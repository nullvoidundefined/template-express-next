# deployments-health-check-dashboard

## Overview

A self-hosted status page and uptime monitoring dashboard for tracking deployed projects. It performs scheduled health checks, captures live screenshots, surfaces build and deployment status from GitHub, and presents everything through a clean public status page and authenticated admin dashboard.

Think Betterstack + Statuspage.io + Checkly, built lean and tailored for a solo builder's portfolio of deployed apps.

---

## ELI5: How This System Works

Imagine you have five lemonade stands spread across town. You can not sit at all five at once, so you hire a kid on a bicycle to ride around and check on each stand every minute.

**The kid on the bike is the Check Runner.** Every 60 seconds (or however often you configure), it rides over to each of your deployed apps and knocks on the front door. "Hey, are you alive?" It is literally just making an HTTP request to your URL and seeing if it gets a 200 OK back, how long the response took, and whether the SSL certificate is still valid. That is the entire health check in a nutshell: send a request, look at what comes back, write down the result.

**The clipboard the kid carries is PostgreSQL.** Every time the kid checks a stand, they write down what they found: "Stand #3, checked at 10:15am, open, responded in 342ms, certificate good until September." That is one row in the `checks` table. Over days and weeks, you accumulate thousands of these rows, which is how you calculate things like "99.95% uptime over 30 days" -- you just count the `up` rows vs. total rows.

**The kid's route schedule is BullMQ + Redis.** You do not want to manually tell the kid "go check Stand #3 now." Instead, you set up a repeating schedule: "check every stand every 60 seconds." BullMQ is a job queue that sits on top of Redis. You register a repeating job for each service, and BullMQ fires it on schedule. If a check takes too long or crashes, BullMQ handles the retry. If your server restarts, the schedule picks back up automatically. Redis holds the queue state in memory so it is fast.

**The Polaroid camera is Playwright.** On each visit, the kid also snaps a photo of the stand. Playwright is a headless browser -- it opens a real Chrome window (with no screen), navigates to your URL, waits for the page to load, and takes a screenshot. This is how you get a visual confirmation that the app is not just returning 200 OK but actually rendering correctly. A blank white page still returns 200, but the screenshot would reveal the problem immediately.

**The walkie-talkie is the Notification System.** If the kid shows up and the stand is closed three times in a row, they radio you. That radio call is a notification -- an SMS to your phone via Twilio, an email via Resend, a Slack message via webhook. Three consecutive failures before alerting (not one) prevents you from getting woken up because of a single dropped packet or a momentary network hiccup.

**The bulletin board outside your house is the Public Status Page.** Anyone can walk by and see which stands are open, which are closed, and how reliable they have been over the last 90 days. They do not need a key to your house (no auth). It is a simple read-only view of the data the kid has been collecting.

**The office inside your house is the Admin Dashboard.** This is where you go to see the full picture: screenshots, response time graphs, GitHub build status, detailed logs. You need a key (auth) to get in because this has operational data you do not want public.

**The GitHub connection is like calling the lemonade supplier.** Separate from the bike route, you also check in with your supply chain. "Did the last batch of lemons arrive okay? (Did the latest deploy succeed?) Were there any problems with the delivery? (Are there build errors in CI?)" You do this by either polling the GitHub API every few minutes or by having GitHub call you via webhooks whenever something happens.

### How a request flows through the system

```
1. Clock strikes :00  -->  BullMQ fires a job for "Roast My Repo"
2. Check Runner picks up the job
3. Runner resolves DNS for roastmyrepo.dev         (records dns_time_ms)
4. Runner sends GET to https://roastmyrepo.dev      (records response_time_ms, status_code)
5. Runner inspects TLS certificate                   (records tls_valid, tls_expires_at)
6. Runner launches Playwright, screenshots the page  (saves to /screenshots/abc-123/latest.webp)
7. Runner writes one row to the `checks` table
8. Runner compares result to previous check:
   - Was it up before and still up?  -->  Do nothing.
   - Was it up before and now down?  -->  Increment failure counter.
     - 3 consecutive failures?       -->  Create incident, send SMS + Slack + email.
   - Was it down before and now up?  -->  Resolve incident, send recovery notification.
```

