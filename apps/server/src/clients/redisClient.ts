import { env } from 'app/config/envConfig.js';
import { logger } from 'app/services/loggerService.js';
import { Redis } from 'ioredis';

let redis: Redis | null = null;
let redisRateLimiter: Redis | null = null;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  redisRateLimiter = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => logger.info('Redis (BullMQ) connected'));
  redis.on('error', (err: Error) =>
    logger.error({ err }, 'Redis (BullMQ) error'),
  );
  redisRateLimiter.on('connect', () =>
    logger.info('Redis (rate-limiter) connected'),
  );
  redisRateLimiter.on('error', (err: Error) =>
    logger.error({ err }, 'Redis (rate-limiter) error'),
  );
} else {
  logger.info('REDIS_URL not set; Redis features disabled');
}

async function redisHealthCheck(): Promise<boolean> {
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export { redis, redisHealthCheck, redisRateLimiter };
