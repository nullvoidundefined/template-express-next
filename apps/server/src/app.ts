import * as Sentry from '@sentry/node';
import { corsConfig } from 'app/config/corsConfig.js';
import { env, isProduction } from 'app/config/env.js';
import { pool, query } from 'app/db/pool/pool.js';
import { csrfGuard } from 'app/middleware/csrfGuard/csrfGuard.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import { notFoundHandler } from 'app/middleware/notFoundHandler/notFoundHandler.js';
import { rateLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import { requestLogger } from 'app/middleware/requestLogger/requestLogger.js';
import { loadSession } from 'app/middleware/requireAuth/requireAuth.js';
import { deleteExpiredSessions } from 'app/repositories/auth/auth.js';
import { authRouter } from 'app/routes/auth.js';
import { logger } from 'app/utils/logs/logger.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
}

function validateEnv(): void {
  if (!process.env.DATABASE_URL) {
    console.error('Fatal: DATABASE_URL is required');
    process.exit(1);
  }
  if (!process.env.SESSION_SECRET) {
    console.error('Fatal: SESSION_SECRET is required');
    process.exit(1);
  }
  if (isProduction() && !process.env.CORS_ORIGIN) {
    console.error('Fatal: CORS_ORIGIN is required in production');
    process.exit(1);
  }
  if (isProduction() && !process.env.CLIENT_URL) {
    console.error('Fatal: CLIENT_URL is required in production');
    process.exit(1);
  }
  if (isProduction() && !process.env.RESEND_API_KEY) {
    console.error('Fatal: RESEND_API_KEY is required in production');
    process.exit(1);
  }
  if (isProduction() && !process.env.RESEND_FROM_EMAIL) {
    console.error('Fatal: RESEND_FROM_EMAIL is required in production');
    process.exit(1);
  }
}

const REQUEST_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

validateEnv();

export const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(corsConfig);
app.use(requestLogger);
app.use(rateLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(csrfGuard);

app.use((req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: { message: 'Request timeout' } });
    }
    req.destroy();
  });
  next();
});

// Liveness check: fast, no DB call. Railway uses this path.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness check: verifies DB connectivity.
app.get('/health/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

app.use(loadSession);

app.use('/auth', authRouter);

app.use(notFoundHandler);
if (env.SENTRY_DSN) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(Sentry.expressErrorHandler() as any);
}
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected idle-client error in pg pool');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception - shutting down');
  logger.flush();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection - shutting down');
  logger.flush();
  process.exit(1);
});

const server = app.listen(PORT, HOST, () =>
  logger.info({ port: PORT }, 'Server running'),
);

const cleanupTimer = setInterval(async () => {
  try {
    const count = await deleteExpiredSessions();
    if (count > 0) logger.info({ count }, 'Cleaned up expired sessions');
  } catch (err) {
    logger.error({ err }, 'Failed to clean up expired sessions');
  }
}, SESSION_CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out - forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  clearInterval(cleanupTimer);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  logger.info('HTTP server closed');
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
