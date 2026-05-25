import { expect, test } from '@playwright/test';

test('unknown route returns status < 500', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist-smoke-test');
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
});
