import { createWorker } from 'app/services/queue.js';
import { logger } from 'app/utils/logs/logger.js';
import 'dotenv/config';

const worker = createWorker(async (job) => {
  switch (job.name) {
    case 'example':
      logger.info({ data: job.data, jobId: job.id }, 'Processing example job');
      break;
    default:
      logger.warn({ jobName: job.name }, 'Unknown job type, skipping');
  }
});

if (!worker) {
  logger.fatal('REDIS_URL is required for the worker process');
  process.exit(1);
}

worker.on('failed', (job, err) => {
  logger.error(
    { err, jobId: job?.id, jobName: job?.name ?? 'unknown' },
    'Job failed',
  );
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, 'Job completed');
});

logger.info('Worker started, listening for jobs on default-jobs queue');
