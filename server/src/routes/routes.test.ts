/**
 * Single smoke test for route wiring: verifies each path/method reaches the correct handler.
 * Handler behavior is covered by handler tests; this only guards against broken router wiring.
 */
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { authRouter } from "app/routes/auth.js";

vi.mock("app/handlers/auth/auth.js", () => ({
  register: (_: express.Request, res: express.Response) => res.status(201).json({ ok: true }),
  login: (_: express.Request, res: express.Response) => res.status(200).json({ ok: true }),
  logout: (_: express.Request, res: express.Response) => res.status(204).send(),
  me: (_: express.Request, res: express.Response) => res.status(200).json({ ok: true }),
}));
vi.mock("app/utils/rateLimiter.js", () => ({
  authRateLimiter: (_: express.Request, __: express.Response, next: express.NextFunction) => next(),
}));

const app = express();
app.use(express.json());
app.use("/auth", authRouter);

describe("route wiring", () => {
  describe("auth", () => {
    it("POST /auth/register → 201", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ email: "a@b.com", password: "x" });
      expect(res.status).toBe(201);
    });
    it("POST /auth/login → 200", async () => {
      const res = await request(app).post("/auth/login").send({ email: "a@b.com", password: "x" });
      expect(res.status).toBe(200);
    });
    it("POST /auth/logout → 204", async () => {
      const res = await request(app).post("/auth/logout");
      expect(res.status).toBe(204);
    });
    it("GET /auth/me → 401 when unauthenticated", async () => {
      const res = await request(app).get("/auth/me");
      expect(res.status).toBe(401);
    });
  });
});
