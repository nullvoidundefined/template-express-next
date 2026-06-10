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
        '**/database/**',
        '**/rateLimiterMiddleware.ts', // tested via middleware test; excluded to keep threshold honest
        '**/*.d.ts',
        'src/__tests__/**',
        'src/index.ts', // thin env-loader shim; no logic to test
        'src/app.ts', // server bootstrap: app.listen, signal handlers, pool setup - not unit-testable
        'src/constants/**',
        'src/worker.ts', // standalone worker entry point; requires Redis
        'src/clients/stripeClient.ts', // Stripe SDK factory; requires STRIPE_SECRET_KEY
        'src/clients/redisClient.ts', // Redis connection setup; requires REDIS_URL
        'src/clients/queueClient.ts', // BullMQ setup; requires Redis
        'src/clients/analyticsClient.ts', // PostHog client; requires POSTHOG_API_KEY
        'src/services/emailService.ts', // email service; requires RESEND_API_KEY
        'src/services/billingService.ts', // orchestrates Stripe webhook events; covered by integration tests
        'src/handlers/billing/**', // Stripe checkout/portal/webhook handlers; covered by integration tests
        'src/repositories/billingRepository.ts', // billing SQL queries; covered by integration tests
        'src/routes/billingRoutes.ts', // billing router wiring; covered by integration tests
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
