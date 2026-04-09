# Engineering Audit: template-express-next

**Date:** 2026-04-09
**Auditor:** CTO perspective (engineering audit role)
**Scope:** Full template audit per primary framing in audit prompt
**Last commit audited:** c20bf03 (Merge remote changes, resolve conflicts)

---

## Executive Summary

This template is structurally sound in its design intent: monorepo with clear surface separation, header-only CSRF, solid auth implementation, good test coverage on the server. The core problem is that this started life as a specific application (a deployments health check dashboard) and was not fully cleaned up before being used as a template. Application-specific code, incorrect package names, missing dependencies, and documentation that describes a structure that does not yet exist all combine to make this template actively misleading for a developer picking it up cold.

**Top three priorities:**

1. `bullmq` and `ioredis` are imported in `apps/server/src/` but missing from `apps/server/package.json` and the lockfile entirely. The test suite cannot resolve them. This is a broken build that ships with the template.
2. `playwright` is imported in `apps/server/src/services/screenshotCapture.ts` and its test file but is not in `apps/server/package.json`. Same class of problem.
3. The root `package.json` `name` field is `deployments-health-check-dashboard`. The `apps/server/package.json` `name` is `server`. These are names from the application this template was derived from, not template-appropriate names. A developer cloning this template will have incorrect workspace scoping and CI artifact names from day one.

---

## Operational Basics

| Check | Status | Notes |
|---|---|---|
| Tests run in CI | YES | CI workflow runs `pnpm run test:coverage` |
| CI green | UNKNOWN | Cannot verify without running CI; local test run fails due to missing deps (see P0 below) |
| E2E tests exist and are wired | NO | No Playwright config, no `e2e/` directory, no E2E test infrastructure anywhere in the project |
| Frontend tests exist | NO | `apps/client/web/package.json` has no test script, no vitest config, no RTL, no test files |
| Error tracking | NO | No Sentry, no error tracking integration documented or implemented |
| Rollback plan | NO | No documented rollback procedure for Railway deploys |
| Monitoring | PARTIAL | `/health` endpoint exists; no alerting, no uptime monitoring wired up |

---

## Architecture and Design

### What is working well

The layering is correct and enforced: routes wire handlers, handlers validate and delegate, services orchestrate, repositories own SQL. The CSRF header-only pattern is implemented correctly on both sides. Session cookie handling (SHA-256 hashed token, `httpOnly`, `secure` in production, `SameSite=None` in production for cross-origin) is correct. The `withTransaction` helper prevents orphaned rows. The pool uses `statement_timeout` and `connectionTimeoutMillis`. Graceful shutdown covers HTTP server, all BullMQ queues and workers, and the DB pool.

The monorepo workspace structure is correctly expressed in `pnpm-workspace.yaml`. The `packages/tokens/` package has a proper `dist/` build and its export map is correct.

### Application leakage into the template

This template was derived from a specific application. The following residual application code is present and wrong for a template:

- `package.json` (root): `name` is `deployments-health-check-dashboard`. Should be `template-express-next`.
- `apps/server/package.json`: `name` is `server`. Should be something that does not conflict with any other package in a developer's workspace.
- `apps/server/migrations/`: Eight domain-specific migrations (`create-services-table`, `create-checks-table`, `create-incidents-table`, etc.). These are not generic auth-plus-user migrations. A developer using this as a starting point will inherit these tables and have to delete them before building their own schema.
- `apps/server/src/` contains: `handlers/checks/`, `handlers/github/`, `handlers/incidents/`, `handlers/screenshots/`, `handlers/services/`, `handlers/webhooks/`, plus `queues/`, and application-specific services. These are all application-specific code, not template scaffolding.
- `apps/server/.env.example`: Includes `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ALERT_PHONE_NUMBER`, `ALERT_EMAIL`, `SLACK_WEBHOOK_URL`, `RESEND_API_KEY`, `SCREENSHOTS_DIR`. None of these belong in a base template.
- `apps/server/src/config/env.ts`: Validates all of the above application-specific env vars. A developer building a new app will see Twilio and Slack validation in their base template config.

The template's `CLAUDE.md` documents a clean structure with `handlers/jobs/`, `repositories/jobs/`, `schemas/job.ts`. The actual code has none of those and has entirely different domain code instead.

### `packages/` layer: incomplete extraction plumbing

