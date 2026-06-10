import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { app: path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    // Integration files share one real database, so they must run one file at a
    // time even though setup.ts truncates between tests; parallel files would
    // truncate each other's rows mid-test.
    fileParallelism: false,
    globals: true,
    include: ['src/__tests__/integration/**/*.test.ts'],
    // Migrates once per file and TRUNCATEs every table between tests.
    setupFiles: ['src/__tests__/integration/setup.ts'],
    testTimeout: 30_000,
  },
});
