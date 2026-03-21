import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_NAME } from "app/constants/session.js";
import { loadSession, requireAuth } from "app/middleware/requireAuth/requireAuth.js";
import * as authRepo from "app/repositories/auth/auth.js";
import { uuid } from "app/utils/tests/uuids.js";

vi.mock("app/repositories/auth/auth.js");

const id = uuid();
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(loadSession);
app.get("/protected", requireAuth, (req, res) => res.json({ user: req.user }));

describe("requireAuth", () => {
  it("returns 401 when req.user is not set", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Authentication required");
  });
});

describe("loadSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next without setting req.user when no cookie", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(authRepo.getSessionWithUser).not.toHaveBeenCalled();
  });

  it("sets req.user when session valid", async () => {
    const user = {
      id: id,
      email: "u@example.com",
      created_at: new Date("2025-01-01"),
      updated_at: null,
    };
    vi.mocked(authRepo.getSessionWithUser).mockResolvedValueOnce(user);

    const res = await request(app)
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=valid-token`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: id,
      email: "u@example.com",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: null,
    });
    expect(authRepo.getSessionWithUser).toHaveBeenCalledWith("valid-token");
  });

  it("does not set req.user when getSessionWithUser returns null", async () => {
    vi.mocked(authRepo.getSessionWithUser).mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=expired-token`);

    expect(res.status).toBe(401);
    expect(authRepo.getSessionWithUser).toHaveBeenCalledWith("expired-token");
  });

  it("calls next(err) when getSessionWithUser throws", async () => {
    const dbError = new Error("connection refused");
    vi.mocked(authRepo.getSessionWithUser).mockRejectedValueOnce(dbError);

    const res = await request(app)
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=some-token`);

    expect(res.status).toBe(500);
    expect(authRepo.getSessionWithUser).toHaveBeenCalledWith("some-token");
  });
});
