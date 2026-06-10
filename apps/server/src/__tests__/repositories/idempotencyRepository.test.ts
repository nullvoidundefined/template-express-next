import { mockResult } from 'app/__tests__/helpers/mockResult.js';
import { uuid } from 'app/__tests__/helpers/uuids.js';
import { createIdempotencyRepo } from 'app/repositories/idempotencyRepository.js';
import type { IdempotencyRepoDeps } from 'app/repositories/idempotencyRepository.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const repo = createIdempotencyRepo({
  query: mockQuery,
} as unknown as IdempotencyRepoDeps);

const userId = uuid();

describe('idempotency repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findByKey', () => {
    it('scopes the lookup to key + user and a 24h TTL window', async () => {
      mockQuery.mockResolvedValueOnce(
        mockResult([{ response_body: { data: 1 }, status_code: 201 }]),
      );

      const result = await repo.findByKey('key-1', userId);

      expect(result).toEqual({ response_body: { data: 1 }, status_code: 201 });
      const [sql, values] = mockQuery.mock.calls[0] ?? [];
      expect(sql).toContain('WHERE key = $1 AND user_id = $2');
      expect(sql).toContain("INTERVAL '1 hour'");
      expect(values).toEqual(['key-1', userId, 24]);
    });

    it('returns null when no unexpired row matches', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));

      const result = await repo.findByKey('key-1', userId);

      expect(result).toBeNull();
    });
  });

  describe('store', () => {
    it('inserts the key, user, status, and JSON-serialized body', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));

      await repo.store('key-1', userId, 201, { data: 'ok' });

      const [sql, values] = mockQuery.mock.calls[0] ?? [];
      expect(sql).toContain('INSERT INTO idempotency_keys');
      expect(values).toEqual([
        'key-1',
        userId,
        201,
        JSON.stringify({ data: 'ok' }),
      ]);
    });
  });
});
