import { logger } from 'app/utils/logs/logger.js';
import type { NextFunction, Request, Response } from 'express';

// Centralized error handler to ensure all uncaught errors are logged once and surfaced with a safe JSON response.
// The full error is only exposed in non-production environments to avoid leaking implementation details.

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const isProd = process.env.NODE_ENV === 'production';
  const status =
    err &&
    typeof err === 'object' &&
    'status' in err &&
    typeof err.status === 'number'
      ? err.status
      : err &&
          typeof err === 'object' &&
          'statusCode' in err &&
          typeof err.statusCode === 'number'
        ? err.statusCode
        : 500;

  logger.error({ err, reqId: req.id }, 'Unhandled error in request handler');

  res.status(status).json({
    error: {
      message:
        isProd && status === 500
          ? 'Internal server error'
          : err instanceof Error
            ? err.message
            : String(err),
    },
  });
}
