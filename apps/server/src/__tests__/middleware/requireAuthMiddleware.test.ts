import { uuid } from 'app/__tests__/helpers/uuids.js';
import { SESSION_COOKIE_NAME } from 'app/constants/sessionConstants.js';
import {
  createLoadSession,
  requireAdmin,
  requireAuth,
} from 'app/middleware/requireAuthMiddleware.js';
import type { User } from 'app/schemas/authSchema.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const id = uuid();

// Inject a fake repo rather than mocking the repository module.
const mockGetSessionWithUser =
  vi.fn<(sessionId: string) => Promise<User | null>>();
const loadSession = createLoadSession({
  getSessionWithUser: mockGetSessionWithUser,
});

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(loadSession);
app.get('/protected', requireAuth, (req, res) => res.json({ user: req.user }));
app.get(
  '/admin-only',
  (req, _res, next) => {
    const role = req.headers['x-test-role'];
    if (role === 'admin' || role === 'user') {
      req.user = {
        id,
        email: 'u@example.com',
        role,
        created_at: new Date('2025-01-01'),
        updated_at: null,
      };
    }
    next();
  },
  requireAdmin,
  (_req, res) => res.json({ ok: true }),
);

describe('requireAuth', () => {
  it('returns 401 when req.user is not set', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
    expect(res.body.error).toBe('Authentication required');
  });
});

describe('requireAdmin', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/admin-only');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 403 when authenticated as a non-admin user', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('x-test-role', 'user');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_ADMIN_REQUIRED');
    expect(res.body.error).toBe('Admin access required');
  });

  it('allows the request through for an admin', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('x-test-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('loadSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next without setting req.user when no cookie', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(mockGetSessionWithUser).not.toHaveBeenCalled();
  });

  it('sets req.user when session valid', async () => {
    const user = {
      id,
      email: 'u@example.com',
      role: 'user' as const,
      created_at: new Date('2025-01-01'),
      updated_at: null,
    };
    mockGetSessionWithUser.mockResolvedValueOnce(user);

    const res = await request(app)
      .get('/protected')
      .set('Cookie', `${SESSION_COOKIE_NAME}=valid-token`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id,
      email: 'u@example.com',
      role: 'user',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: null,
    });
    expect(mockGetSessionWithUser).toHaveBeenCalledWith('valid-token');
  });

  it('does not set req.user when getSessionWithUser returns null', async () => {
    mockGetSessionWithUser.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/protected')
      .set('Cookie', `${SESSION_COOKIE_NAME}=expired-token`);

    expect(res.status).toBe(401);
    expect(mockGetSessionWithUser).toHaveBeenCalledWith('expired-token');
  });

  it('calls next(err) when getSessionWithUser throws', async () => {
    const dbError = new Error('connection refused');
    mockGetSessionWithUser.mockRejectedValueOnce(dbError);

    const res = await request(app)
      .get('/protected')
      .set('Cookie', `${SESSION_COOKIE_NAME}=some-token`);

    expect(res.status).toBe(500);
    expect(mockGetSessionWithUser).toHaveBeenCalledWith('some-token');
  });
});
