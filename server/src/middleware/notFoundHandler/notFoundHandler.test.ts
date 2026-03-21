import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { notFoundHandler } from "app/middleware/notFoundHandler/notFoundHandler.js";

const app = express();
app.use(notFoundHandler);

describe("notFoundHandler", () => {
  it("returns 404 JSON with the requested path", async () => {
    const res = await request(app).get("/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        message: "Not found",
        path: "/nonexistent",
      },
    });
  });
});
