import { defineConfig, devices } from '@playwright/test';

const isPreBuilt = !!process.env.PW_PRE_BUILT || !!process.env.CI;

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  globalSetup: './e2e/global-setup.ts',
  projects: [
    {
      name: 'chromium',
      // Functional E2E only. Visual-regression specs need Storybook on :6006
      // and run under their own project, not the chromium app server.
      testIgnore: /visual-regression\/.*/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual-regression',
      testMatch: /visual-regression\/.*/,
      use: {
        baseURL: 'http://localhost:6006',
        ...devices['Desktop Chrome'],
      },
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
      command: isPreBuilt
        ? 'pnpm --filter ./apps/server run start'
        : 'pnpm --filter ./apps/server run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: isPreBuilt
        ? 'pnpm --filter ./apps/client/web run start'
        : 'pnpm --filter ./apps/client/web run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  workers: process.env.CI ? 1 : undefined,
});
