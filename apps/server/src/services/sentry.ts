import * as Sentry from '@sentry/node';
import { env, isProd } from 'app/config/env.js';
import type { Express } from 'express';

function setupSentry(_app: Express): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: isProd ? 0.2 : 1.0,
  });
}

function registerSentryErrorHandler(app: Express): void {
  if (!env.SENTRY_DSN) return;
  Sentry.setupExpressErrorHandler(app);
}

function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!env.SENTRY_DSN) return;
  Sentry.captureException(error, { extra: context });
}

export { captureException, registerSentryErrorHandler, setupSentry };
