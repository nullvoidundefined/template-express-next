import { mockResult } from 'app/__tests__/helpers/mockResult.js';
import { uuid } from 'app/__tests__/helpers/uuids.js';
import type { PoolClient } from 'app/database/databasePool.js';
import { createIdempotencyRepo } from 'app/repositories/idempotencyRepository.js';
import type { IdempotencyRepoDeps } from 'app/repositories/idempotencyRepository.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const fakeClient = {} as PoolClient;

// Runs the callback with a stand-in client so a transactional claim still
// reaches the fake query, whichever of the two the implementation uses.
function fakeWithTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return fn(fakeClient);
}

const repo = createIdempotencyRepo({
  query: mockQuery,
  withTransaction: fakeWithTransaction,
} as unknown as IdempotencyRepoDeps);

const userId = uuid();

const claimInput = {
  key: 'key-1',
  requestBodyHash: 'a'.repeat(64),
  requestMethod: 'POST',
  requestPath: '/v1/posts',
  userId,
};

describe('idempotency repository', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('findKey', () => {
    it('maps a completed row to the camelCase stored key', async () => {
      mockQuery.mockResolvedValue(
        mockResult([
          {
            request_body_hash: 'b'.repeat(64),
            request_method: 'POST',
            request_path: '/v1/posts',
            response_body: { data: { id: 'p1' } },
            status: 'completed',
            status_code: 201,
          },
        ]),
      );

      const stored = await repo.findKey('key-1', userId);

      expect(stored).toEqual({
        requestBodyHash: 'b'.repeat(64),
        requestMethod: 'POST',
        requestPath: '/v1/posts',
        responseBody: { data: { id: 'p1' } },
        status: 'completed',
        statusCode: 201,
      });
    });

    it('keeps null status code and body for an in-progress row', async () => {
      mockQuery.mockResolvedValue(
        mockResult([
          {
            request_body_hash: 'c'.repeat(64),
            request_method: 'PUT',
            request_path: '/v1/posts/p1',
            response_body: null,
            status: 'in_progress',
            status_code: null,
          },
        ]),
      );

      const stored = await repo.findKey('key-1', userId);

      expect(stored).toEqual({
        requestBodyHash: 'c'.repeat(64),
        requestMethod: 'PUT',
        requestPath: '/v1/posts/p1',
        responseBody: null,
        status: 'in_progress',
        statusCode: null,
      });
    });

    it('keeps null fingerprint fields for a row stored before the fingerprint existed', async () => {
      mockQuery.mockResolvedValue(
        mockResult([
          {
            request_body_hash: null,
            request_method: null,
            request_path: null,
            response_body: { data: 'legacy' },
            status: 'completed',
            status_code: 200,
          },
        ]),
      );

      const stored = await repo.findKey('key-1', userId);

      expect(stored).toEqual({
        requestBodyHash: null,
        requestMethod: null,
        requestPath: null,
        responseBody: { data: 'legacy' },
        status: 'completed',
        statusCode: 200,
      });
    });

    it('returns null when no row exists for the key and user', async () => {
      mockQuery.mockResolvedValue(mockResult([]));

      const stored = await repo.findKey('key-1', userId);

      expect(stored).toBeNull();
    });
  });

  describe('claimKey', () => {
    it('returns true when the claim wrote a row', async () => {
      mockQuery.mockResolvedValue(mockResult([{ key: 'key-1' }], 1));

      const isClaimed = await repo.claimKey(claimInput);

      expect(isClaimed).toBe(true);
    });

    it('returns false when an unexpired row already holds the key', async () => {
      mockQuery.mockResolvedValue(mockResult([], 0));

      const isClaimed = await repo.claimKey(claimInput);

      expect(isClaimed).toBe(false);
    });
  });
});
