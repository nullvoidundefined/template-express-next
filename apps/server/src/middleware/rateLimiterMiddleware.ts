/**
 * Request rate limiting: the global and auth limiters mounted by the app, and
 * the createRateLimiter factory both are built from, which lets tests build a
 * limiter with the shipped configuration and a small limit.
 */
import { redisRateLimiter } from 'app/clients/redisClient.js';
import { isTest } from 'app/config/envConfig.js';
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { logger } from 'app/services/loggerService.js';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

const AUTH_RATE_LIMIT_MAX = 10;
const GLOBAL_RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 900_000; // 15 minutes

// Sent as the 429 body so throttled clients get the same { code, error }
// envelope as every other error response.
const rateLimitResponse = createErrorResponse(
  ERROR_CODES.RATE_LIMIT.EXCEEDED,
  'Too many requests, please try again later.',
);

interface RateLimiterOptions {
  max: number;
  prefix: string;
  shouldSkip?: () => boolean;
}

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

/**
 * Builds a limiter with the shipped configuration. Skips under NODE_ENV=test
 * by default so route tests are not throttled; tests that prove the limit
 * pass `shouldSkip: () => false` and a small `max`.
 */
function createRateLimiter({
  max,
  prefix,
  shouldSkip = () => isTest,
}: RateLimiterOptions) {
  return rateLimit({
    legacyHeaders: false,
    max,
    message: rateLimitResponse,
    skip: shouldSkip,
    standardHeaders: true,
    store: getStore(prefix),
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
}

const rateLimiter = createRateLimiter({
  max: GLOBAL_RATE_LIMIT_MAX,
  prefix: 'global',
});

/** Stricter limit for auth routes to resist credential stuffing. */
const authRateLimiter = createRateLimiter({
  max: AUTH_RATE_LIMIT_MAX,
  prefix: 'auth',
});

export {
  AUTH_RATE_LIMIT_MAX,
  GLOBAL_RATE_LIMIT_MAX,
  authRateLimiter,
  createRateLimiter,
  rateLimiter,
};
