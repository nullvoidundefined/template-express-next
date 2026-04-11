# Infrastructure: Day 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up all third-party services, foundational migrations, and auth extensions so every subsequent feature has logging, error tracking, analytics, payments, email, and a clean DB schema from day one.

**Architecture:** Extend the existing Express 5 + TypeScript server with seven thin service wrappers in `src/services/`, rewrite all DB migrations from scratch (clean history), and extend auth with name fields on users and a forgot/reset password flow.

**Tech Stack:** ioredis, bullmq, @sentry/node, posthog-node, stripe, resend, @anthropic-ai/sdk, @aws-sdk/client-s3, node-pg-migrate, Vitest, Supertest.

---

## File Map

**Create:**
- `apps/server/src/services/redis.ts`
- `apps/server/src/services/sentry.ts`
- `apps/server/src/services/posthog.ts`
- `apps/server/src/services/stripe.ts`
- `apps/server/src/services/email.ts`
- `apps/server/src/services/anthropic.ts`
- `apps/server/src/services/r2.ts`
- `apps/server/src/services/queue.ts`
- `apps/server/migrations/1775865600000_create-users.js`
- `apps/server/migrations/1775865600001_create-sessions.js`
- `apps/server/migrations/1775865600002_create-password-resets.js`
- `apps/server/migrations/1775865600003_create-oauth-accounts.js`
- `apps/server/migrations/1775865600004_create-credit-transactions.js`
- `apps/server/migrations/1775865600005_create-email-subscribers.js`
- `apps/server/migrations/1775865600006_create-user-notifications-seen.js`
- `apps/server/src/__tests__/services/redis.test.ts`
- `apps/server/src/__tests__/services/posthog.test.ts`
- `apps/server/src/__tests__/services/email.test.ts`
- `apps/server/src/__tests__/handlers/auth/forgotPassword.test.ts`
- `apps/server/src/__tests__/handlers/auth/resetPassword.test.ts`
- `apps/server/src/__tests__/repositories/auth/passwordResets.test.ts`

**Modify:**
- `apps/server/package.json` - add 8 packages
- `apps/server/src/config/env.ts` - extend with all service vars + booleans
- `apps/server/.env.example` - update with all vars
- `apps/server/src/app.ts` - Sentry setup + PostHog shutdown
- `apps/server/src/schemas/auth.ts` - name fields + new schemas
- `apps/server/src/repositories/auth/auth.ts` - name fields on createUser + password reset functions
- `apps/server/src/handlers/auth/auth.ts` - name in responses + new handlers
- `apps/server/src/routes/auth.ts` - new routes
- `apps/server/src/middleware/rateLimiter/rateLimiter.ts` - forgot password limiter
- `apps/server/src/__tests__/handlers/auth/auth.test.ts` - update for name fields

**Delete:**
- `apps/server/migrations/1771879388542_create-users-table.js`
- `apps/server/migrations/1771879388543_create-sessions-table.js`

---

## Task 1: Install Packages

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add the 8 new packages**

```bash
cd apps/server && pnpm add ioredis bullmq @sentry/node posthog-node stripe resend @anthropic-ai/sdk @aws-sdk/client-s3
```

- [ ] **Step 2: Verify the lockfile updated and build still passes**

```bash
cd apps/server && pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/package.json pnpm-lock.yaml
git commit -m "chore(server): add third-party service packages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Extend env.ts

**Files:**
- Modify: `apps/server/src/config/env.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import { z } from 'zod';

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  CLIENT_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_CA_CERT: z.string().optional(),
  DATABASE_URL: z.string().default(''),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  NODE_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3001),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().default('https://us.i.posthog.com'),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('hello@doppelscript.com'),
  SENTRY_DSN: z.string().optional(),
  SESSION_SECRET: z.string().default(''),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
});

export const env = Object.freeze(envSchema.parse(process.env));

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isStaging = env.NODE_ENV === 'staging';

export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/server && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/config/env.ts
git commit -m "feat(server): extend env config with all service vars

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Update .env.example

**Files:**
- Modify: `apps/server/.env.example`

- [ ] **Step 1: Replace the file contents**

