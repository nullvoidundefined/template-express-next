import { validate } from 'app/middleware/validateMiddleware.js';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const schema = z.object({
  age: z.coerce.number(),
  name: z.string().min(1, 'name required'),
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/', validate(schema), (req, res) => {
    res.json({ received: req.body });
  });
  return app;
}

describe('validate', () => {
  it('returns 400 INPUT_VALIDATION_ERROR with the first issue message on bad input', async () => {
    const res = await request(buildApp())
      .post('/')
      .send({ age: '1', name: '' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INPUT_VALIDATION_ERROR');
    expect(res.body.error).toBe('name required');
  });

  it('calls next and exposes coerced data to the handler on valid input', async () => {
    const res = await request(buildApp())
      .post('/')
      .send({ age: '42', name: 'Ada' });

    expect(res.status).toBe(200);
    // age was sent as the string '42'; the handler sees the coerced number 42.
    expect(res.body.received).toEqual({ age: 42, name: 'Ada' });
  });
});
