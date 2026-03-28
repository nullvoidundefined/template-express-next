# Tasks — Deployments Health Check Dashboard

> **Purpose**: This file is the build plan for Claude Code. Work through each phase sequentially. Every task should be completed, tested, and committed before moving to the next.
>
> **This project is built on `template-express-next`.** The template provides a production-ready pnpm monorepo with Express 5, Next.js 15, session-based auth, PostgreSQL, Zod, pino, Vitest, ESLint + Prettier, lefthook, Dockerfile, and GitHub Actions CI. **Do not rebuild what the template already provides.** Extend it.

---

## Template Reference — What Already Exists

Before starting, understand what the template gives you for free. These are **not tasks** — they are already done.

| Concern | Template Provides | Location |
|---|---|---|
| Monorepo | pnpm workspaces (`server/`, `web-client/`) | `pnpm-workspace.yaml` |
| Express app | Full middleware stack (helmet, cors, rateLimiter, csrfGuard, requestLogger, errorHandler, notFoundHandler, request timeout) | `server/src/index.ts` |
| Database | `pg` Pool, `query()` wrapper with logging, `withTransaction()`, `node-pg-migrate` CLI | `server/src/db/pool/pool.ts` |
| Auth | Register, login, logout, session management, `requireAuth` middleware, `loadSession`, bcrypt password hashing, SHA-256 session token hashing, expired session cleanup | `server/src/handlers/auth/`, `server/src/repositories/auth/`, `server/src/middleware/requireAuth/` |
| Validation | Zod schemas pattern | `server/src/schemas/auth.ts` |
| Logging | pino (structured JSON in prod, pretty-print in dev) | `server/src/utils/logs/logger.ts` |
| Error handling | Centralized error handler, 404 handler | `server/src/middleware/errorHandler/`, `server/src/middleware/notFoundHandler/` |
| Rate limiting | Global (100/15min) and auth-specific (10/15min) rate limiters | `server/src/middleware/rateLimiter/` |
| Health endpoint | `GET /health` with DB connectivity check and response caching | `server/src/index.ts` |
| Parsers | `parseIdParam()` (UUID), `parsePagination()` (limit/offset) | `server/src/utils/parsers/` |
| Test infra | Vitest, supertest, mock helpers (mockLogger, mockResult, responseHelpers, UUIDs) | `server/src/utils/tests/` |
| Frontend | Next.js 15 App Router, React 19, SCSS, `api.ts` fetch wrapper (with CSRF header), auth helpers | `web-client/src/` |
| Migrations | `users` table, `sessions` table, `set_updated_at()` trigger function | `server/migrations/` |
| Git hooks | lefthook: pre-commit (lint + format:check), pre-push (test:coverage) | `lefthook.yml` |
| CI/CD | GitHub Actions: lint → format:check → test:coverage → build | `.github/workflows/ci.yml` |
| Docker | Multi-stage Dockerfile (server + web targets) | `Dockerfile` |
| TypeScript | Strict mode, `app/*` path alias → `src/*` | `server/tsconfig.json` |

### Conventions to Follow (from template patterns)