- `packages/types/`: `src/index.ts` is a stub with only comments. No actual types exported. No `tsconfig.json`. The `package.json` points `"main"` and `"exports"` directly to `./src/index.ts` (the TypeScript source), which is a valid approach for type-only packages in a monorepo with TypeScript project references but only if consuming packages configure `moduleResolution` to resolve `.ts` files. No workspace currently declares `@repo/types` as a dependency, so no consumer has validated this.
- `packages/client-shared/`: Has only a `package.json` and a `CLAUDE.md`. No `src/` directory. No `index.ts`. The `package.json` points `"exports"` to `./src/index.ts` which does not exist. Importing `@repo/client-shared` from any workspace will immediately fail.
- `packages/tokens/`: Fully built and correct. `dist/_tokens.scss` is committed. Export map points to `dist/`. No workspace currently declares `@repo/tokens` as a dependency, but the package itself is ready to use.

---

## Code Quality

### Convention violations in committed code

The root `CLAUDE.md` and `apps/client/web/CLAUDE.md` both mandate "named exports only, never `export default`." The following files use `export default`, violating this rule:

- `apps/client/web/src/app/layout.tsx` line 35: `export default RootLayout;`
- `apps/client/web/src/app/(auth)/login/page.tsx` line 93: `export default LoginPage;`
- `apps/client/web/src/app/(auth)/register/page.tsx` line 98: `export default RegisterPage;`
- `apps/client/web/src/app/page.tsx` line 87: `export default HomePage;`

Next.js App Router requires `export default` for page and layout files. This is a genuine conflict between the documented convention and the framework requirement. The CLAUDE.md rule needs a stated exception for App Router page/layout files, or the rule needs to be changed to "named exports only, except Next.js App Router pages and layouts which require `export default`." The current state silently violates the documented rule in the first four files a developer will read.

### API response field name inconsistency

The server returns `created_at` (snake_case, matching the database column name) in auth responses. The web client `useAuth.ts` defines `User.createdAt` (camelCase). The `/auth/me` handler returns `req.user` which is the raw database row with `created_at`. The test at `auth.test.ts` line 79 asserts on `created_at`. The client and server are using different naming conventions for the same field with no transformation layer. This is a bug in the template.

File references:
- `apps/server/src/handlers/auth/auth.ts` lines 31 and 76: returns `created_at`
- `apps/client/web/src/state/useAuth.ts` line 9: declares `createdAt: string`

### Service file naming convention inconsistency

`apps/server/CLAUDE.md` specifies that service files use the naming convention `kebab-case.service.ts`. The actual files are `checkRunner.ts`, `githubPoller.ts`, `incidentManager.ts`, `screenshotCapture.ts`: camelCase without the `.service` suffix. The convention is not followed in the code that ships with the template.

### Test placement violates documented convention

Root `CLAUDE.md` section "Testing Conventions" states unambiguously: "Test files live in `src/__tests__/`, never beside source files. Every workspace keeps its tests in a `src/__tests__/` directory." The server has all test files co-located beside their source files (e.g., `csrfGuard.test.ts` beside `csrfGuard.ts`). There is no `__tests__/` directory anywhere in `apps/server/src/`. This is the most direct CLAUDE.md-vs-code contradiction in the repo and it will mislead any developer who reads the convention and then looks at the code.

### `(protected)` route group missing from web client

`apps/client/CLAUDE.md` and `apps/client/web/CLAUDE.md` both document a `(protected)/` route group containing `layout.tsx` and `dashboard/page.tsx`. The actual web app has only `(auth)/`. There is no `(protected)/` route group. A developer following the documented structure to add their first authenticated page will expect this scaffold to be present.

---

## Security

### CSRF implementation

Correct. `csrfGuard` middleware blocks POST/PUT/PATCH/DELETE without `X-Requested-With`. The web client's `api.ts` attaches the header on every request. Extension and mobile clients also attach it. No token endpoint (header-only pattern as documented).

### Auth implementation

Session token is stored as SHA-256 hash in the database. The cookie holds the raw token. A database dump does not expose live sessions. Password hashing uses bcrypt with `SALT_ROUNDS = 12`. Login uses a timing-safe bcrypt compare. Email is lowercased and trimmed before storage and lookup. Concurrent sessions are allowed (only expired sessions are pruned on login). `SameSite=None; Secure` in production for cross-origin cookie use.

