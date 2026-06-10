import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import {
  authRateLimiter,
  rateLimiter,
} from 'app/middleware/rateLimiterMiddleware.js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

function buildApp(limiter: ReturnType<typeof rateLimit>) {
  const app = express();
  app.use(limiter);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('is skipped under NODE_ENV=test so standard rate-limit headers are absent', async () => {
    // The limiter uses skip: () => isTest. Skipped requests do not get headers.
    const app = buildApp(rateLimiter);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });

  it('does not set legacy X-RateLimit headers', async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get('/test');
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('does not throttle requests in NODE_ENV=test (no 429 after exceeding limit)', async () => {
    // NODE_ENV is 'test' during vitest runs. The rateLimiter skips under test
    // so hammering the endpoint must never return 429.
    const app = buildApp(rateLimiter);

    const responses = await Promise.all(
      Array.from({ length: 110 }, () => request(app).get('/test')),
    );

    const throttled = responses.filter((r) => r.status === 429);
    expect(throttled).toHaveLength(0);
  });
});

describe('authRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(authRateLimiter);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('does not block requests under NODE_ENV=test (skip path)', async () => {
    // The limiter uses skip: () => isTest. Under test, no throttling occurs.
    const app = buildApp(authRateLimiter);

    for (let i = 0; i < 10; i++) {
      await request(app).get('/test');
    }

    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(200);
  });
});

describe('throttling enforcement (non-skip path)', () => {
  it('returns 429 after the limit is exceeded when skip is false', async () => {
    // Build a fresh limiter with skip: () => false to exercise the real enforcement path.
    // max: 2 means the 3rd request must be rejected with 429.
    const strictLimiter = rateLimit({
      max: 2,
      skip: () => false,
      standardHeaders: true,
      windowMs: 60_000,
    });

    const app = buildApp(strictLimiter);

    const first = await request(app).get('/test');
    expect(first.status).toBe(200);

    const second = await request(app).get('/test');
    expect(second.status).toBe(200);

    const third = await request(app).get('/test');
    expect(third.status).toBe(429);
  });

  it('returns the { code, error } envelope on the 429 response', async () => {
    // Mirrors the message the shipped limiters carry so the throttled body is
    // verified against the shared error contract.
    const strictLimiter = rateLimit({
      max: 1,
      message: createErrorResponse(
        ERROR_CODES.RATE_LIMIT.EXCEEDED,
        'Too many requests, please try again later.',
      ),
      skip: () => false,
      standardHeaders: true,
      windowMs: 60_000,
    });

    const app = buildApp(strictLimiter);

    await request(app).get('/test');
    const blocked = await request(app).get('/test');

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blocked.body.error).toBe(
      'Too many requests, please try again later.',
    );
  });
});
