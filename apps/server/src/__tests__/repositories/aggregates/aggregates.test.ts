import { mockResult } from 'app/__tests__/helpers/mockResult.js';
import { query } from 'app/db/pool/pool.js';
import {
  deleteRolledUpChecks,
  getDailyUptimeFromAggregates,
  rollupDaily,
  rollupHourly,
} from 'app/repositories/aggregates/aggregates.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/db/pool/pool.js', () => ({ query: vi.fn() }));

const mockQuery = vi.mocked(query);

describe('aggregates repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rollupHourly', () => {
    it('inserts hourly aggregates and returns row count', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([{ id: 'a' }, { id: 'b' }]));
      const count = await rollupHourly(30);
      expect(count).toBe(2);
      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0] as [string, string[]];
      expect(sql).toContain('INSERT INTO check_aggregates');
      expect(sql).toContain("date_trunc('hour', checked_at)");
      expect(sql).toContain('ON CONFLICT');
      expect(params).toEqual(['30']);
    });

    it('uses default 30 days when no argument provided', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));
      await rollupHourly();
      const [, params] = mockQuery.mock.calls[0] as [string, string[]];
      expect(params).toEqual(['30']);
    });

    it('returns 0 when no new rows inserted', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      });
      const count = await rollupHourly();
      expect(count).toBe(0);
    });
  });

  describe('rollupDaily', () => {
    it('inserts daily aggregates from hourly data', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([{ id: 'x' }]));
      const count = await rollupDaily(365);
      expect(count).toBe(1);
      const [sql, params] = mockQuery.mock.calls[0] as [string, string[]];
      expect(sql).toContain('INSERT INTO check_aggregates');
      expect(sql).toContain("period_type = 'hourly'");
      expect(sql).toContain("date_trunc('day', period_start)");
      expect(params).toEqual(['365']);
    });

    it('uses default 365 days when no argument provided', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));
      await rollupDaily();
      const [, params] = mockQuery.mock.calls[0] as [string, string[]];
      expect(params).toEqual(['365']);
    });
  });

  describe('deleteRolledUpChecks', () => {
    it('deletes checks older than threshold', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 150,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });
      const count = await deleteRolledUpChecks(30);
      expect(count).toBe(150);
      const [sql, params] = mockQuery.mock.calls[0] as [string, string[]];
      expect(sql).toContain('DELETE FROM checks');
      expect(params).toEqual(['30']);
    });

    it('returns 0 when nothing deleted', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });
      const count = await deleteRolledUpChecks();
      expect(count).toBe(0);
    });
  });

  describe('getDailyUptimeFromAggregates', () => {
    it('returns parsed uptime rows from aggregates', async () => {
      mockQuery.mockResolvedValueOnce(
        mockResult([
          { date: '2025-03-27', uptime_percent: '99.50', total_checks: '48' },
          { date: '2025-03-26', uptime_percent: null, total_checks: '0' },
        ]),
      );
      const result = await getDailyUptimeFromAggregates('service-1', 90);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2025-03-27',
        uptime_percent: 99.5,
        total_checks: 48,
      });
      expect(result[1]).toEqual({
        date: '2025-03-26',
        uptime_percent: null,
        total_checks: 0,
      });
    });

    it('passes correct serviceId and days params', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));
      await getDailyUptimeFromAggregates('svc-abc', 90);
      const [, params] = mockQuery.mock.calls[0] as [string, string[]];
      expect(params).toEqual(['svc-abc', '90']);
    });

    it('returns empty array when no aggregates found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));
      const result = await getDailyUptimeFromAggregates('svc-123', 30);
      expect(result).toEqual([]);
    });
  });
});
