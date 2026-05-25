import { expect, test } from '@playwright/test';

test('Toast component matches snapshot', async ({ page }) => {
  await page.goto('/iframe.html?id=ui-toast--default');
  await page.getByText('Add Info').click();
  await expect(page).toHaveScreenshot('toast-info.png', { timeout: 5_000 });
});

test('Modal component matches snapshot', async ({ page }) => {
  await page.goto('/iframe.html?id=ui-modal--default');
  await page.getByText('Open Modal').click();
  await expect(page).toHaveScreenshot('modal-open.png', { timeout: 5_000 });
});
