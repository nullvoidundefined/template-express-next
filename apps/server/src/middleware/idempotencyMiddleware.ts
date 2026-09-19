/**
 * Idempotency for retried POST and PUT requests. A request carrying an
 * Idempotency-Key header from an authenticated user claims the key with its
 * fingerprint (method, path, body hash) before the handler runs. A retry of a
 * completed request is replayed without running the handler, a retry while the
 * first is still running answers 409, and a reused key on a different request
 * answers 422. A response of 500 or above releases the claim so the next retry
 * runs again. Other requests pass through untouched.
 */
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
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

function sendStoredResponse(res: Response, stored: StoredIdempotencyKey): void {
  const { responseBody, statusCode } = stored;
  res.status(statusCode ?? HTTP.STATUS.OK);
  if (responseBody === null || responseBody === undefined) {
    res.end();
    return;
  }
  res.json(responseBody);
}

// Answers a request whose key is already held: a different request is
// rejected, a running one is told to wait, and a completed one is replayed. A
// row that vanished between the claim and this read was released by a failing
// request, so the client is told to retry.
function answerFromHeldKey(
  res: Response,
  stored: StoredIdempotencyKey | null,
  fingerprint: RequestFingerprint,
): void {
  if (stored === null) {
    sendRequestInProgress(res);
    return;
  }
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

interface ClaimSettlement {
  idempotencyRepo: IdempotencyRepo;
  isFinished: boolean;
  key: string;
  responseBody: unknown;
  statusCode: number;
  userId: string;
}

// Completes the claim with the stored response below 500; releases it at 500
// or above, or when the connection closed before the response finished.
function settleIdempotencyClaim({
  idempotencyRepo,
  isFinished,
  key,
  responseBody,
  statusCode,
  userId,
}: ClaimSettlement): void {
  const isFailure =
    !isFinished || statusCode >= HTTP.STATUS.INTERNAL_SERVER_ERROR;
  const write = isFailure
    ? idempotencyRepo.releaseKey(key, userId)
    : idempotencyRepo.completeKey(key, userId, statusCode, responseBody);
  write.catch((err: unknown) => {
    logger.error(
      { err, isFailure, statusCode },
      'Failed to settle idempotency claim',
    );
  });
}

// Records the JSON body the handler sends, then settles the claim exactly
// once, when the response finishes or the connection closes.
function settleClaimOnResponse(
  res: Response,
  idempotencyRepo: IdempotencyRepo,
  key: string,
  userId: string,
): void {
  let responseBody: unknown = null;
  let isSettled = false;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };
  function settleOnce(isFinished: boolean): void {
    if (isSettled) {
      return;
    }
    isSettled = true;
    const { statusCode } = res;
    settleIdempotencyClaim({
      idempotencyRepo,
      isFinished,
      key,
      responseBody,
      statusCode,
      userId,
    });
  }
  res.on('finish', () => {
    settleOnce(true);
  });
  res.on('close', () => {
    settleOnce(res.writableFinished);
  });
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

    const userId = req.user.id;
    const fingerprint = buildRequestFingerprint(req);
    try {
      const isClaimed = await idempotencyRepo.claimKey({
        key,
        userId,
        ...fingerprint,
      });
      if (!isClaimed) {
        const stored = await idempotencyRepo.findKey(key, userId);
        answerFromHeldKey(res, stored, fingerprint);
        return;
      }
    } catch (err) {
      next(err);
      return;
    }

    settleClaimOnResponse(res, idempotencyRepo, key, userId);
    next();
  };
}

export { createIdempotencyMiddleware };
