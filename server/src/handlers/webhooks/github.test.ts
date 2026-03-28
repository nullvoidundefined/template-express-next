import crypto from "crypto";

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { githubWebhookHandler } from "app/handlers/webhooks/github.js";
import { errorHandler } from "app/middleware/errorHandler/errorHandler.js";
import * as githubRepo from "app/repositories/github/github.js";
import * as servicesRepo from "app/repositories/services/services.js";
import { uuid } from "app/utils/tests/uuids.js";

vi.mock("app/repositories/github/github.js");
vi.mock("app/repositories/services/services.js");
vi.mock("app/utils/logs/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("app/config/env.js", () => ({
  env: { GITHUB_WEBHOOK_SECRET: "test-webhook-secret" },
}));

const serviceId = uuid();

const app = express();
app.use(express.json());
app.post("/webhooks/github", githubWebhookHandler);
app.use(errorHandler);

function signPayload(body: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  return "sha256=" + hmac.update(body).digest("hex");
}

const mockService = {
  id: serviceId,
  name: "Test Service",
  url: "https://example.com",
  health_endpoint: null,
  github_owner: "myorg",
  github_repo: "myrepo",
  github_branch: "main",
  check_interval_seconds: 60,
  timeout_ms: 10000,
  expected_status_code: 200,
  screenshot_enabled: true,
  tags: [],
  created_at: new Date(),
  updated_at: new Date(),
};

describe("githubWebhookHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signature validation", () => {
    it("returns 401 when no signature provided", async () => {
      const body = JSON.stringify({ test: true });
      const res = await request(app)
        .post("/webhooks/github")
        .set("Content-Type", "application/json")
        .set("x-github-event", "push")
        .send(body);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Invalid signature");
    });

    it("returns 401 when wrong signature provided", async () => {
      const body = JSON.stringify({ test: true });
      const res = await request(app)
        .post("/webhooks/github")
        .set("Content-Type", "application/json")
        .set("x-github-event", "push")
        .set("x-hub-signature-256", "sha256=wrong")
        .send(body);
      expect(res.status).toBe(401);
    });

    it("returns 200 with correct signature", async () => {
      vi.mocked(servicesRepo.listServices).mockResolvedValueOnce([]);
      const body = JSON.stringify({ test: true });
      const sig = signPayload(body, "test-webhook-secret");
      const res = await request(app)
        .post("/webhooks/github")
        .set("Content-Type", "application/json")
        .set("x-github-event", "ping")
        .set("x-hub-signature-256", sig)
        .send(body);
      expect(res.status).toBe(200);
    });
  });

  describe("push event", () => {
    it("upserts github status for matching service", async () => {
      vi.mocked(servicesRepo.listServices).mockResolvedValueOnce([mockService]);
      vi.mocked(githubRepo.upsertGithubStatus).mockResolvedValueOnce({} as never);

      const pushPayload = {
        ref: "refs/heads/main",
        after: "abc1234567",
        repository: { name: "myrepo", owner: { login: "myorg" } },
        head_commit: {
          message: "Fix bug\n\nDetails",
          author: { name: "Jane" },
          timestamp: "2024-01-01T00:00:00Z",
        },
      };
      const body = JSON.stringify(pushPayload);
      const sig = signPayload(body, "test-webhook-secret");

      const res = await request(app)
        .post("/webhooks/github")
        .set("Content-Type", "application/json")
        .set("x-github-event", "push")
        .set("x-hub-signature-256", sig)
        .send(body);

      expect(res.status).toBe(200);
      expect(githubRepo.upsertGithubStatus).toHaveBeenCalledOnce();
      const call = vi.mocked(githubRepo.upsertGithubStatus).mock.calls[0];
      expect(call?.[0]).toBe(serviceId);
      expect(call?.[1].last_commit_sha).toBe("abc1234");
      expect(call?.[1].last_commit_message).toBe("Fix bug");
    });

    it("does not upsert for non-matching service", async () => {
      vi.mocked(servicesRepo.listServices).mockResolvedValueOnce([mockService]);

      const pushPayload = {
        ref: "refs/heads/other-branch",
        after: "abc1234567",
        repository: { name: "myrepo", owner: { login: "myorg" } },
        head_commit: { message: "Fix", author: { name: "Jane" }, timestamp: "2024-01-01" },
      };
      const body = JSON.stringify(pushPayload);
      const sig = signPayload(body, "test-webhook-secret");

      const res = await request(app)
        .post("/webhooks/github")
        .set("Content-Type", "application/json")
        .set("x-github-event", "push")
        .set("x-hub-signature-256", sig)
        .send(body);

      expect(res.status).toBe(200);
      expect(githubRepo.upsertGithubStatus).not.toHaveBeenCalled();
    });
  });

  describe("workflow_run event", () => {
    it("upserts workflow status for matching service", async () => {
      vi.mocked(servicesRepo.listServices).mockResolvedValueOnce([mockService]);
      vi.mocked(githubRepo.upsertGithubStatus).mockResolvedValueOnce({} as never);

      const workflowPayload = {
        repository: { name: "myrepo", owner: { login: "myorg" } },
        workflow_run: {
          name: "CI",
          conclusion: "failure",
          status: "completed",
          html_url: "https://github.com/actions/runs/42",
        },
      };
      const body = JSON.stringify(workflowPayload);
      const sig = signPayload(body, "test-webhook-secret");

      const res = await request(app)
        .post("/webhooks/github")
        .set("Content-Type", "application/json")
        .set("x-github-event", "workflow_run")
        .set("x-hub-signature-256", sig)
        .send(body);

      expect(res.status).toBe(200);
      expect(githubRepo.upsertGithubStatus).toHaveBeenCalledOnce();
      const call = vi.mocked(githubRepo.upsertGithubStatus).mock.calls[0];
      expect(call?.[1].workflow_status).toBe("failure");
      expect(call?.[1].workflow_name).toBe("CI");
    });

    it("maps in-progress workflow to pending", async () => {
      vi.mocked(servicesRepo.listServices).mockResolvedValueOnce([mockService]);
      vi.mocked(githubRepo.upsertGithubStatus).mockResolvedValueOnce({} as never);

      const workflowPayload = {
        repository: { name: "myrepo", owner: { login: "myorg" } },
        workflow_run: {
          name: "CI",
          conclusion: null,
          status: "in_progress",
          html_url: "https://github.com/actions/runs/43",
        },
      };
      const body = JSON.stringify(workflowPayload);
      const sig = signPayload(body, "test-webhook-secret");

      const res = await request(app)
        .post("/webhooks/github")
        .set("Content-Type", "application/json")
        .set("x-github-event", "workflow_run")
        .set("x-hub-signature-256", sig)
        .send(body);

      expect(res.status).toBe(200);
      const call = vi.mocked(githubRepo.upsertGithubStatus).mock.calls[0];
      expect(call?.[1].workflow_status).toBe("pending");
    });
  });

  it("returns 200 for unknown events without doing any upserts", async () => {
    vi.mocked(servicesRepo.listServices).mockResolvedValueOnce([mockService]);
    const body = JSON.stringify({ foo: "bar" });
    const sig = signPayload(body, "test-webhook-secret");

    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("x-github-event", "issues")
      .set("x-hub-signature-256", sig)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
    expect(githubRepo.upsertGithubStatus).not.toHaveBeenCalled();
  });
});
