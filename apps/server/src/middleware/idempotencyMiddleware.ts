/**
 * Idempotency for retried POST and PUT requests. A request carrying an
 * Idempotency-Key header from an authenticated user claims the key with its
 * fingerprint (method, path, body hash) before the handler runs. A retry of a
 * completed request is replayed without running the handler, a retry while the
 * first is still running answers 409, and a reused key on a different request
 * answers 422. A response of 500 or above, a request timeout (408), or a
 * dropped connection releases the claim so the next retry runs again. The
 * claim is settled before a JSON response is sent, so a client retrying the
 * moment it receives the answer always finds the settled row. Other requests
 * pass through untouched.
 */
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import { IDEMPOTENCY_KEY_MAX_LENGTH } from 'app/constants/idempotencyConstants.js';
import type {
  IdempotencyRepo,
  StoredIdempotencyKey,
} from 'app/repositories/idempotencyRepository.js';
import { hashToken } from 'app/services/hashService.js';
import { logger } from 'app/services/loggerService.js';
import type { NextFunction, Request, Response } from 'express';

const REPLAYABLE_METHODS = ['POST', 'PUT'];

interface RequestFingerprint {
  requestBodyHash: string;
  requestMethod: string;
  requestPath: string;
}

interface ClaimOwner {
  idempotencyRepo: IdempotencyRepo;
  key: string;
  requestId: string | undefined;
  userId: string;
}

function buildRequestFingerprint(req: Request): RequestFingerprint {
  return {
    requestBodyHash: hashToken(JSON.stringify(req.body ?? {})),
    requestMethod: req.method,
    requestPath: req.originalUrl,
  };
}

// A field stored before fingerprints existed (null) matches any request, so
// completed rows from before the migration still replay.
function isSameRequest(
  stored: StoredIdempotencyKey,
  fingerprint: RequestFingerprint,
): boolean {
  const { requestBodyHash, requestMethod, requestPath } = stored;
  return (
    (requestMethod === null || requestMethod === fingerprint.requestMethod) &&
    (requestPath === null || requestPath === fingerprint.requestPath) &&
    (requestBodyHash === null ||
      requestBodyHash === fingerprint.requestBodyHash)
  );
}

// A request timeout is transient like a 5xx: retrying may well succeed.
function isFailedStatus(statusCode: number): boolean {
  return (
    statusCode >= HTTP.STATUS.INTERNAL_SERVER_ERROR ||
    statusCode === HTTP.STATUS.REQUEST_TIMEOUT
  );
}

// Records whether the connection closes before the response finishes, from
// before the claim is written, so a client that left while the claim was
// being written is detected once the claim resolves. req.destroyed cannot be
// used: Node destroys the request stream as soon as its body has been read.
function trackClientDisconnect(res: Response): () => boolean {
  let isClientGone = false;
  res.once('close', () => {
    isClientGone = !res.writableFinished;
  });
  return () => isClientGone;
}

function sendKeyTooLong(res: Response): void {
  res
    .status(HTTP.STATUS.BAD_REQUEST)
    .json(
      createErrorResponse(
        ERROR_CODES.INPUT.VALIDATION_ERROR,
        `Idempotency-Key must be at most ${String(IDEMPOTENCY_KEY_MAX_LENGTH)} characters`,
      ),
    );
}

function sendKeyReused(res: Response): void {
  res
    .status(HTTP.STATUS.UNPROCESSABLE_ENTITY)
    .json(
      createErrorResponse(
        ERROR_CODES.IDEMPOTENCY.KEY_REUSED,
        'Idempotency-Key was already used for a different request',
      ),
    );
}

function sendRequestInProgress(res: Response): void {
  res
    .status(HTTP.STATUS.CONFLICT)
    .json(
      createErrorResponse(
        ERROR_CODES.IDEMPOTENCY.REQUEST_IN_PROGRESS,
        'A request with this Idempotency-Key is still in progress',
      ),
    );
}

// A 204 carries no body by definition; any other status replays the stored
// JSON, including a JSON null.
function sendStoredResponse(res: Response, stored: StoredIdempotencyKey): void {
  const { responseBody, statusCode } = stored;
  const replayStatus = statusCode ?? HTTP.STATUS.OK;
  res.status(replayStatus);
  if (replayStatus === HTTP.STATUS.NO_CONTENT || responseBody === undefined) {
    res.end();
    return;
  }
  res.json(responseBody);
}

