import * as Sentry from '@sentry/node';
import { trackEvent } from 'app/clients/analyticsClient.js';
import { getStripe } from 'app/clients/stripeClient.js';
import { corsConfig } from 'app/config/corsConfig.js';
import { env } from 'app/config/envConfig.js';
import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import { createAuthHandlers } from 'app/handlers/authHandler.js';
import { createCheckoutHandler } from 'app/handlers/billing/billingHandler.js';
import { createPortalHandler } from 'app/handlers/billing/portalHandler.js';
import { createWebhookHandler } from 'app/handlers/billing/webhookHandler.js';
import { createPostsHandlers } from 'app/handlers/postsHandler.js';
import { csrfGuard } from 'app/middleware/csrfGuardMiddleware.js';
import { errorHandler } from 'app/middleware/errorHandlerMiddleware.js';
import { createIdempotencyMiddleware } from 'app/middleware/idempotencyMiddleware.js';
import { notFoundHandler } from 'app/middleware/notFoundHandlerMiddleware.js';
import { rateLimiter } from 'app/middleware/rateLimiterMiddleware.js';
import { requestLogger } from 'app/middleware/requestLoggerMiddleware.js';
import { createLoadSession } from 'app/middleware/requireAuthMiddleware.js';
import { createAuthRepo } from 'app/repositories/authRepository.js';
import type { AuthRepoDeps } from 'app/repositories/authRepository.js';
import { createBillingRepo } from 'app/repositories/billingRepository.js';
import type { BillingRepoDeps } from 'app/repositories/billingRepository.js';
import { createIdempotencyRepo } from 'app/repositories/idempotencyRepository.js';
import type { IdempotencyRepoDeps } from 'app/repositories/idempotencyRepository.js';
import { createPostsRepo } from 'app/repositories/postsRepository.js';
import type { PostsRepoDeps } from 'app/repositories/postsRepository.js';
import { createAuthRouter } from 'app/routes/authRoutes.js';
import { createBillingRouter } from 'app/routes/billingRoutes.js';
import { createPostsRouter } from 'app/routes/postsRoutes.js';
import { createBillingService } from 'app/services/billingService.js';
import { sendPasswordResetEmail } from 'app/services/emailService.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

const REQUEST_TIMEOUT_MS = 30_000;

// Data-access dependencies injected so tests can build the app against a fake
// or test pool. Production passes the real pool-backed query/withTransaction.
// The union of what every repo createApp builds requires, so it stays correct
// as repos' dependency needs change.
type AppDeps = AuthRepoDeps &
  BillingRepoDeps &
  IdempotencyRepoDeps &
  PostsRepoDeps;

// Builds the fully wired Express app without starting the listener. server.ts
// owns the listener and process lifecycle so tests can build the app in
// isolation and so importing this module has no side effects.
function createApp(deps: AppDeps) {
  const { query } = deps;

  const authRepo = createAuthRepo(deps);
  const loadSession = createLoadSession(authRepo);
  const authHandlers = createAuthHandlers({
    authRepo,
    sendPasswordResetEmail,
    trackEvent,
  });
  const authRouter = createAuthRouter(authHandlers);

  const billingRepo = createBillingRepo({ query });
  const billingService = createBillingService(billingRepo);
  const handleWebhook = createWebhookHandler({
    billingRepo,
    billingService,
    getStripe,
  });
  const billingRouter = createBillingRouter({
    createCheckoutSession: createCheckoutHandler({ getStripe }),
    createPortalSession: createPortalHandler({ billingRepo, getStripe }),
  });

  const postsRepo = createPostsRepo(deps);
  const postsRouter = createPostsRouter(createPostsHandlers({ postsRepo }));

  const idempotency = createIdempotencyMiddleware(createIdempotencyRepo(deps));

  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(corsConfig);
  app.use(requestLogger);

  // Liveness check: fast, no DB call. Railway uses this path.
  app.get('/health', (_req, res) => {
    res.status(HTTP.STATUS.OK).json({ status: 'ok' });
  });

  // Readiness check: verifies DB connectivity.
  app.get('/health/ready', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.status(HTTP.STATUS.OK).json({ status: 'ok', db: 'connected' });
    } catch {
      res
        .status(HTTP.STATUS.SERVICE_UNAVAILABLE)
        .json({ status: 'degraded', db: 'disconnected' });
    }
  });

  app.use(rateLimiter);

  // Stripe webhook needs raw body for signature verification -- must be before express.json()
  app.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    handleWebhook,
  );

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());
  app.use(csrfGuard);

  app.use((req, res, next) => {
    res.setTimeout(REQUEST_TIMEOUT_MS, () => {
      if (!res.headersSent) {
        res
          .status(HTTP.STATUS.REQUEST_TIMEOUT)
          .json(
            createErrorResponse(
              ERROR_CODES.SERVER.REQUEST_TIMEOUT,
              'Request timeout',
            ),
          );
      }
      req.destroy();
    });
    next();
  });

  app.use(loadSession);
  // Replays stored responses for retried POST/PUT carrying an Idempotency-Key
  // from an authenticated user. Self-skips other methods/keyless/public requests.
  app.use(idempotency);

  // All application routes are versioned under /v1. Health checks stay at root
  // (Railway liveness) and the Stripe webhook stays at root (raw-body route
  // registered before express.json()).
  const v1Router = express.Router();
  v1Router.use('/auth', authRouter);
  v1Router.use('/billing', billingRouter);
  v1Router.use('/posts', postsRouter);
  app.use('/v1', v1Router);

  app.use(notFoundHandler);
  if (env.SENTRY_DSN) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.use(Sentry.expressErrorHandler() as any);
  }
  app.use(errorHandler);

  return { app, authRepo };
}

export { createApp };
export type { AppDeps };
