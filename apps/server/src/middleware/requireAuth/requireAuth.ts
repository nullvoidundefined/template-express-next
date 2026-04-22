import { SESSION_COOKIE_NAME } from 'app/constants/session.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import type { NextFunction, Request, Response } from 'express';

// Sentry is optional; import lazily to avoid hard dependency when DSN not set
async function setSentryUser(id: string, email: string): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.setUser({ email, id });
  } catch {
    // Sentry not available
  }
}

async function clearSentryUser(): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.setUser(null);
  } catch {
    // Sentry not available
  }
}

export async function loadSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token || typeof token !== 'string') {
    next();
    return;
  }
  try {
    const user = await authRepo.getSessionWithUser(token);
    if (user) {
      req.user = user;
      void setSentryUser(user.id, user.email);
    }
  } catch (err) {
    next(err);
    return;
  }
  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  next();
}

export async function clearSession(): Promise<void> {
  await clearSentryUser();
}
