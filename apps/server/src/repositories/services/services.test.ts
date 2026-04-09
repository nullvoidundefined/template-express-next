import { query } from 'app/db/pool/pool.js';
import * as servicesRepo from 'app/repositories/services/services.js';
import { mockResult } from 'app/utils/tests/mockResult.js';
import { uuid } from 'app/utils/tests/uuids.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/db/pool/pool.js', () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

const id = uuid();
const mockService = {
  id,
  name: 'Test Service',
  url: 'https://example.com',
  health_endpoint: null,
  github_owner: null,
  github_repo: null,
  github_branch: 'main',
  check_interval_seconds: 60,
  timeout_ms: 10000,
  expected_status_code: 200,
  screenshot_enabled: true,
  tags: [],
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
};

describe('services repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listServices', () => {
    it('returns all services', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([mockService]));
      const result = await servicesRepo.listServices();
      expect(result).toEqual([mockService]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM services'),
      );
    });

    it('returns empty array when no services', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));
      const result = await servicesRepo.listServices();
      expect(result).toEqual([]);
    });
  });

  describe('getServiceById', () => {
    it('returns service when found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([mockService]));
      const result = await servicesRepo.getServiceById(id);
      expect(result).toEqual(mockService);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        [id],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));
      const result = await servicesRepo.getServiceById(id);
      expect(result).toBeNull();
    });
  });

  describe('createService', () => {
    it('inserts and returns the created service', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([mockService]));
      const input = {
        name: 'Test Service',
        url: 'https://example.com',
        github_branch: 'main',
        check_interval_seconds: 60,
        timeout_ms: 10000,
        expected_status_code: 200,
        screenshot_enabled: true,
        tags: [],
      };
      const result = await servicesRepo.createService(input);
      expect(result).toEqual(mockService);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO services'),
        expect.arrayContaining(['Test Service', 'https://example.com']),
      );
    });

    it('throws when insert returns no row', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([], 0));
      await expect(
        servicesRepo.createService({
          name: 'Test',
          url: 'https://example.com',
          github_branch: 'main',
          check_interval_seconds: 60,
          timeout_ms: 10000,
          expected_status_code: 200,
          screenshot_enabled: true,
          tags: [],
        }),
      ).rejects.toThrow('Insert returned no row');
    });
  });

  describe('updateService', () => {
    it('updates and returns the service', async () => {
      const updated = { ...mockService, name: 'Updated' };
      mockQuery.mockResolvedValueOnce(mockResult([updated]));
      const result = await servicesRepo.updateService(id, { name: 'Updated' });
      expect(result).toEqual(updated);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE services'),
        [id, 'Updated'],
      );
    });

    it('returns null when service not found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));
      const result = await servicesRepo.updateService(id, { name: 'Updated' });
      expect(result).toBeNull();
    });

    it('falls back to getServiceById when no fields provided', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([mockService]));
      const result = await servicesRepo.updateService(id, {});
      expect(result).toEqual(mockService);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        [id],
      );
    });
  });

  describe('deleteService', () => {
    it('returns true when deleted', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([], 1));
      const result = await servicesRepo.deleteService(id);
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM services'),
        [id],
      );
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([], 0));
      const result = await servicesRepo.deleteService(id);
      expect(result).toBe(false);
    });
  });
});
