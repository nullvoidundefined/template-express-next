import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import type { Request, Response } from 'express';

// Return a consistent JSON response for any unmatched route instead of the default HTML 404.
export function notFoundHandler(_req: Request, res: Response) {
  res
    .status(HTTP.STATUS.NOT_FOUND)
    .json(createErrorResponse(ERROR_CODES.ROUTING.NOT_FOUND, 'Not found'));
}
