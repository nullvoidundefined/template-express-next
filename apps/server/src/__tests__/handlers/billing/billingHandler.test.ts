import express from 'express';
import type Stripe from 'stripe';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { uuid } from 'app/__tests__/helpers/uuids.js';
import type * as EnvConfigModule from 'app/config/envConfig.js';
import { createCheckoutHandler } from 'app/handlers/billing/billingHandler.js';
import { validate } from 'app/middleware/validateMiddleware.js';
import { createCheckoutSchema } from 'app/schemas/billingSchema.js';

// The price comes from the server's env, never from the client. A getter keeps
// STRIPE_PRICE_ID readable per test, so the unset case (B-4) can be forced.
const priceConfig = vi.hoisted(() => ({
  stripePriceId: 'price_Server123' as string | undefined,
}));

vi.mock('app/config/envConfig.js', async (importOriginal) => {
  const original = await importOriginal<typeof EnvConfigModule>();
  return {
    ...original,
    env: {
      ...original.env,
      CLIENT_URL: 'https://app.example.com',
      get STRIPE_PRICE_ID() {
        return priceConfig.stripePriceId;
      },
    },
  };
});

const createCheckoutMock = vi.fn();
const getStripe = () =>
  ({
    checkout: { sessions: { create: createCheckoutMock } },
  }) as unknown as Stripe;

const userId = uuid();
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = {
    created_at: new Date('2025-01-01'),
    email: 'user@example.com',
    id: userId,
    role: 'user',
    updated_at: null,
  };
  next();
});
app.post(
  '/checkout',
  validate(createCheckoutSchema),
  createCheckoutHandler({ getStripe }),
);

beforeEach(() => {
  vi.clearAllMocks();
  createCheckoutMock.mockResolvedValue({
    url: 'https://checkout.stripe.test/session',
  });
  priceConfig.stripePriceId = 'price_Server123';
});

describe('checkout price comes from the server (B-3)', () => {
  it('rejects a body carrying a priceId without calling Stripe', async () => {
    const res = await request(app)
      .post('/checkout')
      .send({ priceId: 'price_Cheaper1' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      code: 'INPUT_VALIDATION_ERROR',
      error: expect.any(String) as unknown,
    });
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });

  it('rejects a body carrying any other field without calling Stripe', async () => {
    const res = await request(app).post('/checkout').send({ plan: 'pro' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      code: 'INPUT_VALIDATION_ERROR',
      error: expect.any(String) as unknown,
    });
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });

  it('creates the session with the configured price for an empty body', async () => {
    const res = await request(app).post('/checkout').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { url: 'https://checkout.stripe.test/session' },
    });
    expect(createCheckoutMock).toHaveBeenCalledTimes(1);
    expect(createCheckoutMock.mock.calls[0]?.[0]).toMatchObject({
      line_items: [{ price: 'price_Server123', quantity: 1 }],
      mode: 'subscription',
    });
  });
});

describe('checkout without a configured price (B-4)', () => {
  it('answers 503 BILLING_NOT_CONFIGURED without calling Stripe', async () => {
    priceConfig.stripePriceId = undefined;

    const res = await request(app).post('/checkout').send({});

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      code: 'BILLING_NOT_CONFIGURED',
      error: expect.any(String) as unknown,
    });
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });
});
