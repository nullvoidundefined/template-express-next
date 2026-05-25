import { expect, test } from '@playwright/test';

const API_URL = process.env.SMOKE_API_URL!;

test('unauthenticated /auth/me returns 401', async ({ request }) => {
  const response = await request.get(`${API_URL}/auth/me`);
  expect(response.status()).toBe(401);
});

test('login with test credentials succeeds', async ({ page }) => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    test.skip();
    return;
  }

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
});
