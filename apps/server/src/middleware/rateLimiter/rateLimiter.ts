import { redisRateLimiter } from 'app/services/redis.js';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

function getStore(prefix: string): RedisStore | undefined {
  if (!redisRateLimiter) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) =>
      redisRateLimiter!.call(...(args as [string, ...string[]])) as never,
  });
}

export const rateLimiter = rateLimit({
  store: getStore('global'),
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Stricter limit for auth routes to resist credential stuffing. */
export const authRateLimiter = rateLimit({
  store: getStore('auth'),
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
