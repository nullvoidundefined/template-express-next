# Boilerplate Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade template-express-next boilerplate with production-tested infrastructure ported from doppelscript: Stripe billing, Redis/BullMQ, R2 storage, circuit breaker, env validation, theme, toast, modal queue, Next.js middleware, deploy/smoke/Storybook/testing tooling.

**Architecture:** Hybrid port -- existing boilerplate provides the clean shell (auth, Sentry, PostHog, CSRF, middleware stack, CI). New modules are copied from doppelscript and genericized (domain logic stripped, names/references updated). Single client surface (web only).

**Tech Stack:** Express 5, Next.js 15, TypeScript, PostgreSQL, Redis 7, BullMQ, Stripe, Cloudflare R2 (S3-compatible), Zustand, Radix UI, Playwright, Vitest, Storybook, pnpm workspaces.

**Source repo (read-only reference):** `/Users/iangreenough/Desktop/code/personal/production/doppelscript/`
**Target repo (all writes here):** `/Users/iangreenough/Desktop/code/personal/templates/template-express-next-boilerplate/`

---

## File Map

### New files

```
apps/server/src/
  config/env.ts                          # Zod env validation (replace existing)
  handlers/billing/billing.ts            # create checkout session
  handlers/billing/portal.ts             # create customer portal session
  handlers/billing/webhook.ts            # Stripe webhook + idempotency
  repositories/billing.ts                # subscription + stripe_events CRUD
  routes/billing.ts                      # billing router
  services/billing.service.ts            # webhook event orchestration
  services/circuit-breaker.ts            # Redis-backed circuit breaker
  services/queue.ts                      # BullMQ queue + enqueue helpers
  services/r2.ts                         # Cloudflare R2 client
  services/redis.ts                      # two Redis clients (BullMQ + rate limiter)
  services/stripe.ts                     # lazy Stripe singleton
  worker.ts                              # standalone BullMQ worker process
  __tests__/services/env.test.ts         # env validation tests
  __tests__/handlers/billing/webhook.test.ts
  __tests__/services/circuit-breaker.test.ts
  __tests__/services/r2.test.ts

apps/server/migrations/
  {TS1}_create-subscriptions-table.js
  {TS2}_create-stripe-events-table.js

apps/client/web/src/
  app/api/[...path]/route.ts             # API proxy to Express
  components/ui/Toast/Toast.tsx           # Radix Toast + Zustand
  components/ui/Toast/Toast.module.scss
  components/ui/Toast/Toast.stories.tsx
  components/ui/Modal/Modal.tsx           # Radix Dialog + Zustand
  components/ui/Modal/Modal.module.scss
  components/ui/Modal/Modal.stories.tsx
  state/useTheme.ts                      # Zustand theme store
  state/useToast.ts                      # Zustand toast store
  state/useModal.ts                      # Zustand modal store
  __tests__/state/useTheme.test.ts
  __tests__/state/useToast.test.ts
  __tests__/state/useModal.test.ts
  __tests__/components/ui/Toast/Toast.test.tsx
  __tests__/components/ui/Modal/Modal.test.tsx

apps/client/web/.storybook/
  main.ts
  preview.ts

scripts/
  deploy.sh
  dev-watch.sh
  ensure-test-db.sh

e2e/
  global-setup.ts
  smoke/health.smoke.ts
  smoke/auth.smoke.ts
  smoke/error.smoke.ts
  visual-regression/storybook.spec.ts

playwright.smoke.config.ts
```

### Modified files

```
apps/server/src/app.ts                   # new middleware order, webhook route, billing router
apps/server/src/middleware/rateLimiter/rateLimiter.ts  # Redis-backed
apps/server/package.json                 # new deps
apps/client/web/src/app/layout.tsx       # theme script, Toast/Modal providers
apps/client/web/src/middleware.ts         # route protection
apps/client/web/package.json             # new deps (zustand, radix)
packages/types/src/index.ts              # Subscription type
packages/constants/src/index.ts          # billing constants
package.json                             # scripts
pnpm-workspace.yaml                      # remove extension/mobile/client-shared
docker-compose.yml                       # already has Redis, just verify
lefthook.yml                             # E2E in CI only
.github/workflows/ci.yml                 # Redis service, seed step
playwright.config.ts                     # ensure-test-db globalSetup
```

### Deleted

```
apps/client/extension/                   # if exists
apps/client/mobile/                      # if exists
packages/client-shared/                  # single client, not needed
```

---

## Task 1: Clean up workspace -- remove unused packages

**Files:**
- Delete: `apps/client/extension/`, `apps/client/mobile/`, `packages/client-shared/`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Delete unused directories**

```bash
rm -rf apps/client/extension apps/client/mobile packages/client-shared
```

- [ ] **Step 2: Update pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/server'
  - 'apps/client/web'
  - 'packages/constants'
  - 'packages/tokens'
  - 'packages/types'
```

- [ ] **Step 3: Run pnpm install to update lockfile**

```bash
pnpm install
```

- [ ] **Step 4: Verify build still works**

```bash
pnpm build
```
Expected: clean build, no errors about missing packages.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove extension, mobile, and client-shared packages"
```

---

## Task 2: Server env validation with Zod

**Files:**
- Modify: `apps/server/src/config/env.ts`
- Create: `apps/server/src/__tests__/services/env.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/__tests__/services/env.test.ts
import { describe, expect, it } from 'vitest';

describe('env', () => {
  it('exports a frozen env object with typed properties', async () => {
    const { env } = await import('../../config/env.js');
    expect(env).toBeDefined();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.PORT).toBeTypeOf('number');
    expect(() => {
      (env as any).PORT = 9999;
    }).toThrow();
  });

  it('exports isDev, isProd, isDeployed helpers', async () => {
    const { isDev, isDeployed, isProd } = await import('../../config/env.js');
    expect(typeof isDev).toBe('boolean');
    expect(typeof isProd).toBe('boolean');
    expect(typeof isDeployed).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/server && npx vitest run src/__tests__/services/env.test.ts
```
Expected: FAIL (current env.ts may not export these, or may not be frozen).

- [ ] **Step 3: Replace env.ts with Zod-validated version**

```typescript
// apps/server/src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_CA_CERT: z.string().optional(),
  DATABASE_MIGRATION_URL: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z
    .enum(['development', 'production', 'staging', 'test'])
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
  RESEND_FROM_EMAIL: z.string().default('noreply@example.com'),
  SENTRY_DSN: z.string().optional(),
  SESSION_SECRET: z.string().min(1, 'SESSION_SECRET is required'),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  WORKER_PORT: z.coerce.number().default(3002),
});

const parsed = envSchema.parse(process.env);

if (parsed.NODE_ENV === 'production' && !parsed.REDIS_URL) {
  console.warn(
    '[env] REDIS_URL is not set in production. Rate limiters will use in-memory storage.',
  );
}

export const env = Object.freeze(parsed);

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isStaging = env.NODE_ENV === 'staging';

export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

export function isDeployed(): boolean {
  return env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
}
```

- [ ] **Step 4: Update any existing imports of env vars to use `env.`**

Search for `process.env.` in `apps/server/src/` and replace with `env.` imports where appropriate. Key files: `app.ts`, `db/pool/pool.ts`, `services/email/email.ts`, `services/analytics/analytics.ts`, `config/corsConfig.ts`. Keep `process.env.` in `index.ts` (before env.ts loads) and in vitest configs.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/server && npx vitest run src/__tests__/services/env.test.ts
```
Expected: PASS

- [ ] **Step 6: Run full server test suite**

```bash
cd apps/server && npx vitest run
```
Expected: all passing (env.ts change should be transparent if imports updated correctly).

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/config/env.ts apps/server/src/__tests__/services/env.test.ts
git add -u  # pick up any import changes
git commit -m "feat(server): add Zod-validated env config with typed accessors"
```

---

## Task 3: Redis service

**Files:**
- Create: `apps/server/src/services/redis.ts`
- Modify: `apps/server/package.json` (add `ioredis`)

- [ ] **Step 1: Install ioredis**

```bash
cd apps/server && pnpm add ioredis && pnpm add -D @types/ioredis
```

Note: `@types/ioredis` may not be needed -- `ioredis` ships its own types. Check after install and remove if redundant.

- [ ] **Step 2: Create Redis service**