One concern: `SameSite=None` without a same-origin API URL is the fallback Safari ITP mitigation, but it expands cookie scope to any origin that has CORS permission. The documented convention mentions using Vercel rewrites to achieve same-origin behavior. The template does not implement or scaffold any rewrite. The developer gets `SameSite=None` and needs to know to set up rewrites for production Safari compatibility. This should be called out in the template documentation.

### CORS configuration

`corsConfig.ts` uses `process.env.CORS_ORIGIN` directly rather than the validated `env` object from `env.ts`. Minor inconsistency but not a security issue since the default is `http://localhost:3000`.

### Route auth gaps

`app.use("/api/v1/incidents", incidentsRouter)` in `apps/server/src/index.ts` line 177 does not apply `requireAuth` at the router mounting level. The incidents router applies `requireAuth` per route. This is fine from a correctness standpoint but inconsistent with how services and metrics are mounted (with `requireAuth` at the `app.use` call). A developer adding routes to the incidents router may forget to add `requireAuth` to the new route.

### Input validation

All auth endpoints use `safeParse` with explicit error surfacing. Payload size is limited to `10kb`. Rate limiting is applied globally.

---

## Credential Exposure Scan

**Git history:** Scanned for Anthropic, Stripe, GitHub, Vercel, Resend, AWS, and other credential patterns. No matches found.

**Working tree:** Scanned all source files. No credential values found. `.env.example` contains only placeholder values.

**Claude Code session transcripts:** Scanned 7 JSONL files in the project's transcript directory. Zero matches for any credential pattern.

**Shell history:** Scanned `~/.zsh_history` and `~/.bash_history`. Zero credential pattern matches.

**Railway CLI config:** `~/.railway/config.json` exists (13KB). Structure contains `projects`, `user`, `linkedFunctions`. No credential values visible in the key scan. Railway stores OAuth tokens, not raw API keys, in this file.

**Verdict:** No credential exposure found across any scan surface.

---

## Database

### Schema design

Eight domain-specific migrations are present. All use `pgm.func('gen_random_uuid()')` for primary keys, `timestamptz` for timestamps, and include both `up` and `down` functions. Foreign keys use `onDelete: 'CASCADE'` for user-owned data.

### Findings

- As noted in Architecture: these are application-specific migrations that should not be in a template. A developer cloning the template inherits a schema for services, checks, incidents, and GitHub status tables.
- No `updated_at` trigger function is created in any migration. The `apps/server/CLAUDE.md` convention documentation says to create a shared `set_updated_at` trigger function in the users migration and reuse it. No migration creates this trigger. `updated_at` columns exist in the schema but will not auto-update unless the application explicitly sets them.

---

## API Design

The auth API returns an inconsistent shape (documented in Code Quality above). The routes are correctly segmented. Error responses follow the documented `{ error: { message: "..." } }` convention. The health endpoint returns `{ status, db, redis, queue }` with a 5-second cache, which is thoughtful design for a high-traffic health check path.

---

## Performance

No N+1 patterns visible in the auth layer. The session lookup uses a JOIN query to get user data in one round trip. The health endpoint caches results for 5 seconds to avoid hammering the database on every Railway health check poll.

---

## Testing

### Server tests

Coverage: 91% lines, 91% branches, 86% functions based on the committed coverage report. The configured threshold is 80% across all dimensions. Tests cover: all auth handler paths (register, login, logout, me), CSRF guard for all HTTP methods, error handler, not-found handler, rate limiter, request logger, requireAuth middleware, auth repository, and schemas.

### Critical gap: missing dependencies make tests non-runnable

`checkRunner.test.ts` imports `checkRunner.ts` which imports `ioredis`. `ioredis` is not in `apps/server/package.json` and not in the lockfile. Vitest cannot resolve the module and the test file fails to load entirely. Running `pnpm run test` with the current lockfile will show 1 test file failing to load with `Failed to load url ioredis`. This means any developer who clones the template and runs `pnpm install && pnpm test` will see a red test suite from day one.

### No frontend tests

`apps/client/web/package.json` has no test script. No vitest config. No `@testing-library/react`. No test files of any kind in `apps/client/web/src/`. The CLAUDE.md documents a testing requirement for components but there is no infrastructure to support it.

