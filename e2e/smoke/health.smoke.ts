import { expect, test } from '@playwright/test';

const API_URL = process.env.SMOKE_API_URL!;

test('API health endpoint returns ok', async ({ request }) => {
  const response = await request.get(`${API_URL}/health`);
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.status).toBe('ok');
});

test('API readiness endpoint returns ok', async ({ request }) => {
  const response = await request.get(`${API_URL}/health/ready`);
  expect(response.ok()).toBe(true);
});

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('form')).toBeVisible();
});