```typescript
// apps/server/src/services/redis.ts
import { Redis } from 'ioredis';

import { logger } from 'app/utils/logs/logger.js';

const redisUrl = process.env.REDIS_URL;

let redis: Redis | null = null;
let redisRateLimiter: Redis | null = null;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  redisRateLimiter = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => logger.info('Redis (BullMQ) connected'));
  redis.on('error', (err: Error) =>
    logger.error({ err }, 'Redis (BullMQ) error'),
  );
  redisRateLimiter.on('connect', () =>
    logger.info('Redis (rate-limiter) connected'),
  );
  redisRateLimiter.on('error', (err: Error) =>
    logger.error({ err }, 'Redis (rate-limiter) error'),
  );
} else {
  logger.info('REDIS_URL not set; Redis features disabled');
}

async function redisHealthCheck(): Promise<boolean> {
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export { redis, redisHealthCheck, redisRateLimiter };
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/redis.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): add Redis service with BullMQ and rate-limiter clients"
```

---

## Task 4: BullMQ queue and worker

**Files:**
- Create: `apps/server/src/services/queue.ts`
- Create: `apps/server/src/worker.ts`
- Modify: `apps/server/package.json` (add `bullmq`)

- [ ] **Step 1: Install BullMQ**

```bash
cd apps/server && pnpm add bullmq
```

- [ ] **Step 2: Create queue service**

```typescript
// apps/server/src/services/queue.ts
import { Queue, Worker } from 'bullmq';
import type { Processor } from 'bullmq';

import { redis } from 'app/services/redis.js';
import { logger } from 'app/utils/logs/logger.js';

const jobQueue: Queue | null = redis
  ? new Queue('default-jobs', { connection: redis })
  : null;

function createWorker(processor: Processor): Worker | null {
  if (!redis) {
    logger.info('Redis unavailable; skipping worker creation');
    return null;
  }
  return new Worker('default-jobs', processor, { connection: redis });
}

// -- Example job enqueue (replace with real jobs) --

type ExampleJob = {
  message: string;
};

async function enqueueExampleJob(message: string): Promise<void> {
  if (!jobQueue) return;
  try {
    await jobQueue.add(
      'example',
      { message } satisfies ExampleJob,
      {
        attempts: 3,
        backoff: { delay: 5000, type: 'exponential' },
      },
    );
  } catch (err) {
    logger.warn({ err }, 'Failed to enqueue example job');
  }
}

export { createWorker, enqueueExampleJob, jobQueue };
export type { ExampleJob };
```

- [ ] **Step 3: Create worker entry point**

```typescript
// apps/server/src/worker.ts
import 'dotenv/config';

import { createWorker } from 'app/services/queue.js';
import { logger } from 'app/utils/logs/logger.js';

const worker = createWorker(async (job) => {
  switch (job.name) {
    case 'example':
      logger.info({ data: job.data, jobId: job.id }, 'Processing example job');
      break;
    default:
      logger.warn({ jobName: job.name }, 'Unknown job type, skipping');
  }
});

if (!worker) {
  logger.fatal('REDIS_URL is required for the worker process');
  process.exit(1);
}

worker.on('failed', (job, err) => {
  logger.error(
    { err, jobId: job?.id, jobName: job?.name ?? 'unknown' },
    'Job failed',
  );
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, 'Job completed');
});

logger.info('Worker started, listening for jobs on default-jobs queue');
```

- [ ] **Step 4: Add worker script to server package.json**

Add to `apps/server/package.json` scripts:
```json
"worker": "tsx watch src/worker.ts"
```

And to root `package.json`:
```json
"dev:worker": "pnpm --filter ./apps/server run worker"
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/queue.ts apps/server/src/worker.ts apps/server/package.json package.json pnpm-lock.yaml
git commit -m "feat(server): add BullMQ queue, worker process, and example job"
```

---

## Task 5: Circuit breaker

**Files:**
- Create: `apps/server/src/services/circuit-breaker.ts`
- Create: `apps/server/src/__tests__/services/circuit-breaker.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/__tests__/services/circuit-breaker.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock Redis to null (no Redis available)
vi.mock('app/services/redis.js', () => ({
  redis: null,
}));

describe('circuit-breaker (no Redis)', () => {
  it('isCircuitOpen returns false when Redis is absent', async () => {
    const { isCircuitOpen } = await import(
      '../../services/circuit-breaker.js'
    );
    expect(await isCircuitOpen()).toBe(false);
  });

  it('tripCircuit is a no-op when Redis is absent', async () => {
    const { tripCircuit } = await import('../../services/circuit-breaker.js');
    await expect(tripCircuit()).resolves.toBeUndefined();
  });

  it('closeCircuit is a no-op when Redis is absent', async () => {
    const { closeCircuit } = await import('../../services/circuit-breaker.js');
    await expect(closeCircuit()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/server && npx vitest run src/__tests__/services/circuit-breaker.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Create circuit breaker service**

```typescript
// apps/server/src/services/circuit-breaker.ts
import { redis } from 'app/services/redis.js';
import { logger } from 'app/utils/logs/logger.js';

const CIRCUIT_STATE_KEY = 'circuit:external:state';

async function isCircuitOpen(): Promise<boolean> {
  if (!redis) return false;
  try {
    const state = await redis.get(CIRCUIT_STATE_KEY);
    return state === 'open';
  } catch {
    return false;
  }
}

async function tripCircuit(): Promise<void> {
  if (!redis) return;
  try {
    const current = await redis.get(CIRCUIT_STATE_KEY);
    if (current === 'open') return;
    await redis.set(CIRCUIT_STATE_KEY, 'open');
    logger.warn({ event: 'circuit_tripped' }, 'Circuit breaker opened');
  } catch (err) {
    logger.error({ err }, 'Failed to trip circuit breaker');
  }
}

async function closeCircuit(): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(CIRCUIT_STATE_KEY, 'closed');
    logger.warn({ event: 'circuit_closed' }, 'Circuit breaker closed');
  } catch (err) {
    logger.error({ err }, 'Failed to close circuit breaker');
  }
}

export { closeCircuit, isCircuitOpen, tripCircuit };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/server && npx vitest run src/__tests__/services/circuit-breaker.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/circuit-breaker.ts apps/server/src/__tests__/services/circuit-breaker.test.ts
git commit -m "feat(server): add Redis-backed circuit breaker"
```

---

## Task 6: R2/S3 storage

**Files:**
- Create: `apps/server/src/services/r2.ts`
- Create: `apps/server/src/__tests__/services/r2.test.ts`
- Modify: `apps/server/package.json` (add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)

- [ ] **Step 1: Install AWS SDK S3 packages**

```bash
cd apps/server && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/server/src/__tests__/services/r2.test.ts
import { describe, expect, it } from 'vitest';

import { assertValidKey } from '../../services/r2.js';

describe('r2', () => {
  describe('assertValidKey', () => {
    it('accepts valid keys', () => {
      expect(() => assertValidKey('users/abc/avatar.png')).not.toThrow();
      expect(() => assertValidKey('uploads/2026/file.pdf')).not.toThrow();
    });

    it('rejects keys with path traversal', () => {
      expect(() => assertValidKey('../etc/passwd')).toThrow('Invalid R2 key');
      expect(() => assertValidKey('users/../admin')).toThrow('Invalid R2 key');
    });

    it('rejects keys with invalid characters', () => {
      expect(() => assertValidKey('file name.txt')).toThrow('Invalid R2 key');
      expect(() => assertValidKey('file;rm -rf')).toThrow('Invalid R2 key');
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/server && npx vitest run src/__tests__/services/r2.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 4: Create R2 service**

```typescript
// apps/server/src/services/r2.ts
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presignUrl } from '@aws-sdk/s3-request-presigner';

import { env } from 'app/config/env.js';

const s3 = new S3Client({
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
  },
  endpoint: `https://${env.R2_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com`,
  region: 'auto',
});

const VALID_KEY_PATTERN = /^[a-zA-Z0-9\-_/.]+$/;

function assertValidKey(key: string): void {
  if (!VALID_KEY_PATTERN.test(key) || key.includes('..')) {
    throw new Error(`Invalid R2 key: ${key}`);
  }
}

async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
): Promise<void> {
  assertValidKey(key);
  await s3.send(
    new PutObjectCommand({
      Body: body,
      Bucket: env.R2_BUCKET_NAME,
      ContentType: contentType,
      Key: key,
    }),
  );
}

async function deleteFile(key: string): Promise<void> {
  assertValidKey(key);
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

async function getSignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
  assertValidKey(key);
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME ?? '',
    Key: key,
  });
  return presignUrl(s3, command, { expiresIn: ttlSeconds });
}

export { assertValidKey, deleteFile, getSignedUrl, uploadFile };
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/server && npx vitest run src/__tests__/services/r2.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/r2.ts apps/server/src/__tests__/services/r2.test.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): add Cloudflare R2 storage service"
```

---

## Task 7: Stripe service and billing migrations

**Files:**
- Create: `apps/server/src/services/stripe.ts`
- Create: `apps/server/migrations/{TS1}_create-subscriptions-table.js`
- Create: `apps/server/migrations/{TS2}_create-stripe-events-table.js`
- Modify: `apps/server/package.json` (add `stripe`)
- Modify: `packages/types/src/index.ts` (add Subscription type)

- [ ] **Step 1: Install Stripe**

```bash
cd apps/server && pnpm add stripe
```

- [ ] **Step 2: Create Stripe service**

```typescript
// apps/server/src/services/stripe.ts
import Stripe from 'stripe';

