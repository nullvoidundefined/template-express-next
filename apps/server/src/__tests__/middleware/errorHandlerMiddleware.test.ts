import { errorHandler } from 'app/middleware/errorHandlerMiddleware.js';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/loggerService.js', () => ({
  logger: { error: vi.fn() },
}));

// Use vi.hoisted so mockEnv is available inside the vi.mock factory (which is hoisted to top of file).
const mockEnv = vi.hoisted(() => ({ NODE_ENV: 'development' as string }));
vi.mock('app/config/envConfig.js', () => ({
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
app.get(
  '/db-conn-error',
  (_req: Request, _res: Response, next: NextFunction) => {
    next(
      Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      }),
    );
  },
);
app.get('/pg-shutdown', (_req: Request, _res: Response, next: NextFunction) => {
  next(Object.assign(new Error('admin shutdown'), { code: '57P01' }));
});
app.use(errorHandler);

describe('errorHandler', () => {
  afterEach(() => {
    mockEnv.NODE_ENV = 'development';
  });

  it('returns 500 with error detail in non-production', async () => {
    mockEnv.NODE_ENV = 'development';
    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SERVER_INTERNAL_ERROR');
    expect(res.body.error).toContain('kaboom');
  });

  it('hides error detail in production for 500 errors', async () => {
    mockEnv.NODE_ENV = 'production';
    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SERVER_INTERNAL_ERROR');
    expect(res.body.error).toBe('Internal server error');
  });

  it('respects err.status when present', async () => {
    mockEnv.NODE_ENV = 'development';
    const res = await request(app).get('/status-error');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTING_NOT_FOUND');
    expect(res.body.error).toBe('not found');
  });

  it('respects err.statusCode when present', async () => {
    mockEnv.NODE_ENV = 'development';
    const res = await request(app).get('/status-code-error');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INPUT_VALIDATION_ERROR');
    expect(res.body.error).toBe('bad request');
  });

  it('shows error message for non-500 errors even in production', async () => {
    mockEnv.NODE_ENV = 'production';
    const res = await request(app).get('/status-error');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTING_NOT_FOUND');
    expect(res.body.error).toBe('not found');
  });

  it('returns 503 DATABASE_UNAVAILABLE for driver connection errors', async () => {
    mockEnv.NODE_ENV = 'production';
    const res = await request(app).get('/db-conn-error');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVER_DATABASE_UNAVAILABLE');
    expect(res.body.error).toBe('Service temporarily unavailable');
  });

  it('returns 503 DATABASE_UNAVAILABLE for Postgres connection/shutdown codes', async () => {
    mockEnv.NODE_ENV = 'development';
    const res = await request(app).get('/pg-shutdown');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVER_DATABASE_UNAVAILABLE');
    expect(res.body.error).toBe('Service temporarily unavailable');
  });
});
