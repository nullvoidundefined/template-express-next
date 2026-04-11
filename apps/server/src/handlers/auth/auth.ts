import { isProduction } from 'app/config/env.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from 'app/constants/session.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import type { User } from 'app/schemas/auth.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from 'app/schemas/auth.js';
import { sendEmail } from 'app/services/email.js';
import { trackEvent } from 'app/services/posthog.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';

function toUserResponse(user: User) {
  return {
    createdAt: user.created_at,
    email: user.email,
    id: user.id,
    name: {
      alias: user.name_alias,
      first: user.name_first,
      last: user.name_last,
    },
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
  const { email, nameAlias, nameFirst, nameLast, password } = parsed.data;
  try {
    const { user, sessionId } = await authRepo.createUserAndSession(
      email,
      password,
      { nameAlias, nameFirst, nameLast },
    );
    trackEvent(user.id, 'user_registered');
    logger.info(
      { event: 'register_success', userId: user.id, ip: req.ip },
      'User registered',
    );
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
  trackEvent(user.id, 'user_logged_in');
  logger.info(
    { event: 'login_success', userId: user.id, ip: req.ip },
    'User logged in',
  );
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
  const user = await authRepo.findUserByEmail(email);

  // Always return 200 to prevent user enumeration
  if (!user) {
    res.json({ success: true });
    return;
  }

  const token = await authRepo.createPasswordResetToken(user.id);
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';
  const resetUrl = `${clientUrl}/reset-password?token=${token}`;

  await sendEmail({
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your Doppelscript password. This link expires in 1 hour.</p>`,
    subject: 'Reset your Doppelscript password',
    to: email,
  });

  trackEvent(user.id, 'password_reset_requested');
  logger.info(
    { event: 'password_reset_requested', userId: user.id },
    'Password reset email sent',
  );

  res.json({ success: true });
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
  const { newPassword, token } = parsed.data;

  const resetRecord = await authRepo.findPasswordResetByToken(token);
  if (
    !resetRecord ||
    resetRecord.used_at ||
    resetRecord.expires_at < new Date()
  ) {
    res
      .status(400)
      .json({ error: { message: 'Invalid or expired reset token' } });
    return;
  }

  await authRepo.updateUserPassword(resetRecord.user_id, newPassword);
  await authRepo.markPasswordResetUsed(resetRecord.id);
  await authRepo.deleteSessionsForUser(resetRecord.user_id);

  trackEvent(resetRecord.user_id, 'password_reset_completed');
  logger.info(
    { event: 'password_reset_completed', userId: resetRecord.user_id },
    'Password reset completed',
  );

  res.json({ success: true });
}
