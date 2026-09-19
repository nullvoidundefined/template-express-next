import { type Server, createServer } from 'node:http';

import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The mocked envConfig reads isTest from this state on every access, so one
// file proves the shipped limiters both with the test skip on and with it off.
const envState = vi.hoisted(() => ({ isTest: true }));

vi.mock('app/config/envConfig.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    get isTest() {
      return envState.isTest;
    },
  };
});

// Redis is an external boundary: with REDIS_URL set in the shell, limiters
// would share persistent counters in a real Redis and make reruns flaky.
vi.mock('app/clients/redisClient.js', () => ({
  redis: null,
  redisHealthCheck: () => Promise.resolve(false),
  redisRateLimiter: null,
}));

const THROTTLED_BODY = {
  code: 'RATE_LIMIT_EXCEEDED',
  error: 'Too many requests, please try again later.',
};

let server: Server | undefined;

// Reloads the middleware so each test gets freshly constructed shipped
// limiters (with empty in-memory counters) under the requested isTest flag.
async function loadRateLimiterModule({ isTest }: { isTest: boolean }) {
  envState.isTest = isTest;
  vi.resetModules();
  return import('app/middleware/rateLimiterMiddleware.js');
}

async function startServer(app: express.Express): Promise<Server> {
  const listeningServer = createServer(app);
  server = listeningServer;
  await new Promise<void>((resolve, reject) => {
    listeningServer.once('error', reject);
    listeningServer.listen(0, '127.0.0.1', () => {
      listeningServer.removeListener('error', reject);
      resolve();
    });
  });
  return listeningServer;
}

async function startLimitedServer(
  limiter: express.RequestHandler,
): Promise<Server> {
  const app = express();
  app.use(limiter);
  app.get('/', (_req, res) => res.sendStatus(200));
  return startServer(app);
}

