# Engineering audit: template-express-next against the template-fastapi-nuxt design

Date: 2026-09-19
Reference: `template-fastapi-nuxt/docs/superpowers/specs/2026-09-19-template-fastapi-nuxt-design.md` (spec at `f3feeee`) and `docs/slices/slice-01-walking-skeleton.md`
Scope: `apps/server`, `apps/client/web`, `packages/*`, `Dockerfile`, `docker-compose.yml`, `.github/workflows`, `lefthook.yml`, and harness wiring. Read-only; no code changed.

## Method

The FastAPI template's spec was written against this template as its parity baseline, and in several places it states that it deliberately does better than Express ("stricter than the Express template", "retries that the Express template's unawaited call never had"). Every such statement was treated as a hypothesis about a weakness here and checked against the code on `main` (`1972385`). A finding is listed only when the code on disk confirms it; each carries its evidence, the governing rule, a severity, a fix direction, and what to confirm before fixing (R-804). Fix directions are hypotheses, not patches.

Severity: P0 is a correctness or security defect that ships in every fork; P1 is a defect with a realistic trigger; P2 is a gap against the current rules or the FastAPI design; P3 is hygiene.

## Summary

| # | Finding | Severity | Area |
|---|---|---|---|
| 1 | Failed Stripe webhook events are never retried | P0 | Billing |
| 2 | Idempotency middleware caches error responses and races on concurrent retries | P0 | Middleware |
| 3 | Stripe checkout and portal redirect to `/settings`, a page that does not exist | P1 | Billing |
| 4 | Two browser-to-API paths; the direct cross-origin one breaks the cookie gate on Railway | P1 | Frontend |
| 5 | Sentry initializes after Express is imported, and user context carries the email | P1 | Observability |
| 6 | Request ID is not bound to a context, so most log lines, Sentry, and outbound calls lack it | P1 | Observability |
| 7 | Password-reset email is sent fire-and-forget in the request process | P1 | Auth |
| 8 | Worker loads dotenv after its imports read the environment, and has no health probes | P1 | Worker |
| 9 | Recipient email addresses are written to logs | P1 | Privacy |
| 10 | No generated type contract; `openapi.yaml` and `@repo/types` are hand-maintained | P2 | Contract |
| 11 | Inconsistent success envelope (`{ user }` versus `{ data }`) | P2 | API |
| 12 | Only one deployable has a Dockerfile, and it runs as root with dev dependencies | P2 | Deployment |
| 13 | CI has no aggregate `ci` check, skips integration tests, and has no drift or checklist gates | P2 | CI |
| 14 | Rate limiting is disabled under test, so no test proves it limits | P2 | Testing |
| 15 | Circuit breaker and R2 client have no caller, and the breaker is one global key | P2 | Integrations |
| 16 | Outbound clients lack timeouts and telemetry (R-346) | P2 | Integrations |
| 17 | Table names predate R-334 | P3 | Data model |
| 18 | Smaller correctness and hygiene items | P3 | Various |

## Findings

### 1. Failed Stripe webhook events are never retried (P0)

Evidence, `apps/server/src/repositories/billingRepository.ts:108-114`:

```ts
`INSERT INTO stripe_events (event_id, event_type, status)
 VALUES ($1, $2, 'processing')
 ON CONFLICT (event_id) DO NOTHING
 RETURNING event_id`
```

and `apps/server/src/handlers/billing/webhookHandler.ts`:

```ts
const claimed = await billingRepo.claimStripeEvent(event.id, event.type);
if (!claimed) {
  res.json({ received: true });
  return;
}
```

When processing throws, the handler marks the row `failed` and answers 500 so Stripe redelivers. On redelivery the insert conflicts, `claimed` is false, and the handler answers 200 without processing. The failed event is dropped permanently, and Stripe stops retrying. A process crash between the claim and `markStripeEventProcessed` leaves the row in `processing` forever with the same result. The `processed_at` column also defaults to `NOW()` at claim time, so it records the claim rather than completion.

Rule: FastAPI spec, State transitions ("a failed event is claimed again when Stripe redelivers it"); R-344 (an error must not be silently absorbed).

Fix direction: make the claim an upsert that re-claims rows in `failed` status (and rows stuck in `processing` beyond a staleness window), and record `attempted_at` separately from `processed_at`.
To confirm: that a repository test can drive two deliveries of the same event with a failure in between; that no existing test asserts the current "second delivery is ignored" behaviour for failed rows.

### 2. Idempotency middleware caches error responses and races on concurrent retries (P0)

Evidence, `apps/server/src/middleware/idempotencyMiddleware.ts:35-50`:

