import type { NextFunction, Request, Response } from "express";

import { logger } from "app/utils/logs/logger.js";

// Centralized error handler to ensure all uncaught errors are logged once and surfaced with a safe JSON response.
// The full error is only exposed in non-production environments to avoid leaking implementation details.

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 4th arg required so Express recognizes this as error-handling middleware
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const isProd = process.env.NODE_ENV === "production";
  const status =
    err && typeof err === "object" && "status" in err && typeof err.status === "number"
      ? err.status
      : err && typeof err === "object" && "statusCode" in err && typeof err.statusCode === "number"
        ? err.statusCode
        : 500;

  logger.error({ err, reqId: req.id }, "Unhandled error in request handler");

  res.status(status).json({
    error: {
      message:
        isProd && status === 500
          ? "Internal server error"
          : err instanceof Error
            ? err.message
            : String(err),
    },
  });
}
