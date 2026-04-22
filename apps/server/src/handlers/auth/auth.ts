import { isProduction } from 'app/config/env.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from 'app/constants/session.js';
import { clearSession } from 'app/middleware/requireAuth/requireAuth.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import type { User } from 'app/schemas/auth.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateMeSchema,
} from 'app/schemas/auth.js';
import {
  ANALYTICS_EVENTS,
  trackEvent,
} from 'app/services/analytics/analytics.js';
import * as emailService from 'app/services/email/email.js';
import { logger } from 'app/utils/logs/logger.js';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';

const SALT_ROUNDS = 12;

function toUserResponse(user: User) {
  return {
    createdAt: user.created_at,
    email: user.email,
    id: user.id,
    updatedAt: user.updated_at,
  };
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
    sameSite: isProduction() ? ('none' as const) : ('lax' as const),
    secure: isProduction(),
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const { email, password } = parsed.data;
  try {
    const { user, sessionId } = await authRepo.createUserAndSession(
      email,
      password,
    );
    logger.info(
      { event: 'register_success', userId: user.id, ip: req.ip },
      'User registered',
    );
    trackEvent(user.id, ANALYTICS_EVENTS.USER_REGISTERED);
    res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
    res.status(201).json({ user: toUserResponse(user) });
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code: string }).code
        : undefined;
    if (code === '23505') {
      logger.warn(
        { event: 'register_duplicate_email', ip: req.ip },
        'Registration failed: email already registered',
      );
      res.status(409).json({ error: { message: 'Email already registered' } });
      return;
    }
    throw err;
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const { email, password } = parsed.data;
  const user = await authRepo.authenticate(email, password);
  if (!user) {
    logger.warn(
      { event: 'login_failure', ip: req.ip },
      'Login failed: invalid credentials',
    );
    res.status(401).json({ error: { message: 'Invalid email or password' } });
    return;
  }
  const sessionId = await authRepo.loginUser(user.id);
  logger.info(
    { event: 'login_success', userId: user.id, ip: req.ip },
    'User logged in',
  );
  trackEvent(user.id, ANALYTICS_EVENTS.USER_LOGGED_IN);
  res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
  res.json({ user: toUserResponse(user) });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token && typeof token === 'string') {
    try {
      await authRepo.deleteSession(token);
    } catch (err) {
      logger.error({ err }, 'Failed to delete session on logout');
    }
  }
  const userId = req.user?.id;
  logger.info({ event: 'logout', userId, ip: req.ip }, 'User logged out');
  if (userId) trackEvent(userId, ANALYTICS_EVENTS.USER_LOGGED_OUT);
  void clearSession();
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: toUserResponse(req.user!) });
}

export async function forgotPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }

  const { email } = parsed.data;

  // Always return 200 regardless of whether the email exists (prevents user enumeration).
  res.status(200).json({
    message:
      'If that email is registered, you will receive a reset link shortly.',
  });

  // Fire-and-forget after responding so latency is not exposed to the caller.
  void (async () => {
    try {
      const user = await authRepo.findUserByEmail(email);
      if (!user) return;

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken, 'utf8')
        .digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await authRepo.createPasswordReset(user.id, tokenHash, expiresAt);
      trackEvent(user.id, ANALYTICS_EVENTS.PASSWORD_RESET_REQUESTED);

      const resetUrl = `${process.env.CLIENT_URL ?? 'http://localhost:3000'}/reset-password?token=${rawToken}`;
      await emailService.sendPasswordResetEmail(email, resetUrl);

      logger.info(
        { event: 'password_reset_email_sent', userId: user.id },
        'Password reset email dispatched',
      );
    } catch (err) {
      logger.error(
        { err, event: 'password_reset_email_error' },
        'Error sending password reset email',
      );
    }
  })();
}

export async function resetPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }

  const { token, password } = parsed.data;
  const tokenHash = crypto
    .createHash('sha256')
    .update(token, 'utf8')
    .digest('hex');
  const newPasswordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await authRepo.consumePasswordReset(tokenHash, newPasswordHash);
  if (!user) {
    res.status(400).json({ error: { message: 'Invalid or expired token' } });
    return;
  }

  logger.info(
    { event: 'password_reset_success', userId: user.id },
    'Password reset successfully',
  );
  trackEvent(user.id, ANALYTICS_EVENTS.PASSWORD_RESET_COMPLETED);
  res.status(204).send();
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;
  const userId = req.user!.id;

  if (newPassword) {
    // currentPassword is guaranteed by schema refine, but guard defensively
    if (!currentPassword) {
      res.status(400).json({
        error: {
          message: 'currentPassword is required when setting a new password',
        },
      });
      return;
    }

    const userWithHash = await authRepo.findUserByEmail(req.user!.email);
    if (!userWithHash) {
      res.status(400).json({ error: { message: 'User not found' } });
      return;
    }

    const valid = await authRepo.verifyPassword(
      currentPassword,
      userWithHash.password_hash,
    );
    if (!valid) {
      res
        .status(400)
        .json({ error: { message: 'Current password is incorrect' } });
      return;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const updated = await authRepo.updateUser(userId, {
      passwordHash: newPasswordHash,
    });
    logger.info({ event: 'password_changed', userId }, 'User changed password');
    trackEvent(userId, ANALYTICS_EVENTS.PROFILE_UPDATED);
    res.json({ user: toUserResponse(updated) });
    return;
  }

  // No changes requested
  res.json({ user: toUserResponse(req.user!) });
}