```bash
# =============================================================================
# Core
# =============================================================================

# development | staging | production
NODE_ENV=development

# Server port
PORT=3001

# URL of this API server (e.g. https://api.doppelscript.com)
API_URL=http://localhost:3001

# URL of the web client (used in reset password emails, OAuth redirects)
CLIENT_URL=http://localhost:3000

# Allowed CORS origin for the frontend
CORS_ORIGIN=http://localhost:3000

# =============================================================================
# Database
# =============================================================================

# Neon PostgreSQL connection string. Rotate credentials if ever exposed.
DATABASE_URL=postgresql://user:password@host:5432/dbname

# PEM-encoded CA certificate for SSL verification (Neon, RDS). Omit for local dev.
# DATABASE_CA_CERT=

# =============================================================================
# Auth
# =============================================================================

# Secret used to sign session tokens. Generate with: openssl rand -hex 32
SESSION_SECRET=change-me-in-production

# =============================================================================
# Redis
# =============================================================================

# Redis connection string (used by BullMQ for background jobs)
# Optional in dev if not running background jobs locally.
REDIS_URL=redis://localhost:6379

# =============================================================================
# Anthropic
# =============================================================================

# Required for AI generation features. Optional in dev if not testing generation.
ANTHROPIC_API_KEY=

# =============================================================================
# Stripe
# =============================================================================

# Optional in dev. Use test keys (sk_test_...) for staging.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# =============================================================================
# Resend (email)
# =============================================================================

# Optional in dev - emails are logged to console instead of sent.
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@doppelscript.com

# =============================================================================
# PostHog (analytics)
# =============================================================================

# Optional in dev - events are silently dropped when key is absent.
POSTHOG_API_KEY=
POSTHOG_HOST=https://us.i.posthog.com

# =============================================================================
# Sentry (error monitoring)
# =============================================================================

# Optional in dev - errors are not captured when DSN is absent.
SENTRY_DSN=

# =============================================================================
# Cloudflare R2 (file storage)
# =============================================================================

# Optional in dev if not testing file uploads.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=doppelscript-corpus

# =============================================================================
# LinkedIn OAuth
# =============================================================================

# Optional. Required when LinkedIn import or OAuth login is enabled.
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# =============================================================================
# Twitter / X OAuth
# =============================================================================

# Optional. Required when Twitter/X import or OAuth login is enabled.
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/.env.example
git commit -m "chore(server): update .env.example with all service vars

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Rewrite Migrations - Delete Old, Write Users

**Files:**
- Delete: `apps/server/migrations/1771879388542_create-users-table.js`
- Delete: `apps/server/migrations/1771879388543_create-sessions-table.js`
- Create: `apps/server/migrations/1775865600000_create-users.js`

- [ ] **Step 1: Delete the old migration files**

```bash
rm apps/server/migrations/1771879388542_create-users-table.js
rm apps/server/migrations/1771879388543_create-sessions-table.js
```

- [ ] **Step 2: Create the users migration**

`apps/server/migrations/1775865600000_create-users.js`:

```javascript
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // Shared trigger function reused by all tables with updated_at.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.createTable('users', {
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    email: { notNull: true, type: 'text', unique: true },
    email_verified: { default: false, notNull: true, type: 'boolean' },
    password_hash: { type: 'text' },
    name_alias: { type: 'text' },
    name_first: { type: 'text' },
    name_last: { type: 'text' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
    updated_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.createIndex('users', 'email');

  pgm.sql(`
    CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('users');
  pgm.sql('DROP FUNCTION IF EXISTS set_updated_at CASCADE;');
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/migrations/
git commit -m "chore(server): replace migrations with clean history - users table

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Sessions Migration

**Files:**
- Create: `apps/server/migrations/1775865600001_create-sessions.js`

- [ ] **Step 1: Create the sessions migration**

```javascript
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('sessions', {
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    user_id: {
      notNull: true,
      onDelete: 'CASCADE',
      references: 'users',
      type: 'uuid',
    },
    token_hash: { notNull: true, type: 'text', unique: true },
    expires_at: { notNull: true, type: 'timestamptz' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.createIndex('sessions', 'token_hash');
  pgm.createIndex('sessions', 'user_id');
  pgm.createIndex('sessions', 'expires_at');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('sessions');
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/migrations/1775865600001_create-sessions.js
git commit -m "chore(server): add sessions migration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Password Resets Migration

**Files:**
- Create: `apps/server/migrations/1775865600002_create-password-resets.js`

- [ ] **Step 1: Create the migration**

```javascript
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // Requires users table to exist.
  pgm.createTable('password_resets', {
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    user_id: {
      notNull: true,
      onDelete: 'CASCADE',
      references: 'users',
      type: 'uuid',
    },
    token_hash: { notNull: true, type: 'text', unique: true },
    expires_at: { notNull: true, type: 'timestamptz' },
    used_at: { type: 'timestamptz' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.createIndex('password_resets', 'token_hash');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('password_resets');
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/migrations/1775865600002_create-password-resets.js
git commit -m "chore(server): add password_resets migration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: OAuth Accounts Migration

**Files:**
- Create: `apps/server/migrations/1775865600003_create-oauth-accounts.js`

- [ ] **Step 1: Create the migration**

```javascript
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // Requires users table to exist.
  pgm.createTable('oauth_accounts', {
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    user_id: {
      notNull: true,
      onDelete: 'CASCADE',
      references: 'users',
      type: 'uuid',
    },
    provider: { notNull: true, type: 'text' },
    provider_account_id: { notNull: true, type: 'text' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.addConstraint(
    'oauth_accounts',
    'oauth_accounts_provider_account_unique',
    'UNIQUE (provider, provider_account_id)',
  );

  pgm.createIndex('oauth_accounts', 'user_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('oauth_accounts');
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/migrations/1775865600003_create-oauth-accounts.js
git commit -m "chore(server): add oauth_accounts migration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Credit Transactions Migration

**Files:**
- Create: `apps/server/migrations/1775865600004_create-credit-transactions.js`

- [ ] **Step 1: Create the migration**

```javascript
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // Requires users table to exist.
  pgm.createTable('credit_transactions', {
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    user_id: {
      notNull: true,
      onDelete: 'CASCADE',
      references: 'users',
      type: 'uuid',
    },
    amount: { notNull: true, type: 'integer' },
    balance_after: { notNull: true, type: 'integer' },
    description: { notNull: true, type: 'text' },
    source: { notNull: true, type: 'text' },
    stripe_payment_id: { type: 'text' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.createIndex('credit_transactions', 'user_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('credit_transactions');
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/migrations/1775865600004_create-credit-transactions.js
git commit -m "chore(server): add credit_transactions migration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Email Subscribers Migration

**Files:**
- Create: `apps/server/migrations/1775865600005_create-email-subscribers.js`

- [ ] **Step 1: Create the migration**

```javascript
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('email_subscribers', {
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    email: { notNull: true, type: 'text', unique: true },
    source: { type: 'text' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('email_subscribers');
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/migrations/1775865600005_create-email-subscribers.js
git commit -m "chore(server): add email_subscribers migration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: User Notifications Seen Migration

**Files:**
- Create: `apps/server/migrations/1775865600006_create-user-notifications-seen.js`

- [ ] **Step 1: Create the migration**

```javascript
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // Requires users table to exist.
  pgm.createTable('user_notifications_seen', {
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    user_id: {
      notNull: true,
      onDelete: 'CASCADE',
      references: 'users',
      type: 'uuid',
    },
    notification_key: { notNull: true, type: 'text' },
    seen_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
  });

  pgm.addConstraint(
    'user_notifications_seen',
    'user_notifications_seen_user_notification_unique',
    'UNIQUE (user_id, notification_key)',
  );

  pgm.createIndex('user_notifications_seen', 'user_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('user_notifications_seen');
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/migrations/1775865600006_create-user-notifications-seen.js
git commit -m "chore(server): add user_notifications_seen migration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Run Migrations

- [ ] **Step 1: Ensure DATABASE_URL is set in your local .env**

The `.env` file at `apps/server/.env` must have `DATABASE_URL` pointing to your local or Neon dev database. If using Neon: drop and recreate the database branch before running, since the old migrations no longer exist.

- [ ] **Step 2: Run migrations**

```bash
cd apps/server && pnpm migrate:up
```

Expected output: Seven migrations applied in sequence with no errors.

- [ ] **Step 3: Verify schema**

```bash
cd apps/server && node -e "
import('dotenv/config').then(() => import('pg').then(({ default: pg }) => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  pool.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name\").then(r => { console.log(r.rows.map(x => x.table_name)); pool.end(); });
}));
"
```

Expected output includes: `credit_transactions`, `email_subscribers`, `oauth_accounts`, `password_resets`, `sessions`, `user_notifications_seen`, `users`.

---

## Task 12: Redis Service (TDD)

**Files:**
- Create: `apps/server/src/services/redis.ts`
- Create: `apps/server/src/__tests__/services/redis.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/server/src/__tests__/services/redis.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPing = vi.fn();

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    ping: mockPing,
  })),
}));

// vi.mock is hoisted - this import runs after the mock is in place.
import { redisHealthCheck } from 'app/services/redis.js';

describe('redisHealthCheck', () => {
  beforeEach(() => {
    mockPing.mockReset();
  });

  it('returns true when ping succeeds', async () => {
    mockPing.mockResolvedValue('PONG');
    const result = await redisHealthCheck();
    expect(result).toBe(true);
  });

  it('returns false when ping throws', async () => {
    mockPing.mockRejectedValue(new Error('Connection refused'));
    const result = await redisHealthCheck();
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/server && pnpm test src/__tests__/services/redis.test.ts
```

Expected: FAIL with "Cannot find module 'app/services/redis.js'".

- [ ] **Step 3: Implement redis.ts**

`apps/server/src/services/redis.ts`:

```typescript
import { logger } from 'app/utils/logs/logger.js';
import Redis from 'ioredis';

// maxRetriesPerRequest: null is required for BullMQ compatibility.
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));

async function redisHealthCheck(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export { redis, redisHealthCheck };
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd apps/server && pnpm test src/__tests__/services/redis.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/redis.ts apps/server/src/__tests__/services/redis.test.ts
git commit -m "feat(server): add Redis service

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: PostHog Service (TDD)

**Files:**
- Create: `apps/server/src/services/posthog.ts`
- Create: `apps/server/src/__tests__/services/posthog.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/server/src/__tests__/services/posthog.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(() => ({
    capture: mockCapture,
    shutdown: mockShutdown,
  })),
}));

vi.mock('app/config/env.js', () => ({
  env: {
    POSTHOG_API_KEY: undefined,
    POSTHOG_HOST: 'https://us.i.posthog.com',
  },
  isDev: true,
  isProd: false,
  isProduction: () => false,
  isStaging: false,
}));

describe('posthog service', () => {
  beforeEach(() => {
    mockCapture.mockReset();
    mockShutdown.mockReset();
  });

  describe('when POSTHOG_API_KEY is not set', () => {
    it('trackEvent does not throw and does not call capture', async () => {
      const { trackEvent } = await import('app/services/posthog.js');
      expect(() => trackEvent('user-1', 'test_event')).not.toThrow();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('shutdownPostHog resolves without calling client shutdown', async () => {
      const { shutdownPostHog } = await import('app/services/posthog.js');
      await expect(shutdownPostHog()).resolves.toBeUndefined();
      expect(mockShutdown).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/server && pnpm test src/__tests__/services/posthog.test.ts
```

Expected: FAIL with "Cannot find module 'app/services/posthog.js'".

- [ ] **Step 3: Implement posthog.ts**

`apps/server/src/services/posthog.ts`:

```typescript
import { env } from 'app/config/env.js';
import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

if (env.POSTHOG_API_KEY) {
  client = new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST,
  });
}

function trackEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!client) return;
  client.capture({ distinctId: userId, event, properties });
}

async function shutdownPostHog(): Promise<void> {
  if (!client) return;
  await client.shutdown();
}

export { shutdownPostHog, trackEvent };
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd apps/server && pnpm test src/__tests__/services/posthog.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/posthog.ts apps/server/src/__tests__/services/posthog.test.ts
git commit -m "feat(server): add PostHog analytics service

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Email Service (TDD)

**Files:**
- Create: `apps/server/src/services/email.ts`
- Create: `apps/server/src/__tests__/services/email.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/server/src/__tests__/services/email.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockSend },
  })),
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('sendEmail', () => {
  describe('when RESEND_API_KEY is not set', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.mock('app/config/env.js', () => ({
        env: {
          RESEND_API_KEY: undefined,
          RESEND_FROM_EMAIL: 'hello@doppelscript.com',
        },
        isDev: true,
        isProd: false,
        isProduction: () => false,
        isStaging: false,
      }));
    });

    it('logs to console instead of calling Resend', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { sendEmail } = await import('app/services/email.js');
      await sendEmail({ html: '<p>Hello</p>', subject: 'Test', to: 'user@example.com' });
      expect(mockSend).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('user@example.com'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('when RESEND_API_KEY is set', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.mock('app/config/env.js', () => ({
        env: {
          RESEND_API_KEY: 're_test_key',
          RESEND_FROM_EMAIL: 'hello@doppelscript.com',
        },
        isDev: false,
        isProd: true,
        isProduction: () => true,
        isStaging: false,
      }));
    });

    it('calls Resend with correct sender and fields', async () => {
      const { sendEmail } = await import('app/services/email.js');
      await sendEmail({
        html: '<p>Hello</p>',
        subject: 'Test Subject',
        to: 'user@example.com',
      });
      expect(mockSend).toHaveBeenCalledWith({
        from: 'hello@doppelscript.com',
        html: '<p>Hello</p>',
        subject: 'Test Subject',
        to: 'user@example.com',
      });
    });

    it('logs to address and subject but not html body', async () => {
      const { logger } = await import('app/utils/logs/logger.js');
      const { sendEmail } = await import('app/services/email.js');
      await sendEmail({
        html: '<p>SENSITIVE BODY CONTENT</p>',
        subject: 'My Subject',
        to: 'user@example.com',
      });
      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'My Subject', to: 'user@example.com' }),
        expect.any(String),
      );
      const calls = vi.mocked(logger.info).mock.calls;
      const loggedObject = JSON.stringify(calls);
      expect(loggedObject).not.toContain('SENSITIVE BODY CONTENT');
    });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/server && pnpm test src/__tests__/services/email.test.ts
```

Expected: FAIL with "Cannot find module 'app/services/email.js'".

- [ ] **Step 3: Implement email.ts**

`apps/server/src/services/email.ts`:

```typescript
import { env } from 'app/config/env.js';
import { logger } from 'app/utils/logs/logger.js';
import { Resend } from 'resend';

interface SendEmailOptions {
  html: string;
  subject: string;
  to: string;
}

let resend: Resend | null = null;

if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
}

async function sendEmail({ html, subject, to }: SendEmailOptions): Promise<void> {
  logger.info({ subject, to }, 'Sending email');

  if (!resend) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
    return;
  }

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    html,
    subject,
    to,
  });
}