- **File structure**: `handlers/` (request handlers) → `repositories/` (data access) → `schemas/` (Zod validation) → `routes/` (Express routers)
- **Path alias**: Import as `app/...` not relative paths (e.g., `import { query } from "app/db/pool/pool.js"`)
- **Tests**: Co-located as `*.test.ts` next to source files
- **Migrations**: JS files in `server/migrations/` using `node-pg-migrate` API (`pgm.createTable`, `pgm.sql`, etc.)
- **API responses**: `{ data: ... }` on success, `{ error: { message: "..." } }` on failure
- **Database**: Raw SQL via `query()` wrapper, UUIDs for PKs via `gen_random_uuid()`, `timestamptz` for dates, `set_updated_at` trigger
- **Package manager**: `pnpm` exclusively. Install deps with `pnpm --filter server add <pkg>` or `pnpm --filter web-client add <pkg>`
- **Env vars**: Defined in `server/.env`, documented in `server/.env.example`
- **Commit style**: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`)

---

## Phase 0 — Project Setup (Clone Template & Configure)

**Goal**: Fork the template into this project, install new dependencies, and configure for the health check dashboard.

- [ ] Copy template-express-next into this repo (or use it as the starting point — `git clone` then update remotes)
- [ ] Update `package.json` name to `deployments-health-check-dashboard`
- [ ] Update `web-client/src/app/layout.tsx` metadata (title, description)
- [ ] Update `CLAUDE.md` with project-specific instructions:
  - Reference `SPEC.md` and `tasks.md` as the source of truth
  - Document the health check domain concepts
  - Note: Redis must be running for BullMQ; PostgreSQL must be running for the API
  - Note: Playwright requires Chromium; install with `npx playwright install chromium`
- [ ] Install new server dependencies: `pnpm --filter server add bullmq ioredis playwright`
- [ ] Install new server dev dependencies: `pnpm --filter server add -D @types/ioredis`
- [ ] Install new web-client dependencies: `pnpm --filter web-client add tailwindcss @tailwindcss/postcss postcss recharts lucide-react`
- [ ] Configure Tailwind CSS in `web-client/` (postcss config, import in globals.scss)
- [ ] Add Redis connection config: create `server/src/config/redis.ts` following the pattern in `server/src/config/env.ts`
- [ ] Add to `server/.env.example`:
  ```
  REDIS_URL=redis://localhost:6379
  GITHUB_TOKEN=
  TWILIO_ACCOUNT_SID=
  TWILIO_AUTH_TOKEN=
  TWILIO_FROM_NUMBER=
  ALERT_PHONE_NUMBER=
  ALERT_EMAIL=
  SLACK_WEBHOOK_URL=
  RESEND_API_KEY=
  ```
- [ ] Add Redis and Playwright setup to `docker-compose.yml` (create if not exists) for local dev
- [ ] Install Playwright Chromium: `npx playwright install chromium`
- [ ] Verify: `pnpm dev` starts both server and web-client, `pnpm lint` passes, `pnpm test` passes (existing template tests still green)

---

## Phase 1 — Core Monitoring Backend

> **Extends**: template's database layer, Express middleware, handler/repository/schema pattern

### 1.1 — Database Schema

- [ ] Create migration: `services` table (schema per SPEC.md, use `gen_random_uuid()` for PK, `set_updated_at` trigger)
- [ ] Create migration: `checks` table (FK to services, indexes on `(service_id, checked_at)`)
- [ ] Create migration: `incidents` table (FK to services)
- [ ] Create migration: `github_status` table (FK to services)
- [ ] Create migration: `notification_preferences` table (schema per SPEC.md Notifications section)
- [ ] Create seed script (`server/src/db/seed.ts`) with 2-3 sample services — use `query()` from template's pool
- [ ] Run migrations: `pnpm --filter server run migrate:up`
- [ ] Verify: all tables exist with correct columns, constraints, and indexes

### 1.2 — Service CRUD

Create following the template's handler → repository → schema → route pattern (mirror how `auth` is structured):

- [ ] `server/src/schemas/services.ts` — Zod schemas for create/update service input
- [ ] `server/src/repositories/services/services.ts` — CRUD queries using template's `query()` and `withTransaction()`
- [ ] `server/src/repositories/services/services.test.ts` — Unit tests for repository (mock `query`)
- [ ] `server/src/handlers/services/services.ts` — Request handlers (list, create, update, delete)
- [ ] `server/src/handlers/services/services.test.ts` — Handler tests using template's test helpers
- [ ] `server/src/routes/services.ts` — Express router with `requireAuth` middleware on all routes
- [ ] Register router in `server/src/index.ts`: `app.use("/api/v1/services", requireAuth, servicesRouter)` (after `loadSession`)
- [ ] Verify: full CRUD cycle works via curl/httpie (authenticated)

### 1.3 — Health Check Runner

- [ ] Create `server/src/config/redis.ts` — ioredis connection with env var
- [ ] Create `server/src/queues/healthCheck.ts` — BullMQ queue and worker setup
- [ ] Create `server/src/services/checkRunner.ts` — the check runner logic:
  1. DNS resolution with timing
  2. HTTP GET with timeout and timing
  3. Status code validation
  4. TLS certificate inspection
  5. Status determination (up/degraded/down per SPEC.md thresholds)
- [ ] Create `server/src/repositories/checks/checks.ts` — insert check results using `query()`
- [ ] Create `server/src/schemas/checks.ts` — Zod schemas for check results
- [ ] Register repeating BullMQ jobs on service create, update schedule on edit, remove on delete
- [ ] On server startup, sync BullMQ jobs with all active services from DB
- [ ] Write unit tests for status determination logic
- [ ] Write integration tests for check runner (mock HTTP target)
- [ ] Verify: create a service pointing to a real URL, see checks appearing in DB at configured interval

### 1.4 — Check History & Status Endpoints

- [ ] `GET /api/v1/services/:id/checks` — paginated history using template's `parsePagination()`
- [ ] `GET /api/v1/services/:id/checks/latest` — most recent check (response shape per SPEC.md)
- [ ] `POST /api/v1/services/:id/check` — trigger immediate check (add BullMQ job with no delay)
- [ ] `GET /api/v1/status` — **public, no auth** — aggregate status (response shape per SPEC.md)
- [ ] `GET /api/v1/status/:serviceId` — **public, no auth** — single service status
- [ ] `GET /api/v1/metrics` — system-wide uptime percentages and avg response times
- [ ] Implement uptime percentage calculation (`count(status='up') / count(*) * 100` over time window)
- [ ] Register public routes in `server/src/index.ts` **before** `loadSession` (no auth needed)
- [ ] Write tests for pagination, uptime math, response shapes
- [ ] Verify: endpoints return data matching SPEC.md response shapes

---

## Phase 2 — Status Page & Admin Dashboard

> **Extends**: template's Next.js App Router, `api.ts` fetch wrapper, auth helpers, SCSS + Tailwind

### 2.1 — Frontend Setup

- [ ] Set up shared layout: update `web-client/src/app/layout.tsx` with dashboard nav (Home, Admin, Login)
- [ ] Create API functions in `web-client/src/lib/services.ts` (using template's `api()` wrapper)
- [ ] Create API functions in `web-client/src/lib/status.ts` (public endpoints, no auth needed)
- [ ] Set up auth context or hook that uses template's existing `getMe()` from `web-client/src/lib/auth.ts`
- [ ] Verify: frontend loads, nav works, API calls reach backend

### 2.2 — Public Status Page (`/`)

- [ ] `web-client/src/app/page.tsx` — server component that fetches `/api/v1/status`
- [ ] `StatusHeader` component — project name + overall status indicator (operational/degraded/outage)
- [ ] `ServiceCard` component — name, URL link, status dot (green/yellow/red), response time, last-checked
- [ ] `UptimeBar` component — 90-day bar (one cell per day, color-coded by uptime %)
- [ ] `ActiveIncidents` component — list unresolved incidents
- [ ] Auto-refresh: client component wrapper that re-fetches every 30 seconds
- [ ] Loading and error states
- [ ] Responsive layout (mobile-friendly)
- [ ] Verify: status page renders real data from backend

### 2.3 — Admin Dashboard — Service List (`/admin`)

- [ ] Protected route: redirect to `/login` if not authenticated (use template's auth)
- [ ] Grid/list view of all services with status indicators
- [ ] Filters: by tag, by status
- [ ] Add Service modal/form with Zod validation (mirror template's register form pattern)
- [ ] Edit Service form (pre-populated)
- [ ] Delete Service with confirmation
- [ ] Verify: full CRUD through UI, auth redirect works

### 2.4 — Admin Dashboard — Service Detail (`/admin/services/[id]`)

- [ ] Service header: name, URL, current status, last-checked
- [ ] Sub-check breakdown: DNS, HTTP, TLS, response time
- [ ] Response time chart (Recharts line chart, toggle 24h/7d/30d)
- [ ] Uptime percentage (30d, 90d)
- [ ] Incident timeline
- [ ] "Trigger Check Now" button → `POST /api/v1/services/:id/check`
- [ ] Manual incident creation form
- [ ] Verify: detail view loads with real data, chart renders, manual check works

---

## Phase 3 — Screenshot System

- [ ] Create `server/src/services/screenshotCapture.ts`:
  - Launch headless Chromium via Playwright
  - Navigate to URL, wait for `networkidle` (max 15s)
  - Capture 1280x800 viewport as WebP
  - Save to `screenshots/{serviceId}/` with timestamp filename
  - Return file path
- [ ] Integrate into check runner: capture after HTTP check if `screenshot_enabled` is true
- [ ] Create `server/src/repositories/screenshots/screenshots.ts` — track paths, implement retention (keep last 50 per service)
- [ ] BullMQ scheduled job for screenshot pruning
- [ ] `GET /api/v1/services/:id/screenshot` — serve latest screenshot with `Last-Modified` + `Cache-Control` headers
- [ ] Admin detail view: screenshot thumbnail + click-to-expand lightbox
- [ ] Public status page: lazy-load screenshots
- [ ] Handle Playwright errors gracefully (timeout, crash → log, continue, null path)
- [ ] Write tests (mock Playwright)
- [ ] Verify: screenshots appear in filesystem, accessible via API, display in dashboard

---

## Phase 4 — GitHub Integration

### 4.1 — GitHub API Polling

- [ ] Create `server/src/services/githubPoller.ts` — GitHub API client (Octokit or fetch with token)
- [ ] Fetch latest commit on monitored branch
- [ ] Fetch latest GitHub Actions workflow run status
- [ ] Fetch build logs excerpt for failed runs (last 2KB)
- [ ] `server/src/repositories/github/github.ts` — store/retrieve from `github_status` table
- [ ] BullMQ repeating job (every 5 min per service)
- [ ] `GET /api/v1/services/:id/github` — return latest GitHub status
- [ ] Handle rate limiting (`X-RateLimit-Remaining` headers)
- [ ] Write tests with mocked GitHub API
- [ ] Verify: GitHub data in DB and accessible via API

### 4.2 — GitHub Webhooks

- [ ] `POST /api/v1/webhooks/github` — webhook receiver (register **before** `loadSession` in index.ts — no auth)
- [ ] Validate webhook signature (`X-Hub-Signature-256`)
- [ ] Handle `push`, `workflow_run`, `deployment_status` events
- [ ] Write tests for signature validation and event handling
- [ ] Verify: set up test webhook, see data flow through

### 4.3 — GitHub Data in Frontend

- [ ] Admin detail: GitHub section (commit info, CI status badge with link, expandable build logs on failure)
- [ ] Public status page: CI status indicator per service card
- [ ] Verify: renders correctly in both views

---

## Phase 5 — Incidents & Notifications

### 5.1 — Automatic Incident Management

- [ ] Implement in check runner: track consecutive failure count per service (Redis counter)
- [ ] 3 consecutive `down` → create incident (`investigating`)
- [ ] 2 consecutive `up` on active incident → auto-resolve (set `resolved_at`)
- [ ] `server/src/repositories/incidents/incidents.ts` — CRUD using `query()`
- [ ] `server/src/schemas/incidents.ts` — Zod schemas
- [ ] `server/src/handlers/incidents/incidents.ts` — handlers
- [ ] `server/src/routes/incidents.ts` — routes with `requireAuth`
- [ ] `GET /api/v1/services/:id/incidents`, `POST /api/v1/services/:id/incidents`, `PUT /api/v1/incidents/:id`
- [ ] Write tests for state machine (up→down transitions, consecutive counting, recovery)
- [ ] Verify: simulate outage, confirm auto-incident after 3 failures, auto-resolve on recovery

### 5.2 — Notification System

- [ ] Create `server/src/services/notifications/dispatcher.ts` — accepts event + channel list
- [ ] SMS via Twilio: format per SPEC.md templates, 30-min rate limit, consolidated multi-service SMS
- [ ] Email via Resend: incident created/resolved, TLS warnings, daily digest
- [ ] Slack webhook: incident created/resolved, CI failures (Block Kit format)
- [ ] Discord webhook: same triggers, embed format
- [ ] Quiet hours logic (suppress SMS, batch summary)
- [ ] `server/src/repositories/notifications/notifications.ts` — notification preferences CRUD
- [ ] Write tests for each channel (mock external APIs), rate limiting, quiet hours
- [ ] Verify: trigger incident → SMS sent (Twilio test creds), email sent, Slack posted

### 5.3 — TLS Expiration Warnings

- [ ] During health check: if TLS expires within 14 days → queue TLS warning notification
- [ ] Deduplicate: one warning per service per day
- [ ] At 7 days → escalate to SMS + email
- [ ] Write tests
- [ ] Verify: mock near-expiring cert, confirm warnings

---

## Phase 6 — Polish & Production Readiness

### 6.1 — Data Retention & Rollup

- [ ] Create migration: `check_aggregates` table
- [ ] BullMQ cron job (daily 3am UTC): roll up checks >30d to hourly, >1y to daily
- [ ] Update uptime queries to use aggregates for older ranges
- [ ] Write tests for rollup logic
- [ ] Verify: seed old data, run rollup, confirm accuracy

### 6.2 — 90-Day Uptime History

- [ ] Backend: per-day uptime for last 90 days (using aggregates where available)
- [ ] Frontend: `UptimeBar` component — green (>99.5%), yellow (95-99.5%), red (<95%), gray (no data)
- [ ] Tooltip on hover: date, uptime %, incident count
- [ ] Verify: renders with real data

### 6.3 — Responsive & Mobile

- [ ] Public status page: fully responsive (320px+)
- [ ] Admin dashboard: usable on tablet (768px+)
- [ ] Verify: no horizontal scroll, touch-friendly

### 6.4 — Enhanced Health Endpoint

- [ ] Extend template's `GET /health` to also check: Redis connectivity, BullMQ queue status, screenshot disk space
- [ ] Return granular sub-checks: `{ status, db, redis, queue, disk }`
- [ ] Verify: returns degraded when dependencies unavailable

### 6.5 — Production Deployment

- [ ] Update `Dockerfile` to include Playwright Chromium dependencies and `--no-sandbox` flag
- [ ] Create `docker-compose.yml` for production (PostgreSQL + Redis + server + web)
- [ ] Update GitHub Actions CI to also run integration tests
- [ ] Set up production env vars
- [ ] Configure Vercel for `web-client/` (root directory = `web-client` per template CLAUDE.md)
- [ ] Deploy server to Railway/Render/Fly.io
- [ ] Verify: full deploy, all features working, health endpoint green

### 6.6 — Final Verification

- [ ] `pnpm test` — all tests pass
- [ ] `pnpm lint` — no warnings
- [ ] `pnpm run format:check` — all files formatted
- [ ] Manual smoke test: status page, admin CRUD, health checks on schedule, screenshots, GitHub data, incidents, SMS notification, uptime bars
- [ ] Update `CLAUDE.md` with final project notes
- [ ] Create `README.md` with setup instructions and architecture overview

---

## Rules for Claude Code

1. **Follow the template's patterns exactly.** New handlers go in `handlers/`, repositories in `repositories/`, schemas in `schemas/`, routes in `routes/`. Use the `app/*` path alias.
2. **Use the template's `query()` wrapper** for all database operations. Never create a separate database connection.
3. **Use the template's `withTransaction()`** when multiple DB operations must succeed or fail together.
4. **Use the template's auth.** Admin routes use `requireAuth` from the template. Do not build a new auth system.
5. **One task, one commit.** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
6. **Write tests alongside implementation.** Co-located as `*.test.ts`. Use the template's test helpers.
7. **Validate all inputs with Zod.** Follow the pattern in `server/src/schemas/auth.ts`.
8. **Never hardcode secrets.** All tokens/keys in env vars. Update `server/.env.example` when adding new ones.
9. **SPEC.md is the source of truth** for data models, API shapes, and business logic. If tasks.md and SPEC.md conflict, SPEC.md wins.
10. **Run `pnpm lint` and `pnpm test` before every commit.** Fix failures before committing.
11. **Install packages to the correct workspace.** `pnpm --filter server add <pkg>` or `pnpm --filter web-client add <pkg>`. Never install to root unless it's a dev tool used by both.
12. **Public endpoints go before `loadSession`** in `server/src/index.ts`. Authenticated endpoints go after.
