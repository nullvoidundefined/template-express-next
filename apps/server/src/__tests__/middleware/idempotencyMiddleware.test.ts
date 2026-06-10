import { uuid } from 'app/__tests__/helpers/uuids.js';
import { createIdempotencyMiddleware } from 'app/middleware/idempotencyMiddleware.js';
import type { IdempotencyRepo } from 'app/repositories/idempotencyRepository.js';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRepo = {
  findByKey: vi.fn(),
  store: vi.fn(),
};

const userId = uuid();

// Builds an app that optionally injects a user, then mounts the middleware and
// a handler that returns 201. The handler counts its own invocations.
function buildApp(withUser: boolean) {
  const handler = vi.fn((_req: express.Request, res: express.Response) => {
    res.status(201).json({ data: 'created' });
  });
  const app = express();
  app.use(express.json());
  if (withUser) {
    app.use((req, _res, next) => {
      req.user = {
        created_at: new Date('2025-01-01'),
        email: 'user@example.com',
        id: userId,
        role: 'user',
        updated_at: null,
      };
      next();
    });
  }
  app.use(createIdempotencyMiddleware(mockRepo as unknown as IdempotencyRepo));
  app.post('/r', handler);
  app.get('/r', handler);
  return { app, handler };
}

describe('idempotency middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.store.mockResolvedValue(undefined);
  });

  it('replays the stored response without invoking the handler', async () => {
    mockRepo.findByKey.mockResolvedValueOnce({
      response_body: { data: 'replayed' },
      status_code: 201,
    });
    const { app, handler } = buildApp(true);

    const res = await request(app).post('/r').set('Idempotency-Key', 'k1');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: 'replayed' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('runs the handler and stores the response on first use of a key', async () => {
    mockRepo.findByKey.mockResolvedValueOnce(null);
    const { app, handler } = buildApp(true);

    const res = await request(app).post('/r').set('Idempotency-Key', 'k1');

    expect(res.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockRepo.store).toHaveBeenCalledWith('k1', userId, 201, {
      data: 'created',
    });
  });

  it('passes through when no Idempotency-Key header is present', async () => {
    const { app, handler } = buildApp(true);

    const res = await request(app).post('/r');

    expect(res.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockRepo.findByKey).not.toHaveBeenCalled();
  });

  it('passes through GET requests even with a key', async () => {
    const { app, handler } = buildApp(true);

    await request(app).get('/r').set('Idempotency-Key', 'k1');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockRepo.findByKey).not.toHaveBeenCalled();
  });

  it('passes through when the request is unauthenticated', async () => {
    const { app, handler } = buildApp(false);

    await request(app).post('/r').set('Idempotency-Key', 'k1');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockRepo.findByKey).not.toHaveBeenCalled();
  });
});
