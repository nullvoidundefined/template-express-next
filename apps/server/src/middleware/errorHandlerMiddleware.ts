import { env } from 'app/config/envConfig.js';
import {
  ERROR_CODES,
  type ErrorCode,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import { logger } from 'app/services/loggerService.js';
import type { NextFunction, Request, Response } from 'express';

// Centralized error handler to ensure all uncaught errors are logged once and surfaced with a safe JSON response.
// The full error is only exposed in non-production environments to avoid leaking implementation details.

// Maps a derived HTTP status to a machine-readable error code so the response
// carries a stable { code, error } envelope. Unmapped statuses fall back to the
// generic internal-error code.
const STATUS_TO_CODE: Record<number, ErrorCode> = {
  [HTTP.STATUS.BAD_REQUEST]: ERROR_CODES.INPUT.VALIDATION_ERROR,
  [HTTP.STATUS.UNAUTHORIZED]: ERROR_CODES.AUTH.REQUIRED,
  [HTTP.STATUS.FORBIDDEN]: ERROR_CODES.AUTH.REQUIRED,
  [HTTP.STATUS.NOT_FOUND]: ERROR_CODES.ROUTING.NOT_FOUND,
  [HTTP.STATUS.REQUEST_TIMEOUT]: ERROR_CODES.SERVER.REQUEST_TIMEOUT,
  [HTTP.STATUS.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMIT.EXCEEDED,
  [HTTP.STATUS.INTERNAL_SERVER_ERROR]: ERROR_CODES.SERVER.INTERNAL_ERROR,
  [HTTP.STATUS.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVER.DATABASE_UNAVAILABLE,
};

// Postgres SQLSTATE classes that mean the database is unavailable, not a bug in
// our code. A request hitting one of these should retry, hence 503 not 500.
const PG_UNAVAILABLE_CODES = new Set([
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
]);

// Detects driver-level and server-side connectivity failures so they surface as
// 503 DATABASE_UNAVAILABLE instead of a generic 500. These errors carry a `code`
// but no HTTP `status`, so the status-based path below would misclassify them.
function isDatabaseError(err: unknown): boolean {
  if (!err || typeof err !== 'object' || !('code' in err)) return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string') return false;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    PG_UNAVAILABLE_CODES.has(code)
  );
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const isProd = env.NODE_ENV === 'production';

  if (isDatabaseError(err)) {
    logger.error({ err, reqId: req.id }, 'Database unavailable');
    res
      .status(HTTP.STATUS.SERVICE_UNAVAILABLE)
      .json(
        createErrorResponse(
          ERROR_CODES.SERVER.DATABASE_UNAVAILABLE,
          'Service temporarily unavailable',
        ),
      );
    return;
  }

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
        : HTTP.STATUS.INTERNAL_SERVER_ERROR;

  logger.error({ err, reqId: req.id }, 'Unhandled error in request handler');

  const code = STATUS_TO_CODE[status] ?? ERROR_CODES.SERVER.INTERNAL_ERROR;
  const message =
    isProd && status === HTTP.STATUS.INTERNAL_SERVER_ERROR
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : String(err);

  res.status(status).json(createErrorResponse(code, message));
}