export { sendEmail };
export type { SendEmailOptions };
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd apps/server && pnpm test src/__tests__/services/email.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/email.ts apps/server/src/__tests__/services/email.test.ts
git commit -m "feat(server): add Resend email service

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 15: Sentry Service

**Files:**
- Create: `apps/server/src/services/sentry.ts`

No unit test for Sentry - the SDK integration is verified at build time and in a live environment.

- [ ] **Step 1: Create the service**

`apps/server/src/services/sentry.ts`:

```typescript
import { env, isProd } from 'app/config/env.js';
import * as Sentry from '@sentry/node';
import type { Express } from 'express';

function setupSentry(app: Express): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: isProd ? 0.2 : 1.0,
  });
}

function registerSentryErrorHandler(app: Express): void {
  if (!env.SENTRY_DSN) return;
  Sentry.setupExpressErrorHandler(app);
}

function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!env.SENTRY_DSN) return;
  Sentry.captureException(error, { extra: context });
}

export { captureException, registerSentryErrorHandler, setupSentry };
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/server && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/sentry.ts
git commit -m "feat(server): add Sentry error monitoring service

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 16: Stripe Service

**Files:**
- Create: `apps/server/src/services/stripe.ts`

- [ ] **Step 1: Create the service**

`apps/server/src/services/stripe.ts`:

```typescript
import { env } from 'app/config/env.js';
import Stripe from 'stripe';

