import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "app/middleware/errorHandler/errorHandler.js";

vi.mock("app/utils/logs/logger.js", () => ({
  logger: { error: vi.fn() },
}));

const app = express();
app.get("/boom", (_req: Request, _res: Response, next: NextFunction) => {
  next(new Error("kaboom"));
});
app.use(errorHandler);

describe("errorHandler", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("returns 500 with error detail in non-production", async () => {
    process.env.NODE_ENV = "development";
    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body.error.message).toContain("kaboom");
  });

  it("hides error detail in production", async () => {
    process.env.NODE_ENV = "production";
    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe("Internal server error");
  });
});
