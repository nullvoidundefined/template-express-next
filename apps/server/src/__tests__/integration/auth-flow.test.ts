// Build a minimal test app to avoid importing app.ts which calls app.listen() and validateEnv()
// at module scope. This gives us a clean Express instance with all auth middleware and routes.
import { pool } from 'app/db/pool/pool.js';
import { csrfGuard } from 'app/middleware/csrfGuard/csrfGuard.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import { loadSession } from 'app/middleware/requireAuth/requireAuth.js';
import { authRouter } from 'app/routes/auth.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const testApp = express();
testApp.use(express.json({ limit: '10kb' }));
testApp.use(cookieParser());
testApp.use(csrfGuard);
testApp.use(loadSession);
testApp.use('/auth', authRouter);
testApp.use(errorHandler);

const DB_AVAILABLE = !!process.env.DATABASE_URL;

/**
 * Integration tests: run against a real Express app and real DB.
 * Skip gracefully when DATABASE_URL is not set.
 * Run: pnpm --filter server run test:integration
 */
describe.skipIf(!DB_AVAILABLE)('auth integration', () => {
  const TEST_EMAIL = `test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'password123';

  beforeEach(async () => {
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM password_resets');
    await pool.query("DELETE FROM users WHERE email LIKE 'test-%@example.com'");
  });

  afterAll(async () => {
    await pool.end();
  });

  function agent() {
    return request(testApp);
  }

  describe('POST /auth/register', () => {
    it('returns 201 and sets session cookie', async () => {
      const res = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 409 on duplicate email', async () => {
      await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const res = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    });

    it('returns 200 and sets session cookie with valid credentials', async () => {
      const res = await agent()
        .post('/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 with invalid credentials', async () => {
      const res = await agent()
        .post('/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: 'wrong-password' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 without session', async () => {
      const res = await agent()
        .get('/auth/me')
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(401);
    });

    it('returns 200 with authenticated user', async () => {
      const registerRes = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie =
        ((registerRes.headers['set-cookie'] ?? []) as string[])[0] ?? '';

      const res = await agent()
        .get('/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_EMAIL);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 204 and subsequent /me returns 401', async () => {
      const registerRes = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie =
        ((registerRes.headers['set-cookie'] ?? []) as string[])[0] ?? '';

      const logoutRes = await agent()
        .post('/auth/logout')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(logoutRes.status).toBe(204);

      const meRes = await agent()
        .get('/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(meRes.status).toBe(401);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('always returns 200 regardless of whether email exists', async () => {
      const res = await agent()
        .post('/auth/forgot-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('returns 400 with an invalid token', async () => {
      const res = await agent()
        .post('/auth/reset-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ password: 'newpassword123', token: 'invalid-token' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid or expired token');
    });
  });

  describe('PATCH /auth/me', () => {
    it('returns 200 with updated user after password change', async () => {
      const registerRes = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie =
        ((registerRes.headers['set-cookie'] ?? []) as string[])[0] ?? '';

      const res = await agent()
        .patch('/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword: 'newpassword456',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_EMAIL);
    });

    it('returns 400 when currentPassword is wrong', async () => {
      const registerRes = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie =
        ((registerRes.headers['set-cookie'] ?? []) as string[])[0] ?? '';

      const res = await agent()
        .patch('/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          currentPassword: 'wrong-password',
          newPassword: 'newpassword456',
        });

      expect(res.status).toBe(400);
    });
  });
});