// Check the installed stripe package's ApiVersion type for the correct version string.
const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-03-31.basil',
});

export { stripe };
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/server && pnpm build
```

If TypeScript complains about the `apiVersion` string, open `node_modules/stripe/types/index.d.ts`, search for `ApiVersion`, and copy the latest value from the union.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/stripe.ts
git commit -m "feat(server): add Stripe client

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 17: Anthropic Service

**Files:**
- Create: `apps/server/src/services/anthropic.ts`

- [ ] **Step 1: Create the service**

`apps/server/src/services/anthropic.ts`:

```typescript
import { env } from 'app/config/env.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export { anthropic };
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/server && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/anthropic.ts
git commit -m "feat(server): add Anthropic client

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 18: R2 Service

**Files:**
- Create: `apps/server/src/services/r2.ts`

- [ ] **Step 1: Create the service**

`apps/server/src/services/r2.ts`:

```typescript
import { env } from 'app/config/env.js';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
  },
  endpoint: `https://${env.R2_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com`,
  region: 'auto',
});

async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Body: body,
      Bucket: env.R2_BUCKET_NAME,
      ContentType: contentType,
      Key: key,
    }),
  );
}

function getFileUrl(key: string): string {
  return `https://${env.R2_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME ?? ''}/${key}`;
}

export { getFileUrl, uploadFile };
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/server && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/r2.ts
git commit -m "feat(server): add Cloudflare R2 storage service

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 19: Queue Service

**Files:**
- Create: `apps/server/src/services/queue.ts`

- [ ] **Step 1: Create the service**

`apps/server/src/services/queue.ts`:

```typescript
import { redis } from 'app/services/redis.js';
import { Queue, Worker } from 'bullmq';
import type { Processor } from 'bullmq';

const aiQueue = new Queue('ai-jobs', { connection: redis });

function createWorker(processor: Processor): Worker {
  return new Worker('ai-jobs', processor, { connection: redis });
}

export { aiQueue, createWorker };
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/server && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/queue.ts
git commit -m "feat(server): add BullMQ queue service

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 20: Wire Sentry and PostHog into app.ts

**Files:**
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Add Sentry and PostHog imports at the top of app.ts**

Add these imports after the existing imports (maintain alphabetical order within the local imports group):

```typescript
import { registerSentryErrorHandler, setupSentry } from 'app/services/sentry.js';
import { shutdownPostHog } from 'app/services/posthog.js';
```

- [ ] **Step 2: Call setupSentry before any middleware**

Immediately after `validateEnv()` and before `export const app = express()`, add:

```typescript
validateEnv();

export const app = express();

setupSentry(app);
```

- [ ] **Step 3: Register Sentry error handler after notFoundHandler**

The middleware registration block currently ends with:

```typescript
app.use(notFoundHandler);
app.use(errorHandler);
```

Change it to:

```typescript
app.use(notFoundHandler);
registerSentryErrorHandler(app);
app.use(errorHandler);
```

- [ ] **Step 4: Call shutdownPostHog in the graceful shutdown function**

Find the `shutdown` function. Before `await pool.end()`, add:

```typescript
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out - forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  clearInterval(cleanupTimer);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  logger.info('HTTP server closed');
  await shutdownPostHog();
  await pool.end();
  process.exit(0);
}
```

- [ ] **Step 5: Verify it compiles**

```bash
cd apps/server && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/app.ts
git commit -m "feat(server): wire Sentry and PostHog into app lifecycle

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 21: Update Auth Schemas

**Files:**
- Modify: `apps/server/src/schemas/auth.ts`

- [ ] **Step 1: Write the failing test**

Before changing the schema, add a test that will fail until the schema is updated. This goes in the existing test file `apps/server/src/__tests__/schemas/auth.test.ts`. Open it and add:

