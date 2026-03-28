import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getGithubStatusHandler } from "app/handlers/github/github.js";
import { errorHandler } from "app/middleware/errorHandler/errorHandler.js";
import * as githubRepo from "app/repositories/github/github.js";
import * as servicesRepo from "app/repositories/services/services.js";
import { uuid } from "app/utils/tests/uuids.js";

vi.mock("app/repositories/github/github.js");
vi.mock("app/repositories/services/services.js");
vi.mock("app/utils/logs/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const serviceId = uuid();

const app = express();
app.use(express.json());
app.get("/:id/github", getGithubStatusHandler);
app.use(errorHandler);

const mockService = {
  id: serviceId,
  name: "Test Service",
  url: "https://example.com",
  health_endpoint: null,
  github_owner: "owner",
  github_repo: "repo",
  github_branch: "main",
  check_interval_seconds: 60,
  timeout_ms: 10000,
  expected_status_code: 200,
  screenshot_enabled: true,
  tags: [],
  created_at: new Date(),
  updated_at: new Date(),
};

describe("getGithubStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid ID", async () => {
    const res = await request(app).get("/not-a-uuid/github");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Invalid service ID");
  });

  it("returns 404 when service not found", async () => {
    vi.mocked(servicesRepo.getServiceById).mockResolvedValueOnce(null);
    const res = await request(app).get(`/${serviceId}/github`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Service not found");
  });

  it("returns github status when found", async () => {
    const mockStatus = {
      id: uuid(),
      service_id: serviceId,
      last_commit_sha: "abc1234",
      last_commit_message: "Fix bug",
      last_commit_author: "Jane",
      last_commit_at: new Date("2024-01-01"),
      workflow_name: "CI",
      workflow_status: "success" as const,
      workflow_run_url: "https://github.com/actions/runs/1",
      build_logs_excerpt: null,
      updated_at: new Date(),
    };
    vi.mocked(servicesRepo.getServiceById).mockResolvedValueOnce(mockService);
    vi.mocked(githubRepo.getGithubStatus).mockResolvedValueOnce(mockStatus);

    const res = await request(app).get(`/${serviceId}/github`);
    expect(res.status).toBe(200);
    expect(res.body.data.last_commit_sha).toBe("abc1234");
    expect(res.body.data.workflow_status).toBe("success");
  });

  it("returns null data when no github status exists", async () => {
    vi.mocked(servicesRepo.getServiceById).mockResolvedValueOnce(mockService);
    vi.mocked(githubRepo.getGithubStatus).mockResolvedValueOnce(null);

    const res = await request(app).get(`/${serviceId}/github`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("returns 500 when repo throws", async () => {
    vi.mocked(servicesRepo.getServiceById).mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get(`/${serviceId}/github`);
    expect(res.status).toBe(500);
  });
});
