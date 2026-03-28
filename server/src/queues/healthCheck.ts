import { Queue, Worker, type Processor } from "bullmq";
import { Redis as IORedis } from "ioredis";

import { redisConfig } from "app/config/redis.js";

export const connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });

export const healthCheckQueue = new Queue("health-checks", { connection });

export async function scheduleServiceCheck(serviceId: string, intervalSeconds: number) {
  const jobId = `service-${serviceId}`;
  await healthCheckQueue.upsertJobScheduler(
    jobId,
    { every: intervalSeconds * 1000 },
    { name: "health-check", data: { serviceId } },
  );
}

export async function removeServiceCheck(serviceId: string) {
  const jobId = `service-${serviceId}`;
  await healthCheckQueue.removeJobScheduler(jobId);
}

export function createHealthCheckWorker(processor: Processor) {
  return new Worker("health-checks", processor, { connection });
}
