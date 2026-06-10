import { ANALYTICS_EVENTS } from 'app/clients/analyticsClient.js';
import { env, isDeployed } from 'app/config/envConfig.js';
import { SALT_ROUNDS } from 'app/constants/authConstants.js';
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from 'app/constants/sessionConstants.js';
import { clearSession } from 'app/middleware/requireAuthMiddleware.js';
import type { AuthRepo } from 'app/repositories/authRepository.js';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateMeInput,
  User,
} from 'app/schemas/authSchema.js';
import { hashToken } from 'app/services/hashService.js';
import { logger } from 'app/services/loggerService.js';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';

/**
 * Side-effecting dependencies injected so handler tests can supply fakes
 * without mocking the repo, email, or analytics modules.
 */
interface AuthHandlerDeps {
  authRepo: AuthRepo;
  sendPasswordResetEmail: (to: string, resetUrl: string) => Promise<void>;
  trackEvent: (distinctId: string, event: string) => void;
}

function toUserResponse(user: User) {
  return {
    createdAt: user.created_at,
    email: user.email,
    id: user.id,
    role: user.role,
    updatedAt: user.updated_at,
  };
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
    sameSite: 'lax' as const,
    // secure on every deployed env (staging + production), both of which run
    // HTTPS. Keying on isProduction() alone would send insecure cookies on staging.
    secure: isDeployed(),
  };
}

// clearCookie only deletes the cookie when its attributes match those it was set
// with, so the clear must mirror sessionCookieOptions (minus maxAge).
function clearCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: isDeployed(),
  };
}

function createAuthHandlers({
  authRepo,
  sendPasswordResetEmail,
  trackEvent,
}: AuthHandlerDeps) {
  async function register(req: Request, res: Response): Promise<void> {
    // Body is validated by the validate(registerSchema) route middleware.
    const { email, password } = req.body as RegisterInput;
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
      res.status(HTTP.STATUS.CREATED).json({ user: toUserResponse(user) });
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
        res
          .status(HTTP.STATUS.CONFLICT)
          .json(
            createErrorResponse(
              ERROR_CODES.AUTH.EMAIL_ALREADY_REGISTERED,
              'Email already registered',
            ),
          );
        return;
      }
      throw err;
    }
  }

  async function login(req: Request, res: Response): Promise<void> {
    // Body is validated by the validate(loginSchema) route middleware.
    const { email, password } = req.body as LoginInput;
    const user = await authRepo.authenticate(email, password);
    if (!user) {
      logger.warn(
        { event: 'login_failure', ip: req.ip },
        'Login failed: invalid credentials',
      );
      res
        .status(HTTP.STATUS.UNAUTHORIZED)
        .json(
          createErrorResponse(
            ERROR_CODES.AUTH.INVALID_CREDENTIALS,
            'Invalid email or password',
          ),
        );
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

  async function logout(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
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
    res.clearCookie(SESSION_COOKIE_NAME, clearCookieOptions());
    res.status(HTTP.STATUS.NO_CONTENT).send();
  }

  async function me(req: Request, res: Response): Promise<void> {
    res.json({ user: toUserResponse(req.user!) });
  }

  async function forgotPassword(req: Request, res: Response): Promise<void> {
    // Body is validated by the validate(forgotPasswordSchema) route middleware.
    const { email } = req.body as ForgotPasswordInput;

    // Always return 200 regardless of whether the email exists (prevents user enumeration).
    res.status(HTTP.STATUS.OK).json({
      message:
        'If that email is registered, you will receive a reset link shortly.',
    });

    // Fire-and-forget after responding so latency is not exposed to the caller.
    async function dispatchResetEmail(): Promise<void> {
      try {
        const user = await authRepo.findUserByEmail(email);
        if (!user) return;

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await authRepo.createPasswordReset(user.id, tokenHash, expiresAt);
        trackEvent(user.id, ANALYTICS_EVENTS.PASSWORD_RESET_REQUESTED);

        const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;
        await sendPasswordResetEmail(email, resetUrl);

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
    }

    void dispatchResetEmail();
  }

  async function resetPassword(req: Request, res: Response): Promise<void> {
    // Body is validated by the validate(resetPasswordSchema) route middleware.
    const { token, password } = req.body as ResetPasswordInput;
    const tokenHash = hashToken(token);
    const newPasswordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await authRepo.consumePasswordReset(
      tokenHash,
      newPasswordHash,
    );
    if (!user) {
      res
        .status(HTTP.STATUS.BAD_REQUEST)
        .json(
          createErrorResponse(
            ERROR_CODES.AUTH.INVALID_RESET_TOKEN,
            'Invalid or expired token',
          ),
        );
      return;
    }

    logger.info(
      { event: 'password_reset_success', userId: user.id },
      'Password reset successfully',
    );
    trackEvent(user.id, ANALYTICS_EVENTS.PASSWORD_RESET_COMPLETED);
    res.status(HTTP.STATUS.NO_CONTENT).send();
  }

  async function updateMe(req: Request, res: Response): Promise<void> {
    // Body is validated by the validate(updateMeSchema) route middleware,
    // including the refine that newPassword requires currentPassword.
    const { currentPassword, newPassword } = req.body as UpdateMeInput;
    const userId = req.user!.id;

    if (newPassword) {
      // currentPassword is guaranteed by schema refine, but guard defensively
      if (!currentPassword) {
        res
          .status(HTTP.STATUS.BAD_REQUEST)
          .json(
            createErrorResponse(
              ERROR_CODES.INPUT.VALIDATION_ERROR,
              'currentPassword is required when setting a new password',
            ),
          );
        return;
      }

      const userWithHash = await authRepo.findUserByEmail(req.user!.email);
      if (!userWithHash) {
        res
          .status(HTTP.STATUS.BAD_REQUEST)
          .json(
            createErrorResponse(
              ERROR_CODES.AUTH.USER_NOT_FOUND,
              'User not found',
            ),
          );
        return;
      }

      const valid = await authRepo.verifyPassword(
        currentPassword,
        userWithHash.password_hash,
      );
      if (!valid) {
        res
          .status(HTTP.STATUS.BAD_REQUEST)
          .json(
            createErrorResponse(
              ERROR_CODES.AUTH.INVALID_CREDENTIALS,
              'Current password is incorrect',
            ),
          );
        return;
      }

      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      const updated = await authRepo.updateUser(userId, {
        passwordHash: newPasswordHash,
      });
      // Revoke every existing session (including any an attacker may hold), then
      // issue a fresh one so the user who changed their password stays logged in.
      await authRepo.deleteSessionsForUser(userId);
      const sessionId = await authRepo.createSession(userId);
      res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
      logger.info(
        { event: 'password_changed', userId },
        'User changed password',
      );
      trackEvent(userId, ANALYTICS_EVENTS.PROFILE_UPDATED);
      res.json({ user: toUserResponse(updated) });
      return;
    }

    // No changes requested
    res.json({ user: toUserResponse(req.user!) });
  }

  return {
    forgotPassword,
    login,
    logout,
    me,
    register,
    resetPassword,
    updateMe,
  };
}

type AuthHandlers = ReturnType<typeof createAuthHandlers>;

export { createAuthHandlers };
export type { AuthHandlerDeps, AuthHandlers };