import { env } from 'app/config/env.js';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY is not set. Stripe operations are unavailable.',
      );
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export { getStripe };
```

- [ ] **Step 3: Determine next migration timestamp**

```bash
ls apps/server/migrations/ | tail -1
```

Use the last timestamp + 1 for the new migrations.

- [ ] **Step 4: Create subscriptions migration**

```javascript
// apps/server/migrations/{TS1}_create-subscriptions-table.js
/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  pgm.createType('subscription_status', {
    values: [
      'active',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'paused',
      'trialing',
      'unpaid',
    ],
  });

  pgm.createTable('subscriptions', {
    cancel_at_period_end: { default: false, notNull: true, type: 'boolean' },
    created_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
    current_period_end: { type: 'timestamptz' },
    current_period_start: { type: 'timestamptz' },
    id: {
      default: pgm.func('gen_random_uuid()'),
      primaryKey: true,
      type: 'uuid',
    },
    plan_id: { type: 'varchar(255)' },
    status: { default: 'incomplete', notNull: true, type: 'subscription_status' },
    stripe_customer_id: { type: 'varchar(255)', unique: true },
    stripe_subscription_id: { type: 'varchar(255)', unique: true },
    updated_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
    user_id: {
      notNull: true,
      onDelete: 'CASCADE',
      references: 'users',
      type: 'uuid',
      unique: true,
    },
  });

  pgm.createIndex('subscriptions', 'user_id');
  pgm.createIndex('subscriptions', 'stripe_customer_id');
  pgm.createIndex('subscriptions', 'stripe_subscription_id');

  pgm.createTrigger('subscriptions', 'set_updated_at', {
    function: 'set_updated_at',
    level: 'ROW',
    operation: 'UPDATE',
    when: 'BEFORE',
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
  pgm.dropTable('subscriptions');
  pgm.dropType('subscription_status');
};
```

- [ ] **Step 5: Create stripe_events migration**

```javascript
// apps/server/migrations/{TS2}_create-stripe-events-table.js
/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  pgm.createTable('stripe_events', {
    event_id: { notNull: true, primaryKey: true, type: 'text' },
    event_type: { notNull: true, type: 'text' },
    processed_at: {
      default: pgm.func('NOW()'),
      notNull: true,
      type: 'timestamptz',
    },
    status: { default: 'processing', notNull: true, type: 'text' },
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
  pgm.dropTable('stripe_events');
};
```

- [ ] **Step 6: Add Subscription type to shared types**

Add to `packages/types/src/index.ts`:

```typescript
export type Subscription = {
  cancel_at_period_end: boolean;
  created_at: string;
  current_period_end: string | null;
  current_period_start: string | null;
  id: string;
  plan_id: string | null;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  updated_at: string;
  user_id: string;
};
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/services/stripe.ts apps/server/migrations/ apps/server/package.json packages/types/src/index.ts pnpm-lock.yaml
git commit -m "feat(server): add Stripe service, subscriptions and stripe_events migrations"
```

---

## Task 8: Billing repository, service, and handlers

**Files:**
- Create: `apps/server/src/repositories/billing.ts`
- Create: `apps/server/src/services/billing.service.ts`
- Create: `apps/server/src/handlers/billing/billing.ts`
- Create: `apps/server/src/handlers/billing/portal.ts`
- Create: `apps/server/src/handlers/billing/webhook.ts`
- Create: `apps/server/src/routes/billing.ts`
- Create: `apps/server/src/__tests__/handlers/billing/webhook.test.ts`

- [ ] **Step 1: Create billing repository**

```typescript
// apps/server/src/repositories/billing.ts
import { query } from 'app/db/pool/pool.js';

async function getSubscriptionByUserId(
  userId: string,
): Promise<Record<string, unknown> | null> {
  const result = await query(
    'SELECT * FROM subscriptions WHERE user_id = $1',
    [userId],
  );
  return result.rows[0] ?? null;
}

async function getSubscriptionByStripeCustomerId(
  customerId: string,
): Promise<Record<string, unknown> | null> {
  const result = await query(
    'SELECT * FROM subscriptions WHERE stripe_customer_id = $1',
    [customerId],
  );
  return result.rows[0] ?? null;
}

async function getSubscriptionByStripeSubscriptionId(
  subscriptionId: string,
): Promise<Record<string, unknown> | null> {
  const result = await query(
    'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1',
    [subscriptionId],
  );
  return result.rows[0] ?? null;
}

async function upsertSubscription(params: {
  cancel_at_period_end?: boolean;
  current_period_end?: string;
  current_period_start?: string;
  plan_id?: string;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  user_id: string;
}): Promise<Record<string, unknown>> {
  const result = await query(
    `INSERT INTO subscriptions (
      user_id, stripe_customer_id, stripe_subscription_id,
      status, plan_id, current_period_start, current_period_end,
      cancel_at_period_end
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      plan_id = COALESCE(EXCLUDED.plan_id, subscriptions.plan_id),
      current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
      current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
      cancel_at_period_end = COALESCE(EXCLUDED.cancel_at_period_end, subscriptions.cancel_at_period_end)
    RETURNING *`,
    [
      params.user_id,
      params.stripe_customer_id,
      params.stripe_subscription_id,
      params.status,
      params.plan_id ?? null,
      params.current_period_start ?? null,
      params.current_period_end ?? null,
      params.cancel_at_period_end ?? false,
    ],
  );
  return result.rows[0];
}

async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string,
  cancelAtPeriodEnd?: boolean,
): Promise<void> {
  await query(
    `UPDATE subscriptions
     SET status = $1, cancel_at_period_end = COALESCE($3, cancel_at_period_end)
     WHERE stripe_subscription_id = $2`,
    [status, stripeSubscriptionId, cancelAtPeriodEnd ?? null],
  );
}

async function claimStripeEvent(
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const result = await query(
    `INSERT INTO stripe_events (event_id, event_type, status)
     VALUES ($1, $2, 'processing')
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, eventType],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

async function markStripeEventProcessed(eventId: string): Promise<void> {
  await query(
    `UPDATE stripe_events SET status = 'processed', processed_at = NOW() WHERE event_id = $1`,
    [eventId],
  );
}

async function markStripeEventFailed(eventId: string): Promise<void> {
  await query(
    `UPDATE stripe_events SET status = 'failed' WHERE event_id = $1`,
    [eventId],
  );
}

export {
  claimStripeEvent,
  getSubscriptionByStripeCustomerId,
  getSubscriptionByStripeSubscriptionId,
  getSubscriptionByUserId,
  markStripeEventFailed,
  markStripeEventProcessed,
  updateSubscriptionStatus,
  upsertSubscription,
};
```

- [ ] **Step 2: Create billing service**

```typescript
// apps/server/src/services/billing.service.ts
import type Stripe from 'stripe';

import * as billingRepo from 'app/repositories/billing.js';
import { logger } from 'app/utils/logs/logger.js';

async function onCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    logger.error({ sessionId: session.id }, 'checkout.session.completed: no userId in metadata');
    return;
  }

  const subscription = session.subscription as string | null;
  const customer = session.customer as string | null;

  if (!subscription || !customer) {
    logger.error({ sessionId: session.id }, 'checkout.session.completed: missing subscription or customer');
    return;
  }

  await billingRepo.upsertSubscription({
    status: 'active',
    stripe_customer_id: customer,
    stripe_subscription_id: subscription,
    user_id: userId,
  });

  logger.info({ userId }, 'Subscription created via checkout');
}

async function onSubscriptionUpdated(
  sub: Stripe.Subscription,
): Promise<void> {
  await billingRepo.updateSubscriptionStatus(
    sub.id,
    sub.status,
    sub.cancel_at_period_end,
  );
  logger.info({ status: sub.status, subscriptionId: sub.id }, 'Subscription updated');
}

async function onSubscriptionDeleted(
  sub: Stripe.Subscription,
): Promise<void> {
  await billingRepo.updateSubscriptionStatus(sub.id, 'canceled');
  logger.info({ subscriptionId: sub.id }, 'Subscription canceled');
}

async function onPaymentSucceeded(
  invoice: Stripe.Invoice,
): Promise<void> {
  const subId = invoice.subscription as string | null;
  if (!subId) return;

  const existing = await billingRepo.getSubscriptionByStripeSubscriptionId(subId);
  if (!existing) return;

  const period = invoice.lines?.data?.[0]?.period;
  if (period) {
    await billingRepo.upsertSubscription({
      current_period_end: new Date(period.end * 1000).toISOString(),
      current_period_start: new Date(period.start * 1000).toISOString(),
      status: 'active',
      stripe_customer_id: existing.stripe_customer_id as string,
      stripe_subscription_id: subId,
      user_id: existing.user_id as string,
    });
  }

  logger.info({ subscriptionId: subId }, 'Payment succeeded, period updated');
}

async function onPaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const subId = invoice.subscription as string | null;
  if (!subId) return;
  await billingRepo.updateSubscriptionStatus(subId, 'past_due');
  logger.info({ subscriptionId: subId }, 'Payment failed, marked past_due');
}

export {
  onCheckoutCompleted,
  onPaymentFailed,
  onPaymentSucceeded,
  onSubscriptionDeleted,
  onSubscriptionUpdated,
};
```

- [ ] **Step 3: Create webhook handler**

```typescript
// apps/server/src/handlers/billing/webhook.ts
import type { Request, Response } from 'express';

import * as billingRepo from 'app/repositories/billing.js';
import * as billingService from 'app/services/billing.service.js';
import { getStripe } from 'app/services/stripe.js';
import { logger } from 'app/utils/logs/logger.js';

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
]);

async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    res.status(400).json({ error: { message: 'Missing signature or secret' } });
    return;
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    logger.error({ err }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: { message: 'Invalid signature' } });
    return;
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    res.json({ received: true });
    return;
  }

  const claimed = await billingRepo.claimStripeEvent(event.id, event.type);
  if (!claimed) {
    res.json({ received: true });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await billingService.onCheckoutCompleted(event.data.object as any);
        break;
      case 'customer.subscription.updated':
        await billingService.onSubscriptionUpdated(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await billingService.onSubscriptionDeleted(event.data.object as any);
        break;
      case 'invoice.payment_succeeded':
        await billingService.onPaymentSucceeded(event.data.object as any);
        break;
      case 'invoice.payment_failed':
        await billingService.onPaymentFailed(event.data.object as any);
        break;
    }
    await billingRepo.markStripeEventProcessed(event.id);
  } catch (err) {
    await billingRepo.markStripeEventFailed(event.id);
    logger.error({ err, eventId: event.id, eventType: event.type }, 'Webhook processing failed');
    res.status(500).json({ error: { message: 'Processing failed' } });
    return;
  }

  res.json({ received: true });
}

export { handleWebhook };
```

- [ ] **Step 4: Create checkout and portal handlers**

```typescript
// apps/server/src/handlers/billing/billing.ts
import type { Request, Response } from 'express';

import { env } from 'app/config/env.js';
import { getStripe } from 'app/services/stripe.js';

async function createCheckoutSession(
  req: Request,
  res: Response,
): Promise<void> {
  const { priceId } = req.body as { priceId?: string };

  if (!priceId) {
    res.status(400).json({ error: { message: 'priceId is required' } });
    return;
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    cancel_url: `${env.CORS_ORIGIN}/settings?canceled=true`,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId: req.user!.id },
    mode: 'subscription',
    success_url: `${env.CORS_ORIGIN}/settings?session_id={CHECKOUT_SESSION_ID}`,
  });

  res.json({ data: { url: session.url } });
}

export { createCheckoutSession };
```

```typescript
// apps/server/src/handlers/billing/portal.ts
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { env } from 'app/config/env.js';
import * as billingRepo from 'app/repositories/billing.js';
import { getStripe } from 'app/services/stripe.js';

async function createPortalSession(
  req: Request,
  res: Response,
): Promise<void> {
  const subscription = await billingRepo.getSubscriptionByUserId(req.user!.id);

  if (!subscription?.stripe_customer_id) {
    res.status(400).json({ error: { message: 'No billing account found' } });
    return;
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create(
    {
      customer: subscription.stripe_customer_id as string,
      return_url: `${env.CORS_ORIGIN}/settings`,
    },
    { idempotencyKey: randomUUID() },
  );

  res.json({ data: { url: session.url } });
}

export { createPortalSession };
```

- [ ] **Step 5: Create billing router**

```typescript
// apps/server/src/routes/billing.ts
import { Router } from 'express';

import * as billingHandlers from 'app/handlers/billing/billing.js';
import * as portalHandlers from 'app/handlers/billing/portal.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';

const billingRouter = Router();

billingRouter.use(requireAuth);
billingRouter.post('/checkout', billingHandlers.createCheckoutSession);
billingRouter.post('/portal', portalHandlers.createPortalSession);

export { billingRouter };
```

- [ ] **Step 6: Write webhook handler test**

```typescript
// apps/server/src/__tests__/handlers/billing/webhook.test.ts
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('app/services/stripe.js', () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: vi.fn().mockReturnValue({
        data: { object: {} },
        id: 'evt_test_123',
        type: 'invoice.payment_succeeded',
      }),
    },
  }),
}));

vi.mock('app/repositories/billing.js', () => ({
  claimStripeEvent: vi.fn().mockResolvedValue(true),
  markStripeEventFailed: vi.fn(),
  markStripeEventProcessed: vi.fn(),
}));

vi.mock('app/services/billing.service.js', () => ({
  onCheckoutCompleted: vi.fn(),
  onPaymentFailed: vi.fn(),
  onPaymentSucceeded: vi.fn().mockResolvedValue(undefined),
  onSubscriptionDeleted: vi.fn(),
  onSubscriptionUpdated: vi.fn(),
}));

describe('handleWebhook', () => {
  it('returns 400 when signature is missing', async () => {
    const { handleWebhook } = await import(
      '../../../handlers/billing/webhook.js'
    );
    const req = { headers: {} } as Request;
    const res = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;

    await handleWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
```

- [ ] **Step 7: Run test**

```bash
cd apps/server && npx vitest run src/__tests__/handlers/billing/webhook.test.ts
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/repositories/billing.ts apps/server/src/services/billing.service.ts apps/server/src/handlers/billing/ apps/server/src/routes/billing.ts apps/server/src/__tests__/handlers/billing/
git commit -m "feat(server): add billing handlers, repository, service, and router"
```

---

## Task 9: Update rate limiter for Redis backing

**Files:**
- Modify: `apps/server/src/middleware/rateLimiter/rateLimiter.ts`
- Modify: `apps/server/package.json` (add `rate-limit-redis`)

- [ ] **Step 1: Install rate-limit-redis**

```bash
cd apps/server && pnpm add rate-limit-redis
```

- [ ] **Step 2: Update rate limiter to use Redis store with in-memory fallback**

Update `apps/server/src/middleware/rateLimiter/rateLimiter.ts`:

Import `RedisStore` from `rate-limit-redis` and `redisRateLimiter` from `app/services/redis.js`. Create a helper:

```typescript
import { RedisStore } from 'rate-limit-redis';
import { redisRateLimiter } from 'app/services/redis.js';

function getStore(prefix: string): RedisStore | undefined {
  if (!redisRateLimiter) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) => redisRateLimiter!.call(...args),
  });
}
```

Add `store: getStore('global')` (or appropriate prefix) to each `rateLimit()` call. When `getStore` returns `undefined`, express-rate-limit uses its built-in in-memory store.

- [ ] **Step 3: Run existing rate limiter tests**

```bash
cd apps/server && npx vitest run src/__tests__/middleware/rateLimiter/rateLimiter.test.ts
```
Expected: PASS (tests should still work since Redis is absent in test env, falling back to in-memory).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/middleware/rateLimiter/rateLimiter.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): back rate limiter with Redis, in-memory fallback"
```

---

## Task 10: Update app.ts -- webhook route, billing router, middleware order

**Files:**
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Add imports and update middleware registration**

In `apps/server/src/app.ts`, add these changes (in order):

1. Import `billingRouter` from `app/routes/billing.js`
2. Import `handleWebhook` from `app/handlers/billing/webhook.js`
3. After health endpoints and before `express.json()`, add the raw-body webhook route:

```typescript
// Stripe webhook needs raw body for signature verification -- must be before express.json()
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleWebhook,
);
```

4. After the auth router, add:

```typescript
app.use('/billing', billingRouter);
```

- [ ] **Step 2: Run full server test suite**

```bash
cd apps/server && npx vitest run
```
Expected: all passing.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/app.ts
git commit -m "chore(server): wire up Stripe webhook and billing router"
```

---

## Task 11: Client -- Zustand toast store and Toast component

**Files:**
- Create: `apps/client/web/src/state/useToast.ts`
- Create: `apps/client/web/src/components/ui/Toast/Toast.tsx`
- Create: `apps/client/web/src/components/ui/Toast/Toast.module.scss`
- Create: `apps/client/web/src/__tests__/state/useToast.test.ts`
- Modify: `apps/client/web/package.json` (add `zustand`, `@radix-ui/react-toast`)

- [ ] **Step 1: Install dependencies**

```bash
cd apps/client/web && pnpm add zustand @radix-ui/react-toast
```

- [ ] **Step 2: Write failing test for toast store**

```typescript
// apps/client/web/src/__tests__/state/useToast.test.ts
import { afterEach, describe, expect, it } from 'vitest';

import { useToastStore } from '../../state/useToast';

describe('useToastStore', () => {
  afterEach(() => {
    useToastStore.getState().clearAll();
  });

  it('adds a toast and returns an id', () => {
    const id = useToastStore.getState().addToast('Hello');
    expect(id).toBeTruthy();
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('Hello');
  });

  it('removes a toast by id', () => {
    const id = useToastStore.getState().addToast('Remove me');
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('supports type parameter', () => {
    useToastStore.getState().addToast('Error!', 'error');
    expect(useToastStore.getState().toasts[0].type).toBe('error');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/client/web && npx vitest run src/__tests__/state/useToast.test.ts
```
Expected: FAIL

- [ ] **Step 4: Create toast store**

```typescript
// apps/client/web/src/state/useToast.ts
import { create } from 'zustand';

type ToastType = 'error' | 'info' | 'success';

type ToastEntry = {
  duration: number;
  id: string;
  message: string;
  type: ToastType;
};

type ToastStore = {
  addToast: (message: string, type?: ToastType, duration?: number) => string;
  clearAll: () => void;
  removeToast: (id: string) => void;
  toasts: ToastEntry[];
};

let counter = 0;

const useToastStore = create<ToastStore>((set) => ({
  addToast: (message, type = 'info', duration = 5000) => {
    const id = `toast-${++counter}`;
    set((state) => ({
      toasts: [...state.toasts, { duration, id, message, type }],
    }));
    return id;
  },
  clearAll: () => set({ toasts: [] }),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  toasts: [],
}));

export { useToastStore };
export type { ToastEntry, ToastType };
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/client/web && npx vitest run src/__tests__/state/useToast.test.ts
```
Expected: PASS

- [ ] **Step 6: Create Toast component**

```typescript
// apps/client/web/src/components/ui/Toast/Toast.tsx
'use client';

import * as RadixToast from '@radix-ui/react-toast';
import { useEffect } from 'react';

import { useToastStore } from '@/state/useToast';

import styles from './Toast.module.scss';

function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <RadixToast.Provider swipeDirection='right'>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          duration={toast.duration}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
          type={toast.type}
        />
      ))}
      <RadixToast.Viewport className={styles.viewport} />
    </RadixToast.Provider>
  );
}

type ToastItemProps = {
  duration: number;
  message: string;
  onClose: () => void;
  type: string;
};

function ToastItem({ duration, message, onClose, type }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <RadixToast.Root
      className={`${styles.root} ${styles[type] ?? ''}`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <RadixToast.Description>{message}</RadixToast.Description>
      <RadixToast.Close aria-label='Dismiss' className={styles.close}>
        &times;
      </RadixToast.Close>
    </RadixToast.Root>
  );
}

ToastViewport.displayName = 'ToastViewport';
ToastItem.displayName = 'ToastItem';

export { ToastViewport };
```

- [ ] **Step 7: Create Toast SCSS module**

```scss
// apps/client/web/src/components/ui/Toast/Toast.module.scss
.viewport {
  bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  max-width: 400px;
  padding: 0;
  position: fixed;
  right: 24px;
  z-index: 9999;
}

.root {
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-standard);
  display: flex;
  font-size: 14px;
  gap: 12px;
  justify-content: space-between;
  padding: 12px 16px;
}

.error {
  border-color: var(--error);
}

.success {
  border-color: var(--success);
}

.close {
  background: none;
  border: none;
  color: var(--foreground-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/client/web/src/state/useToast.ts apps/client/web/src/components/ui/Toast/ apps/client/web/src/__tests__/state/useToast.test.ts apps/client/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add Zustand toast store and Radix Toast component"
```

---

## Task 12: Client -- Zustand modal store and Modal component

**Files:**
- Create: `apps/client/web/src/state/useModal.ts`
- Create: `apps/client/web/src/components/ui/Modal/Modal.tsx`
- Create: `apps/client/web/src/components/ui/Modal/Modal.module.scss`
- Create: `apps/client/web/src/__tests__/state/useModal.test.ts`
- Modify: `apps/client/web/package.json` (add `@radix-ui/react-dialog`)

- [ ] **Step 1: Install Radix Dialog**

```bash
cd apps/client/web && pnpm add @radix-ui/react-dialog
```

- [ ] **Step 2: Write failing test for modal store**

```typescript
// apps/client/web/src/__tests__/state/useModal.test.ts
import { afterEach, describe, expect, it } from 'vitest';

import { useModalStore } from '../../state/useModal';

describe('useModalStore', () => {
  afterEach(() => {
    useModalStore.getState().closeAllModals();
  });

  it('opens a modal and returns an id', () => {
    const id = useModalStore.getState().openModal('test-content');
    expect(id).toBeTruthy();
    expect(useModalStore.getState().modals).toHaveLength(1);
  });

  it('closes a specific modal by id', () => {
    const id1 = useModalStore.getState().openModal('first');
    useModalStore.getState().openModal('second');
    useModalStore.getState().closeModal(id1);
    expect(useModalStore.getState().modals).toHaveLength(1);
    expect(useModalStore.getState().modals[0].content).toBe('second');
  });

  it('closeModal with no id closes the top modal', () => {
    useModalStore.getState().openModal('first');
    useModalStore.getState().openModal('second');
    useModalStore.getState().closeModal();
    expect(useModalStore.getState().modals).toHaveLength(1);
    expect(useModalStore.getState().modals[0].content).toBe('first');
  });

  it('closeAllModals empties the stack', () => {
    useModalStore.getState().openModal('a');
    useModalStore.getState().openModal('b');
    useModalStore.getState().closeAllModals();
    expect(useModalStore.getState().modals).toHaveLength(0);
  });

  it('respects custom id option', () => {
    useModalStore.getState().openModal('content', { id: 'custom-id' });
    expect(useModalStore.getState().modals[0].id).toBe('custom-id');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/client/web && npx vitest run src/__tests__/state/useModal.test.ts
```
Expected: FAIL

- [ ] **Step 4: Create modal store**

```typescript
// apps/client/web/src/state/useModal.ts
import type { ReactNode } from 'react';
import { create } from 'zustand';

type ModalEntry = {
  content: ReactNode;
  id: string;
  onClose?: () => void;
  preventClose?: boolean;
};

type ModalOptions = {
  id?: string;
  onClose?: () => void;
  preventClose?: boolean;
};

type ModalStore = {
  closeAllModals: () => void;
  closeModal: (id?: string) => void;
  modals: ModalEntry[];
  openModal: (content: ReactNode, options?: ModalOptions) => string;
};

let counter = 0;

const useModalStore = create<ModalStore>((set, get) => ({
  closeAllModals: () => {
    const modals = get().modals;
    for (const modal of modals) {
      modal.onClose?.();
    }
    set({ modals: [] });
  },
  closeModal: (id) => {
    const { modals } = get();
    if (modals.length === 0) return;

    if (id) {
      const target = modals.find((m) => m.id === id);
      if (target?.preventClose) return;
      target?.onClose?.();
      set({ modals: modals.filter((m) => m.id !== id) });
    } else {
      const top = modals[modals.length - 1];
      if (top.preventClose) return;
      top.onClose?.();
      set({ modals: modals.slice(0, -1) });
    }
  },
  modals: [],
  openModal: (content, options) => {
    const id = options?.id ?? `modal-${++counter}`;
    set((state) => ({
      modals: [
        ...state.modals,
        {
          content,
          id,
          onClose: options?.onClose,
          preventClose: options?.preventClose,
        },
      ],
    }));
    return id;
  },
}));

function useModal() {
  const closeAllModals = useModalStore((s) => s.closeAllModals);
  const closeModal = useModalStore((s) => s.closeModal);
  const openModal = useModalStore((s) => s.openModal);
  return { closeAllModals, closeModal, openModal };
}

export { useModal, useModalStore };
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/client/web && npx vitest run src/__tests__/state/useModal.test.ts
```
Expected: PASS

- [ ] **Step 6: Create Modal component**

```typescript
// apps/client/web/src/components/ui/Modal/Modal.tsx
'use client';

import * as Dialog from '@radix-ui/react-dialog';

import { useModalStore } from '@/state/useModal';

import styles from './Modal.module.scss';

function ModalProvider() {
  const modals = useModalStore((s) => s.modals);
  const closeModal = useModalStore((s) => s.closeModal);

  return (
    <>
      {modals.map((modal, index) => (
        <Dialog.Root
          key={modal.id}
          open
          onOpenChange={(open) => {
            if (!open && !modal.preventClose) {
              closeModal(modal.id);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay
              className={styles.overlay}
              style={{ zIndex: 1000 + index }}
            />
            <Dialog.Content
              aria-describedby={undefined}
              className={styles.content}
              onEscapeKeyDown={(e) => {
                if (modal.preventClose) e.preventDefault();
              }}
              onPointerDownOutside={(e) => {
                if (modal.preventClose) e.preventDefault();
              }}
              style={{ zIndex: 1001 + index }}
            >
              <Dialog.Title className={styles.srOnly}>Dialog</Dialog.Title>
              {modal.content}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ))}
    </>
  );
}

ModalProvider.displayName = 'ModalProvider';

export { ModalProvider };
```

- [ ] **Step 7: Create Modal SCSS module**

```scss
// apps/client/web/src/components/ui/Modal/Modal.module.scss
.overlay {
  background: var(--overlay);
  inset: 0;
  position: fixed;
}

.content {
  background: var(--background);
  border-radius: var(--radius-card);
  left: 50%;
  max-height: 85vh;
  max-width: 560px;
  overflow-y: auto;
  padding: 24px;
  position: fixed;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
}

.srOnly {
  clip: rect(0 0 0 0);
  border: 0;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/client/web/src/state/useModal.ts apps/client/web/src/components/ui/Modal/ apps/client/web/src/__tests__/state/useModal.test.ts apps/client/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add Zustand modal queue store and Radix Dialog component"
```

---

## Task 13: Client -- theme system

**Files:**
- Create: `apps/client/web/src/state/useTheme.ts`
- Create: `apps/client/web/src/__tests__/state/useTheme.test.ts`
- Modify: `apps/client/web/src/app/layout.tsx`
- Modify: `apps/client/web/src/app/globals.scss` (add dark theme vars)

- [ ] **Step 1: Write failing test**

```typescript
// apps/client/web/src/__tests__/state/useTheme.test.ts
import { afterEach, describe, expect, it } from 'vitest';

import { useThemeStore } from '../../state/useTheme';

describe('useThemeStore', () => {
  afterEach(() => {
    useThemeStore.getState().setTheme('system');
    delete document.documentElement.dataset.theme;
  });

  it('defaults to system', () => {
    expect(useThemeStore.getState().theme).toBe('system');
  });

  it('setTheme updates the store', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/client/web && npx vitest run src/__tests__/state/useTheme.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create theme store (Zustand instead of useState/useEffect)**

```typescript
// apps/client/web/src/state/useTheme.ts
'use client';

import { create } from 'zustand';

type ThemeMode = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'app-theme';

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyToDOM(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(mode);
  if (resolved === 'dark') {
    document.documentElement.dataset.theme = 'dark';
  } else {
    delete document.documentElement.dataset.theme;
  }
}

type ThemeStore = {
  setTheme: (mode: ThemeMode) => void;
  theme: ThemeMode;
};

const useThemeStore = create<ThemeStore>((set) => ({
  setTheme: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage may be unavailable.
    }
    applyToDOM(mode);
    set({ theme: mode });
  },
  theme:
    typeof window !== 'undefined'
      ? ((localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'system')
      : 'system',
}));

