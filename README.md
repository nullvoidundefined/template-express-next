# Deployments Health Check Dashboard

A self-hosted uptime monitoring and status page for your deployed projects. It continuously polls your services via HTTP health checks, captures screenshots with Playwright, tracks GitHub CI status, manages incidents, and sends SMS/email/Slack alerts — all from a single Express + Next.js monorepo backed by PostgreSQL and Redis.

## Architecture

```
web-client/   Next.js 15 (App Router) — public status page + admin dashboard
server/       Express 5 API — health check runner, BullMQ workers, REST endpoints
PostgreSQL    Persistent store for services, checks, incidents, aggregates, sessions
Redis         BullMQ job queues (health checks, GitHub polling, maintenance)
Playwright    Chromium-based screenshot capture (runs inside the server process)
```

## Local Development Setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker + Docker Compose

### Steps

1. Copy and fill in environment variables:
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env and set DATABASE_URL, REDIS_URL, SESSION_SECRET, etc.
   ```

2. Start PostgreSQL and Redis:
   ```bash
   docker-compose up -d postgres redis
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Install Playwright Chromium browser:
   ```bash
   npx playwright install chromium
   ```

5. Run database migrations:
   ```bash
   pnpm --filter server run migrate:up
   ```

6. Start the development servers:
   ```bash
   pnpm dev
   ```

The API server runs on `http://localhost:3000` and the web client on `http://localhost:3001` by default.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection URL |
| `SESSION_SECRET` | Yes | — | Secret for signing session cookies |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3000` | HTTP server port |
| `CORS_ORIGIN` | Prod | — | Allowed origin(s) for CORS (required in production) |
| `GITHUB_TOKEN` | No | — | GitHub PAT for private repo access and higher rate limits |
| `GITHUB_WEBHOOK_SECRET` | No | — | Secret for verifying GitHub webhook payloads |
| `TWILIO_ACCOUNT_SID` | No | — | Twilio account SID for SMS alerts |
| `TWILIO_AUTH_TOKEN` | No | — | Twilio auth token |
| `TWILIO_FROM_NUMBER` | No | — | Twilio phone number to send SMS from |
| `ALERT_PHONE_NUMBER` | No | — | Your phone number for alert SMS |
| `ALERT_EMAIL` | No | — | Your email address for alert emails |
| `SLACK_WEBHOOK_URL` | No | — | Slack incoming webhook URL |
| `RESEND_API_KEY` | No | — | Resend API key for transactional email |
| `SCREENSHOTS_DIR` | No | `./screenshots` | Directory to store Playwright screenshots |

## Deployment

### Server (Railway / Render / Fly.io)

The server requires both a PostgreSQL add-on and a Redis add-on. After provisioning:

1. Set all required environment variables in the platform dashboard.
2. Set `NODE_ENV=production`.
3. The `Dockerfile` `server` stage is the build target — point your platform to it.
4. Run migrations on first deploy: `pnpm --filter server run migrate:up`.

**Required production env vars:** `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `CORS_ORIGIN`, `NODE_ENV=production`

### Web Client (Vercel)

1. Import the repository into Vercel.
2. Set **Root Directory** to `web-client`.
3. Set the following environment variables:
   - `NEXT_PUBLIC_API_URL` — full URL to your deployed API server (e.g. `https://api.yourdomain.com`)
4. Deploy. Vercel auto-detects Next.js and uses the standalone output.

**Required production env vars:** `NEXT_PUBLIC_API_URL`
