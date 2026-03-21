import type { Request, Response } from "express";

import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from "app/constants/session.js";
import * as authRepo from "app/repositories/auth/auth.js";
import { loginSchema, registerSchema } from "app/schemas/auth.js";
import { logger } from "app/utils/logs/logger.js";

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: SESSION_TTL_MS,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join("; ");
    res.status(400).json({ error: { message } });
    return;
  }
  const { email, password } = parsed.data;
  try {
    const { user, sessionId } = await authRepo.createUserAndSession(email, password);
    res.cookie(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
    res.status(201).json({ user: { id: user.id, email: user.email, created_at: user.created_at } });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined;
    if (code === "23505") {
      res.status(409).json({ error: { message: "Email already registered" } });
      return;
    }
    throw err;
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join("; ");
    res.status(400).json({ error: { message } });
    return;
  }
  const { email, password } = parsed.data;
  const user = await authRepo.findUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: { message: "Invalid email or password" } });
    return;
  }
  const valid = await authRepo.verifyPassword(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: { message: "Invalid email or password" } });
    return;
  }
  await authRepo.deleteSessionsForUser(user.id);
  const sessionId = await authRepo.createSession(user.id);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.cookie(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
  res.json({ user: { id: user.id, email: user.email, created_at: user.created_at } });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token && typeof token === "string") {
    try {
      await authRepo.deleteSession(token);
    } catch (err) {
      logger.error({ err }, "Failed to delete session on logout");
    }
  }
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: req.user });
}
