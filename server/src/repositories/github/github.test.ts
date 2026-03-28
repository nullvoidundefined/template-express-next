import { beforeEach, describe, expect, it, vi } from "vitest";

import * as pool from "app/db/pool/pool.js";
import { getGithubStatus, upsertGithubStatus } from "app/repositories/github/github.js";
import type { GitHubData } from "app/services/githubPoller.js";

vi.mock("app/db/pool/pool.js");

const mockData: GitHubData = {
  last_commit_sha: "abc1234",
  last_commit_message: "Fix a bug",
  last_commit_author: "Jane",
  last_commit_at: "2024-01-01T00:00:00Z",
  workflow_name: "CI",
  workflow_status: "success",
  workflow_run_url: "https://github.com/owner/repo/actions/runs/1",
  build_logs_excerpt: null,
};

describe("github repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertGithubStatus", () => {
    it("returns the upserted row", async () => {
      const mockRow = { id: "uuid-1", service_id: "svc-1", ...mockData, updated_at: new Date() };
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);

      const result = await upsertGithubStatus("svc-1", mockData);
      expect(result).toEqual(mockRow);
      expect(pool.query).toHaveBeenCalledOnce();
    });

    it("throws when no row returned", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      await expect(upsertGithubStatus("svc-1", mockData)).rejects.toThrow("Upsert returned no row");
    });
  });

  describe("getGithubStatus", () => {
    it("returns row when found", async () => {
      const mockRow = { id: "uuid-1", service_id: "svc-1", ...mockData, updated_at: new Date() };
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);

      const result = await getGithubStatus("svc-1");
      expect(result).toEqual(mockRow);
    });

    it("returns null when not found", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      const result = await getGithubStatus("svc-1");
      expect(result).toBeNull();
    });
  });
});