// Listen for system preference changes when in system mode.
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (useThemeStore.getState().theme === 'system') {
      applyToDOM('system');
    }
  });

  // Apply on initial load.
  applyToDOM(useThemeStore.getState().theme);
}

export { useThemeStore };
export type { ThemeMode };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/client/web && npx vitest run src/__tests__/state/useTheme.test.ts
```
Expected: PASS

- [ ] **Step 5: Add flash-prevention script and providers to layout.tsx**

Update `apps/client/web/src/app/layout.tsx`:

Add the inline theme script inside `<head>` (before any CSS loads), and wrap children with `ToastViewport` and `ModalProvider`:

```typescript
import { ModalProvider } from '@/components/ui/Modal/Modal';
import { ToastViewport } from '@/components/ui/Toast/Toast';
import { PostHogProvider } from '@/providers/PostHogProvider';
import { QueryProvider } from '@/providers/QueryProvider';
```

Inside the `<html>` tag:
```tsx
<head>
  <script
    dangerouslySetInnerHTML={{
      __html: `(function(){try{var t=localStorage.getItem('app-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.dataset.theme='dark'}}catch(e){}})()`,
    }}
  />
</head>
<body className={`${geistSans.variable} ${geistMono.variable}`}>
  <PostHogProvider>
    <QueryProvider>
      {children}
      <ToastViewport />
      <ModalProvider />
    </QueryProvider>
  </PostHogProvider>
