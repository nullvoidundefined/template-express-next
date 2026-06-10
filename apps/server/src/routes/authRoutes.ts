import type { AuthHandlers } from 'app/handlers/authHandler.js';
import { authRateLimiter } from 'app/middleware/rateLimiterMiddleware.js';
import { requireAuth } from 'app/middleware/requireAuthMiddleware.js';
import { validate } from 'app/middleware/validateMiddleware.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateMeSchema,
} from 'app/schemas/authSchema.js';
import express from 'express';
import type { Router } from 'express';

function createAuthRouter(handlers: AuthHandlers): Router {
  const authRouter = express.Router();

  authRouter.post(
    '/forgot-password',
    authRateLimiter,
    validate(forgotPasswordSchema),
    handlers.forgotPassword,
  );
  authRouter.post(
    '/login',
    authRateLimiter,
    validate(loginSchema),
    handlers.login,
  );
  authRouter.post('/logout', handlers.logout);
  authRouter.get('/me', requireAuth, handlers.me);
  authRouter.patch(
    '/me',
    requireAuth,
    validate(updateMeSchema),
    handlers.updateMe,
  );
  authRouter.post(
    '/register',
    authRateLimiter,
    validate(registerSchema),
    handlers.register,
  );
  authRouter.post(
    '/reset-password',
    authRateLimiter,
    validate(resetPasswordSchema),
    handlers.resetPassword,
  );

  return authRouter;
}

export { createAuthRouter };
