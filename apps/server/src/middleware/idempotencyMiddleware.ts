import type { IdempotencyRepo } from 'app/repositories/idempotencyRepository.js';
import { logger } from 'app/services/loggerService.js';
import type { NextFunction, Request, Response } from 'express';

const REPLAYABLE_METHODS = ['POST', 'PUT'];

/**
 * Builds idempotency middleware bound to the repo. On a POST/PUT carrying an
 * `Idempotency-Key` header from an authenticated user, replays the stored
 * response if the key was seen within the TTL window; otherwise captures the
 * response (via res.json) and stores it for future replays. GET/DELETE,
 * keyless requests, and unauthenticated requests pass through untouched.
 */
function createIdempotencyMiddleware(idempotencyRepo: IdempotencyRepo) {
  return async function idempotency(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const key = req.headers['idempotency-key'];

    if (typeof key !== 'string' || !REPLAYABLE_METHODS.includes(req.method)) {
      next();
      return;
    }

    // requireAuth runs before this on protected routes, so a missing user means
    // a public route: skip silently rather than erroring.
    if (!req.user) {
      next();
      return;
    }

    const userId = req.user.id;
    const existing = await idempotencyRepo.findByKey(key, userId);
    if (existing) {
      res.status(existing.status_code).json(existing.response_body);
      return;
    }

    // Intercept res.json to capture the response body before it is sent.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      void idempotencyRepo
        .store(key, userId, res.statusCode, body)
        .catch((err: unknown) => {
          // A storage failure must not break the response.
          logger.error({ err }, 'Failed to store idempotency key');
        });
      return originalJson(body);
    };

    next();
  };
}

export { createIdempotencyMiddleware };
