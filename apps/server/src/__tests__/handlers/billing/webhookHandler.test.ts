import type * as EnvConfigModule from 'app/config/envConfig.js';
import { createWebhookHandler } from 'app/handlers/billing/webhookHandler.js';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

// The handler reads the webhook secret from the frozen env module; force a
// placeholder so the claim path is reachable. Signature checking itself is
// Stripe's, so getStripe returns a fake whose constructEvent yields the event.
vi.mock('app/config/envConfig.js', async (importOriginal) => {
  const original = await importOriginal<typeof EnvConfigModule>();
  return {
    ...original,
    env: { ...original.env, STRIPE_WEBHOOK_SECRET: 'test-webhook-secret' },
  };
});

const EVENT = {
  data: { object: { id: 'sub_test' } },
  id: 'evt_test',
  type: 'customer.subscription.updated',
};

function buildWebhookHandler(options: {
  claimAttempt: number | null;
  onSubscriptionUpdated?: () => Promise<void>;
}) {
  const billingRepo = {
    claimStripeEvent: vi.fn().mockResolvedValue(options.claimAttempt),
    markStripeEventFailed: vi.fn().mockResolvedValue(undefined),
    markStripeEventProcessed: vi.fn().mockResolvedValue(undefined),
  };
  const billingService = {
    onCheckoutCompleted: vi.fn(),
    onPaymentFailed: vi.fn(),
    onPaymentSucceeded: vi.fn(),
    onSubscriptionDeleted: vi.fn(),
    onSubscriptionUpdated: vi.fn(
      options.onSubscriptionUpdated ?? (() => Promise.resolve()),
    ),
  };
  const getStripe = () => ({
    webhooks: { constructEvent: () => EVENT },
  });
  const handleWebhook = createWebhookHandler({
    billingRepo,
    billingService,
    getStripe,
  } as unknown as Parameters<typeof createWebhookHandler>[0]);
  return { billingRepo, billingService, handleWebhook };
}

function buildSignedRequest(): Request {
  return {
    body: Buffer.from('{}'),
    headers: { 'stripe-signature': 't=1,v1=test' },
  } as unknown as Request;
}

function buildResponse() {
  return {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
}

describe('handleWebhook', () => {
  it('returns 400 when signature is missing', async () => {
    const { handleWebhook } = buildWebhookHandler({ claimAttempt: 1 });
    const req = { headers: {} } as Request;
    const res = buildResponse();

    await handleWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('marks the event processed under the attempt that claimed it', async () => {
    const { billingRepo, handleWebhook } = buildWebhookHandler({
      claimAttempt: 3,
    });
    const res = buildResponse();

    await handleWebhook(buildSignedRequest(), res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(billingRepo.markStripeEventProcessed).toHaveBeenCalledWith(
      'evt_test',
      3,
    );
    expect(billingRepo.markStripeEventFailed).not.toHaveBeenCalled();
  });

  it('marks the event failed under the attempt that claimed it and answers 500', async () => {
    const { billingRepo, handleWebhook } = buildWebhookHandler({
      claimAttempt: 3,
      onSubscriptionUpdated: () => Promise.reject(new Error('stripe down')),
    });
    const res = buildResponse();

    await handleWebhook(buildSignedRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(billingRepo.markStripeEventFailed).toHaveBeenCalledWith(
      'evt_test',
      3,
    );
    expect(billingRepo.markStripeEventProcessed).not.toHaveBeenCalled();
  });

  it('skips processing when the event cannot be claimed', async () => {
    const { billingService, handleWebhook } = buildWebhookHandler({
      claimAttempt: null,
    });
    const res = buildResponse();

    await handleWebhook(buildSignedRequest(), res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(billingService.onSubscriptionUpdated).not.toHaveBeenCalled();
  });
});
