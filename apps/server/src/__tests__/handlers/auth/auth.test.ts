import { uuid } from 'app/__tests__/helpers/uuids.js';
import { SESSION_COOKIE_NAME } from 'app/constants/session.js';
import * as authHandlers from 'app/handlers/auth/auth.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import type { User } from 'app/schemas/auth.js';
import * as emailService from 'app/services/email/email.js';
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

vi.mock('app/repositories/auth/auth.js');
vi.mock('app/services/analytics/analytics.js', () => ({
  ANALYTICS_EVENTS: {},
  trackEvent: vi.fn(),
}));
vi.mock('app/services/email/email.js', () => ({
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const id = uuid();
const app = express();
app.use(express.json());
app.use(cookieParser());
app.post('/register', authHandlers.register);
app.post('/login', authHandlers.login);
app.post('/logout', authHandlers.logout);
app.post('/forgot-password', authHandlers.forgotPassword);
app.post('/reset-password', authHandlers.resetPassword);
app.patch(
  '/me',
  (req, res, next) => {
    if (req.headers['x-test-user'] === '1') {
      req.user = {
        id,
        email: 'user@example.com',
        created_at: new Date('2025-01-01'),
        updated_at: null,
      };
    }
    next();
  },
  requireAuth,
  authHandlers.updateMe,
);
app.get(
  '/me',
  (req, res, next) => {
    if (req.headers['x-test-user'] === '1') {
      req.user = {
        id,
        email: 'user@example.com',
        created_at: new Date('2025-01-01'),
        updated_at: null,
      };
    }
    next();
  },
  requireAuth,
  authHandlers.me,
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
  password_hash: 'hashed',
  created_at: new Date('2025-01-01'),
  updated_at: null,
};

const mockAuthUser: User = {
  id,
  email: 'user@example.com',
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
      expect(authRepo.createUserAndSession).not.toHaveBeenCalled();
    });
    it('returns 201 and sets cookie when created', async () => {
      const created = { ...mockUser };
      vi.mocked(authRepo.createUserAndSession).mockResolvedValueOnce({
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
        updatedAt: null,
      });
      expect(res.headers['set-cookie']).toBeDefined();
      expect(authRepo.createUserAndSession).toHaveBeenCalledWith(
        'user@example.com',
        'password123',
      );
    });
    it('returns 409 on unique violation (23505)', async () => {
      const err = Object.assign(new Error('duplicate key'), { code: '23505' });
      vi.mocked(authRepo.createUserAndSession).mockRejectedValueOnce(err);

      const res = await request(server)
        .post('/register')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('Email already registered');
    });
    it('returns 500 on other errors', async () => {
      vi.mocked(authRepo.createUserAndSession).mockRejectedValueOnce(
        new Error('DB error'),
      );

      const res = await request(server)
        .post('/register')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.error.message).toBeDefined();
    });
  });

  describe('login', () => {
    it('returns 400 when body invalid', async () => {
      const res = await request(server).post('/login').send({});
      expect(res.status).toBe(400);
      expect(authRepo.authenticate).not.toHaveBeenCalled();
    });
    it('returns 401 when credentials invalid', async () => {
      vi.mocked(authRepo.authenticate).mockResolvedValueOnce(null);

      const res = await request(server)
        .post('/login')
        .send({ email: 'nobody@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });
    it('returns 200 and sets cookie when valid', async () => {
      vi.mocked(authRepo.authenticate).mockResolvedValueOnce(mockAuthUser);
      vi.mocked(authRepo.loginUser).mockResolvedValueOnce('session-id');

      const res = await request(server)
        .post('/login')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        createdAt: '2025-01-01T00:00:00.000Z',
        email: 'user@example.com',
        id,
        updatedAt: null,
      });
      expect(res.headers['set-cookie']).toBeDefined();
      expect(authRepo.authenticate).toHaveBeenCalledWith(
        'user@example.com',
        'password123',
      );
      expect(authRepo.loginUser).toHaveBeenCalledWith(id);
    });
    it('returns 500 when repo throws', async () => {
      vi.mocked(authRepo.authenticate).mockRejectedValueOnce(
        new Error('DB error'),
      );

      const res = await request(server)
        .post('/login')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.error.message).toBeDefined();
    });
  });

  describe('logout', () => {
    it('returns 204 and clears cookie with no cookie', async () => {
      const res = await request(server).post('/logout');
      expect(res.status).toBe(204);
      expect(authRepo.deleteSession).not.toHaveBeenCalled();
    });
    it('returns 204 and deletes session when cookie present', async () => {
      vi.mocked(authRepo.deleteSession).mockResolvedValueOnce(true);

      const res = await request(server)
        .post('/logout')
        .set('Cookie', `${SESSION_COOKIE_NAME}=abc123`);

      expect(res.status).toBe(204);
      expect(authRepo.deleteSession).toHaveBeenCalledWith('abc123');
    });
    it('returns 204 even when deleteSession throws', async () => {
      vi.mocked(authRepo.deleteSession).mockRejectedValueOnce(
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
      expect(res.body.error.message).toBe('Authentication required');
    });
    it('returns 200 with user when req.user set', async () => {
      const res = await request(server).get('/me').set('x-test-user', '1');
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        createdAt: '2025-01-01T00:00:00.000Z',
        email: 'user@example.com',
        id,
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
      vi.mocked(authRepo.consumePasswordReset).mockResolvedValueOnce(null);

      const res = await request(server)
        .post('/reset-password')
        .send({ token: 'bad-token', password: 'newpassword123' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid or expired token');
    });
    it('returns 204 on success', async () => {
      vi.mocked(authRepo.consumePasswordReset).mockResolvedValueOnce(
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
      vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
      vi.mocked(authRepo.verifyPassword).mockResolvedValueOnce(false);

      const res = await request(server)
        .patch('/me')
        .set('x-test-user', '1')
        .send({ currentPassword: 'wrong', newPassword: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Current password is incorrect');
    });
    it('returns 200 with updated user when password changed successfully', async () => {
      vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
      vi.mocked(authRepo.verifyPassword).mockResolvedValueOnce(true);
      vi.mocked(authRepo.updateUser).mockResolvedValueOnce(mockAuthUser);

      const res = await request(server)
        .patch('/me')
        .set('x-test-user', '1')
        .send({ currentPassword: 'correct', newPassword: 'newpass123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });
  });

  describe('forgotPassword', () => {
    it('returns 400 when body invalid', async () => {
      const res = await request(server).post('/forgot-password').send({});
      expect(res.status).toBe(400);
    });
    it('returns 200 and sends email when user found', async () => {
      vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
      vi.mocked(authRepo.createPasswordReset).mockResolvedValueOnce(undefined);
      vi.mocked(emailService.sendPasswordResetEmail).mockResolvedValueOnce(
        undefined,
      );

      const res = await request(server)
        .post('/forgot-password')
        .send({ email: 'user@example.com' });

      expect(res.status).toBe(200);
      await vi.waitFor(() =>
        expect(emailService.sendPasswordResetEmail).toHaveBeenCalledOnce(),
      );
    });
    it('returns 200 and does NOT send email when user not found', async () => {
      vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(null);

      const res = await request(server)
        .post('/forgot-password')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      await vi.waitFor(() =>
        expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled(),
      );
    });
  });
});
