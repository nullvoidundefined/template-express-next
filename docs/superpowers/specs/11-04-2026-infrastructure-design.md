# Doppelscript Infrastructure Design

**Date:** 11-04-2026
**Status:** Approved
**Phase:** Day 1 Infrastructure

---

## Pre-Build Decision: Cloud Project Consolidation

Before any code is deployed, the existing cloud projects need to be restructured. The old setup had separate projects for staging and production across all three platforms. The new setup consolidates into single projects with environment-level separation.

**Neon:** Create one new database project. Use two branches: `main` (production) and `staging`. Delete old Neon projects.

**Railway:** Consolidate into one Railway project with two environments: `production` and `staging`. Each environment contains the same services (API, Redis). Delete old Railway projects.

**Vercel:** Consolidate into one Vercel project. Production deploys from `main` branch. Staging deploys from `staging` branch (or preview). Delete old Vercel projects.

All old projects can be deleted. There is no data or configuration worth preserving from the previous build.

---

## What Already Exists (Do Not Touch)

The following are already built and will not be modified except where noted:

- Express app and full middleware stack (`src/app.ts`)
- DB pool and query wrapper (`src/db/pool/pool.ts`)
- Health endpoints (`GET /health`, `GET /health/ready`)
- `loadSession` and `requireAuth` middleware
- Register, login, logout, and me handlers and routes
- Pino logger (`src/utils/logs/logger.ts`)
- CSRF guard, rate limiter, error handler, not found handler

**One small addition to the existing register handler:** `createUser` and `createUserAndSession` are updated to accept optional `nameFirst`, `nameLast`, and `nameAlias` fields, which are written directly into the `users` INSERT. The `toUserResponse` helper is updated to include `name: { alias, first, last }` mapped from the DB columns.

---

## Section 1: Environment Config

**File:** `src/config/env.ts`

Extend the existing Zod schema with all new service vars. All API keys and secrets are optional in development (server boots without them) and required in staging and production. The exported config object gains `isDev`, `isStaging`, and `isProd` booleans. The existing `isProduction()` function is preserved for backwards compatibility.

New vars by service group:

| Group | Vars | Dev default |
|---|---|---|
| Core | `API_URL`, `CLIENT_URL` | none |
| Anthropic | `ANTHROPIC_API_KEY` | optional |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | `hello@doppelscript.com` |
| PostHog | `POSTHOG_API_KEY`, `POSTHOG_HOST` | `https://us.i.posthog.com` |
| Sentry | `SENTRY_DSN` | optional |
| R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | optional |
| Redis | `REDIS_URL` | optional |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | optional |
| Twitter | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | optional |

**`.env.example`** updated at repo root with all vars, placeholder values, and comments indicating which are optional in dev.

---

## Section 2: New Packages

Eight packages added to `apps/server/package.json` dependencies:

- `ioredis`
- `bullmq`
- `@sentry/node`
- `posthog-node`
- `stripe`
- `resend`
- `@anthropic-ai/sdk`
- `@aws-sdk/client-s3`

---

## Section 3: Third-Party Service Wrappers

All wrappers live in `src/services/`. Named exports only. No default exports. No business logic - initialization and thin helpers only.

### `src/services/redis.ts`
- Initializes ioredis client from `REDIS_URL`
- Exports: initialized `redis` client, `redisHealthCheck()` returning boolean
- Logs connect and error events via Pino

### `src/services/sentry.ts`
- Initializes `@sentry/node` with DSN and environment
- Exports: `setupSentry(app)` attaching request and error handlers to Express, `captureException(error, context?)` wrapper
- Traces sample rate: 1.0 in dev and staging, 0.2 in production
- `setupSentry(app)` called in `app.ts` before all middleware
- Sentry error handler registered in `app.ts` after all routes and `notFoundHandler`, before `errorHandler`

### `src/services/posthog.ts`
- Initializes `posthog-node` client
- Exports: `trackEvent(userId, event, properties?)`, `shutdownPostHog()`
- No-ops silently when `POSTHOG_API_KEY` is not set
- `shutdownPostHog()` called inside the graceful shutdown function in `app.ts`

### `src/services/stripe.ts`
- Initializes Stripe SDK with pinned API version
- Exports: initialized `stripe` client
- No payment or subscription logic yet

### `src/services/email.ts`
- Initializes Resend SDK
- Exports: `sendEmail({ html, subject, to })`
- Uses `RESEND_FROM_EMAIL` as sender
- Logs `to` address and `subject` via Pino (never the body)
- Falls back to `console.log` in dev when `RESEND_API_KEY` is absent

### `src/services/anthropic.ts`
- Initializes Anthropic SDK
- Exports: initialized `anthropic` client
- No generation logic yet

