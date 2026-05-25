// Global test setup: provide required env vars so Zod validation in env.ts passes.
// Integration tests that need a real database set DATABASE_URL in their own beforeAll.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/testdb';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'test-session-secret-value';