```ts
const existing = await idempotencyRepo.findByKey(key, userId);
if (existing) {
  res.status(existing.status_code).json(existing.response_body);
  return;
}
const originalJson = res.json.bind(res);
res.json = (body: unknown) => {
  void idempotencyRepo
    .store(key, userId, res.statusCode, body)
    .catch((err: unknown) => { logger.error({ err }, 'Failed to store idempotency key'); });
  return originalJson(body);
};
```

Four defects follow from this shape:

1. Every `res.json` call is stored, including the error handler's 500 and 503 responses, so a client that retries after a transient database outage receives the stored 500 for 24 hours. The FastAPI spec's B-18 requires the opposite: a failed handler releases its claim.
2. There is no in-flight claim. Two concurrent requests with the same key both miss `findByKey`, both run the handler (two Stripe Checkout sessions), and the second `store` fails on the primary key and is only logged. The FastAPI spec answers the second request 409 until the first finishes.
3. The key is bound only to `(key, user_id)`. A key reused on a different path or with a different body replays the first response. The FastAPI spec (B-40) stores method, path, and body hash and answers 422 `IDEMPOTENCY_KEY_REUSED`.
4. After the 24-hour window, `findByKey` ignores the old row, but `store` then conflicts with it on the primary key (`idempotency_keys` has `primaryKey: ['key', 'user_id']` and no upsert), so a reused key is never stored again. Rows are removed only by pg_cron, which the migration skips silently where pg_cron is unavailable.

Rule: FastAPI spec B-17, B-18, B-40 and Failure modes; R-344.

Fix direction: an insert-first claim row (status `in_progress`) with method, path, and body hash; replay only completed 2xx and 4xx rows; delete the claim on 5xx or thrown error; answer 409 while in progress; upsert or prune expired keys in-app.
To confirm: whether `apps/server/src/__tests__/integration/idempotency-flow.test.ts` covers concurrency or failure (it would have caught defects 1 and 2 if it did); that the web client actually sends `Idempotency-Key` anywhere (no caller was found in `apps/client/web/src`).

### 3. Stripe checkout and portal redirect to a page that does not exist (P1)

Evidence: `apps/server/src/handlers/billing/billingHandler.ts:20-24` sets `cancel_url` and `success_url` to `${env.CLIENT_URL}/settings...`, and `portalHandler.ts:42` sets `return_url` to `/settings`. The only reference to `/settings` in the web client is a prefix rule in `apps/client/web/src/middleware.ts:16`; there is no `app/**/settings/page.tsx`. The web client also has no checkout or portal buttons (no `billing` reference anywhere in `apps/client/web/src`), so the billing backend has no UI.

Rule: FastAPI frontend feature map (the dashboard carries the checkout and portal buttons); R-607 (a route needs a page, a story, and an e2e spec).

Fix direction: point the three URLs at a page that exists (the dashboard), or add the page, and add the dashboard billing buttons with an e2e spec against stripe-mock.
To confirm: what `apps/server/src/__tests__/handlers/billing/redirectUrls.test.ts` asserts; if it asserts `/settings`, the test encodes the bug.

### 4. Two browser-to-API paths; the direct one breaks the cookie gate on Railway (P1)

Evidence, `apps/client/web/src/services/apiService.ts:5`:

