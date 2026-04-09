import {
  createIncident,
  getActiveIncident,
  resolveIncident,
} from 'app/repositories/incidents/incidents.js';
import { handleIncidentLogic } from 'app/services/incidentManager.js';
import { dispatch } from 'app/services/notifications/dispatcher.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockIncr, mockDel, mockGet, mockSet } = vi.hoisted(() => ({
  mockIncr: vi.fn(),
  mockDel: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(() => ({
    incr: mockIncr,
    del: mockDel,
    get: mockGet,
    set: mockSet,
  })),
}));

vi.mock('app/config/redis.js', () => ({
  redisConfig: { url: 'redis://localhost:6379' },
}));

vi.mock('app/repositories/incidents/incidents.js', () => ({
  createIncident: vi.fn(),
  getActiveIncident: vi.fn(),
  resolveIncident: vi.fn(),
}));

vi.mock('app/services/notifications/dispatcher.js', () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockService = {
  id: 'service-uuid-123',
  name: 'Test Service',
  url: 'https://example.com',
};

const mockIncident = {
  id: 'incident-uuid-456',
  service_id: 'service-uuid-123',
  title: 'Test Service is down',
  status: 'investigating' as const,
  cause: null,
  started_at: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
  resolved_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIncr.mockResolvedValue(0);
  mockDel.mockResolvedValue(0);
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue('OK');
  vi.mocked(getActiveIncident).mockResolvedValue(null);
  vi.mocked(createIncident).mockResolvedValue(mockIncident);
  vi.mocked(resolveIncident).mockResolvedValue({
    ...mockIncident,
    status: 'resolved',
    resolved_at: new Date(),
  });
});

describe('handleIncidentLogic', () => {
  describe('down status', () => {
    it('creates incident on 3rd consecutive failure', async () => {
      mockIncr.mockResolvedValue(3);
      vi.mocked(getActiveIncident).mockResolvedValue(null);

      await handleIncidentLogic(mockService, {
        status: 'down',
        error_message: 'Connection refused',
      });

      expect(createIncident).toHaveBeenCalledWith(
        mockService.id,
        expect.objectContaining({
          title: `${mockService.name} is down`,
          status: 'investigating',
          cause: 'Connection refused',
        }),
      );
    });

    it('does not create incident when failures below threshold', async () => {
      mockIncr.mockResolvedValue(2);

      await handleIncidentLogic(mockService, { status: 'down' });

      expect(createIncident).not.toHaveBeenCalled();
    });

    it('does not create duplicate incident when one already exists', async () => {
      mockIncr.mockResolvedValue(3);
      vi.mocked(getActiveIncident).mockResolvedValue(mockIncident);

      await handleIncidentLogic(mockService, { status: 'down' });

      expect(createIncident).not.toHaveBeenCalled();
    });

    it('increments failure counter and resets success counter on down', async () => {
      mockIncr.mockResolvedValue(1);

      await handleIncidentLogic(mockService, { status: 'down' });

      expect(mockIncr).toHaveBeenCalledWith(`failures:${mockService.id}`);
      expect(mockDel).toHaveBeenCalledWith(`successes:${mockService.id}`);
    });

    it('dispatches notification when no SMS cooldown is active', async () => {
      mockIncr.mockResolvedValue(3);
      mockGet.mockResolvedValue(null); // no cooldown
      vi.mocked(getActiveIncident).mockResolvedValue(null);

      await handleIncidentLogic(mockService, {
        status: 'down',
        error_message: null,
      });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'incident_created',
          serviceId: mockService.id,
        }),
      );
    });

    it('does not dispatch notification when SMS cooldown is active', async () => {
      mockIncr.mockResolvedValue(3);
      mockGet.mockResolvedValue('1'); // cooldown active
      vi.mocked(getActiveIncident).mockResolvedValue(null);

      await handleIncidentLogic(mockService, { status: 'down' });

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('up status', () => {
    it('resolves incident after 2 consecutive successes', async () => {
      mockIncr.mockResolvedValue(2);
      vi.mocked(getActiveIncident).mockResolvedValue(mockIncident);

      await handleIncidentLogic(mockService, { status: 'up' });

      expect(resolveIncident).toHaveBeenCalledWith(mockIncident.id);
    });

    it('does not resolve when below recovery threshold', async () => {
      mockIncr.mockResolvedValue(1);

      await handleIncidentLogic(mockService, { status: 'up' });

      expect(resolveIncident).not.toHaveBeenCalled();
    });

    it('does not resolve when no active incident exists', async () => {
      mockIncr.mockResolvedValue(2);
      vi.mocked(getActiveIncident).mockResolvedValue(null);

      await handleIncidentLogic(mockService, { status: 'up' });

      expect(resolveIncident).not.toHaveBeenCalled();
    });

    it('dispatches recovery notification after resolving', async () => {
      mockIncr.mockResolvedValue(2);
      vi.mocked(getActiveIncident).mockResolvedValue(mockIncident);

      await handleIncidentLogic(mockService, { status: 'up' });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'incident_resolved',
          serviceId: mockService.id,
          serviceName: mockService.name,
        }),
      );
    });

    it('increments success counter and resets failure counter on up', async () => {
      mockIncr.mockResolvedValue(1);

      await handleIncidentLogic(mockService, { status: 'up' });

      expect(mockIncr).toHaveBeenCalledWith(`successes:${mockService.id}`);
      expect(mockDel).toHaveBeenCalledWith(`failures:${mockService.id}`);
    });
  });

  describe('degraded status', () => {
    it('resets failure counter without creating incident', async () => {
      await handleIncidentLogic(mockService, { status: 'degraded' });

      expect(mockDel).toHaveBeenCalledWith(`failures:${mockService.id}`);
      expect(createIncident).not.toHaveBeenCalled();
    });
  });
});