```typescript
describe('registerSchema', () => {
  it('accepts optional name fields', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      nameAlias: 'Lenny',
      nameFirst: 'Leonard',
      nameLast: 'Smith',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nameFirst).toBe('Leonard');
      expect(result.data.nameLast).toBe('Smith');
      expect(result.data.nameAlias).toBe('Lenny');
    }
  });

  it('succeeds without name fields', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/server && pnpm test src/__tests__/schemas/auth.test.ts
```

Expected: FAIL - `nameFirst`, `nameLast`, `nameAlias` not in schema.

- [ ] **Step 3: Replace the file contents**

`apps/server/src/schemas/auth.ts`:

```typescript
import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  nameAlias: z.string().optional(),
  nameFirst: z.string().optional(),
  nameLast: z.string().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
});

export const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  token: z.string().min(1, 'Token is required'),
});

const uuidSchema = z.string().uuid('Invalid ID format');

export const userSchema = z.object({
  created_at: z.coerce.date(),
  email: z.string().email(),
  id: uuidSchema,
  name_alias: z.string().nullable(),
  name_first: z.string().nullable(),
  name_last: z.string().nullable(),
  updated_at: z.coerce.date().nullable(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type User = z.infer<typeof userSchema>;
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd apps/server && pnpm test src/__tests__/schemas/auth.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/schemas/auth.ts apps/server/src/__tests__/schemas/auth.test.ts
git commit -m "feat(server): extend auth schemas with name fields and password reset

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 22: Update Auth Repository

**Files:**
- Modify: `apps/server/src/repositories/auth/auth.ts`
- Create: `apps/server/src/__tests__/repositories/auth/passwordResets.test.ts`

- [ ] **Step 1: Write the failing tests for password reset functions**

`apps/server/src/__tests__/repositories/auth/passwordResets.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('app/db/pool/pool.js', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

import { query } from 'app/db/pool/pool.js';
import {
  createPasswordResetToken,
  findPasswordResetByToken,
  markPasswordResetUsed,
  updateUserPassword,
} from 'app/repositories/auth/auth.js';

describe('createPasswordResetToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a row and returns a 64-char hex token', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const token = await createPasswordResetToken('user-uuid');
    expect(token).toHaveLength(64);
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO password_resets'),
      expect.arrayContaining(['user-uuid']),
    );
  });
});

describe('findPasswordResetByToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no row found', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await findPasswordResetByToken('sometoken');
    expect(result).toBeNull();
  });

  it('returns the row when found', async () => {
    const mockRow = {
      expires_at: new Date(Date.now() + 3600_000),
      id: 'reset-id',
      used_at: null,
      user_id: 'user-uuid',
    };
    vi.mocked(query).mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);
    const result = await findPasswordResetByToken('sometoken');
    expect(result).toEqual(mockRow);
  });
});

describe('markPasswordResetUsed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls UPDATE with the correct id', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await markPasswordResetUsed('reset-id');
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE password_resets'),
      ['reset-id'],
    );
  });
});

describe('updateUserPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls UPDATE users with user id', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await updateUserPassword('user-uuid', 'newpassword123');
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      expect.arrayContaining(['user-uuid']),
    );
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/server && pnpm test src/__tests__/repositories/auth/passwordResets.test.ts
```

Expected: FAIL - functions not exported yet.

- [ ] **Step 3: Replace the full auth repository**

`apps/server/src/repositories/auth/auth.ts`:

```typescript
import { SESSION_TTL_MS } from 'app/constants/session.js';
import { query, withTransaction } from 'app/db/pool/pool.js';
import type { PoolClient } from 'app/db/pool/pool.js';
import type { User } from 'app/schemas/auth.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

const SALT_ROUNDS = 12;

interface NameFields {
  nameAlias?: string;
  nameFirst?: string;
  nameLast?: string;
}

export interface PasswordResetRow {
  expires_at: Date;
  id: string;
  used_at: Date | null;
  user_id: string;
}

