# Boilerplate Upgrade: Infrastructure Port from Doppelscript

**Date:** 2026-05-25
**Approach:** Hybrid (Option C) -- update existing template-express-next boilerplate by porting production-tested infrastructure modules from doppelscript, genericized.

---

## Scope

### Ported from doppelscript (genericized)

**Server infrastructure:**

- `config/env.ts` -- Zod-validated environment variables, typed accessors, fail-fast startup
- `services/stripe.ts` -- lazy singleton, throws if `STRIPE_SECRET_KEY` absent
- `services/billing.service.ts` -- webhook event orchestration, no tier/plan logic
- `handlers/billing/webhook.ts` -- raw body registration before `express.json()`, Stripe signature verification, idempotency table (`stripe_events`) with atomic INSERT ... ON CONFLICT claim
- `handlers/billing/checkout-session.ts` -- create checkout session
- `handlers/billing/portal.ts` -- create customer portal session
- `repositories/billing.ts` -- subscription CRUD, stripe event idempotency checks
- `services/redis.ts` -- two lazy clients (BullMQ + rate limiter), no-op when `REDIS_URL` absent
- `services/queue.ts` -- BullMQ `default-jobs` queue, one example placeholder job, 3 retries with exponential backoff
- `worker.ts` -- separate BullMQ worker process, health server on `WORKER_PORT`
- `services/r2.ts` -- S3-compatible Cloudflare R2 client, `uploadFile`, `getPresignedUrl`, `deleteFile`, key path validation
- `services/circuit-breaker.ts` -- Redis-backed, `isOpen`/`trip`/`close`, fails safe when Redis absent
- `middleware/rateLimiter` updated to use `rate-limit-redis` with in-memory fallback

**Database migrations added:**

- `subscriptions` table: id (UUID), user_id (FK CASCADE), stripe_customer_id, stripe_subscription_id, status (enum: active/canceled/past_due/trialing/incomplete/incomplete_expired/paused/unpaid), plan_id, current_period_start (timestamptz), current_period_end (timestamptz), cancel_at_period_end (boolean), created_at, updated_at, set_updated_at trigger
- `stripe_events` idempotency table: event_id (text PK), event_type (text), processed_at (timestamptz default NOW()), status (text default 'processed')
- Existing auth migrations untouched

**Webhook events handled (generic):**

- `checkout.session.completed` -- create/update subscription record
- `customer.subscription.updated` -- sync subscription status
- `customer.subscription.deleted` -- mark canceled
- `invoice.payment_succeeded` -- update period dates
- `invoice.payment_failed` -- mark past_due

**Client infrastructure:**

- Theme system: `useTheme` Zustand store, `data-theme` attribute on `<html>`, localStorage persistence key `app-theme`, `matchMedia` system preference listener, inline `<script>` in layout `<head>` for flash prevention
- Toast system: Zustand store, queue-based, `useToast` hook exposes `addToast(message, type?, duration?)`, auto-dismiss with configurable timeout, Radix Toast primitives
- Modal queue: Zustand store, `useModal` hook exposes `openModal(content, options?)`, `closeModal(id?)`, `closeAllModals()`. Options: `id` (targeted close), `onClose` callback, `preventClose` (disable backdrop/escape). Stacking support. Built on Radix Dialog.
- Next.js middleware: route protection map (exact `ROUTE_MAP` + prefix `PREFIX_RULES`), public/private/admin classification, defaults to private (fail-safe), reads `sid` cookie for auth check (presence only, no API call), `x-pathname` response header
- API proxy route: `/api/[...path]` Next.js Route Handler proxying to Express, uses `INTERNAL_API_URL` (Railway private networking) falling back to `NEXT_PUBLIC_API_URL`, forwards all headers, passes body as ArrayBuffer

**Testing and DevEx:**

- `scripts/ensure-test-db.sh` -- createdb (no-op if exists) + migrate + seed, called from Playwright globalSetup locally, CI seeds only
- `playwright.smoke.config.ts` -- post-deploy smoke suite against real URLs
- `e2e/smoke/health.smoke.ts` -- health endpoint check
- `e2e/smoke/auth.smoke.ts` -- login/logout cycle
- `scripts/deploy.sh` -- Railway CLI, staging/production x full/web/server/migrate, post-deploy health poll + smoke tests
- `scripts/dev-watch.sh` -- crash-restart loop with `.next` cache clearing
- Storybook config (`.storybook/main.ts`, `.storybook/preview.ts`)
- Visual regression Playwright project against Storybook at port 6006
- `dev:payments` script: `pnpm dev & stripe listen --forward-to localhost:3001/webhooks/stripe`

### Removed from boilerplate

- `apps/client/extension/` (if scaffolded)
- `apps/client/mobile/` (if scaffolded)
- `packages/client-shared/` (single client surface)
- CLAUDE.md rules prohibiting Zustand

### Updated

- `docker-compose.yml` -- add Redis 7 service
- `package.json` scripts -- add dev:watch, dev:payments, test:e2e (port-kill + PW_PRE_BUILT), test:e2e:full, smoke scripts
- `lefthook.yml` -- E2E in CI only, not pre-push
- `.github/workflows/ci.yml` -- add Redis service in E2E job, integration test step
- `pnpm-workspace.yaml` -- remove deleted packages
- `apps/server/src/app.ts` -- Stripe webhook route before express.json(), Redis-backed rate limiter, circuit breaker wiring
- `apps/client/web/src/app/layout.tsx` -- theme flash-prevention script, provider nesting order

---

## Architecture

### Server middleware order (updated)

