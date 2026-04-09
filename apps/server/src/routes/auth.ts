import * as authHandlers from 'app/handlers/auth/auth.js';
import { authRateLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const authRouter = express.Router();

authRouter.post('/register', authRateLimiter, authHandlers.register);
authRouter.post('/login', authRateLimiter, authHandlers.login);
authRouter.post('/logout', authHandlers.logout);
authRouter.get('/me', requireAuth, authHandlers.me);

export { authRouter };
