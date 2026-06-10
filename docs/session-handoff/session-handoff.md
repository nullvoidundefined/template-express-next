# Session Handoff

Backend parity alignment (Plan B) is **COMPLETE and squash-merged to `main`**. The `template-express` and `template-express-next/apps/server` backends now follow one set of architectural decisions.

## Last commits

- `template-express-next` `main`: `12411f8` "chore: clear all lint warnings to pass --max-warnings=0" (Plan B B1-B9 squash-merged as `9706d0b`, branch deleted). **PUSHED; CI green (incl. E2E).**
- `template-express` `main`: `bdee356` "feat: convert users identity to uuid primary key" (Plan A complete, merged). **PUSHED; CI green.**

## Production state

Both repos pushed to `origin/main`; GitHub Actions CI green on both. The `template-express-next` CI run executed the full Playwright E2E suite (the `/v1` `posts.spec.ts` passed in CI). Nothing deployed to Railway (template repos).

Parity alignment (Plan A + Plan B) is COMPLETE and shipped. No pending parity work.

## What shipped (Plan B, now one squashed commit on `main`)

- **Error contract:** `{ code, error }` envelope everywhere via `app/errors.js` registry; `errorHandler` maps status -> code and returns 503 `DATABASE_UNAVAILABLE` for driver/Postgres connectivity errors; `HTTP.STATUS` constants replace numeric literals; web `ApiError` carries `code`.
- **Factory DI** (pre-session) across repos/handlers/middleware/routers; `createApp(deps)`.
- **validate middleware** at the router layer (handlers read `req.body as XxxInput`); **hashToken** shared helper.
- **Isolated integration setup** (`__tests__/integration/setup.ts`: migrate once + TRUNCATE between tests, LOCAL-only R-110 guard).
- **posts resource** (uuid PK, user_id FK, pagination, validate, `{ data }`/`{ data, meta }`).
- **Idempotency keys** (table + repo + middleware mounted after `loadSession`; 24h replay).
- **`/v1` versioning** on all app routes (health + Stripe webhook stay at root); web client + proxy + layouts target `/v1`.
- **pg_cron cleanup migration** (sessions + idempotency keys; silently skips without pg_cron) and **OpenAPI 3.1 spec** at `apps/server/docs/openapi.yaml`.

Monorepo's better-than-reference choices kept (SSL via DATABASE_CA_CERT, `/health` split, in-process session cleanup interval).

## Verification (on `main`)

- Server unit: **192** passing. Web unit: **34** passing. Build (both): clean. Lint: **0 errors** (10 pre-existing warnings, unrelated to Plan B).
- Integration: **16** passing (auth 11 + posts 3 + idempotency 2) against LOCAL `template_test`. Run: `DATABASE_URL="postgresql://localhost:5432/template_test" SESSION_SECRET="test-secret" NODE_ENV=test pnpm --filter server test:integration`.
- Migrations applied + verified on LOCAL `template_test` only (R-110). Local `postgresql@14` running (trust auth, user `iangreenough`).

## Pending / next session

No parity work remains; all follow-ups done.

- DONE: `template-express` CI bumped to `actions/checkout@v6` + `setup-node@v6` (`5dd8666`); the Node 20 deprecation warning is gone, CI green.
- DONE: lint clean at `--max-warnings=0` in both `template-express-next` workspaces.
- DONE: E2E runs in CI for `template-express-next` (the `/v1` `posts.spec.ts` passes there).

Next real workstream (new scope, not leftover): the portfolio's app builds (`job-tracker-ai` -> ... -> `agentic-travel-agent`).
