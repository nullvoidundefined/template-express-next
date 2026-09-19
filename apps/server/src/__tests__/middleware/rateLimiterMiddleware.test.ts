import {
  AUTH_RATE_LIMIT_MAX,
  GLOBAL_RATE_LIMIT_MAX,
  authRateLimiter,
  createRateLimiter,
  rateLimiter,
} from 'app/middleware/rateLimiterMiddleware.js';
import express from 'express';
import { type Server, createServer } from 'node:http';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

let server: Server | undefined;

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
    const app = express();
    app.use(
      createRateLimiter({ max: 2, prefix: 'test', shouldSkip: () => false }),
    );
    app.get('/', (_req, res) => res.sendStatus(200));
    const listeningServer = await startServer(app);

    for (const expectedStatus of [200, 200, 429]) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(expectedStatus);
    }
  });

  it('returns the shipped error envelope when throttled', async () => {
    const app = express();
    app.use(
      createRateLimiter({ max: 1, prefix: 'test', shouldSkip: () => false }),
    );
    app.get('/', (_req, res) => res.sendStatus(200));
    const listeningServer = await startServer(app);

    await request(listeningServer).get('/').expect(200);
    const response = await request(listeningServer).get('/');

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      code: 'RATE_LIMIT_EXCEEDED',
      error: 'Too many requests, please try again later.',
    });
  });

  it('counts down standard headers without exposing legacy headers', async () => {
    const app = express();
    app.use(
      createRateLimiter({ max: 2, prefix: 'test', shouldSkip: () => false }),
    );
    app.get('/', (_req, res) => res.sendStatus(200));
    const listeningServer = await startServer(app);

    for (const [index, remaining] of ['1', '0', '0'].entries()) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(index < 2 ? 200 : 429);
      expect(response.headers['ratelimit-limit']).toBe('2');
      expect(response.headers['ratelimit-remaining']).toBe(remaining);
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    }
  });

  it('keeps counters independent for separate factory calls', async () => {
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
    expect(GLOBAL_RATE_LIMIT_MAX).toBe(100);
    const app = express();
    app.use(rateLimiter);
    app.get('/', (_req, res) => res.sendStatus(200));
    const listeningServer = await startServer(app);

    for (let count = 0; count < GLOBAL_RATE_LIMIT_MAX + 1; count += 1) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    }
  });

  it('skips the shipped auth limiter under NODE_ENV=test', async () => {
    expect(AUTH_RATE_LIMIT_MAX).toBe(10);
    const app = express();
    app.use(authRateLimiter);
    app.get('/', (_req, res) => res.sendStatus(200));
    const listeningServer = await startServer(app);

    for (let count = 0; count < AUTH_RATE_LIMIT_MAX + 1; count += 1) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(200);
    }
  });

  it('defaults to skipping factory limiters under NODE_ENV=test', async () => {
    const app = express();
    app.use(createRateLimiter({ max: 1, prefix: 'test' }));
    app.get('/', (_req, res) => res.sendStatus(200));
    const listeningServer = await startServer(app);

    for (let count = 0; count < 2; count += 1) {
      const response = await request(listeningServer).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    }
  });
});
