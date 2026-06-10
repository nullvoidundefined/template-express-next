import { uuid } from 'app/__tests__/helpers/uuids.js';
import { SESSION_COOKIE_NAME } from 'app/constants/sessionConstants.js';
import { createAuthHandlers } from 'app/handlers/authHandler.js';
import { errorHandler } from 'app/middleware/errorHandlerMiddleware.js';
import { requireAuth } from 'app/middleware/requireAuthMiddleware.js';
import { validate } from 'app/middleware/validateMiddleware.js';
import type { AuthRepo } from 'app/repositories/authRepository.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateMeSchema,
} from 'app/schemas/authSchema.js';
import type { User } from 'app/schemas/authSchema.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import http from 'node:http';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Inject fakes rather than mocking modules. The logger self-silences under
// NODE_ENV=test, so it needs no mock.
const mockAuthRepo = {
  authenticate: vi.fn(),
  consumePasswordReset: vi.fn(),
  createPasswordReset: vi.fn(),
  createSession: vi.fn(),
  createUser: vi.fn(),
  createUserAndSession: vi.fn(),
  deleteExpiredSessions: vi.fn(),
  deleteSession: vi.fn(),
  deleteSessionsForUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  getSessionWithUser: vi.fn(),
  loginUser: vi.fn(),
  updateUser: vi.fn(),
  verifyPassword: vi.fn(),
};
const mockSendEmail = vi.fn();
const mockTrackEvent = vi.fn();

const handlers = createAuthHandlers({
  authRepo: mockAuthRepo as unknown as AuthRepo,
  sendPasswordResetEmail: mockSendEmail,
  trackEvent: mockTrackEvent,
});

const id = uuid();
const app = express();
app.use(express.json());
app.use(cookieParser());
app.post('/register', validate(registerSchema), handlers.register);
app.post('/login', validate(loginSchema), handlers.login);
app.post('/logout', handlers.logout);
app.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  handlers.forgotPassword,
);
app.post(
  '/reset-password',
  validate(resetPasswordSchema),
  handlers.resetPassword,
);
app.patch(
  '/me',
  (req, res, next) => {
    if (req.headers['x-test-user'] === '1') {
      req.user = {
        id,
        email: 'user@example.com',
        role: 'user',
        created_at: new Date('2025-01-01'),
        updated_at: null,
      };
    }
    next();
  },
  requireAuth,
  validate(updateMeSchema),
  handlers.updateMe,
);
app.get(
  '/me',
  (req, res, next) => {
    if (req.headers['x-test-user'] === '1') {
      req.user = {
        id,
        email: 'user@example.com',
        role: 'user',
        created_at: new Date('2025-01-01'),
        updated_at: null,
      };
    }
    next();
  },
  requireAuth,
  handlers.me,
);
app.use(errorHandler);

// Supertest v7 requires a listening http.Server because serverAddress() calls
// server.address() which returns null on an Express function (not an http.Server).
let server: http.Server;
beforeAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server = http.createServer(app);
      server.listen(0);
      server.once('listening', resolve);
      server.once('error', reject);
    }),
);
afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
);

const mockUser: User & { password_hash: string } = {
  id,
  email: 'user@example.com',
  role: 'user',
  password_hash: 'hashed',
  created_at: new Date('2025-01-01'),
  updated_at: null,
};

const mockAuthUser: User = {
  id,
  email: 'user@example.com',
  role: 'user',
  created_at: new Date('2025-01-01'),
  updated_at: null,
};

