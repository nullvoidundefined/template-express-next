# Doppelscript: Full Stack Reference

Extracted from codebase and commit history on 2026-04-09.

---

## Runtime & Deployment

| Layer | Technology |
|---|---|
| Backend hosting | Railway |
| Frontend hosting | Vercel |
| Database hosting | Neon (PostgreSQL) |
| Secrets management | GCP Secret Manager |
| Object storage | Cloudflare R2 |
| Background jobs | BullMQ on Railway |
| Cache / job broker | Redis (ioredis) |
| CI/CD | GitHub Actions (`.github/workflows/`) |
| Package manager | pnpm workspaces |

Two fully isolated environments: **staging** (`staging.doppelscript.com` / `staging-api.doppelscript.com`) auto-deploys on push to `main`; **production** (`www.doppelscript.com` / `api.doppelscript.com`) is manual via `workflow_dispatch` with repo-owner approval gate.

---

## Backend (server/)

| Category | Technology / Package |
|---|---|
| Framework | Express 5 |
| Language | TypeScript 5.9 |
| Runtime executor | tsx |
| Schema validation | Zod 4 |
| Logging | Pino + pino-http |
| Error tracking | Sentry (`@sentry/node`) |
| Database driver | pg (raw SQL, no ORM) |
| Migrations | node-pg-migrate (ESM) |
| Job queue | BullMQ |
| Redis client | ioredis |
| AI / LLM | Anthropic SDK (`@anthropic-ai/sdk`) |
| Payments | Stripe |
| Email | Resend |
| File storage (S3-compatible) | `@aws-sdk/client-s3` (Cloudflare R2) |
| PDF parsing | pdf-parse |
| DOCX parsing | mammoth |
| Password hashing | bcrypt |
| Security headers | helmet |
| CORS | cors |
| Rate limiting | express-rate-limit |
| Cookie parsing | cookie-parser |
| OAuth library | arctic |
| Analytics | PostHog (`posthog-node`) |
| Voice judge package | `@doppelscript/voice-judge` (local workspace) |

### Auth

Custom cookie-based sessions. SHA-256 hashed tokens, 7-day TTL, cookie name `sid`. CSRF protection via header-only pattern (`X-Requested-With: XMLHttpRequest`). Password reset with time-limited tokens.

### AI Configuration

- Generator: `messages.create()` only (never `messages.stream()`). No SSE, no chunked text.
- Claude 3.5 Sonnet for post generation and corpus analysis.
- Claude 3.5 Haiku for async inline judge scoring.

---

## Frontend (web-client/)

| Category | Technology / Package |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI library | React 19 |
| Styling | SCSS Modules + Sass |
| Component primitives | Radix UI (alert-dialog, dropdown-menu, tabs, toast, tooltip) |
| Server state | TanStack Query v8 |
| Virtualization | TanStack Virtual |
| MDX support | `@mdx-js/loader`, `@mdx-js/react`, `@next/mdx` |
| Markdown rendering | react-markdown + remark-gfm |
| Unit testing | Vitest + React Testing Library + `@testing-library/user-event` |
| E2E testing | Playwright |

Note: Tailwind is present in `package.json` for the web client (`tailwindcss@^4.2.2`) but SCSS Modules is the intended styling system per conventions. Components follow per-folder structure with `displayName` and `data-test-id` on every component.

---

## Monorepo Workspaces

```
/
  server/          Express API + background worker
  web-client/      Next.js frontend
  extension/       Chrome/browser extension
  packages/        Shared packages (voice-judge, etc.)
  eval/            Evaluation/testing framework
  e2e/             Playwright end-to-end tests
```

---

## External Services Summary

| Service | Purpose |
|---|---|
| Anthropic Claude API | Post generation, voice analysis, inline judge |
| Stripe | Subscriptions (Creator, Pro) + one-time credit packs |
| Resend | Transactional email |
| PostHog | Product analytics |
| Sentry | Error tracking (server-side) |
| Neon | Managed PostgreSQL |
| Cloudflare R2 | Corpus file storage (PDFs, DOCXs) |
| Railway | API server + BullMQ worker hosting |
| Vercel | Frontend hosting |
| GCP Secret Manager | Secrets for all Railway services |
| LinkedIn API | OAuth import + platform post sync |
| Twitter/X API | Platform post sync |

---

## Key Conventions

- No em dashes (U+2014) anywhere in the codebase.
- Named exports only (`export { Name }` at end of every file, never `export default`).
- Alphabetical ordering on all type keys, object keys, JSX props, imports.
- No token streaming in user-facing AI output.
- Test-first bug fixes: failing test -> fix -> green -> commit.
- Forward-only database migrations (never run `down` in production).
- Staging-first promotion: every change goes to staging before production.
- Commit after every task; deploy after every phase.
