import { Queue, Worker, type Processor } from "bullmq";

import { connection } from "app/queues/healthCheck.js";
import {
  deleteRolledUpChecks,
  rollupDaily,
  rollupHourly,
} from "app/repositories/aggregates/aggregates.js";
import { listServices } from "app/repositories/services/services.js";
import { pruneScreenshots } from "app/services/screenshotCapture.js";
import { logger } from "app/utils/logs/logger.js";

export const maintenanceQueue = new Queue("maintenance", { connection });

export async function scheduleScreenshotPruning(): Promise<void> {
  // Runs daily at 3am UTC
  await maintenanceQueue.upsertJobScheduler(
    "screenshot-pruning",
    { pattern: "0 3 * * *" },
    { name: "prune-screenshots", data: {} },
  );
}

export async function scheduleDataRollup(): Promise<void> {
  await maintenanceQueue.upsertJobScheduler(
    "daily-rollup",
    { pattern: "0 3 * * *" },
    { name: "rollup", data: {} },
  );
}

export function createMaintenanceWorker(processor?: Processor) {
  const defaultProcessor: Processor = async (job) => {
    if (job.name === "prune-screenshots") {
      try {
        const services = await listServices();
        await Promise.all(services.map((s) => pruneScreenshots(s.id)));
        logger.info({ count: services.length }, "Screenshot pruning completed");
      } catch (err) {
        logger.error({ err }, "Screenshot pruning failed");
        throw err;
      }
    } else if (job.name === "rollup") {
      try {
        const hourlyCount = await rollupHourly(30);
        logger.info({ hourlyCount }, "Hourly rollup completed");

        const dailyCount = await rollupDaily(365);
        logger.info({ dailyCount }, "Daily rollup completed");

        const deletedCount = await deleteRolledUpChecks(30);
        logger.info({ deletedCount }, "Rolled-up checks deleted");
      } catch (err) {
        logger.error({ err }, "Data rollup failed");
        throw err;
      }
    }
  };

  return new Worker("maintenance", processor ?? defaultProcessor, { connection });
}
