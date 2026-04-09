import { uuid } from 'app/__tests__/helpers/uuids.js';
import * as servicesHandlers from 'app/handlers/services/services.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import * as servicesRepo from 'app/repositories/services/services.js';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/services/services.js');
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const id = uuid();

const app = express();
app.use(express.json());
app.get('/services', servicesHandlers.listServices);
app.get('/services/:id', servicesHandlers.getService);
app.post('/services', servicesHandlers.createService);
app.put('/services/:id', servicesHandlers.updateService);
app.delete('/services/:id', servicesHandlers.deleteService);
app.use(errorHandler);

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

describe('services handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listServices', () => {
    it('returns 200 with list of services', async () => {
      vi.mocked(servicesRepo.listServices).mockResolvedValueOnce([mockService]);
      const res = await request(app).get('/services');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 500 when repo throws', async () => {
      vi.mocked(servicesRepo.listServices).mockRejectedValueOnce(
        new Error('DB error'),
      );
      const res = await request(app).get('/services');
      expect(res.status).toBe(500);
    });
  });

  describe('getService', () => {
    it('returns 400 for invalid UUID', async () => {
      const res = await request(app).get('/services/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid service ID');
    });

    it('returns 404 when not found', async () => {
      vi.mocked(servicesRepo.getServiceById).mockResolvedValueOnce(null);
      const res = await request(app).get(`/services/${id}`);
      expect(res.status).toBe(404);
    });

    it('returns 200 with service', async () => {
      vi.mocked(servicesRepo.getServiceById).mockResolvedValueOnce(mockService);
      const res = await request(app).get(`/services/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
    });
  });

  describe('createService', () => {
    it('returns 400 for invalid body', async () => {
      const res = await request(app).post('/services').send({});
      expect(res.status).toBe(400);
      expect(servicesRepo.createService).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid URL', async () => {
      const res = await request(app)
        .post('/services')
        .send({ name: 'Test', url: 'not-a-url' });
      expect(res.status).toBe(400);
    });

    it('returns 201 with created service', async () => {
      vi.mocked(servicesRepo.createService).mockResolvedValueOnce(mockService);
      const res = await request(app)
        .post('/services')
        .send({ name: 'Test Service', url: 'https://example.com' });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(id);
    });

    it('returns 500 when repo throws', async () => {
      vi.mocked(servicesRepo.createService).mockRejectedValueOnce(
        new Error('DB error'),
      );
      const res = await request(app)
        .post('/services')
        .send({ name: 'Test', url: 'https://example.com' });
      expect(res.status).toBe(500);
    });
  });

  describe('updateService', () => {
    it('returns 400 for invalid UUID', async () => {
      const res = await request(app)
        .put('/services/not-a-uuid')
        .send({ name: 'New' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid service ID');
    });

    it('returns 404 when not found', async () => {
      vi.mocked(servicesRepo.updateService).mockResolvedValueOnce(null);
      const res = await request(app)
        .put(`/services/${id}`)
        .send({ name: 'New' });
      expect(res.status).toBe(404);
    });

    it('returns 200 with updated service', async () => {
      const updated = { ...mockService, name: 'New' };
      vi.mocked(servicesRepo.updateService).mockResolvedValueOnce(updated);
      const res = await request(app)
        .put(`/services/${id}`)
        .send({ name: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New');
    });

    it('returns 400 for invalid body fields', async () => {
      const res = await request(app)
        .put(`/services/${id}`)
        .send({ url: 'not-a-url' });
      expect(res.status).toBe(400);
    });
  });

  describe('deleteService', () => {
    it('returns 400 for invalid UUID', async () => {
      const res = await request(app).delete('/services/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid service ID');
    });

    it('returns 404 when not found', async () => {
      vi.mocked(servicesRepo.deleteService).mockResolvedValueOnce(false);
      const res = await request(app).delete(`/services/${id}`);
      expect(res.status).toBe(404);
    });

    it('returns 204 when deleted', async () => {
      vi.mocked(servicesRepo.deleteService).mockResolvedValueOnce(true);
      const res = await request(app).delete(`/services/${id}`);
      expect(res.status).toBe(204);
    });
  });
});