// Answers a request whose key is held by a live row: a different request is
// rejected, a running one is told to wait, and a completed one is replayed.
function answerFromHeldKey(
  res: Response,
  stored: StoredIdempotencyKey,
  fingerprint: RequestFingerprint,
): void {
  if (!isSameRequest(stored, fingerprint)) {
    sendKeyReused(res);
    return;
  }
  if (stored.status === 'in_progress') {
    sendRequestInProgress(res);
    return;
  }
  sendStoredResponse(res, stored);
}

function logSettleFailure(
  err: unknown,
  owner: ClaimOwner,
  statusCode: number,
): void {
  const { key, requestId, userId } = owner;
  logger.error(
    { err, idempotencyKey: key, reqId: requestId, statusCode, userId },
    'Failed to settle idempotency claim',
  );
}

async function releaseClaim(
  owner: ClaimOwner,
  statusCode: number,
): Promise<void> {
  const { idempotencyRepo, key, userId } = owner;
  try {
    await idempotencyRepo.releaseKey(key, userId);
  } catch (err) {
    logSettleFailure(err, owner, statusCode);
  }
}

// Completes the claim with the response; when storing it fails, releases the
// claim instead so the key does not stay in_progress with no recovery.
async function completeClaim(
  owner: ClaimOwner,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  const { idempotencyRepo, key, userId } = owner;
  try {
    await idempotencyRepo.completeKey(key, userId, statusCode, responseBody);
  } catch (err) {
    logSettleFailure(err, owner, statusCode);
    await releaseClaim(owner, statusCode);
  }
}

function settleClaim(
  owner: ClaimOwner,
  statusCode: number,
  responseBody: unknown,
  isFinished: boolean,
): Promise<void> {
  return !isFinished || isFailedStatus(statusCode)
    ? releaseClaim(owner, statusCode)
    : completeClaim(owner, statusCode, responseBody);
}

// Settles the claim exactly once. A JSON response is held until the claim is
// settled, then sent; any other response (res.end, a 204) settles when it
// finishes, and a connection closed before finishing releases the claim.
function settleClaimOnResponse(res: Response, owner: ClaimOwner): void {
  let isSettled = false;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (isSettled) {
      return originalJson(body);
    }
    isSettled = true;
    void settleClaim(owner, res.statusCode, body, true).then(() => {
      if (!res.headersSent && !res.destroyed) {
        originalJson(body);
      }
    });
    return res;
  };
  function settleOnce(isFinished: boolean): void {
    if (isSettled) {
      return;
    }
    isSettled = true;
    void settleClaim(owner, res.statusCode, null, isFinished);
  }
  res.on('finish', () => {
    settleOnce(true);
  });
  res.on('close', () => {
    settleOnce(res.writableFinished);
  });
}

// Claims the key, retrying once when the row holding it vanished between the
// failed claim and the read (a failing request released it). Returns the row
// that holds the key when this request did not claim it.
async function claimOrFindKey(
  idempotencyRepo: IdempotencyRepo,
  claimInput: Parameters<IdempotencyRepo['claimKey']>[0],
): Promise<StoredIdempotencyKey | 'claimed' | null> {
  const { key, userId } = claimInput;
  if (await idempotencyRepo.claimKey(claimInput)) {
    return 'claimed';
  }
  const stored = await idempotencyRepo.findKey(key, userId);
  if (stored !== null) {
    return stored;
  }
  return (await idempotencyRepo.claimKey(claimInput)) ? 'claimed' : null;
}

function createIdempotencyMiddleware(idempotencyRepo: IdempotencyRepo) {
  return async function idempotency(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const key = req.headers['idempotency-key'];
    if (
      typeof key !== 'string' ||
      !REPLAYABLE_METHODS.includes(req.method) ||
      !req.user
    ) {
      next();
      return;
    }
    if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      sendKeyTooLong(res);
      return;
    }

    const owner: ClaimOwner = {
      idempotencyRepo,
      key,
      requestId: typeof req.id === 'string' ? req.id : undefined,
      userId: req.user.id,
    };
    const fingerprint = buildRequestFingerprint(req);
    const hasClientLeft = trackClientDisconnect(res);
    let claim: StoredIdempotencyKey | 'claimed' | null;
    try {
      claim = await claimOrFindKey(idempotencyRepo, {
        key,
        userId: owner.userId,
        ...fingerprint,
      });
    } catch (err) {
      next(err);
      return;
    }

    if (claim === null) {
      sendRequestInProgress(res);
      return;
    }
    if (claim !== 'claimed') {
      answerFromHeldKey(res, claim, fingerprint);
      return;
    }
    if (hasClientLeft()) {
      await releaseClaim(owner, HTTP.STATUS.REQUEST_TIMEOUT);
      return;
    }
    settleClaimOnResponse(res, owner);
    next();
  };
}

export { createIdempotencyMiddleware };
