import type { Request, Response } from "express";

import { isProduction } from "app/config/env.js";
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from "app/constants/session.js";
import * as authRepo from "app/repositories/auth/auth.js";
import { loginSchema, registerSchema } from "app/schemas/auth.js";
import { logger } from "app/utils/logs/logger.js";

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: SESSION_TTL_MS,
  path: "/",
  sameSite: "lax" as const,
  secure: isProduction(),
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
    logger.info({ event: "register_success", userId: user.id, ip: req.ip }, "User registered");
    res.cookie(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
    res.status(201).json({ user: { id: user.id, email: user.email, created_at: user.created_at } });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined;
    if (code === "23505") {
      logger.warn(
        { event: "register_duplicate_email", ip: req.ip },
        "Registration failed: email already registered",
      );
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
    logger.warn(
      { event: "login_failure", reason: "user_not_found", ip: req.ip },
      "Login failed: user not found",
    );
    res.status(401).json({ error: { message: "Invalid email or password" } });
    return;
  }
  const valid = await authRepo.verifyPassword(password, user.password_hash);
  if (!valid) {
    logger.warn(
      { event: "login_failure", reason: "wrong_password", userId: user.id, ip: req.ip },
      "Login failed: wrong password",
    );
    res.status(401).json({ error: { message: "Invalid email or password" } });
    return;
  }
  const sessionId = await authRepo.loginUser(user.id);
  logger.info({ event: "login_success", userId: user.id, ip: req.ip }, "User logged in");
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
  const userId = req.user?.id;
  logger.info({ event: "logout", userId, ip: req.ip }, "User logged out");
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: req.user });
}