1. `trust proxy: 1`
2. `helmet()`
3. `corsConfig`
4. `requestLogger` (pino-http)
5. `GET /health`, `GET /health/ready` (before rate limiter)
6. `rateLimiter` (Redis-backed, in-memory fallback)
7. `POST /webhooks/stripe` -- `express.raw()` + webhook handler (before CSRF/JSON parsing)
8. `express.json({ limit: '10kb' })`
9. `express.urlencoded({ extended: true, limit: '10kb' })`
10. `cookieParser()`
11. `csrfGuard`
12. 30s request timeout
13. `loadSession`
14. Application routers (auth, billing, etc.)
15. `notFoundHandler`
16. `Sentry.expressErrorHandler()` (conditional)
17. `errorHandler`

### Worker process

Separate entry point `src/worker.ts`. Runs `node dist/worker.js` as its own Railway service (or local process). Health server on `WORKER_PORT` (default 3002). Graceful shutdown: close worker, flush Sentry, flush PostHog.

### Client provider nesting (layout.tsx)

```
<ThemeScript />          // inline in <head>, reads localStorage before paint
<QueryProvider>
  <PostHogProvider>
    <ToastProvider>       // Radix Toast.Provider + viewport
      <ModalProvider>     // Radix Dialog portal mount
        {children}
      </ModalProvider>
    </ToastProvider>
  </PostHogProvider>
</QueryProvider>
```

Note: Theme is a Zustand store, not a provider. `ThemeScript` is a `<script>` tag only. Toast and Modal use Radix primitives that need a provider/viewport mount point in the tree, but their state lives in Zustand stores accessible from anywhere.

### State management rules

| Tool | Use for |
|---|---|
| TanStack Query | Server state (API data, cache, mutations) |
| Zustand | Cross-component client state (modal queue, toast queue, UI preferences, complex form state shared across routes) |
| React Context | Providers wrapping the tree (auth session object) |
| useState | Local component UI state |

### Modal queue (Zustand store)

```typescript
type ModalEntry = {
  content: ReactNode;
  id: string;
  onClose?: () => void;
  preventClose?: boolean;
};

type ModalStore = {
  closeAllModals: () => void;
  closeModal: (id?: string) => void;
  modals: ModalEntry[];
  openModal: (content: ReactNode, options?: {
    id?: string;
    onClose?: () => void;
    preventClose?: boolean;
  }) => string;
};
```

`ModalProvider` renders all stacked modals, each in its own Radix Dialog overlay with ascending z-index. Backdrop click and Escape close the top modal unless `preventClose`. Each modal gets a unique ID (crypto.randomUUID or counter). `openModal` returns the ID for targeted close.

### Next.js middleware route protection

```typescript
const ROUTE_MAP: Record<string, 'public' | 'private' | 'admin'> = {
  '/': 'public',
  '/login': 'public',
  '/register': 'public',
  '/forgot-password': 'public',
  '/reset-password': 'public',
  '/dashboard': 'private',
};

const PREFIX_RULES: Array<{ access: 'public' | 'private' | 'admin'; prefix: string }> = [
  { access: 'private', prefix: '/settings' },
  { access: 'admin', prefix: '/admin' },
];
// Default: private (fail-safe)
```

Reads `sid` cookie. No API call. Redirects unauthenticated users on private/admin routes to `/login?redirect={path}`. Redirects authenticated users on auth pages to `/dashboard`.

### Environment validation (env.ts)

Zod schema parsing `process.env` at import time. Groups: required always, required in production only, optional with defaults. Exports frozen object + `isDev()`, `isProd()`, `isDeployed()` helpers. Server crashes at startup with clear error listing all missing/invalid variables.

Required variables:
- `DATABASE_URL`
- `SESSION_SECRET`
- `CORS_ORIGIN` (production only)
- `STRIPE_SECRET_KEY` (production only)
- `STRIPE_WEBHOOK_SECRET` (production only)

Optional with graceful degradation:
- `REDIS_URL` (rate limiter falls back to in-memory, BullMQ logs warning)
- `SENTRY_DSN` (Sentry no-ops)
- `POSTHOG_API_KEY` (PostHog no-ops)
- `RESEND_API_KEY` (email no-ops)
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ACCOUNT_ID` (R2 no-ops)

---

## CLAUDE.md Updates

All existing CLAUDE.md files updated to document:

- Zustand allowed and positioned (state management table above)
- Stripe/billing: handler pattern, webhook registration order, idempotency table, raw body requirement
- Redis: two-client pattern, graceful absence handling
- BullMQ: queue/worker separation, job definition pattern, worker as separate process
- R2: upload/download/presigned URL patterns, key path conventions
- Circuit breaker: when to use, how to wire to external API calls
- env.ts: how to add new variables, required vs optional, production-only requirements
- Theme: store location, flash-prevention script, `data-theme` attribute
- Toast: store API, usage pattern
- Modal queue: store API, Radix Dialog integration, dynamic content pattern
- Middleware: route map maintenance, adding new routes
- Deploy: `deploy.sh` usage, staging-first rule
- Smoke tests: when to run, how to add new checks
- Testing: ensure-test-db.sh, E2E in CI only (not pre-push)

---

## Files Not Ported (explicitly excluded)

- All doppelscript domain logic (voices, documents, workdesk, notepad, onboarding, samples, etc.)
- Extension and mobile surfaces
- `packages/client-shared` (chat engine, SSE parser, shared components)
- Upload middleware (multer + magic byte validation)
- Admin routes and admin auth
- Subdomain routing in Next.js middleware
- Coming-soon gate
- LLM fixture mode and AI-specific test infrastructure
- BullMQ job types beyond the example placeholder