</body>
```

- [ ] **Step 6: Add dark theme CSS variables to globals.scss**

Append to `apps/client/web/src/app/globals.scss`:

```scss
[data-theme='dark'] {
  --accent: #f09040;
  --accent-hover: #e07830;
  --accent-light: #3d2a1a;
  --background: #1a1a1a;
  --background-translucent: rgba(26, 26, 26, 0.92);
  --border: #333333;
  --error: #f87171;
  --error-light: #3b1c1c;
  --foreground: #e5e5e5;
  --foreground-muted: #999999;
  --overlay: rgba(0, 0, 0, 0.6);
  --success: #4ade80;
  --surface: #262626;
  --surface-active: #404040;
  --surface-alt: #2a2a2a;
  --surface-hover: #333333;
  --white: #ffffff;
}
```

- [ ] **Step 7: Update metadata title/description to be generic**

In layout.tsx, change:
```typescript
export const metadata: Metadata = {
  description: 'Express 5 + Next.js 15 full-stack application',
  title: 'App',
};
```

- [ ] **Step 8: Commit**

```bash
git add apps/client/web/src/state/useTheme.ts apps/client/web/src/__tests__/state/useTheme.test.ts apps/client/web/src/app/layout.tsx apps/client/web/src/app/globals.scss
git commit -m "feat(web): add Zustand theme store with dark mode and flash prevention"
```

---

## Task 14: Next.js middleware -- route protection

**Files:**
- Modify: `apps/client/web/src/middleware.ts`

- [ ] **Step 1: Replace middleware with route protection**

```typescript
// apps/client/web/src/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Access = 'admin' | 'private' | 'public';