/** Hash session token for storage. Cookie holds raw token; DB holds hash so a dump doesn't expose sessions. */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function createUser(
  email: string,
  password: string,
  nameFields?: NameFields,
  client?: PoolClient,
): Promise<User> {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await query<User>(
    `INSERT INTO users (email, name_alias, name_first, name_last, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name_alias, name_first, name_last, created_at, updated_at`,
    [
      email.toLowerCase().trim(),
      nameFields?.nameAlias ?? null,
      nameFields?.nameFirst ?? null,
      nameFields?.nameLast ?? null,
      password_hash,
    ],
    client,
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}

export async function findUserByEmail(
  email: string,
): Promise<(User & { password_hash: string }) | null> {
  const result = await query<User & { password_hash: string }>(
    `SELECT id, email, name_alias, name_first, name_last, password_hash, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT id, email, name_alias, name_first, name_last, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(
  userId: string,
  client?: PoolClient,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const idHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [idHash, userId, expiresAt],
    client,
  );
  return token;
}

/** Returns the user for a valid session in one query (sessions JOIN users). */
export async function getSessionWithUser(
  sessionId: string,
): Promise<User | null> {
  const idHash = hashToken(sessionId);
  const result = await query<User>(
    `SELECT u.id, u.email, u.name_alias, u.name_first, u.name_last, u.created_at, u.updated_at
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [idHash],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const idHash = hashToken(sessionId);
  const result = await query(
    'DELETE FROM sessions WHERE id = $1 RETURNING id',
    [idHash],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

/** Removes expired sessions. Call on an interval to prevent table bloat. */
export async function deleteExpiredSessions(): Promise<number> {
  const result = await query(
    'DELETE FROM sessions WHERE expires_at <= NOW() RETURNING id',
  );
  return result.rowCount ?? 0;
}

/** Creates a new session, pruning only expired sessions for this user. Allows concurrent sessions. */
export async function loginUser(userId: string): Promise<string> {
  return withTransaction(async (client) => {
    await query(
      'DELETE FROM sessions WHERE user_id = $1 AND expires_at <= NOW()',
      [userId],
      client,
    );
    return createSession(userId, client);
  });
}

/**
 * Verifies credentials and returns the user without exposing password_hash.
 * Returns null when email does not exist or password is wrong.
 * Callers cannot distinguish which case failed (intentional: prevents user enumeration).
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<User | null> {
  const row = await findUserByEmail(email);
  if (!row) return null;
  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) return null;
  return {
    created_at: row.created_at,
    email: row.email,
    id: row.id,
    name_alias: row.name_alias,
    name_first: row.name_first,
    name_last: row.name_last,
    updated_at: row.updated_at,
  };
}

/**
 * Creates a user and their first session in a single transaction.
 * Throws with code "23505" when email is already registered.
 */
export async function createUserAndSession(
  email: string,
  password: string,
  nameFields?: NameFields,
): Promise<{ user: User; sessionId: string }> {
  return withTransaction(async (client) => {
    const user = await createUser(email, password, nameFields, client);
    const sessionId = await createSession(user.id, client);
    return { user, sessionId };
  });
}

/** Generates a reset token, stores its SHA-256 hash with a 1-hour expiry, and returns the raw token. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
  return token;
}

/** Looks up a password reset by raw token (hashes internally). Returns null if not found. */
export async function findPasswordResetByToken(
  token: string,
): Promise<PasswordResetRow | null> {
  const tokenHash = hashToken(token);
  const result = await query<PasswordResetRow>(
    `SELECT id, user_id, expires_at, used_at
     FROM password_resets
     WHERE token_hash = $1`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

/** Marks a password reset token as used so it cannot be replayed. */
export async function markPasswordResetUsed(id: string): Promise<void> {
  await query(
    `UPDATE password_resets SET used_at = NOW() WHERE id = $1`,
    [id],
  );
}

/** Hashes newPassword with bcrypt and updates the user's password_hash. */
export async function updateUserPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [password_hash, userId],
  );
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd apps/server && pnpm test src/__tests__/repositories/auth/passwordResets.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Run all auth repo tests to ensure nothing is broken**

```bash
cd apps/server && pnpm test src/__tests__/repositories/auth/auth.test.ts
```

Expected: All tests pass (the existing repo tests mock `query` so the new columns don't affect them).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/repositories/auth/auth.ts apps/server/src/__tests__/repositories/auth/passwordResets.test.ts
git commit -m "feat(server): update auth repo with name fields and password reset functions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 23: Update Auth Handlers (Name in Responses)

**Files:**
- Modify: `apps/server/src/handlers/auth/auth.ts`
- Modify: `apps/server/src/__tests__/handlers/auth/auth.test.ts`

- [ ] **Step 1: Update the existing handler test to assert the name shape**

In `apps/server/src/__tests__/handlers/auth/auth.test.ts`, make these changes:

First, add two new `vi.mock` calls at the top (the updated handler now imports `sendEmail` and `trackEvent`):

```typescript
vi.mock('app/services/email.js', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('app/services/posthog.js', () => ({ shutdownPostHog: vi.fn(), trackEvent: vi.fn() }));
```

Update the mock `User` objects to include name fields:

```typescript
const mockUser: User & { password_hash: string } = {
  created_at: new Date('2025-01-01'),
  email: 'user@example.com',
  id,
  name_alias: null,
  name_first: null,
  name_last: null,
  password_hash: 'hashed',
  updated_at: null,
};

const mockAuthUser: User = {
  created_at: new Date('2025-01-01'),
  email: 'user@example.com',
  id,
  name_alias: null,
  name_first: null,
  name_last: null,
  updated_at: null,
};
```

Update the `req.user` stub in the `me` route setup:

```typescript
app.get(
  '/me',
  (req, res, next) => {
    if (req.headers['x-test-user'] === '1') {
      req.user = {
        created_at: new Date('2025-01-01'),
        email: 'user@example.com',
        id,
        name_alias: null,
        name_first: null,
        name_last: null,
        updated_at: null,
      };
    }
    next();
  },
  requireAuth,
  authHandlers.me,
);
```

Update all `expect(res.body.user).toEqual(...)` assertions to include the `name` field:

```typescript
// In register test:
expect(res.body.user).toEqual({
  createdAt: '2025-01-01T00:00:00.000Z',
  email: 'user@example.com',
  id,
  name: { alias: null, first: null, last: null },
  updatedAt: null,
});

// In login test:
expect(res.body.user).toEqual({
  createdAt: '2025-01-01T00:00:00.000Z',
  email: 'user@example.com',
  id,
  name: { alias: null, first: null, last: null },
  updatedAt: null,
});

// In me test:
expect(res.body.user).toEqual({
  createdAt: '2025-01-01T00:00:00.000Z',
  email: 'user@example.com',
  id,
  name: { alias: null, first: null, last: null },
  updatedAt: null,
});
```

Update the `createUserAndSession` call assertion in the register test:

```typescript
expect(authRepo.createUserAndSession).toHaveBeenCalledWith(
  'user@example.com',
  'password123',
  { nameAlias: undefined, nameFirst: undefined, nameLast: undefined },
);
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd apps/server && pnpm test src/__tests__/handlers/auth/auth.test.ts
```

Expected: FAIL - `name` field missing from responses, User type mismatch.

- [ ] **Step 3: Replace the full handlers file**

`apps/server/src/handlers/auth/auth.ts`:

```typescript
import { isProduction } from 'app/config/env.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from 'app/constants/session.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import type { User } from 'app/schemas/auth.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from 'app/schemas/auth.js';
import { sendEmail } from 'app/services/email.js';
import { trackEvent } from 'app/services/posthog.js';
import { logger } from 'app/utils/logs/logger.js';
import type { Request, Response } from 'express';

function toUserResponse(user: User) {
  return {
    createdAt: user.created_at,
    email: user.email,
    id: user.id,
    name: {
      alias: user.name_alias,
      first: user.name_first,
      last: user.name_last,
    },
    updatedAt: user.updated_at,
  };
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
    sameSite: isProduction() ? ('none' as const) : ('lax' as const),
    secure: isProduction(),
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const { email, nameAlias, nameFirst, nameLast, password } = parsed.data;
  try {
    const { user, sessionId } = await authRepo.createUserAndSession(
      email,
      password,
      { nameAlias, nameFirst, nameLast },
    );
    logger.info(
      { event: 'register_success', ip: req.ip, userId: user.id },
      'User registered',
    );
    trackEvent(user.id, 'user_registered');
    res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
    res.status(201).json({ user: toUserResponse(user) });
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code: string }).code
        : undefined;
    if (code === '23505') {
      logger.warn(
        { event: 'register_duplicate_email', ip: req.ip },
        'Registration failed: email already registered',
      );
      res.status(409).json({ error: { message: 'Email already registered' } });
      return;
    }
    throw err;
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const { email, password } = parsed.data;
  const user = await authRepo.authenticate(email, password);
  if (!user) {
    logger.warn(
      { event: 'login_failure', ip: req.ip },
      'Login failed: invalid credentials',
    );
    res.status(401).json({ error: { message: 'Invalid email or password' } });
    return;
  }
  const sessionId = await authRepo.loginUser(user.id);
  logger.info(
    { event: 'login_success', ip: req.ip, userId: user.id },
    'User logged in',
  );
  trackEvent(user.id, 'user_logged_in');
  res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
  res.json({ user: toUserResponse(user) });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token && typeof token === 'string') {
    try {
      await authRepo.deleteSession(token);
    } catch (err) {
      logger.error({ err }, 'Failed to delete session on logout');
    }
  }
  const userId = req.user?.id;
  logger.info({ event: 'logout', ip: req.ip, userId }, 'User logged out');
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: toUserResponse(req.user!) });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const { email } = parsed.data;
  const user = await authRepo.findUserByEmail(email);
  if (user) {
    const token = await authRepo.createPasswordResetToken(user.id);
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;
    await sendEmail({
      html: `<p>Click the link below to reset your Doppelscript password. This link expires in 1 hour.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you did not request a password reset, you can safely ignore this email.</p>`,
      subject: 'Reset your Doppelscript password',
      to: email,
    });
    trackEvent(user.id, 'password_reset_requested');
    logger.info(
      { event: 'password_reset_requested', userId: user.id },
      'Password reset requested',
    );
  }
  res.json({ success: true });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const { newPassword, token } = parsed.data;
  const resetRecord = await authRepo.findPasswordResetByToken(token);

  if (!resetRecord || resetRecord.used_at || new Date() > new Date(resetRecord.expires_at)) {
    res.status(400).json({ error: { message: 'Invalid or expired reset token' } });
    return;
  }

  await authRepo.updateUserPassword(resetRecord.user_id, newPassword);
  await authRepo.markPasswordResetUsed(resetRecord.id);
  await authRepo.deleteSessionsForUser(resetRecord.user_id);

  trackEvent(resetRecord.user_id, 'password_reset_completed');
  logger.info(
    { event: 'password_reset_completed', userId: resetRecord.user_id },
    'Password reset completed',
  );

  res.json({ success: true });
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd apps/server && pnpm test src/__tests__/handlers/auth/auth.test.ts
```

Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/handlers/auth/auth.ts apps/server/src/__tests__/handlers/auth/auth.test.ts
git commit -m "feat(server): add name to user responses and wire PostHog events

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 24: Forgot Password Handler Tests + Rate Limiter

**Files:**
- Create: `apps/server/src/__tests__/handlers/auth/forgotPassword.test.ts`
- Modify: `apps/server/src/middleware/rateLimiter/rateLimiter.ts`

- [ ] **Step 1: Write the failing tests for forgotPassword**

`apps/server/src/__tests__/handlers/auth/forgotPassword.test.ts`:

```typescript
import { uuid } from 'app/__tests__/helpers/uuids.js';
import * as authHandlers from 'app/handlers/auth/auth.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/auth/auth.js');
vi.mock('app/services/email.js', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('app/services/posthog.js', () => ({ trackEvent: vi.fn() }));
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { sendEmail } from 'app/services/email.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.post('/auth/forgot-password', authHandlers.forgotPassword);
app.use(errorHandler);

const userId = uuid();

describe('POST /auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('returns 200 when email is not found (prevents enumeration)', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 200 and sends email when user found', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce({
      created_at: new Date(),
      email: 'user@example.com',
      id: userId,
      name_alias: null,
      name_first: null,
      name_last: null,
      password_hash: 'hash',
      updated_at: null,
    });
    vi.mocked(authRepo.createPasswordResetToken).mockResolvedValueOnce('rawtoken');

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Reset your Doppelscript password',
        to: 'user@example.com',
      }),
    );
    expect(authRepo.createPasswordResetToken).toHaveBeenCalledWith(userId);
  });

  it('includes the token in the reset URL sent via email', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce({
      created_at: new Date(),
      email: 'user@example.com',
      id: userId,
      name_alias: null,
      name_first: null,
      name_last: null,
      password_hash: 'hash',
      updated_at: null,
    });
    vi.mocked(authRepo.createPasswordResetToken).mockResolvedValueOnce('mytoken123');

    await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'user@example.com' });

    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.html).toContain('mytoken123');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd apps/server && pnpm test src/__tests__/handlers/auth/forgotPassword.test.ts
```

Expected: FAIL - `sendEmail` and `trackEvent` imports in the handler need the mocked modules.

- [ ] **Step 3: Add the forgotPasswordRateLimiter to rateLimiter.ts**

Open `apps/server/src/middleware/rateLimiter/rateLimiter.ts` and append:

```typescript
/** Per-email rate limit for forgot-password: 3 requests per email per hour. */
export const forgotPasswordRateLimiter = rateLimit({
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown };
    return typeof body.email === 'string'
      ? body.email.toLowerCase()
      : (req.ip ?? 'unknown');
  },
  legacyHeaders: false,
  limit: 3,
  standardHeaders: true,
  windowMs: 60 * 60 * 1000,
});
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd apps/server && pnpm test src/__tests__/handlers/auth/forgotPassword.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/__tests__/handlers/auth/forgotPassword.test.ts apps/server/src/middleware/rateLimiter/rateLimiter.ts
git commit -m "feat(server): add forgot password handler tests and rate limiter

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 25: Reset Password Handler Tests

**Files:**
- Create: `apps/server/src/__tests__/handlers/auth/resetPassword.test.ts`

- [ ] **Step 1: Write the failing tests**

`apps/server/src/__tests__/handlers/auth/resetPassword.test.ts`:

```typescript
import { uuid } from 'app/__tests__/helpers/uuids.js';
import * as authHandlers from 'app/handlers/auth/auth.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/auth/auth.js');
vi.mock('app/services/posthog.js', () => ({ trackEvent: vi.fn() }));
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.post('/auth/reset-password', authHandlers.resetPassword);
app.use(errorHandler);

const userId = uuid();

const validResetRow = {
  expires_at: new Date(Date.now() + 3600_000),
  id: 'reset-id',
  used_at: null,
  user_id: userId,
};

describe('POST /auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when token is missing', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is missing', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'sometoken' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is too short', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'short', token: 'sometoken' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is not found', async () => {
    vi.mocked(authRepo.findPasswordResetByToken).mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123', token: 'badtoken' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid or expired reset token');
  });

  it('returns 400 when token is already used', async () => {
    vi.mocked(authRepo.findPasswordResetByToken).mockResolvedValueOnce({
      ...validResetRow,
      used_at: new Date(Date.now() - 1000),
    });
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123', token: 'usedtoken' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid or expired reset token');
  });

  it('returns 400 when token is expired', async () => {
    vi.mocked(authRepo.findPasswordResetByToken).mockResolvedValueOnce({
      ...validResetRow,
      expires_at: new Date(Date.now() - 1000),
    });
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123', token: 'expiredtoken' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid or expired reset token');
  });

  it('returns 200 and updates password and clears sessions on valid token', async () => {
    vi.mocked(authRepo.findPasswordResetByToken).mockResolvedValueOnce(validResetRow);
    vi.mocked(authRepo.updateUserPassword).mockResolvedValueOnce(undefined);
    vi.mocked(authRepo.markPasswordResetUsed).mockResolvedValueOnce(undefined);
    vi.mocked(authRepo.deleteSessionsForUser).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'newpassword123', token: 'validtoken' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(authRepo.updateUserPassword).toHaveBeenCalledWith(userId, 'newpassword123');
    expect(authRepo.markPasswordResetUsed).toHaveBeenCalledWith('reset-id');
    expect(authRepo.deleteSessionsForUser).toHaveBeenCalledWith(userId);
  });
});
```

- [ ] **Step 2: Run the tests**

The `resetPassword` handler was implemented in Task 23. Run the tests now to verify the implementation matches the expected behavior:

```bash
cd apps/server && pnpm test src/__tests__/handlers/auth/resetPassword.test.ts
```

If any test fails, diagnose from the error output and fix the handler - do not skip any test.

```bash
cd apps/server && pnpm test src/__tests__/handlers/auth/resetPassword.test.ts
```

Expected: All 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/__tests__/handlers/auth/resetPassword.test.ts
git commit -m "test(server): add reset password handler tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 26: Add Routes for Forgot/Reset Password

**Files:**
- Modify: `apps/server/src/routes/auth.ts`

- [ ] **Step 1: Write the failing routes test**

Open `apps/server/src/__tests__/routes/routes.test.ts`. Add a test that hitting `POST /auth/forgot-password` and `POST /auth/reset-password` returns something other than 404:

```typescript
it('POST /auth/forgot-password route exists', async () => {
  const res = await request(app).post('/auth/forgot-password').send({});
  expect(res.status).not.toBe(404);
});

