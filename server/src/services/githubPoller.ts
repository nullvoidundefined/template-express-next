import { env } from "app/config/env.js";
import { logger } from "app/utils/logs/logger.js";

const GITHUB_API = "https://api.github.com";

interface GitHubHeaders {
  Authorization?: string;
  Accept: string;
  "User-Agent": string;
  "X-GitHub-Api-Version": string;
}

function githubHeaders(): GitHubHeaders {
  const headers: GitHubHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": "deployments-health-check-dashboard",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }
  return headers;
}

export interface GitHubData {
  last_commit_sha: string | null;
  last_commit_message: string | null;
  last_commit_author: string | null;
  last_commit_at: string | null;
  workflow_name: string | null;
  workflow_status: "success" | "failure" | "pending" | "cancelled" | null;
  workflow_run_url: string | null;
  build_logs_excerpt: string | null;
}

function checkRateLimit(response: Response): boolean {
  const remaining = response.headers.get("X-RateLimit-Remaining");
  if (remaining !== null && parseInt(remaining, 10) <= 10) {
    const reset = response.headers.get("X-RateLimit-Reset");
    logger.warn({ remaining, reset }, "GitHub API rate limit nearly exhausted, skipping poll");
    return false;
  }
  return true;
}

export async function pollGitHub(owner: string, repo: string, branch: string): Promise<GitHubData> {
  const data: GitHubData = {
    last_commit_sha: null,
    last_commit_message: null,
    last_commit_author: null,
    last_commit_at: null,
    workflow_name: null,
    workflow_status: null,
    workflow_run_url: null,
    build_logs_excerpt: null,
  };

  try {
    // 1. Fetch latest commit on branch
    const commitsRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=1`,
      { headers: githubHeaders() },
    );
    if (commitsRes.ok) {
      if (!checkRateLimit(commitsRes)) return data;
      const [commit] = await commitsRes.json();
      if (commit) {
        data.last_commit_sha = commit.sha?.slice(0, 7) ?? null;
        data.last_commit_message = commit.commit?.message?.split("\n")[0] ?? null;
        data.last_commit_author = commit.commit?.author?.name ?? null;
        data.last_commit_at = commit.commit?.author?.date ?? null;
      }
    }

    // 2. Fetch latest workflow run
    const runsRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/runs?branch=${branch}&per_page=1`,
      { headers: githubHeaders() },
    );
    if (runsRes.ok) {
      if (!checkRateLimit(runsRes)) return data;
      const runsData = await runsRes.json();
      const run = runsData.workflow_runs?.[0];
      if (run) {
        data.workflow_name = run.name ?? null;
        // Map GitHub conclusion to our enum
        const conclusion = run.conclusion;
        if (conclusion === "success") data.workflow_status = "success";
        else if (conclusion === "failure") data.workflow_status = "failure";
        else if (conclusion === "cancelled") data.workflow_status = "cancelled";
        else data.workflow_status = "pending"; // in_progress, queued, waiting, etc.
        data.workflow_run_url = run.html_url ?? null;

        // 3. If failure, fetch logs excerpt
        if (conclusion === "failure" && run.id) {
          try {
            const logsRes = await fetch(
              `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${run.id}/logs`,
              { headers: githubHeaders() },
            );
            if (logsRes.ok) {
              const text = await logsRes.text();
              // Take last 2KB
              data.build_logs_excerpt = text.slice(-2048);
            }
          } catch {
            // Non-critical
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err, owner, repo }, "GitHub polling failed");
  }

  return data;
}
