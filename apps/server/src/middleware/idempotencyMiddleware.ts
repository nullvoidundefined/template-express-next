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

// Typed with an unknown body so the parsed JSON is never read as any.
function buildRequestFingerprint(
  req: Request<unknown, unknown, unknown>,
): RequestFingerprint {
  const { body, method, originalUrl } = req;
  return {
    requestBodyHash: hashToken(JSON.stringify(body ?? {})),
    requestMethod: method,
    requestPath: originalUrl,
  };
}

// A field stored before fingerprints existed (null) matches any request, so
// completed rows from before the migration still replay.
function isSameRequest(
  stored: StoredIdempotencyKey,
  fingerprint: RequestFingerprint,
): boolean {
  const { requestBodyHash, requestMethod, requestPath } = stored;
  const {
    requestBodyHash: bodyHash,
    requestMethod: method,
    requestPath: path,
  } = fingerprint;
  return (
    (requestMethod === null || requestMethod === method) &&
    (requestPath === null || requestPath === path) &&
    (requestBodyHash === null || requestBodyHash === bodyHash)
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

// A response sent with a JSON body (a JSON null included) replays that body;
// one sent without a JSON body replays its status with an empty body.
function sendStoredResponse(res: Response, stored: StoredIdempotencyKey): void {
  const { hasJsonBody, responseBody, statusCode } = stored;
  res.status(statusCode ?? HTTP.STATUS.OK);
  if (!hasJsonBody) {
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
  statusCode: number | undefined,
): void {
  const { key, requestId, userId } = owner;
  logger.error(
    { err, idempotencyKey: key, reqId: requestId, statusCode, userId },
    'Failed to settle idempotency claim',
  );
}

// statusCode is undefined when the client left before any response existed.
async function releaseClaim(
  owner: ClaimOwner,
  statusCode: number | undefined,
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
  hasJsonBody: boolean,
): Promise<void> {
  const { idempotencyRepo, key, userId } = owner;
  try {
    await idempotencyRepo.completeKey(
      key,
      userId,
      statusCode,
      responseBody,
      hasJsonBody,
    );
  } catch (err) {
    logSettleFailure(err, owner, statusCode);
    await releaseClaim(owner, statusCode);
  }
}

interface SettledResponse {
  hasJsonBody: boolean;
  isFinished: boolean;
  responseBody: unknown;
  statusCode: number;
}

function settleClaim(
  owner: ClaimOwner,
  { hasJsonBody, isFinished, responseBody, statusCode }: SettledResponse,
): Promise<void> {
  return !isFinished || isFailedStatus(statusCode)
    ? releaseClaim(owner, statusCode)
    : completeClaim(owner, statusCode, responseBody, hasJsonBody);
}

// Settles the claim exactly once, before any response bytes are flushed: the
// first res.json or res.end is held until the claim is settled, then sent, so
// a client retrying the moment it receives the answer finds the settled row. A
// connection closed before the response finished releases the claim.
function settleClaimOnResponse(res: Response, owner: ClaimOwner): void {
  let isSettled = false;
  function holdUntilSettled(
    response: Omit<SettledResponse, 'isFinished' | 'statusCode'>,
    send: () => void,
  ): void {
    isSettled = true;
    const { statusCode } = res;
    void settleClaim(owner, { ...response, isFinished: true, statusCode }).then(
      () => {
        const { destroyed, writableEnded } = res;
        if (!writableEnded && !destroyed) {
          send();
        }
      },
    );
  }
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (isSettled) {
      return originalJson(body);
    }
    holdUntilSettled({ hasJsonBody: true, responseBody: body }, () => {
      originalJson(body);
    });
    return res;
  };
  const originalEnd = res.end.bind(res) as (...args: unknown[]) => Response;
  res.end = ((...args: unknown[]) => {
    if (isSettled) {
      return originalEnd(...args);
    }
    holdUntilSettled({ hasJsonBody: false, responseBody: null }, () => {
      originalEnd(...args);
    });
    return res;
  }) as Response['end'];
  res.on('close', () => {
    if (!isSettled) {
      isSettled = true;
      void releaseClaim(owner, res.statusCode);
    }
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
    const { headers, id, method, user } = req;
    const key = headers['idempotency-key'];
    if (
      typeof key !== 'string' ||
      !REPLAYABLE_METHODS.includes(method) ||
      !user
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
      requestId: typeof id === 'string' ? id : undefined,
      userId: user.id,
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
      await releaseClaim(owner, undefined);
      return;
    }
    settleClaimOnResponse(res, owner);
    next();
  };
}

export { createIdempotencyMiddleware };
