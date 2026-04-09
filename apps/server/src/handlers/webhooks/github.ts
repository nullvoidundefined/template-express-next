import { env } from 'app/config/env.js';
import { upsertGithubStatus } from 'app/repositories/github/github.js';
import { listServices } from 'app/repositories/services/services.js';
import { logger } from 'app/utils/logs/logger.js';
import crypto from 'crypto';
import type { Request, Response } from 'express';

function verifySignature(
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function githubWebhookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const secret = env.GITHUB_WEBHOOK_SECRET;

  if (secret) {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const payload = JSON.stringify(req.body);
    if (!verifySignature(payload, signature, secret)) {
      res.status(401).json({ error: { message: 'Invalid signature' } });
      return;
    }
  }

  const event = req.headers['x-github-event'] as string;
  const payload = req.body;

  // Find matching service(s) by repo
  const services = await listServices();

  try {
    if (event === 'push') {
      const repoName = payload.repository?.name;
      const repoOwner = payload.repository?.owner?.login;
      const branch = payload.ref?.replace('refs/heads/', '');

      const matching = services.filter(
        (s) =>
          s.github_repo === repoName &&
          s.github_owner === repoOwner &&
          s.github_branch === branch,
      );

      for (const service of matching) {
        await upsertGithubStatus(service.id, {
          last_commit_sha: payload.after?.slice(0, 7) ?? null,
          last_commit_message:
            payload.head_commit?.message?.split('\n')[0] ?? null,
          last_commit_author: payload.head_commit?.author?.name ?? null,
          last_commit_at: payload.head_commit?.timestamp ?? null,
          workflow_name: null,
          workflow_status: null,
          workflow_run_url: null,
          build_logs_excerpt: null,
        });
      }
    }

    if (event === 'workflow_run') {
      const repoName = payload.repository?.name;
      const repoOwner = payload.repository?.owner?.login;
      const run = payload.workflow_run;

      const matching = services.filter(
        (s) => s.github_repo === repoName && s.github_owner === repoOwner,
      );

      for (const service of matching) {
        const conclusion = run?.conclusion;
        let workflowStatus:
          | 'success'
          | 'failure'
          | 'pending'
          | 'cancelled'
          | null = null;
        if (conclusion === 'success') workflowStatus = 'success';
        else if (conclusion === 'failure') workflowStatus = 'failure';
        else if (conclusion === 'cancelled') workflowStatus = 'cancelled';
        else if (run?.status) workflowStatus = 'pending';

        await upsertGithubStatus(service.id, {
          last_commit_sha: null,
          last_commit_message: null,
          last_commit_author: null,
          last_commit_at: null,
          workflow_name: run?.name ?? null,
          workflow_status: workflowStatus,
          workflow_run_url: run?.html_url ?? null,
          build_logs_excerpt: null,
        });
      }
    }
  } catch (err) {
    logger.error({ err, event }, 'webhook processing error');
  }

  res.status(200).json({ data: { received: true } });
}
