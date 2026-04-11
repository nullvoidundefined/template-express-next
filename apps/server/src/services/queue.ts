import { redis } from 'app/services/redis.js';
import { Queue, Worker } from 'bullmq';
import type { Processor } from 'bullmq';

const aiQueue = new Queue('ai-jobs', { connection: redis });

function createWorker(processor: Processor): Worker {
  return new Worker('ai-jobs', processor, { connection: redis });
}

export { aiQueue, createWorker };
