import { uuid } from 'app/__tests__/helpers/uuids.js';
import { createCheckoutHandler } from 'app/handlers/billing/billingHandler.js';
import { createPortalHandler } from 'app/handlers/billing/portalHandler.js';
import { validate } from 'app/middleware/validateMiddleware.js';
import { createCheckoutSchema } from 'app/schemas/billingSchema.js';
import express from 'express';
import type Stripe from 'stripe';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// CLIENT_URL and CORS_ORIGIN are deliberately different so a handler that
// builds redirect URLs from the wrong one is caught.
vi.mock('app/config/envConfig.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown> & {
    env: Record<string, unknown>;
  };
  return {
    ...actual,
    env: {
      ...actual.env,
      CLIENT_URL: 'https://app.example.com',
      CORS_ORIGIN: 'https://api.example.com',
    },
    isProduction: () => true,
  };
});

const createCheckoutMock = vi.fn().mockResolvedValue({ url: 'https://stripe' });
const createPortalMock = vi.fn().mockResolvedValue({ url: 'https://stripe' });
const getStripe = () =>
  ({
    billingPortal: { sessions: { create: createPortalMock } },
    checkout: { sessions: { create: createCheckoutMock } },
  }) as unknown as Stripe;

const mockGetSubscriptionByUserId = vi.fn();

const createCheckoutSession = createCheckoutHandler({ getStripe });
const createPortalSession = createPortalHandler({
  billingRepo: { getSubscriptionByUserId: mockGetSubscriptionByUserId },
  getStripe,
});

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
app.post('/checkout', validate(createCheckoutSchema), createCheckoutSession);
app.post('/portal', createPortalSession);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('billing redirect URLs use CLIENT_URL', () => {
  it('checkout success_url and cancel_url point at CLIENT_URL', async () => {
    await request(app).post('/checkout').send({ priceId: 'price_123' });

    const arg = createCheckoutMock.mock.calls[0]?.[0];
    expect(arg.success_url).toContain('https://app.example.com');
    expect(arg.cancel_url).toContain('https://app.example.com');
    expect(arg.success_url).not.toContain('https://api.example.com');
  });

  it('rejects a priceId that is not a Stripe price ID', async () => {
    const res = await request(app)
      .post('/checkout')
      .send({ priceId: 'not-a-price-id' });

    expect(res.status).toBe(400);
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });

  it('portal return_url points at CLIENT_URL', async () => {
    mockGetSubscriptionByUserId.mockResolvedValue({
      stripe_customer_id: 'cus_123',
    });

    await request(app).post('/portal').send({});

    const arg = createPortalMock.mock.calls[0]?.[0];
    expect(arg.return_url).toContain('https://app.example.com');
    expect(arg.return_url).not.toContain('https://api.example.com');
  });
});
