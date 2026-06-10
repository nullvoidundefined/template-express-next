import { env } from 'app/config/envConfig.js';
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import { SESSION_COOKIE_NAME } from 'app/constants/sessionConstants.js';
import type { AuthRepo } from 'app/repositories/authRepository.js';
import type { NextFunction, Request, Response } from 'express';

// Sentry is optional; import lazily to avoid hard dependency when DSN not set
async function setSentryUser(id: string, email: string): Promise<void> {
  if (!env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.setUser({ email, id });
  } catch {
    // Sentry not available
  }
}

async function clearSentryUser(): Promise<void> {
  if (!env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.setUser(null);
  } catch {
    // Sentry not available
  }
}

/**
 * Builds the loadSession middleware bound to an auth repo. Populates req.user
 * for a valid session cookie and never blocks unauthenticated requests.
 */
function createLoadSession(authRepo: Pick<AuthRepo, 'getSessionWithUser'>) {
  return async function loadSession(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
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
  };
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res
      .status(HTTP.STATUS.UNAUTHORIZED)
      .json(
        createErrorResponse(
          ERROR_CODES.AUTH.REQUIRED,
          'Authentication required',
        ),
      );
    return;
  }
  next();
}

/**
 * Authorization gate for admin-only routes. Apply after loadSession so req.user
 * is populated. Returns 401 when unauthenticated and 403 when authenticated but
 * not an admin. This is the real admin gate; the frontend (admin) layout only
 * redirects for UX.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res
      .status(HTTP.STATUS.UNAUTHORIZED)
      .json(
        createErrorResponse(
          ERROR_CODES.AUTH.REQUIRED,
          'Authentication required',
        ),
      );
    return;
  }
  if (req.user.role !== 'admin') {
    res
      .status(HTTP.STATUS.FORBIDDEN)
      .json(
        createErrorResponse(
          ERROR_CODES.AUTH.ADMIN_REQUIRED,
          'Admin access required',
        ),
      );
    return;
  }
  next();
}

export async function clearSession(): Promise<void> {
  await clearSentryUser();
}

export { createLoadSession };