it('POST /auth/reset-password route exists', async () => {
  const res = await request(app).post('/auth/reset-password').send({});
  expect(res.status).not.toBe(404);
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd apps/server && pnpm test src/__tests__/routes/routes.test.ts
```

Expected: FAIL - routes return 404.

- [ ] **Step 3: Replace the routes file**

`apps/server/src/routes/auth.ts`:

```typescript
import * as authHandlers from 'app/handlers/auth/auth.js';
import {
  authRateLimiter,
  forgotPasswordRateLimiter,
} from 'app/middleware/rateLimiter/rateLimiter.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const authRouter = express.Router();

authRouter.post('/forgot-password', forgotPasswordRateLimiter, authHandlers.forgotPassword);
authRouter.post('/login', authRateLimiter, authHandlers.login);
authRouter.post('/logout', authHandlers.logout);
authRouter.get('/me', requireAuth, authHandlers.me);
authRouter.post('/register', authRateLimiter, authHandlers.register);
authRouter.post('/reset-password', authHandlers.resetPassword);

export { authRouter };
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd apps/server && pnpm test src/__tests__/routes/routes.test.ts
```

Expected: All tests pass including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/auth.ts apps/server/src/__tests__/routes/routes.test.ts
git commit -m "feat(server): add forgot-password and reset-password routes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 27: Final Verification

- [ ] **Step 1: Run the full test suite**

```bash
cd apps/server && pnpm test
```

Expected: All tests pass. Fix any failures before proceeding - do not skip.

- [ ] **Step 2: Run lint**

```bash
cd apps/server && pnpm lint
```

Expected: Zero warnings, zero errors.

- [ ] **Step 3: Run the build**

```bash
cd apps/server && pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Smoke test the server locally**

Ensure `apps/server/.env` has `DATABASE_URL`, `SESSION_SECRET`, and optionally `REDIS_URL`.

```bash
cd apps/server && pnpm dev
```

In a second terminal:

```bash
# Liveness check
curl -s http://localhost:3001/health

# Readiness check (DB connectivity)
curl -s http://localhost:3001/health/ready

# Register
curl -s -X POST http://localhost:3001/auth/register \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"test@example.com","password":"password123","nameFirst":"Test","nameLast":"User"}'

# Forgot password (dev mode - check server logs for the email content)
curl -s -X POST http://localhost:3001/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"test@example.com"}'
```

Expected:
- `/health` returns `{"status":"ok"}`
- `/health/ready` returns `{"status":"ok","db":"connected"}`
- Register returns 201 with `user.name: { alias: null, first: "Test", last: "User" }`
- Forgot-password returns `{"success":true}` and logs the email content to the server console

- [ ] **Step 5: Check em-dash cleanliness across new files**

```bash
grep -r $'\u2014' apps/server/src/services/ apps/server/migrations/ || echo "Clean"
```

Expected: "Clean" - no em dashes found.
