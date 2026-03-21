import type { Request, Response, NextFunction } from "express";

import { SESSION_COOKIE_NAME } from "app/constants/session.js";
import * as authRepo from "app/repositories/auth/auth.js";

export async function loadSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token || typeof token !== "string") {
    next();
    return;
  }
  try {
    const user = await authRepo.getSessionWithUser(token);
    if (user) req.user = user;
  } catch (err) {
    next(err);
    return;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: { message: "Authentication required" } });
    return;
  }
  next();
}
