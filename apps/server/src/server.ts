import * as Sentry from '@sentry/node';
import { createApp } from 'app/app.js';
import { env } from 'app/config/envConfig.js';
import { pool, query, withTransaction } from 'app/database/databasePool.js';
import { logger } from 'app/services/loggerService.js';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
  });
}

const SHUTDOWN_TIMEOUT_MS = 10_000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const PORT = env.PORT;
const HOST = '0.0.0.0';

const { app, authRepo } = createApp({ query, withTransaction });

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

async function cleanupExpiredSessions(): Promise<void> {
  try {
    const count = await authRepo.deleteExpiredSessions();
    if (count > 0) logger.info({ count }, 'Cleaned up expired sessions');
  } catch (err) {
    logger.error({ err }, 'Failed to clean up expired sessions');
  }
}

const cleanupTimer = setInterval(() => {
  void cleanupExpiredSessions();
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
