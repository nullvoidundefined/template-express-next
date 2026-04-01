import { Queue, Worker } from "bullmq";

import { connection } from "app/queues/healthCheck.js";
import { upsertGithubStatus } from "app/repositories/github/github.js";
import { pollGitHub } from "app/services/githubPoller.js";
import { logger } from "app/utils/logs/logger.js";

export const githubPollQueue = new Queue("github-polls", { connection });

export async function scheduleGitHubPoll(
  serviceId: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<void> {
  const jobId = `github-service-${serviceId}`;
  await githubPollQueue.upsertJobScheduler(
    jobId,
    { every: 5 * 60 * 1000 }, // every 5 minutes
    { name: "github-poll", data: { serviceId, owner, repo, branch } },
  );
}

export async function removeGitHubPoll(serviceId: string): Promise<void> {
  const jobId = `github-service-${serviceId}`;
  await githubPollQueue.removeJobScheduler(jobId);
}

export function createGitHubPollWorker() {
  return new Worker(
    "github-polls",
    async (job) => {
      const { serviceId, owner, repo, branch } = job.data as {
        serviceId: string;
        owner: string;
        repo: string;
        branch: string;
      };
      try {
        const data = await pollGitHub(owner, repo, branch);
        await upsertGithubStatus(serviceId, data);
        logger.info({ serviceId, owner, repo }, "GitHub poll completed");
      } catch (err) {
        logger.error({ err, serviceId }, "GitHub poll job failed");
        throw err;
      }
    },
    { connection },
  );
}
