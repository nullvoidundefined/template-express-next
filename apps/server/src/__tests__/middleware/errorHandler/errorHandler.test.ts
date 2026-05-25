import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn() },
}));

// Use vi.hoisted so mockEnv is available inside the vi.mock factory (which is hoisted to top of file).
const mockEnv = vi.hoisted(() => ({ NODE_ENV: 'development' as string }));
vi.mock('app/config/env.js', () => ({
  env: mockEnv,
  isDev: true,
  isProd: false,
  isStaging: false,
  isProduction: () => mockEnv.NODE_ENV === 'production',
  isDeployed: () =>
    mockEnv.NODE_ENV === 'production' || mockEnv.NODE_ENV === 'staging',
}));

const app = express();
app.get('/boom', (_req: Request, _res: Response, next: NextFunction) => {
  next(new Error('kaboom'));
});
app.get(
  '/status-error',
  (_req: Request, _res: Response, next: NextFunction) => {
    const err = Object.assign(new Error('not found'), { status: 404 });
    next(err);
  },
);
app.get(
  '/status-code-error',
  (_req: Request, _res: Response, next: NextFunction) => {
    const err = Object.assign(new Error('bad request'), { statusCode: 400 });
    next(err);
  },
);
app.use(errorHandler);

describe('errorHandler', () => {
  afterEach(() => {
    mockEnv.NODE_ENV = 'development';
  });

  it('returns 500 with error detail in non-production', async () => {
    mockEnv.NODE_ENV = 'development';
    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error.message).toContain('kaboom');
  });

  it('hides error detail in production for 500 errors', async () => {
    mockEnv.NODE_ENV = 'production';
    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
  });

  it('respects err.status when present', async () => {
    mockEnv.NODE_ENV = 'development';
    const res = await request(app).get('/status-error');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('not found');
  });

  it('respects err.statusCode when present', async () => {
    mockEnv.NODE_ENV = 'development';
    const res = await request(app).get('/status-code-error');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('bad request');
  });

  it('shows error message for non-500 errors even in production', async () => {
    mockEnv.NODE_ENV = 'production';
    const res = await request(app).get('/status-error');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('not found');
  });
});
