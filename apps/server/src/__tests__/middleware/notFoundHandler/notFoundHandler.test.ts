import { notFoundHandler } from 'app/middleware/notFoundHandler/notFoundHandler.js';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const app = express();
app.use(notFoundHandler);

describe('notFoundHandler', () => {
  it('returns 404 JSON without exposing the requested path', async () => {
    const res = await request(app).get('/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        message: 'Not found',
      },
    });
  });
});