```ts
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/v1`;
```

The browser calls the API origin directly with `credentials: 'include'`, so the `sid` cookie is set on the API's host. Meanwhile `src/middleware.ts` and `(protected)/layout.tsx` read `sid` from the web origin. On Railway the two services have separate `*.up.railway.app` hosts; `railway.app` is on the Public Suffix List, so a cookie set by one host is never sent to the other. The same-origin proxy `app/api/[...path]/route.ts` exists but `apiService.ts` does not use it. If the proxy were used, it forwards the browser's headers but the API sees the web server as the client, so `trust proxy: 1` plus IP-keyed rate limiting would put every user in one bucket unless `X-Forwarded-For` is set deliberately.

Rule: FastAPI spec, Request path ("The browser talks only to the Nuxt origin"); root `CLAUDE.md` rule 24 (cookie flags depend on same-domain deployment).

Fix direction: route every browser call through the same-origin proxy, forward the client IP explicitly, and set the API's `trust proxy` hop count to match; drop `NEXT_PUBLIC_API_URL` from the browser bundle.
To confirm: the deployed Railway hostnames (a shared custom domain would hide this bug); whether the e2e suite runs web and API on one host (`localhost` on both hides it locally, because cookies ignore ports).

### 5. Sentry initializes after Express loads, and user context carries the email (P1)

Evidence, `apps/server/src/server.ts:1-8`: `import { createApp } from 'app/app.js'` is a static import and so evaluates, loading `express`, before `Sentry.init` on line 8 runs. `@sentry/node` 10 relies on OpenTelemetry hooks registered at `init`, before the instrumented module is first imported; Sentry's documented pattern is a separate `instrument.ts` loaded first (for example with `node --import`). Without it, per-request isolation scopes are not created, and `Sentry.setUser` in `requireAuthMiddleware.ts:16` writes to a shared scope, so one user's identity can attach to another request's error. That line also sends `email` to Sentry, and `logout` clears the user with `void clearSession()`, which clears the shared scope rather than the request's.

Rule: FastAPI spec B-30 (user ID only, never the email; cookies and `Authorization` scrubbed); R-104; root `CLAUDE.md` rule 30 ("initialize before any business logic").

Fix direction: move `Sentry.init` to an `instrument.ts` preloaded before `index.ts`, set only `{ id }`, and add a `beforeSend` that strips cookies and the `Authorization` header.
To confirm: Sentry's current Node ESM setup docs through context7 before changing the start command; that `Sentry.setupExpressErrorHandler` is the v10 API (the code casts `expressErrorHandler() as any`, suppressing a type error that suggests an API mismatch).

### 6. Request ID is not bound to a request context (P1)

Evidence: `requestLoggerMiddleware.ts` generates and echoes `x-request-id` through pino-http, which attaches it only to `req.log`. Handlers, repositories, and services log through the module-level `logger` from `loggerService.ts`, which has no mixin, so their lines carry no request ID; `errorHandlerMiddleware.ts` passes `reqId: req.id` by hand, and nothing else does. No `AsyncLocalStorage` exists in `apps/server/src`. Sentry events are not tagged with the ID, and outbound calls (Stripe, Resend, PostHog) do not forward it.

Rule: R-341; FastAPI spec B-2 ("every log line for that request carries the same ID").

Fix direction: an `AsyncLocalStorage` request context set in the first middleware, a pino `mixin` that reads it, a Sentry tag, and forwarding in each client wrapper.
To confirm: that pino-http's `genReqId` output can seed the store so the header and the log ID stay one value.

### 7. Password-reset email is fire-and-forget in the request process (P1)

Evidence, `apps/server/src/handlers/authHandler.ts:204`: `void dispatchResetEmail();` after the response is sent. A Resend failure is logged and lost with no retry; a deploy or crash between response and send drops the email; `server.ts` shutdown does not wait for it. The BullMQ worker exists but handles only an `example` job.

Rule: FastAPI spec, Decisions ("Sent by an arq job ... retries that the Express template's unawaited call never had") and B-14.

Fix direction: enqueue a `send_password_reset_email` BullMQ job with attempts and backoff; keep the always-200 response.
To confirm: that `queueClient.ts`'s null-Redis fallback does not silently drop the job in production (see finding 18, Redis optional in production).

### 8. Worker loads dotenv too late and has no health probes (P1)

Evidence, `apps/server/src/worker.ts:1-3`:

```ts
import { createWorker } from 'app/clients/queueClient.js';
import { logger } from 'app/services/loggerService.js';
import 'dotenv/config';
```

ES module imports evaluate in order, so `queueClient` loads `redisClient`, which loads `envConfig`, which calls `envSchema.parse(process.env)` before `dotenv/config` runs. With a local `.env` and no exported variables, `pnpm dev:worker` throws on the required `DATABASE_URL`. `index.ts` avoids this with a dynamic import; the worker does not. `WORKER_PORT` is declared in `envConfig.ts:27` and never used: the worker has no `/health` or `/health/ready`, no graceful shutdown, and no Dockerfile or Railway service.

Rule: R-345 ("on every service and worker"); FastAPI spec B-16; root `CLAUDE.md` Ports section.

Fix direction: mirror `index.ts` (dotenv first, then a dynamic import), add a small HTTP probe server on `WORKER_PORT` that pings Redis, and close the worker on SIGTERM.
To confirm: run `pnpm dev:worker` with only `apps/server/.env` present to reproduce before fixing (R-403).

### 9. Recipient email addresses are written to logs (P1)

Evidence, `apps/server/src/services/emailService.ts:20, 40, 46`: `{ event: 'email_skipped', to }`, `{ err: error, event: 'email_send_failed', to }`, `{ event: 'email_sent', to }`.

Rule: R-342 and R-104 (no PII in logs).

Fix direction: log the user ID, which the caller has, instead of the address.
To confirm: that pino `redact` paths are not already configured elsewhere (none were found in `loggerService.ts`).

### 10. No generated type contract (P2)

Evidence: `apps/server/docs/openapi.yaml` is hand-written (12 paths; `/webhooks/stripe` is absent), `packages/types/src/userTypes.ts` is hand-written, and the web client re-declares response shapes as Zod schemas. Nothing checks any of the three against the Zod request schemas or the handlers, so they drift silently. `UserRole` is `'admin' | 'user'`, while the FastAPI spec settles on `member | admin` to avoid a boolean-like name.

Rule: FastAPI spec, Type flow and B-4; root `CLAUDE.md` rule 8.

Fix direction: generate OpenAPI from the Zod schemas (for example `@asteasolutions/zod-to-openapi`), generate client types from it with `openapi-typescript`, commit both, and add a CI drift job.
To confirm: R-331 justification for the new dependency; whether the existing `packages/types` consumers can switch to generated types in one PR.

### 11. Inconsistent success envelope (P2)

Evidence: auth handlers answer `{ user }` (`authHandler.ts`, `res.json({ user: toUserResponse(user) })`), while posts and checkout answer `{ data }`. `errorHandlerMiddleware.ts:20` also maps every 403 to `AUTH_REQUIRED`, so a generic forbidden error reads as "log in".

Rule: FastAPI spec, Outputs and the `GET /auth/me` row ("so generated clients see one success shape").

Fix direction: `{ data }` everywhere, with the client wrappers updated in the same PR; a distinct forbidden code.
To confirm: every web client schema that parses `{ user }`.

### 12. Only one deployable has a Dockerfile, and it runs as root with dev dependencies (P2)

Evidence: the root `Dockerfile` has one runtime target, `server`, based on the full `node:22` image with no `USER`, no `HEALTHCHECK`, and `COPY --from=deps /app/node_modules`, which includes every workspace's dev dependencies. The `build-web` stage is labelled "for local/CI use" and has no runtime stage; there is no worker image. `docker-compose.yml` runs only Postgres 16, Redis, and the server, with `depends_on` that does not wait for health, a leftover `health_check_dev` database name, and a leftover `./screenshots` volume. `vercel.json` remains as a second deploy path.

Rule: R-351 (every deployable artifact: API, worker, frontend server); FastAPI spec, Deployables and B-3.

Fix direction: three images (API, worker, web with Next `output: 'standalone'`), `node:22-slim` runtimes with `pnpm deploy --prod`, a non-root user, `HEALTHCHECK`s, and compose with `condition: service_healthy`.
To confirm: whether any fork deploys through Vercel before removing `vercel.json`.

### 13. CI gaps (P2)

Evidence, `.github/workflows/ci.yml`: jobs `build-and-test`, `e2e`, `docker-build`; no job is named `ci`, so the `protect-merge` ruleset context the FastAPI repo uses cannot be required here. `test:integration` never runs, although `src/__tests__/integration/` holds three suites. There is no `permissions:` block, no `concurrency:` group, no R-607 feature-checklist step (`scripts/require-feature-checklist.sh` is absent), no OpenAPI drift job, no visual-regression run, and `docker-build` builds the image without starting it. The repo has no Dependabot config and no PR template.

Separately, `lefthook.yml` pre-commit runs `eslint .` and `prettier . --check` across the whole package rather than on staged files.

Rule: R-509; R-408; R-607; FastAPI spec, Testing (seven jobs plus an aggregate `ci`).

Fix direction: port the FastAPI repo's `ci.yml` skeleton (aggregate `ci` job with `if: always()` and a failure check on `needs`), add an integration job with Postgres and Redis services, and copy `dependabot.yml`, the PR template, and `require-feature-checklist.sh` from `template-fastapi-nuxt`.
To confirm: the ruleset currently configured on the GitHub repo (`gh api repos/{owner}/{repo}/rulesets`).

### 14. Rate limiting is untested (P2)

Evidence, `rateLimiterMiddleware.ts:38, 49`: `skip: () => isTest`. The three rate-limit tests assert only that the limiter is skipped under test. No test sends the eleventh auth request and expects 429, and production without `REDIS_URL` only warns (`envConfig.ts:33`, through `console.warn`), so a multi-replica deploy enforces per-instance limits.

Rule: R-401 (tests that fail when the implementation is wrong); FastAPI spec B-7 and Failure modes ("production refuses to start without `REDIS_URL`").

Fix direction: make the limiter injectable so tests build it with a low limit; fail `validateEnv` in production without `REDIS_URL`; replace `console.warn` with the logger.
To confirm: whether other tests rely on the skip to avoid 429s, which would need a per-test limiter instead.

### 15. Circuit breaker and R2 client have no caller (P2)

Evidence: `services/circuitBreakerService.ts` stores one Redis key, `circuit:external:state`, for every provider, with no failure counting; `isCircuitOpen`, `tripCircuit`, and `closeCircuit` are referenced only by their own test. `clients/r2Client.ts` is likewise uncalled, and nothing enforces the key pattern or extension allowlist at the point a key is generated.

Rule: FastAPI spec B-25 (five failures in 60 seconds opens a per-provider breaker for 30 seconds) and B-29 (server-generated keys, extension allowlist, 15-minute expiry).

Fix direction: a per-provider breaker with a failure counter, wired into the Stripe and Resend wrappers; a presign service that generates the key itself.
To confirm: whether forks are expected to delete these or wire them; an unused module that looks production-ready is worse than none.

### 16. Outbound clients lack timeouts and telemetry (P2)

Evidence: `stripeClient.ts` constructs `new Stripe(key)` with the library default timeout (80 seconds, longer than the 30-second request timeout); `emailService.ts` and `analyticsClient.ts` set no timeout. None logs provider, operation, duration, and outcome. `analyticsClient.ts:17` hard-codes `host: 'https://us.i.posthog.com'`, ignoring `env.POSTHOG_HOST`, and `trackEvent` accepts `event: string` rather than the registry type, so a string literal compiles. `server.ts` shutdown never flushes PostHog.

Rule: R-346; R-343; FastAPI spec B-23.

Fix direction: one `withClientTelemetry` wrapper applied in each client; explicit timeouts (Stripe `timeout: 10_000`, per the FastAPI failure modes); `event: AnalyticsEvent`; `posthog.shutdown()` in the shutdown path.
To confirm: the Stripe SDK 22 option name for timeout.

### 17. Table names predate R-334 (P3)

Evidence: `sessions`, `password_resets`, `subscriptions`, `stripe_events`, `idempotency_keys`. The FastAPI spec maps these to `user_sessions`, `user_password_resets`, `user_subscriptions`, `billing_webhook_events`, `request_idempotency_keys`.

Rule: R-334.

Fix direction: rename in the template now, before more forks inherit the old names; a rename migration per table.
To confirm: which forks exist; a rename here does not propagate to them.

### 18. Smaller items (P3)

- `SESSION_SECRET` is required (`envConfig.ts:23`) but read nowhere, so every environment must set a secret that does nothing.
- `databasePool.ts:13` sets `ssl: false` whenever `DATABASE_CA_CERT` is unset, which contradicts root `CLAUDE.md` rule 21 (gate on `isProduction()`); to confirm whether `sslmode` in the Neon connection string overrides it in `pg` 8.
- `server.ts:50` runs session cleanup on a `setInterval` in every API replica, on top of the pg_cron job, and never prunes idempotency keys; the FastAPI design moves the fallback to one worker job.
- `resetPassword` computes a bcrypt hash before checking the token, so invalid tokens cost full hashing work.
- Health readiness uses the shared pool (`app.ts:98`), so an exhausted pool reports "not ready" for up to the 5-second connect timeout; the FastAPI design opens its own connection.
- The rate-limiter test and the `routes.test.ts` route table would need updating with any envelope change (R-513).

## What the FastAPI design adds that has no Express counterpart yet

These are not defects here, but they are the reasons the FastAPI template will be stronger, and each could be back-ported:

1. Numbered acceptance criteria (B-1 to B-40), each one behavior and one test, as the definition of parity.
2. A spec with Inputs, Outputs, Invariants, Failure modes, State transitions, and a Domain vocabulary glossary (R-330).
3. Slice plans with per-PR context, problem, approach, tests, and review focus, run under the TDD lock (R-412).
4. Repo-setup harness wiring: `.claude/settings.json` with `harness-bootstrap.sh`, `scripts/require-feature-checklist.sh`, Dependabot, and the PR template. This repo has only an untracked `settings.local.json`.
5. The `admin` role introduced with its consumer rather than ahead of it (R-334, slice ordering).

## Recommended order

1. Findings 1 and 2 (billing and idempotency correctness), test-first, one PR each.
2. Findings 3 and 4 (billing redirect and single request path), since both break a deployed fork.
3. Findings 5, 6, 9 (observability and PII) as one observability PR.
4. Findings 7 and 8 (worker: dotenv, probes, reset-email job).
5. Finding 13 (CI), which then enforces the rest.
6. Findings 10 to 12 and 14 to 18 as follow-up tickets in `docs/todos/`.
