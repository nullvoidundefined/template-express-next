import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { app: path.resolve(__dirname, './src') },
  },
  test: {
    coverage: {
      exclude: [
        'dist/**',
        'migrations/**',
        'scripts/**',
        '*.config.*',
        '**/config/**',
        '**/types/**',
        '**/db/**',
        '**/rateLimiter.ts', // tested via middleware test; excluded to keep threshold honest
        '**/*.d.ts',
        'src/__tests__/**',
        'src/index.ts', // thin env-loader shim; no logic to test
        'src/app.ts', // server bootstrap: app.listen, signal handlers, pool setup - not unit-testable
        'src/constants/**',
        'src/worker.ts', // standalone worker entry point; requires Redis
        'src/services/stripe.ts', // Stripe SDK factory; requires STRIPE_SECRET_KEY
        'src/services/redis.ts', // Redis connection setup; requires REDIS_URL
        'src/services/queue.ts', // BullMQ setup; requires Redis
        'src/services/analytics/**', // PostHog client; requires POSTHOG_API_KEY
        'src/services/email/**', // Resend client; requires RESEND_API_KEY
        'src/services/billing.service.ts', // orchestrates Stripe webhook events; covered by integration tests
        'src/handlers/billing/**', // Stripe checkout/portal/webhook handlers; covered by integration tests
        'src/repositories/billing.ts', // billing SQL queries; covered by integration tests
        'src/routes/billing.ts', // billing router wiring; covered by integration tests
      ],
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: 'node',
    exclude: [
      ...configDefaults.exclude,
      'migrations/**',
      'src/__tests__/integration/**',
    ],
    include: ['src/__tests__/**/*.test.ts'],
    globals: true,
    setupFiles: ['src/__tests__/helpers/setup.ts'],
  },
});
