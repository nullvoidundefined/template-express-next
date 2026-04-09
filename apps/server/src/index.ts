import { corsConfig } from 'app/config/corsConfig.js';
import { isProduction } from 'app/config/env.js';
import pool, { query } from 'app/db/pool/pool.js';
import { csrfGuard } from 'app/middleware/csrfGuard/csrfGuard.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import { notFoundHandler } from 'app/middleware/notFoundHandler/notFoundHandler.js';
import { rateLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import { requestLogger } from 'app/middleware/requestLogger/requestLogger.js';
import {
  loadSession,
  requireAuth,
} from 'app/middleware/requireAuth/requireAuth.js';
import {
  createGitHubPollWorker,
  githubPollQueue,
  scheduleGitHubPoll,
} from 'app/queues/githubPoller.js';
import {
  createHealthCheckWorker,
  healthCheckQueue,
  connection as redisConnection,
  scheduleServiceCheck,
} from 'app/queues/healthCheck.js';
import {
  createMaintenanceWorker,
  maintenanceQueue,
  scheduleDataRollup,
  scheduleScreenshotPruning,
} from 'app/queues/maintenance.js';
import { deleteExpiredSessions } from 'app/repositories/auth/auth.js';
import { listServices } from 'app/repositories/services/services.js';
import { authRouter } from 'app/routes/auth.js';
import { githubRouter } from 'app/routes/github.js';
import { incidentsRouter } from 'app/routes/incidents.js';
import { metricsRouter } from 'app/routes/metrics.js';
import { servicesRouter } from 'app/routes/services.js';
import { statusRouter } from 'app/routes/status.js';
import { webhooksRouter } from 'app/routes/webhooks.js';
import { runCheck } from 'app/services/checkRunner.js';
import { logger } from 'app/utils/logs/logger.js';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function validateEnv(): void {
  if (!process.env.DATABASE_URL) {
    console.error('Fatal: DATABASE_URL is required');
    process.exit(1);
  }
  if (isProduction() && !process.env.CORS_ORIGIN) {
    console.error('Fatal: CORS_ORIGIN is required in production');
    process.exit(1);
  }
}

const app = express();
const REQUEST_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Trust the first hop (reverse proxy / load balancer) so req.ip, req.protocol, and rate limiting work
// correctly with X-Forwarded-For / X-Forwarded-Proto headers. Set to the number of trusted proxy hops.
app.set('trust proxy', 1);

// Add security-related HTTP headers to reduce common web vulnerabilities (XSS, clickjacking, MIME sniffing, etc.).
app.use(helmet());

// Allow browser frontends to call this API while still controlling which origins are permitted.
app.use(corsConfig);

// Attach structured request/response logging (with request IDs) early so all downstream handlers are observable.
app.use(requestLogger);

// Apply a basic rate limiter to protect the API from simple abuse and accidental client floods.
app.use(rateLimiter);

// Parse JSON request bodies and cap payload size to avoid unexpectedly large requests.
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded form submissions (e.g. HTML forms) with the same size cap as JSON.
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(cookieParser());

// Require X-Requested-With on state-changing requests to mitigate CSRF.
app.use(csrfGuard);

// Timeout long-running requests so hung connections don't stay open indefinitely.
app.use((req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: { message: 'Request timeout' } });
    }
    req.destroy();
  });
  next();
});

// Health check — placed before loadSession to avoid unnecessary DB session lookups.
let healthCacheResult: {
  status: string;
  db: boolean;
  redis: boolean;
  queue: { waiting: number; active: number; failed: number };
} | null = null;
let healthCacheExpiry = 0;
const HEALTH_CACHE_TTL_MS = 5_000;

app.get('/health', async (_req, res) => {
  const now = Date.now();
  if (healthCacheResult && now < healthCacheExpiry) {
    const isHealthy = healthCacheResult.db && healthCacheResult.redis;
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(healthCacheResult);
    return;
  }

  const checks = {
    db: false,
    redis: false,
    queue: { waiting: 0, active: 0, failed: 0 },
  };

  try {
    await query('SELECT 1');
    checks.db = true;
  } catch {
    checks.db = false;
  }

  try {
    await redisConnection.ping();
    checks.redis = true;
  } catch {
    checks.redis = false;
  }

  try {
    const counts = await healthCheckQueue.getJobCounts(
      'waiting',
      'active',
      'failed',
    );
    checks.queue = {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      failed: counts.failed ?? 0,
    };
  } catch {
    // non-critical
  }

  const isHealthy = checks.db && checks.redis;
  healthCacheResult = {
    status: isHealthy ? 'healthy' : 'degraded',
    ...checks,
  };
  healthCacheExpiry = now + HEALTH_CACHE_TTL_MS;
  res.status(isHealthy ? 200 : 503).json(healthCacheResult);
});

