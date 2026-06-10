import { HTTP } from 'app/constants/httpConstants.js';
import { describe, expect, it } from 'vitest';

describe('HTTP.STATUS', () => {
  it('maps each status name to its numeric code', () => {
    expect(HTTP.STATUS.BAD_REQUEST).toBe(400);
    expect(HTTP.STATUS.CONFLICT).toBe(409);
    expect(HTTP.STATUS.CREATED).toBe(201);
    expect(HTTP.STATUS.FORBIDDEN).toBe(403);
    expect(HTTP.STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    expect(HTTP.STATUS.NO_CONTENT).toBe(204);
    expect(HTTP.STATUS.NOT_FOUND).toBe(404);
    expect(HTTP.STATUS.OK).toBe(200);
    expect(HTTP.STATUS.REQUEST_TIMEOUT).toBe(408);
    expect(HTTP.STATUS.SERVICE_UNAVAILABLE).toBe(503);
    expect(HTTP.STATUS.TOO_MANY_REQUESTS).toBe(429);
    expect(HTTP.STATUS.UNAUTHORIZED).toBe(401);
  });
});