### No E2E tests

No `playwright.config.ts` at the root or in any workspace. No `e2e/` directory. The CI workflow has no E2E step. The convention files document E2E tests as mandatory but the template ships with no scaffold for them.

### Tests are co-located, not in `__tests__/`

Documented in Code Quality above. The convention says `__tests__/`; the implementation uses co-location. A developer following the convention file will create `__tests__/` directories; a developer following the existing code pattern will create co-located test files. The template is internally inconsistent.

---

## Dependencies and Supply Chain

### Missing from `apps/server/package.json`

The following packages are imported in `apps/server/src/` but not declared as dependencies:

| Package | Imported in | Type |
|---|---|---|
| `bullmq` | `src/queues/healthCheck.ts`, `src/queues/githubPoller.ts`, `src/queues/maintenance.ts` | Production dep |
| `ioredis` | `src/queues/healthCheck.ts`, `src/services/checkRunner.ts`, `src/services/incidentManager.ts` | Production dep |
| `playwright` | `src/services/screenshotCapture.ts` | Production dep |

These packages are not in `pnpm-lock.yaml`. `pnpm install --frozen-lockfile` (the CI and Dockerfile command) will succeed, but the TypeScript build (`pnpm run build`) will fail with module resolution errors. The Docker image cannot be built from a clean state.

### Version skew between workspaces

`apps/client/web/package.json` specifies `"node": ">=20.9.0"` while the root `package.json` and `apps/server/package.json` both specify `"node": ">=22.0.0"`. The CI workflow and Dockerfile both use Node 22. This is a minor inconsistency but it means the web client's engines field does not match what will actually run it.

`eslint-config-prettier` is `^8.6.0` in `apps/client/web` and `^10.1.8` in `apps/server`. These are major versions apart. Minor risk for drift in formatting rules.

### Lockfile integrity

`pnpm-lock.yaml` exists and the CI uses `--frozen-lockfile`. Since `bullmq`, `ioredis`, and `playwright` are absent from `package.json`, they are correctly absent from the lockfile. The lockfile itself is not corrupt; the issue is that the source code references packages that are not listed.

---

## Deployment and Infrastructure

### Dockerfile

The Dockerfile is correct and well-structured. It uses multi-stage builds: `base`, `deps`, `build-server`, `build-web`, `server`. The production stage copies compiled output and `migrations/` but not test files or source. The `start.sh` script runs migrations before starting the server (`set -e` ensures migration failure prevents server start).

Two concerns:

1. The Dockerfile installs Playwright Chromium in the `deps` stage for the production server image. Screenshot capture is an application-specific feature. The template ships a Dockerfile that bundles a 200MB+ browser binary into the production server image. This is wrong for a template.
2. The CI workflow does not run `pnpm run build` in a step that would catch the missing `bullmq`/`ioredis`/`playwright` module resolution errors before they reach a deploy attempt. The workflow runs lint, format check, and test:coverage, then build. The build step will fail in CI once a developer tries to ship, but only then.

### Railway config

`apps/server/lefthook.yml` duplicates the root `lefthook.yml` with different scope. The root hooks run `pnpm -r run lint` (all workspaces) while the server hooks run `pnpm run lint` (server only). The installed git hooks reference the root lefthook config. A developer working inside `apps/server/` and seeing `apps/server/lefthook.yml` may assume it governs their pre-commit behavior, but it does not.

---

## Bug Fix Discipline

Scanned all 18 `fix:` commits in the last 30 days of history. Four commits are unpaired (source file changes with no test file changes):

| SHA | Subject |
|---|---|
| `5331d99` | fix: use SameSite=None in production for cross-origin session cookies |
| `1352464` | fix: update public status API to match web client expected response shape |
| `04982da` | fix: explicitly disable SSL when no CA cert configured |
| `2e481d3` | fix: replace SSL cert bypass with proper CA cert configuration |

Four unpaired fixes in a 30-day window is a P1 behavioral finding per the audit criteria. However, three of these four (`5331d99`, `04982da`, `2e481d3`) involve deployment/infrastructure behavior (cookie flags, SSL configuration) that is genuinely test-resistant without a real database or deployed environment. The honest classification is: `04982da` and `2e481d3` are deploy-configuration fixes that qualify for the R-201 honest exception. `5331d99` (SameSite cookie flag change) is testable and should have a corresponding test asserting the correct `Set-Cookie` header shape in production mode. `1352464` (API response shape) is definitely testable and should have a test.