### `src/services/r2.ts`
- Initializes AWS S3 client pointed at `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
- Exports: `uploadFile(key, body, contentType)`, `getFileUrl(key)`
- No corpus upload logic yet

### `src/services/queue.ts`
- Creates BullMQ `Queue` named `ai-jobs` using the Redis client from `services/redis.ts`
- Exports: initialized `aiQueue`, `createWorker(processor)` factory
- No job processors yet

---

## Section 4: Database Migrations

All existing migrations deleted and replaced with a clean set. Seven tables, seven migration files, sequential timestamps.

All migrations follow existing conventions: ESM `export const up` and `export const down`, pgm builder API, `onDelete: 'CASCADE'` on all user-owned FKs, indexes in the same migration as the table.

**Note:** Anyone who ran the old migrations must drop and recreate their local database before running the new set.

### Migration order

**1. `users`**
```
id (uuid pk), email (text unique not null), email_verified (boolean default false),
password_hash (text nullable), name_first (text nullable), name_last (text nullable),
name_alias (text nullable), created_at, updated_at
```
Index on `email`.

**2. `sessions`**
```
id (uuid pk), user_id (fk cascade), token_hash (text unique not null),
expires_at (timestamptz not null), created_at
```
Indexes on `token_hash`, `user_id`, `expires_at`.

**3. `password_resets`**
```
id (uuid pk), user_id (fk cascade), token_hash (text unique not null),
expires_at (timestamptz not null), used_at (timestamptz nullable), created_at
```
Index on `token_hash`.

**4. `oauth_accounts`**
```
id (uuid pk), user_id (fk cascade), provider (text not null),
provider_account_id (text not null), created_at
```
Unique on `(provider, provider_account_id)`. Index on `user_id`.

**5. `credit_transactions`**
```
id (uuid pk), user_id (fk cascade), amount (integer not null),
balance_after (integer not null), description (text not null),
source (text not null), stripe_payment_id (text nullable), created_at
```
Index on `user_id`.

**6. `email_subscribers`**
```
id (uuid pk), email (text unique not null), source (text nullable), created_at
```
No `updated_at` - append-only table.

**7. `user_notifications_seen`**
```
id (uuid pk), user_id (fk cascade), notification_key (text not null),
seen_at (timestamptz not null default now())
```
Unique on `(user_id, notification_key)`. Index on `user_id`.

---

## Section 5: Auth Extensions

### Schema update (`src/schemas/auth.ts`)
`registerSchema` gains three optional name fields: `nameFirst`, `nameLast`, `nameAlias` (all `z.string().optional()`). `toUserResponse` updated to include `name: { alias, first, last }` mapping from DB columns.

### Updated register handler
`createUser` and `createUserAndSession` updated to accept optional `nameFirst`, `nameLast`, `nameAlias`. All three are passed through to the `users` INSERT and can be null. The user response now includes the `name` object.

### New repository functions (`src/repositories/auth/auth.ts`)
- `createPasswordResetToken(userId)` - generates token, stores hash with 1-hour expiry, returns raw token
- `findPasswordResetToken(tokenHash)` - looks up token, returns row or null
- `markPasswordResetUsed(id)` - sets `used_at = now()`

### `POST /auth/forgot-password`
- Separate rate limit: 3 requests per email per hour
- Zod validation: email
- Always returns `{ success: true }` (prevents email enumeration)
- When user found: generates reset token, stores hash, sends email via `sendEmail()` with link `${CLIENT_URL}/reset-password?token=...`
- Email subject: "Reset your Doppelscript password"
- Tracks `password_reset_requested` via PostHog

### `POST /auth/reset-password`
- Zod validation: `token` (string), `newPassword` (min 8 chars)
- Hashes token, looks up in `password_resets`
- Rejects with 400 if: not found, already used, or expired
- On success: updates `users.password_hash`, marks token used, deletes all sessions for user (forces re-login)
- Tracks `password_reset_completed` via PostHog
- Returns `{ success: true }`

Both routes added to `src/routes/auth.ts`.

---

## Section 6: Testing

All test files in `src/__tests__/` mirroring source tree. Vitest runner. 80% coverage target.

| Test file | What it covers |
|---|---|
| `src/__tests__/services/email.test.ts` | Dev fallback to console, Pino logs address and subject not body, Resend called with correct sender |
| `src/__tests__/services/posthog.test.ts` | No-op when key absent, calls client when present |
| `src/__tests__/services/redis.test.ts` | `redisHealthCheck()` true on success, false on failure |
| `src/__tests__/handlers/auth/forgotPassword.test.ts` | 200 regardless of email existence, email sent when user found, email not sent when not found, rate limit on 4th request |
| `src/__tests__/handlers/auth/resetPassword.test.ts` | 400 on missing token, 400 on expired, 400 on already used, sessions cleared on success, new password works for login |
| `src/__tests__/repositories/auth/passwordResets.test.ts` | Token hash storage, expiry logic, `used_at` marking |

Existing register handler test updated to assert `name: { alias, first, last }` shape in response.

---

## Secrets Status

| Var | Status |
|---|---|
| `ANTHROPIC_API_KEY` | Available (old server .env) |
| `SESSION_SECRET` | Available |
| `DATABASE_URL` | Available (Neon - needs new branch for new project) |
| `REDIS_URL` | Available for dev (localhost only - needs real URL for staging/prod) |
| `STRIPE_SECRET_KEY` | Available (test key) |
| `STRIPE_WEBHOOK_SECRET` | Available |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | Available |
| `POSTHOG_API_KEY`, `POSTHOG_HOST` | Available |
| `SENTRY_DSN` | Missing - needs Sentry project created |
| `RESEND_API_KEY` | Missing - needs Resend account |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | Missing - needs OAuth app |
| `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | Missing - needs OAuth app |

---

## Acceptance Criteria

1. `pnpm build` passes in `apps/server/`
2. Server boots locally with only `DATABASE_URL`, `REDIS_URL`, and `SESSION_SECRET` set
3. `GET /health` returns 200; `GET /health/ready` returns 200 with DB connected
4. Register, login, logout, and me all work end-to-end with `name` in responses
5. Forgot and reset password flow works end-to-end (token generated, email logged in dev, password updated, sessions cleared)
6. All 7 service clients initialize without errors when their keys are present
7. All 8 migrations run cleanly on a fresh Neon database
8. No em dashes anywhere in the codebase
9. All exports are named exports
10. All keys, props, and imports are alphabetically ordered
11. Test suite passes at 80% coverage
