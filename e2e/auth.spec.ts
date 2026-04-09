import { expect, test } from '@playwright/test';

// Tests in this describe block run serially so the register test creates
// the account that the login test depends on.
test.describe.serial('Auth', () => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'Password123!';

  test('register creates a new account and redirects to dashboard', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /register/i }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('login with registered credentials redirects to dashboard', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('login with invalid credentials shows an error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('notexist@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('unauthenticated access to protected route redirects to login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
