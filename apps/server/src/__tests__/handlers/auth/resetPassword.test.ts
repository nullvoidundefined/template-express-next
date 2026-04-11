import { uuid } from 'app/__tests__/helpers/uuids.js';
import * as authHandlers from 'app/handlers/auth/auth.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/auth/auth.js');
vi.mock('app/services/posthog.js', () => ({
  shutdownPostHog: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('app/services/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.post('/auth/reset-password', authHandlers.resetPassword);
app.use(errorHandler);

const userId = uuid();

const validResetRow = {
  expires_at: new Date(Date.now() + 3600_000),
  id: 'reset-id',
  used_at: null,
  user_id: userId,
};

describe('POST /auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when token is missing', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is missing', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'sometoken' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is too short', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'short', token: 'sometoken' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is not found', async () => {
    vi.mocked(authRepo.findPasswordResetByToken).mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123', token: 'badtoken' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid or expired reset token');
  });

  it('returns 400 when token is already used', async () => {
    vi.mocked(authRepo.findPasswordResetByToken).mockResolvedValueOnce({
      ...validResetRow,
      used_at: new Date(Date.now() - 1000),
    });
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123', token: 'usedtoken' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid or expired reset token');
  });

  it('returns 400 when token is expired', async () => {
    vi.mocked(authRepo.findPasswordResetByToken).mockResolvedValueOnce({
      ...validResetRow,
      expires_at: new Date(Date.now() - 1000),
    });
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123', token: 'expiredtoken' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid or expired reset token');
  });

  it('returns 200 and updates password and clears sessions on valid token', async () => {
    vi.mocked(authRepo.findPasswordResetByToken).mockResolvedValueOnce(
      validResetRow,
    );
    vi.mocked(authRepo.updateUserPassword).mockResolvedValueOnce(undefined);
    vi.mocked(authRepo.markPasswordResetUsed).mockResolvedValueOnce(undefined);
    vi.mocked(authRepo.deleteSessionsForUser).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123', token: 'validtoken' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(authRepo.updateUserPassword).toHaveBeenCalledWith(
      userId,
      'newpassword123',
    );
    expect(authRepo.markPasswordResetUsed).toHaveBeenCalledWith('reset-id');
    expect(authRepo.deleteSessionsForUser).toHaveBeenCalledWith(userId);
  });
});
