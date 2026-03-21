import type { Request, Response, NextFunction } from "express";

const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Rejects state-changing requests that lack X-Requested-With.
 * Reduces CSRF risk when using cookie-based sessions with credentials.
 * Frontend must send X-Requested-With: XMLHttpRequest (or any value) on non-GET requests.
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (!STATE_CHANGING_METHODS.includes(req.method)) {
    next();
    return;
  }
  const value = req.get("X-Requested-With");
  if (!value) {
    res.status(403).json({ error: { message: "Missing X-Requested-With header" } });
    return;
  }
  next();
}
