import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  legacyHeaders: false,
  limit: 100,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000,
});

/** Stricter limit for auth routes to resist credential stuffing. */
export const authRateLimiter = rateLimit({
  legacyHeaders: false,
  limit: 10,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000,
});

/** Per-email rate limit for forgot-password: 3 requests per email per hour. */
export const forgotPasswordRateLimiter = rateLimit({
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown };
    return typeof body.email === 'string'
      ? body.email.toLowerCase()
      : (req.ip ?? 'unknown');
  },
  legacyHeaders: false,
  limit: 3,
  standardHeaders: true,
  windowMs: 60 * 60 * 1000,
});
