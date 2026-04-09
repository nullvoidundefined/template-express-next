import { getScreenshotHandler } from 'app/handlers/screenshots/screenshots.js';
import { getLatestScreenshotPath } from 'app/services/screenshotCapture.js';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/services/screenshotCapture.js', () => ({
  getLatestScreenshotPath: vi.fn(),
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock fs.statSync
vi.mock('fs', () => ({
  default: {
    statSync: vi
      .fn()
      .mockReturnValue({ mtime: new Date('2025-01-01T00:00:00Z') }),
  },
  statSync: vi
    .fn()
    .mockReturnValue({ mtime: new Date('2025-01-01T00:00:00Z') }),
}));

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function buildApp() {
  const app = express();
  // Routes with :id param (admin route style)
  app.get('/:id/screenshot', getScreenshotHandler);
  return app;
}

const mockedGetLatestScreenshotPath = vi.mocked(getLatestScreenshotPath);

describe('getScreenshotHandler', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for an invalid service ID', async () => {
    const app = buildApp();
    const res = await request(app).get('/not-a-uuid/screenshot');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid service ID');
  });

  it('returns 404 when no screenshot is available', async () => {
    mockedGetLatestScreenshotPath.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app).get(`/${VALID_UUID}/screenshot`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('No screenshot available');
  });

  it('calls getLatestScreenshotPath with the service id', async () => {
    mockedGetLatestScreenshotPath.mockResolvedValue(null);
    const app = buildApp();
    await request(app).get(`/${VALID_UUID}/screenshot`);
    expect(mockedGetLatestScreenshotPath).toHaveBeenCalledWith(VALID_UUID);
  });

  it('passes errors to next() error handler', async () => {
    mockedGetLatestScreenshotPath.mockRejectedValue(
      new Error('Unexpected DB error'),
    );
    const app = express();
    app.get('/:id/screenshot', getScreenshotHandler);
    // Error handler
    app.use((err: Error, _req: express.Request, res: express.Response) => {
      res.status(500).json({ error: { message: err.message } });
    });
    const res = await request(app).get(`/${VALID_UUID}/screenshot`);
    expect(res.status).toBe(500);
  });
});
