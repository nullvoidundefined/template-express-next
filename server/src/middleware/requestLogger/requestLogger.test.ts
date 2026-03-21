import express from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("app/utils/logs/logger.js", () => ({
  logger: pino({ level: "silent" }),
}));

import { requestLogger } from "app/middleware/requestLogger/requestLogger.js";

const app = express();
app.use(requestLogger);
app.get("/test", (_req, res) => res.json({ ok: true }));

describe("requestLogger", () => {
  it("generates a request ID when none is provided", async () => {
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("echoes back a provided x-request-id header", async () => {
    const customId = "my-custom-request-id-123";
    const res = await request(app).get("/test").set("x-request-id", customId);
    expect(res.headers["x-request-id"]).toBe(customId);
  });

  it("truncates request IDs longer than 64 characters", async () => {
    const longId = "a".repeat(100);
    const res = await request(app).get("/test").set("x-request-id", longId);
    expect(res.headers["x-request-id"]).toBe("a".repeat(64));
  });

  it("generates unique IDs across requests", async () => {
    const res1 = await request(app).get("/test");
    const res2 = await request(app).get("/test");
    expect(res1.headers["x-request-id"]).not.toBe(res2.headers["x-request-id"]);
  });
});
