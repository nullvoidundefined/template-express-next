# Boilerplate Completion Design

**Date:** 2026-04-22
**Status:** Approved

## Scope

Complete the template-express-next boilerplate by implementing all features required by CLAUDE.md that are currently missing or partial.

---

## Phase 1: Auth Completion

### Database

New migration `create-password-resets`:

- Table `password_resets`: `id` (uuid PK default gen_random_uuid()), `user_id` (uuid FK -> users ON DELETE CASCADE), `token_hash` (text unique not null), `expires_at` (timestamptz not null), `used_at` (timestamptz nullable)
- Indexes on `token_hash` and `expires_at`
- No `updated_at` column; no set_updated_at trigger (tokens are write-once)

### Repository additions (`repositories/auth/auth.ts`)

- `createPasswordReset(userId, tokenHash, expiresAt)` -- inserts a row into password_resets
- `consumePasswordReset(tokenHash)` -- single transaction: check token exists + not expired + not used; update user password hash; mark token used (`used_at = now()`); delete all sessions for that user. Returns the updated user or null if invalid.
- `updateUser(userId, fields)` -- updates name and/or password_hash for PATCH /auth/me

### Email service (`services/email/email.ts`)

- Wraps Resend SDK (`resend` npm package)
- Exports `sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>`
- Reset URL constructed as `${CLIENT_URL}/reset-password?token={rawToken}`
- `RESEND_API_KEY` and `CLIENT_URL` added to validateEnv (required in production)
- `RESEND_FROM_EMAIL` env var for the sender address (e.g., `noreply@example.com`)

### New endpoints

**PATCH /auth/me** (requires auth)
- Body: `{ name?: string, currentPassword?: string, newPassword?: string }`
- If newPassword provided, currentPassword is required; verify against stored hash before updating
- Returns updated user object (without password_hash)
- 400 if newPassword provided without currentPassword
- 400 if currentPassword is wrong

**POST /auth/forgot-password**
- Body: `{ email: string }`
- Always returns 200 regardless of whether email exists (prevents enumeration)
- If user found: generate 32-byte random token, store SHA-256 hash in password_resets (1hr TTL), send email via Resend
- If user not found: no-op, still returns 200

**POST /auth/reset-password**
- Body: `{ token: string, password: string }`
- Calls consumePasswordReset; returns 400 "Invalid or expired token" if token invalid, expired, or already used
- Returns 204 on success

### Zod schemas

New schemas in `schemas/auth.ts`:
- `forgotPasswordSchema`: `{ email: z.string().email() }`
- `resetPasswordSchema`: `{ token: z.string().min(1), password: z.string().min(8) }`
- `updateMeSchema`: `{ name: z.string().min(1).optional(), currentPassword: z.string().optional(), newPassword: z.string().min(8).optional() }`

### Frontend pages

**`(auth)/forgot-password/page.tsx`**
- Single email field
- Submits to POST /auth/forgot-password
- On any 200 response (including non-existent emails): shows "If that email is registered, you will receive a reset link shortly"
- Uses existing auth.module.scss and Button component
- data-test-id: `forgot-password-form`

**`(auth)/reset-password/page.tsx`**
- Reads `?token=` from URL search params
- Password + confirm-password fields
- Client-side validation: passwords must match
- Submits to POST /auth/reset-password with token from URL
- On success: redirect to /login with `?reset=true` query param
- On 400: shows "This link is invalid or has expired"
- data-test-id: `reset-password-form`

**Login page update:** Show "Password reset successfully. Please log in." banner when `?reset=true` is present.

### useAuth hook additions

Two new TanStack Query mutations:
- `forgotPassword`: calls POST /auth/forgot-password, no cache invalidation needed
- `resetPassword`: calls POST /auth/reset-password, on success navigates to /login

### @repo/types additions

- `PasswordReset` type: `{ id: string, userId: string, expiresAt: string, usedAt: string | null }`

---

## Phase 2: Observability + Integration Tests

### packages/constants (new workspace)

Location: `packages/constants/`

Structure:
```
packages/constants/
  package.json          (@repo/constants)
  tsconfig.json
  src/
    analytics.ts        (typed event name constants)
    index.ts            (re-exports)
```

`analytics.ts` exports:
```typescript
export const ANALYTICS_EVENTS = {
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PROFILE_UPDATED: 'profile_updated',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',
  USER_REGISTERED: 'user_registered',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
```

Added to pnpm workspaces. Imported by server and web (no magic strings).

### Sentry (server)

- Install `@sentry/node`
- `SENTRY_DSN` env var: optional (Sentry skipped if not set, so template works without account)
- Init at the very top of `app.ts` before any imports of business logic
- `environment: process.env.NODE_ENV`
- `loadSession` middleware: after populating `req.user`, call `Sentry.setUser({ id: user.id, email: user.email })`. On logout, call `Sentry.setUser(null)`.
- Sentry error handler registered as the last middleware in `app.ts` (before the custom errorHandler)

### Sentry (web)

- Install `@sentry/nextjs`
- `NEXT_PUBLIC_SENTRY_DSN` env var: optional
- `sentry.client.config.ts` and `sentry.server.config.ts` at Next.js root
- `instrumentation.ts` wired per Next.js 15 conventions
- `environment: process.env.NODE_ENV`
- No source map upload configured (template concern; consumers add their own CI step)

### PostHog (server)

- Install `posthog-node`
- `POSTHOG_API_KEY` env var: optional (analytics skipped if not set)
- Singleton client in `services/analytics/analytics.ts`
- Exports `trackEvent(distinctId: string, event: AnalyticsEvent, properties?: Record<string, unknown>): void`
- Called from auth handlers using `ANALYTICS_EVENTS` constants:
  - register: USER_REGISTERED
  - login: USER_LOGGED_IN
  - logout: USER_LOGGED_OUT
  - forgot-password (when user found): PASSWORD_RESET_REQUESTED
  - reset-password (on success): PASSWORD_RESET_COMPLETED
  - PATCH /auth/me (on success): PROFILE_UPDATED

