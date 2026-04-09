import { env } from 'app/config/env.js';

export const redisConfig = {
  url: env.REDIS_URL,
};
