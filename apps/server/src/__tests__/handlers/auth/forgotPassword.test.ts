import { uuid } from 'app/__tests__/helpers/uuids.js';
import * as authHandlers from 'app/handlers/auth/auth.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import { sendEmail } from 'app/services/email.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/auth/auth.js');
vi.mock('app/services/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('app/services/posthog.js', () => ({
  shutdownPostHog: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.post('/auth/forgot-password', authHandlers.forgotPassword);
app.use(errorHandler);

const userId = uuid();

describe('POST /auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('returns 200 when email is not found (prevents enumeration)', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 200 and sends email when user found', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce({
      created_at: new Date(),
      email: 'user@example.com',
      id: userId,
      name_alias: null,
      name_first: null,
      name_last: null,
      password_hash: 'hash',
      updated_at: null,
    });
    vi.mocked(authRepo.createPasswordResetToken).mockResolvedValueOnce(
      'rawtoken',
    );

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Reset your Doppelscript password',
        to: 'user@example.com',
      }),
    );
    expect(authRepo.createPasswordResetToken).toHaveBeenCalledWith(userId);
  });

  it('includes the token in the reset URL sent via email', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce({
      created_at: new Date(),
      email: 'user@example.com',
      id: userId,
      name_alias: null,
      name_first: null,
      name_last: null,
      password_hash: 'hash',
      updated_at: null,
    });
    vi.mocked(authRepo.createPasswordResetToken).mockResolvedValueOnce(
      'mytoken123',
    );

    await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'user@example.com' });

    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.html).toContain('mytoken123');
  });
});