const ROUTE_MAP: Record<string, Access> = {
  '/': 'public',
  '/forgot-password': 'public',
  '/login': 'public',
  '/register': 'public',
  '/reset-password': 'public',
  '/dashboard': 'private',
};

const PREFIX_RULES: Array<{ access: Access; prefix: string }> = [
  { access: 'private', prefix: '/settings' },
  { access: 'admin', prefix: '/admin' },
];

function resolveAccess(pathname: string): Access {
  const exact = ROUTE_MAP[pathname];
  if (exact) return exact;

  for (const rule of PREFIX_RULES) {
    if (pathname.startsWith(rule.prefix)) return rule.access;
  }

  return 'private';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSid = request.cookies.has('sid');
  const access = resolveAccess(pathname);

  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);

  if (access === 'public') {
    if (hasSid && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  if (!hasSid) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|ingest).*)'],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/web/src/middleware.ts
git commit -m "feat(web): add route protection middleware with public/private/admin access"
```

---

## Task 15: API proxy route

**Files:**
- Create: `apps/client/web/src/app/api/[...path]/route.ts`

- [ ] **Step 1: Create API proxy**

```typescript
// apps/client/web/src/app/api/[...path]/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INTERNAL_API =
  process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function proxy(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const targetPath = url.pathname.replace(/^\/api/, '');
  const target = `${INTERNAL_API}${targetPath}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const body =
    request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.arrayBuffer()
      : undefined;

  const upstream = await fetch(target, {
    body,
    headers,
    method: request.method,
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(upstream.body, {
    headers: responseHeaders,
    status: upstream.status,
    statusText: upstream.statusText,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
```

- [ ] **Step 2: Commit**

```bash
git add "apps/client/web/src/app/api/[...path]/route.ts"
git commit -m "feat(web): add API proxy route to Express backend"
```

---

## Task 16: Scripts -- deploy, dev-watch, ensure-test-db

**Files:**
- Create: `scripts/deploy.sh`
- Create: `scripts/dev-watch.sh`
- Create: `scripts/ensure-test-db.sh`

- [ ] **Step 1: Create deploy script**

```bash
#!/usr/bin/env bash
# Deploy to Railway. Usage: ./scripts/deploy.sh [production|staging] [full|web|server|migrate]
set -euo pipefail

ENVIRONMENT="${1:-staging}"
TARGET="${2:-full}"

if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" ]]; then
  echo "Usage: $0 [production|staging] [full|web|server|migrate]"
  exit 1
fi

echo "Deploying $TARGET to $ENVIRONMENT..."

run_migrations() {
  echo "[deploy] Running migrations..."
  railway run --environment "$ENVIRONMENT" -- pnpm --filter ./apps/server run migrate:up
}

deploy_server() {
  echo "[deploy] Deploying server..."
  railway up -d --environment "$ENVIRONMENT" --service server
}

deploy_web() {
  echo "[deploy] Deploying web..."
  railway up -d --environment "$ENVIRONMENT" --service web
}

wait_for_healthy() {
  local url="$1"
  echo "[deploy] Waiting for $url to be healthy..."
  for i in $(seq 1 10); do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo "[deploy] $url is healthy"
      return 0
    fi
    echo "[deploy] Attempt $i/10..."
    sleep 10
  done
  echo "[deploy] FAILED: $url did not become healthy"
  return 1
}

case "$TARGET" in
  full)
    run_migrations
    deploy_server &
    deploy_web &
    wait
    ;;
  server)
    deploy_server
    ;;
  web)
    deploy_web
    ;;
  migrate)
    run_migrations
    ;;
  *)
    echo "Unknown target: $TARGET"
    exit 1
    ;;
esac

echo "[deploy] Done."
```

- [ ] **Step 2: Create dev-watch script**

```bash
#!/usr/bin/env bash
# Runs pnpm dev in a loop, clearing .next cache on crash.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NEXT_DIR="$ROOT/apps/client/web/.next"

while true; do
  echo "[dev-watch] Starting dev server..."
  (cd "$ROOT" && pnpm dev) || true
  echo ""
  echo "[dev-watch] Dev server exited. Clearing .next cache and restarting in 2s..."
  rm -rf "$NEXT_DIR"
  sleep 2
done
```

- [ ] **Step 3: Create ensure-test-db script**

```bash
#!/usr/bin/env bash
# Ensures the E2E test database exists, is migrated, and is seeded.
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://localhost:5432/template_test}"
DB_NAME=$(echo "$DB_URL" | sed 's|.*/||' | sed 's|?.*||')

createdb "$DB_NAME" 2>/dev/null && echo "[ensure-test-db] Created database $DB_NAME" \
  || echo "[ensure-test-db] Database $DB_NAME already exists"

echo "[ensure-test-db] Running migrations..."
DATABASE_URL="$DB_URL" pnpm --filter server run migrate:up

echo "[ensure-test-db] Seeding test data..."
DATABASE_URL="$DB_URL" pnpm --filter server run seed:test

echo "[ensure-test-db] Done."
```

- [ ] **Step 4: Make scripts executable**

```bash
chmod +x scripts/deploy.sh scripts/dev-watch.sh scripts/ensure-test-db.sh
```

- [ ] **Step 5: Update package.json scripts**

Add to root `package.json` scripts:
```json
"dev:watch": "./scripts/dev-watch.sh",
"dev:payments": "pnpm dev & stripe listen --forward-to localhost:3001/webhooks/stripe",
"test:e2e": "lsof -ti:3000 -ti:3001 | xargs kill 2>/dev/null || true; PW_PRE_BUILT=true PW_REUSE_SERVER=false playwright test --project=chromium",
"test:e2e:full": "pnpm build && pnpm test:e2e",
"test:smoke": "playwright test --config=playwright.smoke.config.ts",
"seed:test-db": "pnpm --filter server run seed:test"
```

- [ ] **Step 6: Commit**

```bash
git add scripts/ package.json
git commit -m "feat: add deploy, dev-watch, and ensure-test-db scripts"
```

---

## Task 17: Smoke tests and smoke Playwright config

**Files:**
- Create: `playwright.smoke.config.ts`
- Create: `e2e/smoke/health.smoke.ts`
- Create: `e2e/smoke/auth.smoke.ts`
- Create: `e2e/smoke/error.smoke.ts`

- [ ] **Step 1: Create smoke Playwright config**

```typescript
// playwright.smoke.config.ts
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
```

- [ ] **Step 2: Create health smoke test**

```typescript
// e2e/smoke/health.smoke.ts
import { expect, test } from '@playwright/test';

const API_URL = process.env.SMOKE_API_URL!;

test('API health endpoint returns ok', async ({ request }) => {
  const response = await request.get(`${API_URL}/health`);
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.status).toBe('ok');
});

test('API readiness endpoint returns ok', async ({ request }) => {
  const response = await request.get(`${API_URL}/health/ready`);
  expect(response.ok()).toBe(true);
});

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('form')).toBeVisible();
});
```

- [ ] **Step 3: Create auth smoke test**

```typescript
// e2e/smoke/auth.smoke.ts
import { expect, test } from '@playwright/test';

const API_URL = process.env.SMOKE_API_URL!;

test('unauthenticated /auth/me returns 401', async ({ request }) => {
  const response = await request.get(`${API_URL}/auth/me`);
  expect(response.status()).toBe(401);
});

test('login with test credentials succeeds', async ({ page }) => {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;
  if (!email || !password) {
    test.skip();
    return;
  }

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
});
```

- [ ] **Step 4: Create error smoke test**

```typescript
// e2e/smoke/error.smoke.ts
import { expect, test } from '@playwright/test';

test('unknown route returns status < 500', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist-smoke-test');
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
});
```

- [ ] **Step 5: Commit**

```bash
git add playwright.smoke.config.ts e2e/smoke/
git commit -m "feat: add smoke test suite with health, auth, and error checks"
```

---

## Task 18: Update E2E globalSetup and Playwright config

**Files:**
- Create: `e2e/global-setup.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Create globalSetup**

```typescript
// e2e/global-setup.ts
import { execSync } from 'node:child_process';

const isCI = !!process.env.CI;

export default function globalSetup(): void {
  if (isCI) {
    console.log('[global-setup] CI: seeding test database...');
    execSync('pnpm --filter server run seed:test', { stdio: 'inherit' });
  } else {
    console.log('[global-setup] Ensuring test database...');
    execSync('bash scripts/ensure-test-db.sh', { stdio: 'inherit' });
  }
  console.log('[global-setup] Done.');
}
```

- [ ] **Step 2: Update playwright.config.ts**

Add `globalSetup: './e2e/global-setup.ts'` and `isPreBuilt` flag. Update server command to use `pnpm start` for both CI and PW_PRE_BUILT (consistent with doppelscript pattern). Add Storybook and visual-regression project entries if Storybook is set up (Task 20).

- [ ] **Step 3: Commit**

```bash
git add e2e/global-setup.ts playwright.config.ts
git commit -m "chore: add ensure-test-db globalSetup and PW_PRE_BUILT support"
```

---

## Task 19: Update CI and lefthook

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `lefthook.yml`

- [ ] **Step 1: Update CI workflow**

Add Redis service to the `e2e` job:

```yaml
    services:
      postgres:
        # ... existing ...
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-retries 5
          --health-timeout 5s
```

Add `REDIS_URL: redis://localhost:6379` to the E2E test env vars.

Add a seed step before E2E:

```yaml
      - name: Seed test data
        run: pnpm --filter ./apps/server run seed:test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/template_test
```

Add web client tests to the `build-and-test` job:

```yaml
      - name: Run web tests
        run: pnpm --filter ./apps/client/web run test
```

- [ ] **Step 2: Update lefthook -- remove E2E from pre-push, update format hooks**

Change `lefthook.yml` pre-push to `piped: true` and remove any E2E step. Ensure pre-push is: format:check -> lint -> test-server -> test-web -> build. Match the doppelscript pattern:

```yaml
pre-push:
  piped: true
  commands:
    format:
      run: pnpm format:check
    lint:
      run: pnpm lint
    test-server:
      run: pnpm test:coverage
    test-web:
      run: pnpm --filter ./apps/client/web run test
    build:
      run: pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml lefthook.yml
git commit -m "chore: add Redis to CI, update lefthook pre-push pipeline"
```

---

## Task 20: Storybook and visual regression

**Files:**
- Create: `apps/client/web/.storybook/main.ts`
- Create: `apps/client/web/.storybook/preview.ts`
- Create: `apps/client/web/src/components/ui/Toast/Toast.stories.tsx`
- Create: `apps/client/web/src/components/ui/Modal/Modal.stories.tsx`
- Create: `e2e/visual-regression/storybook.spec.ts`
- Modify: `package.json` (add storybook scripts)
- Modify: root `package.json` devDeps (add storybook packages)

- [ ] **Step 1: Install Storybook**

```bash
pnpm add -D -w storybook @storybook/react-vite @storybook/addon-essentials @storybook/addon-a11y @storybook/test
```

- [ ] **Step 2: Create Storybook config**

```typescript
// apps/client/web/.storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
  ],
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
};

export default config;
```

```typescript
// apps/client/web/.storybook/preview.ts
import type { Preview } from '@storybook/react-vite';

import '../src/app/globals.scss';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
};

export default preview;
```

- [ ] **Step 3: Create Toast story**

```typescript
// apps/client/web/src/components/ui/Toast/Toast.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';

import { useToastStore } from '../../../state/useToast';
import { ToastViewport } from './Toast';

const meta: Meta = {
  component: ToastViewport,
  title: 'UI/Toast',
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const addToast = useToastStore((s) => s.addToast);
    return (
      <div>
        <button onClick={() => addToast('Info toast')}>Add Info</button>
        <button onClick={() => addToast('Success!', 'success')}>
          Add Success
        </button>
        <button onClick={() => addToast('Error occurred', 'error')}>
          Add Error
        </button>
        <ToastViewport />
      </div>
    );
  },
};
```

- [ ] **Step 4: Create Modal story**

```typescript
// apps/client/web/src/components/ui/Modal/Modal.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';

import { useModalStore } from '../../../state/useModal';
import { ModalProvider } from './Modal';

const meta: Meta = {
  component: ModalProvider,
  title: 'UI/Modal',
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const openModal = useModalStore((s) => s.openModal);
    return (
      <div>
        <button
          onClick={() =>
            openModal(
              <div>
                <h2>Modal Content</h2>
                <p>This is dynamic content inside the modal.</p>
              </div>,
            )
          }
        >
          Open Modal
        </button>
        <ModalProvider />
      </div>
    );
  },
};
```

- [ ] **Step 5: Create visual regression spec**

```typescript
// e2e/visual-regression/storybook.spec.ts
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
```

- [ ] **Step 6: Add Storybook scripts to root package.json**

```json
"storybook": "storybook dev -p 6006 -c apps/client/web/.storybook",
"storybook:build": "storybook build -c apps/client/web/.storybook",
"test:visual": "pnpm storybook:build && playwright test e2e/visual-regression/ --project=visual-regression",
"test:visual:update": "pnpm storybook:build && playwright test e2e/visual-regression/ --project=visual-regression --update-snapshots"
```

- [ ] **Step 7: Add visual-regression project to playwright.config.ts**

Add to the `projects` array:
```typescript
{
  name: 'visual-regression',
  testMatch: /visual-regression\/.*/,
  use: {
    baseURL: 'http://localhost:6006',
    ...devices['Desktop Chrome'],
  },
},
```

- [ ] **Step 8: Commit**

```bash
git add apps/client/web/.storybook/ apps/client/web/src/components/ui/Toast/Toast.stories.tsx apps/client/web/src/components/ui/Modal/Modal.stories.tsx e2e/visual-regression/ package.json playwright.config.ts pnpm-lock.yaml
git commit -m "feat: add Storybook config, component stories, and visual regression suite"
```

---

## Task 21: Update CLAUDE.md files

**Files:**
- Modify: `CLAUDE.md` (root)
- Modify: `apps/server/CLAUDE.md`
- Modify: `apps/client/web/CLAUDE.md` (or `apps/client/CLAUDE.md`)

- [ ] **Step 1: Update root CLAUDE.md**

Add sections for:
- State management table (TanStack Query / Zustand / Context / useState)
- Stripe billing (webhook registration order, idempotency pattern, raw body requirement)
- Redis (two-client pattern, graceful degradation)
- BullMQ (queue/worker separation, worker as separate process, adding new jobs)
- R2 (upload/presigned URL pattern, key validation)
- Circuit breaker (when and how to use)
- Scripts reference (deploy.sh, dev-watch.sh, ensure-test-db.sh)
- Testing updates (E2E in CI only, smoke tests, Storybook visual regression)
- Remove any rules prohibiting Zustand

- [ ] **Step 2: Update server CLAUDE.md**

Add:
- `config/env.ts` pattern (how to add new env vars, required vs optional)
- Billing layer (handlers/billing/, repositories/billing.ts, services/billing.service.ts)
- Services reference (redis.ts, queue.ts, stripe.ts, r2.ts, circuit-breaker.ts)
- Updated middleware order (webhook before JSON parser)
- Worker entry point documentation

- [ ] **Step 3: Update client CLAUDE.md**

Add:
- Zustand stores (useTheme, useToast, useModal) and when to use Zustand vs other state tools
- Toast and Modal component usage patterns
- Theme system (STORAGE_KEY, data-theme attribute, flash-prevention)
- Next.js middleware route map maintenance (how to add new routes)
- API proxy route explanation
- Storybook conventions (stories required per component)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md apps/server/CLAUDE.md apps/client/CLAUDE.md apps/client/web/CLAUDE.md
git commit -m "docs: update CLAUDE.md files with new infrastructure documentation"
```

---

## Task 22: Final verification

- [ ] **Step 1: Install all dependencies**

```bash
pnpm install
```

- [ ] **Step 2: Run full build**

```bash
pnpm build
```
Expected: clean build.

- [ ] **Step 3: Run server tests**

```bash
pnpm test:coverage
```
Expected: all passing, coverage thresholds met.

- [ ] **Step 4: Run web tests**

```bash
pnpm --filter ./apps/client/web run test
```
Expected: all passing.

- [ ] **Step 5: Run lint and format check**

```bash
pnpm lint && pnpm format:check
```
Expected: clean.

- [ ] **Step 6: Start dev server and verify**

```bash
pnpm dev
```

Open `http://localhost:3000` -- verify landing page loads. Open `/login` -- verify login form renders. Check browser console for no errors. Verify dark mode toggle works (if wired to UI). Verify toast can be triggered from console: `useToastStore.getState().addToast('test')`.

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final verification fixes"
```
