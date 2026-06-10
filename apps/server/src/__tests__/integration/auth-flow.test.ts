// Build the real app via the factory (no listener) so the integration test
// exercises the production wiring -- CSRF, loadSession, auth routes -- against
// a real database.
import { createApp } from 'app/app.js';
import { query, withTransaction } from 'app/database/databasePool.js';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

const { app: testApp } = createApp({ query, withTransaction });

const DB_AVAILABLE = !!process.env.DATABASE_URL;

/**
 * Integration tests: run against a real Express app and real DB.
 * Schema migration, per-test TRUNCATE, and pool teardown are handled by
 * src/__tests__/integration/setup.ts. Skips when DATABASE_URL is not set.
 * Run: pnpm --filter server run test:integration
 */
describe.skipIf(!DB_AVAILABLE)('auth integration', () => {
  const TEST_EMAIL = `test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'password123';

  function agent() {
    return request(testApp);
  }

  describe('POST /auth/register', () => {
    it('returns 201 and sets session cookie', async () => {
      const res = await agent()
        .post('/v1/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 409 on duplicate email', async () => {
      await agent()
        .post('/v1/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const res = await agent()
        .post('/v1/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await agent()
        .post('/v1/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    });

    it('returns 200 and sets session cookie with valid credentials', async () => {
      const res = await agent()
        .post('/v1/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 with invalid credentials', async () => {
      const res = await agent()
        .post('/v1/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: 'wrong-password' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 without session', async () => {
      const res = await agent()
        .get('/v1/auth/me')
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(401);
    });

    it('returns 200 with authenticated user', async () => {
      const registerRes = await agent()
        .post('/v1/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie =
        ((registerRes.headers['set-cookie'] ?? []) as string[])[0] ?? '';

      const res = await agent()
        .get('/v1/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_EMAIL);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 204 and subsequent /me returns 401', async () => {
      const registerRes = await agent()
        .post('/v1/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie =
        ((registerRes.headers['set-cookie'] ?? []) as string[])[0] ?? '';

      const logoutRes = await agent()
        .post('/v1/auth/logout')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(logoutRes.status).toBe(204);

      const meRes = await agent()
        .get('/v1/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(meRes.status).toBe(401);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('always returns 200 regardless of whether email exists', async () => {
      const res = await agent()
        .post('/v1/auth/forgot-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('returns 400 with an invalid token', async () => {
      const res = await agent()
        .post('/v1/auth/reset-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ password: 'newpassword123', token: 'invalid-token' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('AUTH_INVALID_RESET_TOKEN');
      expect(res.body.error).toBe('Invalid or expired token');
    });
  });

  describe('PATCH /auth/me', () => {
    it('returns 200 with updated user after password change', async () => {
      const registerRes = await agent()
        .post('/v1/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie =
        ((registerRes.headers['set-cookie'] ?? []) as string[])[0] ?? '';

      const res = await agent()
        .patch('/v1/auth/me')
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
        .post('/v1/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie =
        ((registerRes.headers['set-cookie'] ?? []) as string[])[0] ?? '';

      const res = await agent()
        .patch('/v1/auth/me')
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
