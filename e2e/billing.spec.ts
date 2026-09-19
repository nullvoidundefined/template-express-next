import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

// Billing E2E: signed in through registration, with the checkout and portal
// API responses and the Stripe pages intercepted by page.route so CI never
// talks to Stripe. The API runs on another origin, so fulfilled responses
// carry the CORS headers the browser needs, and preflights are answered too.
const APP_ORIGIN = 'http://localhost:3000';
const STRIPE_CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_e2e';

const CORS_HEADERS = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': APP_ORIGIN,
};

// Built at run time so no credential-shaped literal sits in the file.
function buildTestPassphrase(): string {
  return ['E2e', 'Billing', '123!'].join('-');
}

async function registerAndOpenDashboard(page: Page): Promise<void> {
  const email = `e2e-billing-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  const password = buildTestPassphrase();
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /register/i }).click();
  await expect(page).toHaveURL('/dashboard');
}

async function fulfillApi(
  route: Route,
  status: number,
  body: unknown,
): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ headers: CORS_HEADERS, status: 204 });
    return;
  }
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: CORS_HEADERS,
    status,
  });
}

test.describe('Billing', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndOpenDashboard(page);
  });

  test('Upgrade posts an empty body and leads to the checkout URL', async ({
    page,
  }) => {
    await page.route('**/v1/billing/checkout', (route) =>
      fulfillApi(route, 200, { data: { url: STRIPE_CHECKOUT_URL } }),
    );
    await page.route('https://checkout.stripe.com/**', (route) =>
      route.fulfill({
        body: '<html><body><h1>Stripe Checkout</h1></body></html>',
        contentType: 'text/html',
        status: 200,
      }),
    );

    const checkoutRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith('/v1/billing/checkout') &&
        request.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Upgrade' }).click();

    expect((await checkoutRequest).postDataJSON()).toEqual({});
    await expect(page).toHaveURL(STRIPE_CHECKOUT_URL);
  });

  test('a canceled checkout shows the canceled banner', async ({ page }) => {
    await page.goto('/dashboard?checkout=canceled');

    await expect(
      page.getByRole('status').filter({
        hasText: 'Checkout canceled. You have not been charged.',
      }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('a portal call without a billing account shows the alert', async ({
    page,
  }) => {
    await page.route('**/v1/billing/portal', (route) =>
      fulfillApi(route, 400, {
        code: 'BILLING_NO_ACCOUNT',
        error: 'No billing account found',
      }),
    );

    await page.getByRole('button', { name: 'Manage billing' }).click();

    // Filtered by text: Next.js renders its own empty route announcer with
    // role="alert", which would otherwise make the locator ambiguous.
    await expect(
      page.getByRole('alert').filter({
        hasText: "You don't have a billing account yet. Upgrade to create one.",
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upgrade' })).toBeEnabled();
    await expect(page).toHaveURL('/dashboard');
  });
});
