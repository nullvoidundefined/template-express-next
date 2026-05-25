import { redis } from 'app/services/redis.js';
import { logger } from 'app/utils/logs/logger.js';
import { Queue, Worker } from 'bullmq';
import type { Processor } from 'bullmq';

const jobQueue: Queue | null = redis
  ? new Queue('default-jobs', { connection: redis })
  : null;

function createWorker(processor: Processor): Worker | null {
  if (!redis) {
    logger.info('Redis unavailable; skipping worker creation');
    return null;
  }
  return new Worker('default-jobs', processor, { connection: redis });
}

// -- Example job enqueue (replace with real jobs) --

type ExampleJob = {
  message: string;
};

async function enqueueExampleJob(message: string): Promise<void> {
  if (!jobQueue) return;
  try {
    await jobQueue.add('example', { message } satisfies ExampleJob, {
      attempts: 3,
      backoff: { delay: 5000, type: 'exponential' },
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to enqueue example job');
  }
}

export { createWorker, enqueueExampleJob, jobQueue };
export type { ExampleJob };
