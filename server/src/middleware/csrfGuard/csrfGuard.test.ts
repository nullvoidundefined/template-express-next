import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { csrfGuard } from "app/middleware/csrfGuard/csrfGuard.js";

const app = express();
app.use(express.json());
app.use(csrfGuard);
app.get("/get-ok", (_req, res) => res.status(200).json({ ok: true }));
app.post("/post-ok", (_req, res) => res.status(200).json({ ok: true }));
app.put("/put-ok", (_req, res) => res.status(200).json({ ok: true }));
app.patch("/patch-ok", (_req, res) => res.status(200).json({ ok: true }));
app.delete("/delete-ok", (_req, res) => res.status(200).json({ ok: true }));

describe("csrfGuard", () => {
  it("allows GET without X-Requested-With", async () => {
    const res = await request(app).get("/get-ok");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("rejects POST without X-Requested-With with 403", async () => {
    const res = await request(app).post("/post-ok").send({});
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("Missing X-Requested-With header");
  });

  it("allows POST with X-Requested-With header", async () => {
    const res = await request(app)
      .post("/post-ok")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("rejects PUT without header with 403", async () => {
    const res = await request(app).put("/put-ok").send({});
    expect(res.status).toBe(403);
  });

  it("rejects PATCH without header with 403", async () => {
    const res = await request(app).patch("/patch-ok").send({});
    expect(res.status).toBe(403);
  });

  it("rejects DELETE without header with 403", async () => {
    const res = await request(app).delete("/delete-ok");
    expect(res.status).toBe(403);
  });

  it("allows DELETE with X-Requested-With", async () => {
    const res = await request(app).delete("/delete-ok").set("X-Requested-With", "any");
    expect(res.status).toBe(200);
  });
});