---

## Runbook-vs-Code Drift Scan

No `docs/runbooks/` directory exists. Nothing to compare.

---

## Workspace Hygiene

Only one copy of this project was found at the expected path. No duplicates detected.

---

## CLAUDE.md Accuracy Audit

The following documented items contradict what is actually on disk:

| CLAUDE.md claim | Reality |
|---|---|
| Root `CLAUDE.md`: "Test files live in `src/__tests__/`, never beside source files" | All server tests are co-located |
| Root `CLAUDE.md`: Server CLAUDE.md lists `handlers/jobs/jobs.ts`, `repositories/jobs/jobs.ts` as example structure | Actual structure has `handlers/auth/`, `handlers/services/`, etc. (application-specific) |
| `apps/client/CLAUDE.md`: Documents `(protected)/layout.tsx` and `(protected)/dashboard/` | Neither exists on disk |
| `apps/client/CLAUDE.md` and `apps/client/web/CLAUDE.md`: "Named exports only" | All Next.js page/layout files use `export default` |
| `apps/server/CLAUDE.md`: Services are named `kebab-case.service.ts` | Actual files: `checkRunner.ts`, `incidentManager.ts` (no `.service` suffix, camelCase) |
| `apps/server/CLAUDE.md`: Entry point pattern should use `src/index.ts` + `src/app.ts` (two files) | `src/index.ts` is a combined single-file entry |
| `apps/server/CLAUDE.md`: `/health` should return `200 { status: 'ok' }` (fast, no DB call) | Actual `/health` runs DB + Redis + queue checks and returns degraded state |
| `apps/client/CLAUDE.md`: "packages/client-shared/ src/ ├── index.ts ├── api.ts ..." | `packages/client-shared/` has no `src/` directory at all |

---

## Tech Debt Register

| Item | Risk | Notes |
|---|---|---|
| Application-specific domain code in template | HIGH | Needs cleanup before developer use; creates confusion about what is scaffolding vs. what to delete |
| Missing `bullmq`, `ioredis`, `playwright` in package.json | CRITICAL | Breaks build and tests |
| `packages/client-shared/` has no src/ | HIGH | Import will fail at runtime if any workspace depends on it |
| `packages/types/` has no tsconfig.json | MEDIUM | Consuming TypeScript workspaces need project references to resolve `.ts` exports |
| No frontend test infrastructure | HIGH | Template ships with no ability to run component tests |
| No E2E test infrastructure | HIGH | Template documents E2E as mandatory but provides no scaffold |
| `updated_at` trigger not created in migrations | MEDIUM | Columns exist but will not auto-update |
| Two `lefthook.yml` files with inconsistent scope | LOW | Confusing but non-breaking |
| Dockerfile bundles Playwright Chromium | MEDIUM | Wrong for a template; adds 200MB+ to production image |

---

## Prioritized Recommendations

### P0: Blocking

**1. Add `bullmq`, `ioredis`, and `playwright` to `apps/server/package.json`.**
These packages are imported in source and tests. Without them the build and tests fail. Run `pnpm --filter ./apps/server add bullmq ioredis playwright` and commit the updated `package.json` and `pnpm-lock.yaml`.

**2. `packages/client-shared/` is non-functional.**
The `src/` directory does not exist. The `package.json` exports point to `./src/index.ts` which does not exist. Any workspace that installs and imports `@repo/client-shared` will fail immediately. Either create `src/index.ts` with a stub, or mark the package clearly in its `README` as "not yet implemented."

### P1: Fix this sprint

**3. Clean the template of application-specific code.**
Decision to make: either (a) rename this repo as the health-check-dashboard application and create a separate clean template, or (b) strip the application-specific code (handlers for services/checks/incidents/screenshots/webhooks/github, queue files, service files, all eight migrations, env vars for Twilio/Slack/GitHub/Resend) and replace with the generic scaffolding the CLAUDE.md documents. Until this is resolved, the template is an application and a developer using it as a starting point will carry significant application-specific debt.

**4. Fix the root and server `package.json` name fields.**
`package.json` (root) `name`: change from `deployments-health-check-dashboard` to `template-express-next`.
`apps/server/package.json` `name`: change from `server` to something template-appropriate (e.g., `@template/server`).

