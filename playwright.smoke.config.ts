import { defineConfig, devices } from '@playwright/test';

if (!process.env.SMOKE_WEB_URL) {
  throw new Error('SMOKE_WEB_URL is required for smoke tests');
}
if (!process.env.SMOKE_API_URL) {
  throw new Error('SMOKE_API_URL is required for smoke tests');
}

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: true,
  fullyParallel: false,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'smoke-results.json' }],
  ],
  retries: 1,
  testDir: './e2e/smoke',
  testMatch: '*.smoke.ts',
  timeout: 30_000,
  use: {
    baseURL: process.env.SMOKE_WEB_URL,
    trace: 'on-first-retry',
  },
  workers: 1,
});