That is the whole system. Everything else -- the 90-day uptime bars, the response time charts, the incident timeline -- is just different ways of querying and displaying the data that accumulates in step 7.

---

## Core Concepts

**Service**: A single deployed application or API being monitored. Each service has a URL, a GitHub repo, and a set of health check rules.

**Check**: A single execution of a health check against a service. Produces a result (up/degraded/down), response time, status code, and optional screenshot.

**Incident**: An automatically or manually created record when a service transitions from healthy to unhealthy. Tracks duration, root cause notes, and resolution.

---

## Architecture

> **This project is built on the `template-express-next` monorepo template.** The template provides a production-ready pnpm workspace with Express 5 + TypeScript (server) and Next.js 15 App Router + React 19 (web-client), session-based auth, PostgreSQL via raw `pg` + `node-pg-migrate`, Zod validation, pino structured logging, a full middleware stack (helmet, cors, rateLimiter, csrfGuard, requestLogger, errorHandler, notFoundHandler), Vitest testing, ESLint + Prettier, lefthook git hooks, multi-stage Dockerfile, and GitHub Actions CI. All architectural decisions below build on top of — and must remain consistent with — the template's existing patterns. See the template README and CLAUDE.md for deployment specifics (e.g., Vercel root directory = `web-client/`).

### Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 22+ | Template standard; matches `engines` field |
| Package Manager | pnpm 9+ (workspaces) | Template standard; `server/` and `web-client/` packages |
| Framework (API) | Express 5 | Template provides full Express 5 setup with middleware stack |
| Database | PostgreSQL (raw `pg` + `node-pg-migrate`) | Template provides connection pool, query wrapper, transactions, migration CLI |
| Validation | Zod 4 | Template standard for request/schema validation |
| Logging | pino + pino-http | Template standard; structured JSON in prod, pretty-print in dev |
| Auth | Session-based (cookie + bcrypt + SHA-256 hashed tokens) | Template provides full auth flow (register, login, logout, session management) |
| Cache / Queue | Redis + BullMQ | **New dependency** — job scheduling for health checks, caching GitHub data |
| Screenshot Engine | Playwright | **New dependency** — headless Chromium for full-page captures |
| Frontend | Next.js 15 (App Router) + React 19 | Template provides Next.js setup with SCSS, `api.ts` fetch wrapper |
| Styling | SCSS (template default) + Tailwind CSS (add for dashboard) | Template uses SCSS; add Tailwind for component utility styling |
| Testing | Vitest + supertest | Template standard; co-located `.test.ts` files |
| Linting | ESLint + Prettier + lefthook | Template provides pre-commit (lint + format) and pre-push (test:coverage) hooks |
| CI/CD | GitHub Actions | Template provides CI pipeline (lint → format:check → test:coverage → build) |
| Deployment (API) | VPS (Railway, Render, Fly.io) or self-hosted | Template provides multi-stage Dockerfile; needs persistent process for BullMQ |
| Deployment (Web) | Vercel | Template provides Vercel deployment notes; set root directory to `web-client/` |

### Template Directory Structure (Starting Point)

