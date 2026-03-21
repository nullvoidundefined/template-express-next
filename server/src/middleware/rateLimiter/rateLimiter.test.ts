import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { authRateLimiter, rateLimiter } from "app/middleware/rateLimiter/rateLimiter.js";

function buildApp(limiter: ReturnType<typeof import("express-rate-limit").default>) {
  const app = express();
  app.use(limiter);
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("rateLimiter", () => {
  it("allows requests under the limit", async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("sets standard rate-limit headers", async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get("/test");
    expect(res.headers["ratelimit-limit"]).toBeDefined();
    expect(res.headers["ratelimit-remaining"]).toBeDefined();
  });

  it("does not set legacy X-RateLimit headers", async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get("/test");
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
  });
});

describe("authRateLimiter", () => {
  it("allows requests under the limit", async () => {
    const app = buildApp(authRateLimiter);
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("returns 429 after exceeding the auth limit", async () => {
    const app = buildApp(authRateLimiter);

    for (let i = 0; i < 10; i++) {
      await request(app).get("/test");
    }

    const blocked = await request(app).get("/test");
    expect(blocked.status).toBe(429);
  });
});
