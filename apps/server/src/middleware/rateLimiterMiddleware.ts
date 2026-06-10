import { redisRateLimiter } from 'app/clients/redisClient.js';
import { isTest } from 'app/config/envConfig.js';
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { logger } from 'app/services/loggerService.js';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

// Sent as the 429 body so throttled clients get the same { code, error }
// envelope as every other error response.
const rateLimitResponse = createErrorResponse(
  ERROR_CODES.RATE_LIMIT.EXCEEDED,
  'Too many requests, please try again later.',
);

if (!redisRateLimiter) {
  logger.warn(
    { event: 'rate_limiter_in_memory' },
    'Rate limiting uses in-memory storage (REDIS_URL not set). Counters are per-instance, so limits are not enforced across multiple instances. Set REDIS_URL in any multi-instance deployment.',
  );
}

function getStore(prefix: string): RedisStore | undefined {
  if (!redisRateLimiter) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) =>
      redisRateLimiter!.call(...(args as [string, ...string[]])) as never,
  });
}

export const rateLimiter = rateLimit({
  legacyHeaders: false,
  max: 100,
  message: rateLimitResponse,
  skip: () => isTest,
  standardHeaders: true,
  store: getStore('global'),
  windowMs: 15 * 60 * 1000,
});

/** Stricter limit for auth routes to resist credential stuffing. */
export const authRateLimiter = rateLimit({
  legacyHeaders: false,
  max: 10,
  message: rateLimitResponse,
  skip: () => isTest,
  standardHeaders: true,
  store: getStore('auth'),
  windowMs: 15 * 60 * 1000,
});