```
├── CLAUDE.md                          # Claude Code project instructions (template)
├── Dockerfile                         # Multi-stage build (server + web targets)
├── lefthook.yml                       # Git hooks: pre-commit (lint, format), pre-push (test)
├── package.json                       # Root workspace: dev, build, lint, format, test scripts
├── pnpm-workspace.yaml                # Workspace packages: server, web-client
├── .github/workflows/ci.yml           # CI: lint → format:check → test:coverage → build
├── server/
│   ├── src/
│   │   ├── index.ts                   # Express app setup, middleware stack, graceful shutdown
│   │   ├── config/                    # corsConfig.ts, env.ts
│   │   ├── constants/                 # session.ts (cookie name, TTL)
│   │   ├── db/pool/                   # pool.ts (pg Pool, query wrapper, withTransaction)
│   │   ├── handlers/                  # Request handlers (auth/ provided)
│   │   ├── middleware/                # errorHandler, notFoundHandler, rateLimiter, requestLogger, requireAuth, csrfGuard
│   │   ├── repositories/             # Data access layer (auth/ provided)
│   │   ├── routes/                    # Route definitions (auth.ts provided)
│   │   ├── schemas/                   # Zod schemas (auth.ts provided)
│   │   ├── types/                     # express.d.ts (req.user augmentation)
│   │   └── utils/                     # logs/logger.ts, parsers/parseIdParam.ts, parsers/parsePagination.ts, tests/*
│   ├── migrations/                    # node-pg-migrate JS files (users, sessions provided)
│   ├── package.json                   # Express 5, pg, pino, zod, bcrypt, vitest, etc.
│   ├── tsconfig.json                  # Strict, path alias: app/* → src/*
│   └── vitest.config.ts
└── web-client/
    ├── src/
    │   ├── app/                        # Next.js App Router pages (layout, page, login, register, account)
    │   └── lib/                        # api.ts (fetch wrapper with CSRF), auth.ts (login/register/logout)
    ├── package.json                    # Next.js 15, React 19, SCSS
    ├── next.config.ts
    └── tsconfig.json
```

### What the Template Already Provides (Do Not Rebuild)

- **Full auth flow**: register, login, logout, session management, `requireAuth` middleware, password hashing, session token hashing, expired session cleanup
- **Database layer**: pg connection pool with instrumented query wrapper, `withTransaction()`, `node-pg-migrate` CLI
- **Middleware stack**: helmet, cors, rate limiting (global + per-route), CSRF guard, request logging (pino-http), centralized error handler, 404 handler, request timeout
- **Health endpoint**: `GET /health` with DB connectivity check and response caching
- **Validation pattern**: Zod schemas in `schemas/`, parsed in handlers
- **Utility parsers**: `parseIdParam()` (UUID validation), `parsePagination()` (limit/offset with bounds)
- **Test infrastructure**: Vitest, supertest, mock helpers (mockLogger, mockResult, responseHelpers, UUID fixtures)
- **CI/CD**: GitHub Actions, lefthook hooks, ESLint + Prettier
- **Dockerfile**: Multi-stage build for server and web-client targets
- **Frontend**: Next.js App Router with API client, auth helpers, SCSS global styles

### High-Level Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  BullMQ      │────▶│  Check Runner │────▶│  PostgreSQL  │
│  Scheduler   │     │  (HTTP + SSL  │     │  (results,   │
│  (cron jobs) │     │   + screenshot│     │   incidents,  │
│              │     │   + DNS)      │     │   metrics)    │
└─────────────┘     └──────┬───────┘     └──────┬──────┘
                           │                     │
                    ┌──────▼───────┐     ┌──────▼──────┐
                    │  GitHub API   │     │  API Server  │
                    │  (webhooks +  │     │  (REST)      │
                    │   polling)    │     └──────┬──────┘
                    └──────────────┘            │
                                        ┌──────▼──────┐
                                        │  Frontend    │
                                        │  (status pg  │
                                        │  + admin)    │
                                        └─────────────┘