query('SELECT NOW()')
  .then(() => logger.info('Connected to database'))
  .catch((err: unknown) => logger.error({ err }, 'Database connection failed'));

// Public status endpoints (no auth) — before loadSession
app.use('/api/v1/status', statusRouter);

// Webhooks don't need auth — register before loadSession
app.use('/api/v1/webhooks', webhooksRouter);

// Load session from cookie and set req.user when valid (does not block unauthenticated requests).
app.use(loadSession);

app.use('/auth', authRouter);
app.use('/api/v1/services', requireAuth, servicesRouter);
app.use('/api/v1/services', githubRouter);
app.use('/api/v1/metrics', requireAuth, metricsRouter);
app.use('/api/v1/incidents', incidentsRouter);

// Attach reusable utilities for 404 and error handling.
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const entryPath = process.argv[1];
const isEntryModule =
  entryPath !== undefined &&
  path.resolve(entryPath) === path.resolve(fileURLToPath(import.meta.url));

if (isEntryModule) {
  validateEnv();

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected idle-client error in pg pool');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception – shutting down');
    logger.flush();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection – shutting down');
    logger.flush();
    process.exit(1);
  });

  // Start health check worker
  const healthCheckWorker = createHealthCheckWorker(async (job) => {
    const { serviceId } = job.data as { serviceId: string };
    try {
      const services = await listServices();
      const service = services.find((s) => s.id === serviceId);
      if (!service) {
        logger.warn({ serviceId }, 'Health check job: service not found');
        return;
      }
      const result = await runCheck(service);
      logger.info(
        { serviceId, status: result.status },
        'Health check completed',
      );
    } catch (err) {
      logger.error({ err, serviceId }, 'Health check job failed');
      throw err;
    }
  });

  healthCheckWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Health check worker job failed');
  });

  // Schedule health checks for all services on startup
  void (async () => {
    try {
      const services = await listServices();
      for (const service of services) {
        await scheduleServiceCheck(service.id, service.check_interval_seconds);
      }
      logger.info(
        { count: services.length },
        'Scheduled health checks for all services',
      );
    } catch (err) {
      logger.error({ err }, 'Failed to schedule health checks on startup');
    }
  })();

  // Start maintenance worker (screenshot pruning + data rollup)
  const maintenanceWorker = createMaintenanceWorker();
  maintenanceWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Maintenance worker job failed');
  });
  void scheduleScreenshotPruning().catch((err: unknown) =>
    logger.error({ err }, 'Failed to schedule screenshot pruning'),
  );
  void scheduleDataRollup().catch((err: unknown) =>
    logger.error({ err }, 'Failed to schedule data rollup'),
  );

  // Start GitHub poll worker
  const githubPollWorker = createGitHubPollWorker();
  githubPollWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'GitHub poll worker job failed');
  });

  // Schedule GitHub polls for all services with GitHub config on startup
  void (async () => {
    try {
      const services = await listServices();
      let githubCount = 0;
      for (const service of services) {
        if (service.github_owner && service.github_repo) {
          await scheduleGitHubPoll(
            service.id,
            service.github_owner,
            service.github_repo,
            service.github_branch,
          );
          githubCount++;
        }
      }
      logger.info(
        { count: githubCount },
        'Scheduled GitHub polls for services',
      );
    } catch (err) {
      logger.error({ err }, 'Failed to schedule GitHub polls on startup');
    }
  })();

  const server = app.listen(PORT, HOST, () =>
    logger.info({ port: PORT }, 'Server running'),
  );

  // Periodically clean up expired sessions to prevent table bloat.
  const cleanupTimer = setInterval(async () => {
    try {
      const count = await deleteExpiredSessions();
      if (count > 0) logger.info({ count }, 'Cleaned up expired sessions');
    } catch (err) {
      logger.error({ err }, 'Failed to clean up expired sessions');
    }
  }, SESSION_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down gracefully');

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out – forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    clearInterval(cleanupTimer);
    await healthCheckWorker.close();
    await healthCheckQueue.close();
    await maintenanceWorker.close();
    await maintenanceQueue.close();
    await githubPollWorker.close();
    await githubPollQueue.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    logger.info('HTTP server closed');
    await pool.end();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
