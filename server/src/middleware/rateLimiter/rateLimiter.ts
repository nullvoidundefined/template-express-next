import rateLimit from "express-rate-limit";

import { isProduction } from "app/config/env.js";

if (isProduction() && !process.env.RATE_LIMIT_STORAGE_URI) {
  console.warn(
    "WARNING: rate limiter is using in-memory storage in production. " +
      "Set RATE_LIMIT_STORAGE_URI for a persistent store.",
  );
}

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Stricter limit for auth routes to resist credential stuffing. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
