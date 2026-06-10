import { uuid } from 'app/__tests__/helpers/uuids.js';
import { createAuthHandlers } from 'app/handlers/authHandler.js';
import type { AuthRepo } from 'app/repositories/authRepository.js';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// isDeployed() true represents any deployed env (staging or production), both
// HTTPS, so cookies must be Secure. Keying on isProduction() alone would miss
// staging. Keep the rest of env real; only force isDeployed.
vi.mock('app/config/envConfig.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, isDeployed: () => true };
});

const userId = uuid();
const mockUser = {
  created_at: new Date('2025-01-01'),
  email: 'user@example.com',
  id: userId,
  role: 'user' as const,
  updated_at: null,
};

// Inject fakes rather than mocking the repo, email, and analytics modules.
const mockAuthRepo = {
  authenticate: vi.fn(),
  createUserAndSession: vi.fn(),
  deleteSession: vi.fn(),
  loginUser: vi.fn(),
};
const handlers = createAuthHandlers({
  authRepo: mockAuthRepo as unknown as AuthRepo,
  sendPasswordResetEmail: vi.fn(),
  trackEvent: vi.fn(),
});

const app = express();
app.use(express.json());
app.post('/register', handlers.register);
app.post('/login', handlers.login);
app.post('/logout', handlers.logout);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('session cookie on a deployed env (staging or production)', () => {
  it('register sets SameSite=Lax, Secure, HttpOnly (same-domain Railway topology)', async () => {
    mockAuthRepo.createUserAndSession.mockResolvedValue({
      sessionId: 'raw-token',
      user: mockUser,
    });

    const res = await request(app)
      .post('/register')
      .send({ email: 'user@example.com', password: 'password123' });

    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toMatch(/SameSite=None/i);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/HttpOnly/);
  });

  it('login sets SameSite=Lax in production', async () => {
    mockAuthRepo.authenticate.mockResolvedValue(mockUser);
    mockAuthRepo.loginUser.mockResolvedValue('raw-token');

    const res = await request(app)
      .post('/login')
      .send({ email: 'user@example.com', password: 'password123' });

    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  it('logout clears the cookie with matching Secure and SameSite attributes', async () => {
    mockAuthRepo.deleteSession.mockResolvedValue(true);

    const res = await request(app)
      .post('/logout')
      .set('Cookie', 'sid=raw-token');

    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    // Browsers ignore a clear whose attributes do not match the set cookie.
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/HttpOnly/);
  });
});