```

---

## Data Model

### services

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | varchar(255) | Display name ("Roast My Repo", "Portfolio Site") |
| url | text | Primary URL to check |
| health_endpoint | text | Optional dedicated health route (e.g., `/api/health`) |
| github_owner | varchar(255) | GitHub org or user |
| github_repo | varchar(255) | Repository name |
| github_branch | varchar(100) | Branch to monitor (default: `main`) |
| check_interval_seconds | int | Default 60 |
| timeout_ms | int | Default 10000 |
| expected_status_code | int | Default 200 |
| screenshot_enabled | boolean | Default true |
| tags | text[] | Optional grouping ("production", "staging") |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### checks

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| service_id | uuid | FK to services |
| status | enum | `up`, `degraded`, `down` |
| status_code | int | HTTP response code |
| response_time_ms | int | Total request duration |
| dns_time_ms | int | DNS resolution time |
| tls_valid | boolean | Certificate validity |
| tls_expires_at | timestamptz | Certificate expiration |
| error_message | text | Null if healthy |
| screenshot_path | text | S3/local path to screenshot |
| raw_response_body | text | First 1KB of response (for health endpoint parsing) |
| checked_at | timestamptz | When the check ran |

**Retention policy**: Keep granular data for 30 days, roll up to hourly aggregates after that. Configurable.

### incidents

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| service_id | uuid | FK to services |
| status | enum | `investigating`, `identified`, `monitoring`, `resolved` |
| title | varchar(255) | Auto-generated or manual |
| cause | text | Root cause notes |
| started_at | timestamptz | First failing check |
| resolved_at | timestamptz | Null if ongoing |
| created_at | timestamptz | |

### github_status

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| service_id | uuid | FK to services |
| last_commit_sha | varchar(40) | |
| last_commit_message | text | |
| last_commit_author | varchar(255) | |
| last_commit_at | timestamptz | |
| workflow_name | varchar(255) | e.g., "CI / Deploy" |
| workflow_status | enum | `success`, `failure`, `pending`, `cancelled` |
| workflow_run_url | text | Link to GitHub Actions run |
| build_logs_excerpt | text | Last 2KB of failed build logs |
| updated_at | timestamptz | |

---

## API Design

Base path: `/api/v1`

### Public Endpoints (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/status` | Aggregate status of all services (the public status page data) |
| GET | `/status/:serviceId` | Single service status with recent checks |

### Authenticated Endpoints (admin)

| Method | Path | Description |
|---|---|---|
| GET | `/services` | List all services with current status |
| POST | `/services` | Register a new service |
| PUT | `/services/:id` | Update service config |
| DELETE | `/services/:id` | Remove a service |
| GET | `/services/:id/checks` | Paginated check history (cursor-based) |
| GET | `/services/:id/checks/latest` | Most recent check with screenshot URL |
| GET | `/services/:id/screenshot` | Redirect to latest screenshot image |
| POST | `/services/:id/check` | Trigger an immediate check |
| GET | `/services/:id/incidents` | Incident history |
| POST | `/services/:id/incidents` | Create manual incident |
| PUT | `/incidents/:id` | Update incident status/notes |
| GET | `/services/:id/github` | Latest GitHub status (commit, CI, logs) |
| GET | `/metrics` | System-wide metrics (avg response time, uptime percentages) |

### Response Shape: GET `/services/:id/checks/latest`

```json
{
  "service": {
    "id": "abc-123",
    "name": "Roast My Repo",
    "url": "https://roastmyrepo.dev",
    "status": "up"
  },
  "check": {
    "id": "chk-456",
    "status": "up",
    "statusCode": 200,
    "responseTimeMs": 342,
    "tlsValid": true,
    "tlsExpiresAt": "2026-09-15T00:00:00Z",
    "screenshotUrl": "/api/v1/services/abc-123/screenshot",
    "checkedAt": "2026-03-28T10:15:00Z"
  },
  "github": {
    "lastCommit": {
      "sha": "a1b2c3d",
      "message": "fix: handle empty repos gracefully",
      "author": "nullvoidundefined",
      "committedAt": "2026-03-27T18:30:00Z"
    },
    "ci": {
      "workflowName": "CI / Deploy",
      "status": "success",
      "runUrl": "https://github.com/nullvoidundefined/roast-my-repo/actions/runs/12345"
    }
  }
}
```

### Response Shape: GET `/status`

```json
{
  "overall": "operational",
  "services": [
    {
      "id": "abc-123",
      "name": "Roast My Repo",
      "url": "https://roastmyrepo.dev",
      "status": "up",
      "uptimePercent30d": 99.95,
      "responseTimeAvg30d": 287,
      "lastCheckedAt": "2026-03-28T10:15:00Z",
      "screenshotUrl": "/api/v1/services/abc-123/screenshot",
      "github": {
        "ciStatus": "success",
        "lastCommitAt": "2026-03-27T18:30:00Z"
      }
    }
  ],
  "activeIncidents": [],
  "uptimeHistory90d": [
    { "date": "2026-03-28", "uptimePercent": 100 },
    { "date": "2026-03-27", "uptimePercent": 99.8 }
  ]
}
```

---

## Health Check Runner

