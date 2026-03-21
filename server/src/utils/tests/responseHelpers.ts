import { expect } from "vitest";

/** Supertest response-like (status + body). */
export interface ResLike {
  status: number;
  body: Record<string, unknown>;
}

export function expectError(res: ResLike, status: number, message: string): void {
  expect(res.status).toBe(status);
  expect((res.body?.error as { message?: string } | undefined)?.message).toBe(message);
}

/** Asserts list-handler response: 200, body.data (serialized), body.meta (total, limit 50, offset 0). */
export function expectListResponse(res: ResLike, data: unknown[], total: number): void {
  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    data: JSON.parse(JSON.stringify(data)),
    meta: { total, limit: 50, offset: 0 },
  });
}
