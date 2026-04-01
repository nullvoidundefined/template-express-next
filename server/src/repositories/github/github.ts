import { query } from "app/db/pool/pool.js";
import type { GitHubData } from "app/services/githubPoller.js";

export interface GithubStatusRow {
  id: string;
  service_id: string;
  last_commit_sha: string | null;
  last_commit_message: string | null;
  last_commit_author: string | null;
  last_commit_at: Date | null;
  workflow_name: string | null;
  workflow_status: "success" | "failure" | "pending" | "cancelled" | null;
  workflow_run_url: string | null;
  build_logs_excerpt: string | null;
  updated_at: Date;
}

export async function upsertGithubStatus(
  serviceId: string,
  data: GitHubData,
): Promise<GithubStatusRow> {
  const result = await query<GithubStatusRow>(
    `INSERT INTO github_status
      (service_id, last_commit_sha, last_commit_message, last_commit_author,
       last_commit_at, workflow_name, workflow_status, workflow_run_url, build_logs_excerpt)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (service_id) DO UPDATE SET
       last_commit_sha = COALESCE(EXCLUDED.last_commit_sha, github_status.last_commit_sha),
       last_commit_message = COALESCE(EXCLUDED.last_commit_message, github_status.last_commit_message),
       last_commit_author = COALESCE(EXCLUDED.last_commit_author, github_status.last_commit_author),
       last_commit_at = COALESCE(EXCLUDED.last_commit_at, github_status.last_commit_at),
       workflow_name = COALESCE(EXCLUDED.workflow_name, github_status.workflow_name),
       workflow_status = COALESCE(EXCLUDED.workflow_status, github_status.workflow_status),
       workflow_run_url = COALESCE(EXCLUDED.workflow_run_url, github_status.workflow_run_url),
       build_logs_excerpt = COALESCE(EXCLUDED.build_logs_excerpt, github_status.build_logs_excerpt),
       updated_at = NOW()
     RETURNING *`,
    [
      serviceId,
      data.last_commit_sha,
      data.last_commit_message,
      data.last_commit_author,
      data.last_commit_at,
      data.workflow_name,
      data.workflow_status,
      data.workflow_run_url,
      data.build_logs_excerpt,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Upsert returned no row");
  return row;
}

export async function getGithubStatus(serviceId: string): Promise<GithubStatusRow | null> {
  const result = await query<GithubStatusRow>(`SELECT * FROM github_status WHERE service_id = $1`, [
    serviceId,
  ]);
  return result.rows[0] ?? null;
}