### What Gets Checked

Each scheduled check performs the following in sequence:

1. **DNS Resolution** -- Resolve the hostname, measure time. Failure here = `down`.
2. **HTTP(S) Request** -- `GET` to the configured URL (or health endpoint if set). Measure total response time.
3. **Status Code Validation** -- Compare against `expected_status_code`.
4. **TLS Certificate Inspection** -- Check validity and expiration date. Flag if expiring within 14 days.
5. **Response Body Parsing** (if health endpoint) -- Parse JSON response for granular sub-service status. Expected shape:

```json
{
  "status": "healthy",
  "version": "1.2.3",
  "uptime": 86400,
  "checks": {
    "database": { "status": "healthy", "latencyMs": 12 },
    "redis": { "status": "healthy", "latencyMs": 3 },
    "external_api": { "status": "degraded", "latencyMs": 2100, "message": "Slow responses" }
  }
}
```

6. **Screenshot Capture** (if enabled) -- Playwright loads the URL in headless Chromium, waits for network idle, captures a 1280x800 viewport screenshot. Stored as WebP for size efficiency.

### Status Logic

| Condition | Status |
|---|---|
| HTTP 200 + response < timeout + TLS valid | `up` |
| HTTP 200 but response > 80% of timeout, or TLS expiring in < 14d | `degraded` |
| Non-200 status, timeout, DNS failure, TLS expired, connection refused | `down` |

### Incident Auto-Creation

- Transition from `up` to `down`: create incident after **3 consecutive failures** (configurable). This avoids false alarms from transient blips.
- Transition from `down` to `up`: auto-resolve incident after **2 consecutive successes**.
- Transition to `degraded`: no auto-incident, but flag in dashboard.

---

## GitHub Integration

### Data Sources

1. **GitHub REST API (polling)** -- Poll every 5 minutes (or on-demand) for:
   - Latest commit on monitored branch
   - Latest GitHub Actions workflow run status
   - Build logs for failed runs (via the workflow run logs endpoint)

2. **GitHub Webhooks (preferred)** -- Register webhooks for real-time updates:
   - `push` -- new commits
   - `workflow_run` -- CI status changes
   - `deployment_status` -- deployment events

### What Gets Surfaced

| Data Point | Source | Display |
|---|---|---|
| Latest commit SHA, message, author, timestamp | Commits API / push webhook | Dashboard card |
| CI/CD pipeline status | Actions API / workflow_run webhook | Green check / red X / yellow spinner |
| Build error logs (excerpt) | Actions API (download logs) | Expandable panel on failure |
| Last successful deploy timestamp | deployment_status webhook | Dashboard card |
| Open issues count | Issues API | Badge (optional) |
| Last release tag | Releases API | Version badge |

### Authentication

Use a GitHub Personal Access Token (fine-grained, scoped to target repos) or a GitHub App installation token for org-level access. Store in environment variables, never in the database.

---

## Frontend

### Public Status Page (`/`)

The publicly accessible view. No auth required.

**Layout:**
- Header with project name/logo and overall status indicator
- Per-service cards, each showing:
  - Service name + link to live URL
  - Status indicator: green dot (up), yellow dot (degraded), red X (down)
  - Current response time
  - 90-day uptime bar (one cell per day, colored by uptime percentage)
  - Last checked timestamp
- Active incidents section (if any)
- Footer with "Powered by Deployments Health Check Dashboard" and last-updated timestamp

### Admin Dashboard (`/admin`)

Authenticated view for the service owner.

**Service Detail View:**
- Live screenshot (most recent capture, click to expand)
- Real-time status with all sub-checks (DNS, HTTP, TLS, response time)
- GitHub section:
  - Latest commit info
  - CI status badge with link to Actions run
  - Expandable build logs on failure
- Response time chart (last 24h, 7d, 30d toggleable)
- Uptime percentage (30d, 90d)
- Incident timeline
- Manual actions: trigger check, create incident, update incident

**Service List View:**
- Grid or list of all services with at-a-glance status
- Quick filters by tag, status
- Add/edit/remove services