### PostHog (web)

- Install `posthog-js`
- `NEXT_PUBLIC_POSTHOG_KEY` env var: optional
- `PostHogProvider` component in `providers/PostHogProvider.tsx`
- Added to root `layout.tsx` wrapping the app
- PostHog configured to use the reverse proxy path (`/ingest`) for all requests
- `useAuth` hook: `posthog.identify(user.id, { email: user.email })` on login/register; `posthog.reset()` on logout

### PostHog reverse proxy

- Next.js route handler at `src/app/ingest/[...path]/route.ts`
- Forwards all requests to `https://us.i.posthog.com`
- Strips the `/ingest` prefix before forwarding
- Preserves method, headers, and body

### ESLint fix

- `no-explicit-any`: `'warn'` -> `'error'` in both server and web ESLint configs
- All existing `any` usages in the codebase replaced with `unknown` + narrowing (or proper types) in the same commit

### Integration tests

Location: `apps/server/src/__tests__/integration/auth-flow.test.ts`

Config: `apps/server/vitest.integration.config.ts` with `include: ['src/__tests__/integration/**/*.test.ts']`, no coverage thresholds.

Script: `"test:integration": "vitest run --config vitest.integration.config.ts"` in server `package.json`.

Test cases (all use Supertest against real Express app, real DB):
1. POST /auth/register -- 201 + Set-Cookie header
2. POST /auth/register duplicate email -- 409
3. POST /auth/login valid credentials -- 200 + Set-Cookie
4. POST /auth/login invalid credentials -- 401
5. GET /auth/me with valid session -- 200 + user object
6. GET /auth/me without session -- 401
7. POST /auth/logout -- 204
8. GET /auth/me after logout -- 401
9. POST /auth/forgot-password any email -- 200
10. POST /auth/reset-password with invalid token -- 400
11. PATCH /auth/me update name -- 200 + updated name
12. PATCH /auth/me wrong currentPassword -- 400

Tests skip gracefully (via `test.skipIf`) when `DATABASE_URL` env var is not set.
Each test runs DB cleanup (DELETE FROM sessions; DELETE FROM users) in beforeEach.

---

## Environment Variables Added

| Var | Where | Required | Purpose |
|-----|-------|----------|---------|
| `CLIENT_URL` | server | prod only | Base URL for password reset links |
| `RESEND_API_KEY` | server | prod only | Resend email sending |
| `RESEND_FROM_EMAIL` | server | prod only | Sender address |
| `SENTRY_DSN` | server | optional | Sentry error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | web | optional | Sentry error tracking |
| `POSTHOG_API_KEY` | server | optional | PostHog server-side analytics |
| `NEXT_PUBLIC_POSTHOG_KEY` | web | optional | PostHog client-side analytics |

---

## Files Created or Modified

### Phase 1

- `apps/server/migrations/*_create-password-resets-table.js` (new)
- `apps/server/src/services/email/email.ts` (new)
- `apps/server/src/repositories/auth/auth.ts` (modified: add createPasswordReset, consumePasswordReset, updateUser)
- `apps/server/src/handlers/auth/auth.ts` (modified: add forgotPassword, resetPassword, updateMe handlers)
- `apps/server/src/routes/auth.ts` (modified: add 3 new routes)
- `apps/server/src/schemas/auth.ts` (modified: add 3 new schemas)
- `apps/server/src/config/env.ts` (modified: add CLIENT_URL, RESEND_API_KEY, RESEND_FROM_EMAIL)
- `apps/client/web/src/app/(auth)/forgot-password/page.tsx` (new)
- `apps/client/web/src/app/(auth)/reset-password/page.tsx` (new)
- `apps/client/web/src/app/(auth)/login/page.tsx` (modified: add reset=true banner)
- `apps/client/web/src/state/useAuth.ts` (modified: add forgotPassword, resetPassword mutations)
- `packages/types/src/index.ts` (modified: export PasswordReset)
- `packages/types/src/password-reset.ts` (new)

### Phase 2

- `packages/constants/` (new package: package.json, tsconfig.json, src/analytics.ts, src/index.ts)
- `apps/server/src/services/analytics/analytics.ts` (new)
- `apps/server/src/app.ts` (modified: Sentry init, handlers emit PostHog events)
- `apps/server/src/middleware/requireAuth/requireAuth.ts` (modified: Sentry user context)
- `apps/server/src/handlers/auth/auth.ts` (modified: trackEvent calls)
- `apps/server/package.json` (modified: add @sentry/node, posthog-node, @repo/constants)
- `apps/server/eslint.config.mjs` (modified: no-explicit-any -> error)
- `apps/server/vitest.integration.config.ts` (new)
- `apps/server/src/__tests__/integration/auth-flow.test.ts` (new)
- `apps/client/web/sentry.client.config.ts` (new)
- `apps/client/web/sentry.server.config.ts` (new)
- `apps/client/web/instrumentation.ts` (new)
- `apps/client/web/src/app/ingest/[...path]/route.ts` (new)
- `apps/client/web/src/providers/PostHogProvider.tsx` (new)
- `apps/client/web/src/app/layout.tsx` (modified: PostHogProvider, Sentry)
- `apps/client/web/src/state/useAuth.ts` (modified: PostHog identify/reset)
- `apps/client/web/package.json` (modified: add @sentry/nextjs, posthog-js, @repo/constants)
- `apps/client/web/eslint.config.mjs` (modified: no-explicit-any -> error)
- `pnpm-workspace.yaml` (modified: add packages/constants)
