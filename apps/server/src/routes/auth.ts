import * as authHandlers from 'app/handlers/auth/auth.js';
import {
  authRateLimiter,
  forgotPasswordRateLimiter,
} from 'app/middleware/rateLimiter/rateLimiter.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const authRouter = express.Router();

authRouter.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  authHandlers.forgotPassword,
);
authRouter.post('/login', authRateLimiter, authHandlers.login);
authRouter.post('/logout', authHandlers.logout);
authRouter.get('/me', requireAuth, authHandlers.me);
authRouter.post('/register', authRateLimiter, authHandlers.register);
authRouter.post('/reset-password', authHandlers.resetPassword);

export { authRouter };