**Settings:**
- Notification preferences (see below)
- Global defaults (check interval, timeout, screenshot toggle)
- GitHub token configuration
- Webhook endpoint display for GitHub setup

---

## Notifications

### Channels

| Channel | Trigger | Implementation | Priority |
|---|---|---|---|
| **SMS** | Incident created/resolved | Twilio Programmable SMS | **Primary** -- immediate alerting |
| Email | Incident created/resolved, TLS expiring, daily digest | Resend or Nodemailer | Secondary |
| Slack webhook | Incident created/resolved, CI failures | Incoming webhook POST | Team/logging |
| Discord webhook | Same as Slack | Incoming webhook POST | Optional |
| Push notification | Optional | Web Push API | Optional |

### SMS Implementation (Twilio)

**Why Twilio**: Industry standard for programmatic SMS. Free trial gives you enough credits to test. Production pricing is roughly $0.0079/message in the US, so even aggressive alerting costs pennies per month.

**Setup**:
1. Create a Twilio account and get a phone number
2. Store `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` as env vars
3. Store your personal phone number as `ALERT_PHONE_NUMBER`

**Message format** (keep it scannable on a lock screen):

```
[HEALTH] DOWN: Roast My Repo
3 consecutive failures since 10:15 UTC
Last status: 502 | Response: timeout
https://health.yourdomain.com/admin/services/abc-123
```

```
[HEALTH] RECOVERED: Roast My Repo
Back up at 10:18 UTC (3 min outage)
Status: 200 | Response: 287ms
```

**Rate limiting** (critical -- you do not want 400 texts in your sleep):
- After the initial incident SMS, suppress duplicate alerts for that service for 30 minutes
- If multiple services go down simultaneously (e.g., your VPS rebooted), send one consolidated SMS: `"[HEALTH] 3 services down: Roast My Repo, Portfolio, API"` rather than three separate messages
- Recovery messages are always sent (one per service) so you know things are back
- Configurable quiet hours (e.g., no SMS between 11pm-7am local time, batch and send summary at 7am). Off by default -- you probably want to know immediately

**Fallback chain**: If Twilio SMS delivery fails (rate limit, API error), fall back to email. Log the failure.

### Notification Rules

- Notify on incident creation (after confirmation threshold, not on first failure)
- Notify on incident resolution
- SMS is always the first channel attempted for down/recovery events
- Daily digest email with uptime summary (optional, email only)
- TLS expiration warning at 14 days and 7 days (email + SMS at 7 days)
- GitHub CI failure notification (optional, Slack/email only -- too noisy for SMS)

### Notification Preferences Table

Store per-channel preferences so you can toggle things without code changes:

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| channel | enum | `sms`, `email`, `slack`, `discord`, `push` |
| event_type | enum | `incident_created`, `incident_resolved`, `tls_warning`, `ci_failure`, `daily_digest` |
| enabled | boolean | Default true for SMS on incident events |
| quiet_hours_start | time | Null = no quiet hours |
| quiet_hours_end | time | |
| cooldown_minutes | int | Default 30 for SMS |

---

## Screenshot System

### Capture Strategy

- **Engine**: Playwright with Chromium
- **Viewport**: 1280x800 (desktop)
- **Format**: WebP (significantly smaller than PNG, good quality)
- **Wait strategy**: `networkidle` with a max wait of 15 seconds
- **Frequency**: Every check by default, or configurable to every Nth check to save resources
- **Storage**: Local filesystem initially, with an S3-compatible option (R2, MinIO) for production
- **Retention**: Keep last 50 screenshots per service, prune older ones via cron

### Screenshots in API

The `GET /services/:id/screenshot` endpoint serves the latest screenshot directly. The response includes `Last-Modified` and `Cache-Control` headers so browsers and CDNs can cache appropriately.

For the status page, screenshots load lazily and expand on click into a lightbox view.

---

## Non-Functional Requirements

### Performance

- Health checks must complete within the configured timeout (default 10s)
- Screenshot captures must complete within 20s
- API responses should be < 200ms for cached/simple queries
- Dashboard should load in < 2s on a reasonable connection

### Reliability

