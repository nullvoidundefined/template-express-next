import {
  ERROR_CODES,
  createErrorResponse,
} from 'app/constants/errorCodesConstants.js';
import { HTTP } from 'app/constants/httpConstants.js';
import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

type RequestSource = 'body' | 'params' | 'query';

// Returns middleware that validates req[source] against the schema. On success
// it overwrites req[source] with the parsed (and coerced) data so handlers read
// typed, normalized values; on failure it returns 400 with the first issue.
function validate(schema: ZodType, source: RequestSource = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const firstError = result.error.issues[0]?.message ?? 'Invalid request';
      res
        .status(HTTP.STATUS.BAD_REQUEST)
        .json(
          createErrorResponse(ERROR_CODES.INPUT.VALIDATION_ERROR, firstError),
        );
      return;
    }

    // Mutate in place: req.body/params/query are read-only properties, so the
    // coerced data is written onto the existing object rather than reassigned.
    Object.assign(req[source], result.data);
    next();
  };
}

export { validate };