describe('auth handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('returns 400 when body invalid', async () => {
      const res = await request(server).post('/register').send({});
      expect(res.status).toBe(400);
      expect(mockAuthRepo.createUserAndSession).not.toHaveBeenCalled();
    });
    it('returns 201 and sets cookie when created', async () => {
      const created = { ...mockUser };
      vi.mocked(mockAuthRepo.createUserAndSession).mockResolvedValueOnce({
        user: created,
        sessionId: 'session-id',
      });

      const res = await request(server)
        .post('/register')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user).toEqual({
        createdAt: '2025-01-01T00:00:00.000Z',
        email: 'user@example.com',
        id,
        role: 'user',
        updatedAt: null,
      });
      expect(res.headers['set-cookie']).toBeDefined();
      expect(mockAuthRepo.createUserAndSession).toHaveBeenCalledWith(
        'user@example.com',
        'password123',
      );
    });
    it('returns 409 on unique violation (23505)', async () => {
      const err = Object.assign(new Error('duplicate key'), { code: '23505' });
      vi.mocked(mockAuthRepo.createUserAndSession).mockRejectedValueOnce(err);

      const res = await request(server)
        .post('/register')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('AUTH_EMAIL_ALREADY_REGISTERED');
      expect(res.body.error).toBe('Email already registered');
    });
    it('returns 500 on other errors', async () => {
      vi.mocked(mockAuthRepo.createUserAndSession).mockRejectedValueOnce(
        new Error('DB error'),
      );

      const res = await request(server)
        .post('/register')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('SERVER_INTERNAL_ERROR');
      expect(res.body.error).toBeDefined();
    });
  });

  describe('login', () => {
    it('returns 400 when body invalid', async () => {
      const res = await request(server).post('/login').send({});
      expect(res.status).toBe(400);
      expect(mockAuthRepo.authenticate).not.toHaveBeenCalled();
    });
    it('returns 401 when credentials invalid', async () => {
      vi.mocked(mockAuthRepo.authenticate).mockResolvedValueOnce(null);

      const res = await request(server)
        .post('/login')
        .send({ email: 'nobody@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(res.body.error).toBe('Invalid email or password');
    });
    it('returns 200 and sets cookie when valid', async () => {
      vi.mocked(mockAuthRepo.authenticate).mockResolvedValueOnce(mockAuthUser);
      vi.mocked(mockAuthRepo.loginUser).mockResolvedValueOnce('session-id');

      const res = await request(server)
        .post('/login')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        createdAt: '2025-01-01T00:00:00.000Z',
        email: 'user@example.com',
        id,
        role: 'user',
        updatedAt: null,
      });
      expect(res.headers['set-cookie']).toBeDefined();
      expect(mockAuthRepo.authenticate).toHaveBeenCalledWith(
        'user@example.com',
        'password123',
      );
      expect(mockAuthRepo.loginUser).toHaveBeenCalledWith(id);
    });
    it('returns 500 when repo throws', async () => {
      vi.mocked(mockAuthRepo.authenticate).mockRejectedValueOnce(
        new Error('DB error'),
      );

      const res = await request(server)
        .post('/login')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('SERVER_INTERNAL_ERROR');
      expect(res.body.error).toBeDefined();
    });
  });

  describe('logout', () => {
    it('returns 204 and clears cookie with no cookie', async () => {
      const res = await request(server).post('/logout');
      expect(res.status).toBe(204);
      expect(mockAuthRepo.deleteSession).not.toHaveBeenCalled();
    });
    it('returns 204 and deletes session when cookie present', async () => {
      vi.mocked(mockAuthRepo.deleteSession).mockResolvedValueOnce(true);

      const res = await request(server)
        .post('/logout')
        .set('Cookie', `${SESSION_COOKIE_NAME}=abc123`);

      expect(res.status).toBe(204);
      expect(mockAuthRepo.deleteSession).toHaveBeenCalledWith('abc123');
    });
    it('returns 204 even when deleteSession throws', async () => {
      vi.mocked(mockAuthRepo.deleteSession).mockRejectedValueOnce(
        new Error('DB error'),
      );

      const res = await request(server)
        .post('/logout')
        .set('Cookie', `${SESSION_COOKIE_NAME}=abc123`);

      expect(res.status).toBe(204);
    });
  });

  describe('me', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(server).get('/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
      expect(res.body.error).toBe('Authentication required');
    });
    it('returns 200 with user when req.user set', async () => {
      const res = await request(server).get('/me').set('x-test-user', '1');
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        createdAt: '2025-01-01T00:00:00.000Z',
        email: 'user@example.com',
        id,
        role: 'user',
        updatedAt: null,
      });
    });
  });

  describe('resetPassword', () => {
    it('returns 400 when body invalid', async () => {
      const res = await request(server).post('/reset-password').send({});
      expect(res.status).toBe(400);
    });
    it('returns 400 when token invalid or expired', async () => {
      vi.mocked(mockAuthRepo.consumePasswordReset).mockResolvedValueOnce(null);

      const res = await request(server)
        .post('/reset-password')
        .send({ token: 'bad-token', password: 'newpassword123' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('AUTH_INVALID_RESET_TOKEN');
      expect(res.body.error).toBe('Invalid or expired token');
    });
    it('returns 204 on success', async () => {
      vi.mocked(mockAuthRepo.consumePasswordReset).mockResolvedValueOnce(
        mockAuthUser,
      );

      const res = await request(server)
        .post('/reset-password')
        .send({ token: 'valid-token', password: 'newpassword123' });

      expect(res.status).toBe(204);
    });
  });

  describe('updateMe', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(server).patch('/me').send({ name: 'Alice' });
      expect(res.status).toBe(401);
    });
    it('returns 400 when body fails schema refine (newPassword without currentPassword)', async () => {
      const res = await request(server)
        .patch('/me')
        .set('x-test-user', '1')
        .send({ newPassword: 'newpass123' });
      expect(res.status).toBe(400);
    });
    it('returns 400 when currentPassword is wrong', async () => {
      vi.mocked(mockAuthRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
      vi.mocked(mockAuthRepo.verifyPassword).mockResolvedValueOnce(false);

      const res = await request(server)
        .patch('/me')
        .set('x-test-user', '1')
        .send({ currentPassword: 'wrong', newPassword: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(res.body.error).toBe('Current password is incorrect');
    });
    it('returns 200 with updated user when password changed successfully', async () => {
      vi.mocked(mockAuthRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
      vi.mocked(mockAuthRepo.verifyPassword).mockResolvedValueOnce(true);
      vi.mocked(mockAuthRepo.updateUser).mockResolvedValueOnce(mockAuthUser);
      vi.mocked(mockAuthRepo.createSession).mockResolvedValueOnce(
        'fresh-token',
      );

      const res = await request(server)
        .patch('/me')
        .set('x-test-user', '1')
        .send({ currentPassword: 'correct', newPassword: 'newpass123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('revokes all existing sessions and issues a fresh one on password change', async () => {
      vi.mocked(mockAuthRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
      vi.mocked(mockAuthRepo.verifyPassword).mockResolvedValueOnce(true);
      vi.mocked(mockAuthRepo.updateUser).mockResolvedValueOnce(mockAuthUser);
      vi.mocked(mockAuthRepo.createSession).mockResolvedValueOnce(
        'fresh-token',
      );

      const res = await request(server)
        .patch('/me')
        .set('x-test-user', '1')
        .send({ currentPassword: 'correct', newPassword: 'newpass123' });

      expect(mockAuthRepo.deleteSessionsForUser).toHaveBeenCalledWith(id);
      expect(mockAuthRepo.createSession).toHaveBeenCalledWith(id);
      expect(res.headers['set-cookie']?.[0] ?? '').toMatch(/sid=fresh-token/);
    });
  });

  describe('forgotPassword', () => {
    it('returns 400 when body invalid', async () => {
      const res = await request(server).post('/forgot-password').send({});
      expect(res.status).toBe(400);
    });
    it('returns 200 and sends email when user found', async () => {
      vi.mocked(mockAuthRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
      vi.mocked(mockAuthRepo.createPasswordReset).mockResolvedValueOnce(
        undefined,
      );
      vi.mocked(mockSendEmail).mockResolvedValueOnce(undefined);

      const res = await request(server)
        .post('/forgot-password')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(mockSendEmail).toHaveBeenCalledOnce());
    });
    it('returns 200 and does NOT send email when user not found', async () => {
      vi.mocked(mockAuthRepo.findUserByEmail).mockResolvedValueOnce(null);

      const res = await request(server)
        .post('/forgot-password')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(mockSendEmail).not.toHaveBeenCalled());
    });
  });
});