**5. Fix the test location inconsistency or update the documentation.**
Either move all server tests to `src/__tests__/` mirroring the source tree (as documented), or change the CLAUDE.md convention to match the co-location pattern that is actually implemented. The current state misleads developers. Recommendation: the co-location pattern is more common and more ergonomic; update the CLAUDE.md to remove the `__tests__/` rule and replace it with a co-location rule.

**6. Fix the `created_at` / `createdAt` field name mismatch.**
The server returns `created_at`; the web client type declares `createdAt`. One must change. Recommendation: the server's schema and database use `snake_case`, so the server output is correct. The client should declare `created_at: string` to match what it actually receives. The longer-term fix is a shared type in `packages/types/` that enforces consistency.

**7. Add a Next.js `export default` exception to the CLAUDE.md named-exports rule.**
The rule as written conflicts with Next.js App Router requirements. Add a stated exception: "Next.js App Router files (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`) must use `export default` per the framework requirement. All other files use named exports only."

**8. Create the `(protected)/` route group scaffold.**
`apps/client/web/src/app/(protected)/layout.tsx` (auth guard) and `(protected)/dashboard/page.tsx` (stub) are documented in two CLAUDE.md files. They don't exist. Add them as stubs so the documented structure is present.

**9. Unpaired fixes: add tests for `5331d99` and `1352464`.**
`5331d99` changed cookie `sameSite` behavior conditionally based on `NODE_ENV`. A test that sets `NODE_ENV=production` and asserts the `Set-Cookie` header includes `SameSite=None` would have caught any future regression.
`1352464` changed an API response shape. A test asserting the new shape would have locked this in.

### P2: Next sprint

**10. Add frontend test infrastructure to `apps/client/web`.**
Add `vitest`, `@testing-library/react`, `@testing-library/user-event`, and a `vitest.config.ts` to the web workspace. Add a `test` script to `apps/client/web/package.json`. Wire the pre-push hook to run web tests. Without this, the template ships with a documented requirement (component tests) and no means to satisfy it.

**11. Add an E2E test scaffold.**
Add `playwright.config.ts` at the project root with `webServer` config for both backend and frontend. Add a minimal `e2e/auth.spec.ts` that tests the login and register flows. Wire it to the CI workflow.

**12. Add `tsconfig.json` to `packages/types/`.**
The package exports TypeScript source directly. A consuming workspace needs TypeScript to resolve it. Add a `tsconfig.json` with `"composite": true` and proper settings, and document the project reference pattern in `packages/types/CLAUDE.md`.

**13. Fix the `updated_at` trigger gap.**
The first migration that creates the `users` table should create a `set_updated_at` trigger function. Subsequent migrations should apply it to tables that have `updated_at` columns.

**14. Fix the duplicate `lefthook.yml` situation.**
Delete `apps/server/lefthook.yml` (it is not used by the installed hooks) or rename it to `lefthook.server.yml` and add a comment explaining that lefthook is managed from the root. The current state where two `lefthook.yml` files exist with different scope configurations is confusing.

**15. Fix the Dockerfile Playwright dependency.**
If screenshot capture remains in the template, move `playwright` to a separate service (it has no place in an Express API server). If it is removed as part of the application-specific code cleanup, the Playwright install step in the Dockerfile should also be removed.

**16. Align service file naming convention.**
Either update `apps/server/CLAUDE.md` to document the actual naming convention (`camelCase.ts` without `.service` suffix), or rename the service files to match the documented convention (`checkRunner.service.ts`, etc.).

### P3: Nice to have

**17. Align Node engines field in `apps/client/web/package.json`.**
Change `"node": ">=20.9.0"` to `"node": ">=22.0.0"` to match the root and server declarations and the actual runtime used in CI and Dockerfile.

**18. Add a SameSite/ITP note to deployment docs.**
Document that `SameSite=None` is the cross-origin cookie fallback, and that the recommended production setup is a Vercel rewrite that makes the API call same-origin, which allows `SameSite=Lax` everywhere.

**19. Move CORS config to use the validated `env` object.**
`apps/server/src/config/corsConfig.ts` reads `process.env.CORS_ORIGIN` directly instead of `env.CORS_ORIGIN` from the Zod-validated config. Minor inconsistency.
