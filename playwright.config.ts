import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: 'html',
  retries: process.env.CI ? 2 : 0,
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter ./apps/server run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter ./apps/client/web run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  workers: process.env.CI ? 1 : undefined,
});
