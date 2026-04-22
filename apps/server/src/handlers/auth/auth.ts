import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { isProduction } from 'app/config/env.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from 'app/constants/session.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import type { User } from 'app/schemas/auth.js';
import { forgotPasswordSchema, loginSchema, registerSchema } from 'app/schemas/auth.js';
import * as emailService from 'app/services/email/email.js';
import { logger } from 'app/utils/logs/logger.js';

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

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }

  const { email } = parsed.data;

  // Always return 200 regardless of whether the email exists (prevents user enumeration).
  res.status(200).json({ message: 'If that email is registered, you will receive a reset link shortly.' });

  // Fire-and-forget after responding so latency is not exposed to the caller.
  void (async () => {
    try {
      const user = await authRepo.findUserByEmail(email);
      if (!user) return;

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await authRepo.createPasswordReset(user.id, tokenHash, expiresAt);

      const resetUrl = `${process.env.CLIENT_URL ?? 'http://localhost:3000'}/reset-password?token=${rawToken}`;
      await emailService.sendPasswordResetEmail(email, resetUrl);

      logger.info({ event: 'password_reset_email_sent', userId: user.id }, 'Password reset email dispatched');
    } catch (err) {
      logger.error({ err, event: 'password_reset_email_error' }, 'Error sending password reset email');
    }
  })();
}