afterEach(async () => {
  const listeningServer = server;
  server = undefined;
  if (!listeningServer?.listening) return;
  await new Promise<void>((resolve, reject) => {
    listeningServer.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

describe('rate limiter middleware', () => {
  it('allows two requests and throttles the third at the configured limit', async () => {
    const { createRateLimiter } = await loadRateLimiterModule({
      isTest: true,
    });
    const listeningServer = await startLimitedServer(
      createRateLimiter({ max: 2, prefix: 'test', shouldSkip: () => false }),
    );

    for (const expectedStatus of [200, 200, 429]) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(expectedStatus);
    }
  });

  it('returns the shipped error envelope when throttled', async () => {
    const { createRateLimiter } = await loadRateLimiterModule({
      isTest: true,
    });
    const listeningServer = await startLimitedServer(
      createRateLimiter({ max: 1, prefix: 'test', shouldSkip: () => false }),
    );

    await request(listeningServer).get('/').expect(200);
    const response = await request(listeningServer).get('/');

    expect(response.status).toBe(429);
    expect(response.body).toEqual(THROTTLED_BODY);
  });

  it('counts down standard headers without exposing legacy headers', async () => {
    const { createRateLimiter } = await loadRateLimiterModule({
      isTest: true,
    });
    const listeningServer = await startLimitedServer(
      createRateLimiter({ max: 2, prefix: 'test', shouldSkip: () => false }),
    );

    for (const [index, remaining] of ['1', '0', '0'].entries()) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(index < 2 ? 200 : 429);
      expect(response.headers['ratelimit-limit']).toBe('2');
      expect(response.headers['ratelimit-remaining']).toBe(remaining);
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
      expect(response.headers['x-ratelimit-reset']).toBeUndefined();
    }
  });

  it('keeps counters independent for separate factory calls', async () => {
    const { createRateLimiter } = await loadRateLimiterModule({
      isTest: true,
    });
    const app = express();
    const firstLimiter = createRateLimiter({
      max: 1,
      prefix: 'test',
      shouldSkip: () => false,
    });
    const secondLimiter = createRateLimiter({
      max: 1,
      prefix: 'test',
      shouldSkip: () => false,
    });
    app.get('/first', firstLimiter, (_req, res) => res.sendStatus(200));
    app.get('/second', secondLimiter, (_req, res) => res.sendStatus(200));
    const listeningServer = await startServer(app);

    await request(listeningServer).get('/first').expect(200);
    await request(listeningServer).get('/first').expect(429);
    await request(listeningServer).get('/second').expect(200);
    await request(listeningServer).get('/second').expect(429);
  });

  it('skips the shipped global limiter under NODE_ENV=test', async () => {
    const { GLOBAL_RATE_LIMIT_MAX, rateLimiter } = await loadRateLimiterModule({
      isTest: true,
    });
    expect(GLOBAL_RATE_LIMIT_MAX).toBe(100);
    const listeningServer = await startLimitedServer(rateLimiter);

    for (let count = 0; count < GLOBAL_RATE_LIMIT_MAX + 1; count += 1) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    }
  });

  it('skips the shipped auth limiter under NODE_ENV=test', async () => {
    const { AUTH_RATE_LIMIT_MAX, authRateLimiter } =
      await loadRateLimiterModule({ isTest: true });
    expect(AUTH_RATE_LIMIT_MAX).toBe(10);
    const listeningServer = await startLimitedServer(authRateLimiter);

    for (let count = 0; count < AUTH_RATE_LIMIT_MAX + 1; count += 1) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    }
  });

  it('defaults to skipping factory limiters under NODE_ENV=test', async () => {
    const { createRateLimiter } = await loadRateLimiterModule({
      isTest: true,
    });
    const listeningServer = await startLimitedServer(
      createRateLimiter({ max: 1, prefix: 'test' }),
    );

    for (let count = 0; count < 2; count += 1) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    }
  });

  it('throttles the shipped global limiter at 100 per 900 seconds when the test skip is off', async () => {
    const { rateLimiter } = await loadRateLimiterModule({ isTest: false });
    const listeningServer = await startLimitedServer(rateLimiter);

    for (let count = 1; count <= 100; count += 1) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-policy']).toBe('100;w=900');
      expect(response.headers['ratelimit-limit']).toBe('100');
      expect(response.headers['ratelimit-remaining']).toBe(String(100 - count));
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
      expect(response.headers['x-ratelimit-reset']).toBeUndefined();
    }
    const response = await request(listeningServer).get('/');

    expect(response.status).toBe(429);
    expect(response.body).toEqual(THROTTLED_BODY);
    expect(response.headers['ratelimit-policy']).toBe('100;w=900');
    expect(response.headers['ratelimit-remaining']).toBe('0');
  });

  it('throttles the shipped auth limiter at 10 per 900 seconds when the test skip is off', async () => {
    const { authRateLimiter } = await loadRateLimiterModule({ isTest: false });
    const listeningServer = await startLimitedServer(authRateLimiter);

    for (let count = 1; count <= 10; count += 1) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-policy']).toBe('10;w=900');
      expect(response.headers['ratelimit-limit']).toBe('10');
      expect(response.headers['ratelimit-remaining']).toBe(String(10 - count));
    }
    const response = await request(listeningServer).get('/');

    expect(response.status).toBe(429);
    expect(response.body).toEqual(THROTTLED_BODY);
    expect(response.headers['ratelimit-policy']).toBe('10;w=900');
  });

  it('keeps the shipped global and auth counters separate when the test skip is off', async () => {
    const { authRateLimiter, rateLimiter } = await loadRateLimiterModule({
      isTest: false,
    });
    const app = express();
    app.get('/auth', authRateLimiter, (_req, res) => res.sendStatus(200));
    app.get('/global', rateLimiter, (_req, res) => res.sendStatus(200));
    const listeningServer = await startServer(app);

    for (let count = 1; count <= 10; count += 1) {
      await request(listeningServer).get('/auth').expect(200);
    }
    await request(listeningServer).get('/auth').expect(429);
    const response = await request(listeningServer).get('/global');

    expect(response.status).toBe(200);
    expect(response.headers['ratelimit-remaining']).toBe('99');
  });
});