- The monitor itself should have its own health endpoint (`/api/health`)
- Missed checks (e.g., if the server restarts) should be detected and backfilled
- BullMQ handles job retries and failure tracking out of the box

### Security

- Admin routes behind session-based auth (template provides `requireAuth` middleware and full auth flow)
- CSRF protection via `X-Requested-With` header guard (template provides `csrfGuard` middleware)
- GitHub tokens stored as env vars, never exposed in API responses
- Rate limiting on public endpoints (template provides `rateLimiter` middleware with global and per-route variants)
- CORS configured for known frontends only (template provides `corsConfig`)
- Helmet middleware for HTTP security headers (template provides)
- Request timeout middleware (template provides 30s timeout)

### Data Retention

| Data | Retention | Rollup |
|---|---|---|
| Individual checks | 30 days | Hourly aggregates after 30d |
| Screenshots | Last 50 per service | Pruned via scheduled job |
| Incidents | Indefinite | None |
| GitHub status | Latest only | Previous overwrites stored in checks |
| Hourly aggregates | 1 year | Daily aggregates after 1 year |

---

## Implementation Phases

### Phase 1 -- Core Monitoring

- Service CRUD
- HTTP health check runner with BullMQ scheduling
- PostgreSQL storage for check results
- Basic API endpoints
- Simple status determination (up/down based on status code + timeout)

### Phase 2 -- Status Page + Dashboard

- Public status page with per-service cards and uptime bars
- Admin dashboard with service detail views
- Response time charts
- Session-based auth for admin

### Phase 3 -- Screenshots

- Playwright integration for screenshot capture
- Screenshot storage and serving
- Lazy loading and lightbox on frontend

### Phase 4 -- GitHub Integration

- GitHub API polling for commits and CI status
- Display in dashboard
- GitHub webhook receiver for real-time updates
- Build log extraction for failures

### Phase 5 -- Incidents + Notifications

- Auto-incident creation on confirmed outages
- Manual incident management
- SMS alerting via Twilio (primary channel)
- Additional notification channels (email, Slack, Discord)
- TLS expiration warnings

### Phase 6 -- Polish

- 90-day uptime history bars
- Daily digest emails
- Data retention and rollup jobs
- Responsive mobile view for status page
- Meta-monitoring (the dashboard's own health check)

---

## Open Questions

1. **Multi-region checks?** Checking from a single location is fine for solo use. Multi-region adds complexity (multiple runners, consensus on status). Defer unless needed.
2. **Custom health check scripts?** Beyond HTTP checks, some services might benefit from custom assertions (e.g., "response body contains X"). Worth considering as a Phase 2+ enhancement.
3. **Public incident updates?** Statuspage.io lets you post human-readable updates to incidents. Adds complexity but improves the public status page significantly.
4. **Subdomain per project vs. single page?** Single status page is simpler. Per-project status pages are fancier but probably unnecessary for a solo builder.
5. ~~**SSR vs. SPA for the status page?**~~ **Resolved**: Next.js 15 App Router (from template). SSR for the public status page, with client components where interactivity is needed.
6. ~~**Express or Fastify?**~~ **Resolved**: Express 5 (from template).
7. ~~**ORM choice?**~~ **Resolved**: Raw `pg` with `node-pg-migrate` (from template). No ORM — use the template's `query()` wrapper and `withTransaction()` utility.
8. ~~**Auth approach?**~~ **Resolved**: Session-based auth with httpOnly cookies (from template). The admin dashboard uses the existing auth flow.

---

## Reference: Industry Comparisons

| Feature | Betterstack | Checkly | Statuspage.io | This Project |
|---|---|---|---|---|
| HTTP checks | Yes | Yes | No (display only) | Yes |
| Screenshots | No | Yes | No | Yes |
| GitHub CI status | No | Yes (partial) | No | Yes |
| Build error logs | No | No | No | Yes |
| Public status page | Yes | No | Yes | Yes |
| Incident management | Yes | Yes | Yes | Yes |
| Multi-region | Yes | Yes | N/A | No (v1) |
| Self-hosted | No | No | No | Yes |
| Free | Freemium | Freemium | No | Yes |
