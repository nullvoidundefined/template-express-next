# Doppelscript: Feature Inventory

Extracted from codebase, migrations, routes, and commit history on 2026-04-09.

---

## Core Product

### Voice Profile System

The central concept of the product. Each user can create one or more named voice profiles. A voice profile accumulates writing style data from multiple sources and is used to guide post generation.

Voice profile configuration tabs:
- **Traits** - Personality and tone trait selections (e.g. analytical, warm, direct)
- **Patterns** - Writing pattern customization
- **Vocabulary** - Custom vocabulary the voice uses or avoids
- **Rules** - Free-form generation rules
- **Danger words** - Words or phrases to never include
- **Lifestyle facts** - 11 personal categories (religion, politics, family, hobbies, etc.) used to prevent the AI from hallucinating personal details that contradict the user's real life
- **Paste** - Analyze freeform pasted text samples to extract voice traits
- **Upload** - Upload PDF or DOCX corpus documents for voice analysis

Voice sources tracked:
- Corpus uploads (PDFs, DOCXs)
- Pasted text samples
- Platform post imports (LinkedIn, Twitter/X)
- Manual trait selections
- Voice examples

### Post Generator

Takes a topic, context, or brief and generates a LinkedIn post written in the user's voice profile style. Returns the full post in a single response (no streaming). Supports:
- Public generator (no login required) for marketing/demo purposes
- Authenticated generation using the user's saved voice profile
- Credit consumption per generation

### Inline Judge (async quality scoring)

A background evaluation step that scores generated posts for AI-detectable patterns. Claude 3.5 Haiku evaluates the output and stores results in `generation_judge_results`. Feature-flagged via `INLINE_JUDGE_ENABLED`. Provides a "make it less AI-sounding" refine path in the UI.

### Post History

All generations are stored and browsable in `/app/posts`. Users can review, copy, and reference past outputs.

---

## Data Ingestion

### Corpus Upload

Users upload PDF or DOCX documents as source material for voice analysis. Files are stored in Cloudflare R2. Parsed server-side using `pdf-parse` and `mammoth`. Credit cost scales with file size.

### Paste Analysis

Users paste raw text directly into the voice profile. Analyzed for writing style traits via the Anthropic API.

### Platform Import (LinkedIn, Twitter/X)

OAuth-connected platform accounts allow importing post history. Platform posts are analyzed for voice traits and stored in `platform_posts`. Sync state tracked in `platform_syncs`.

---

## Auth and Accounts

### Registration and Login

Custom session-based auth. SHA-256 hashed tokens, 7-day TTL, `sid` cookie. Email/password registration with bcrypt hashing.

### OAuth Accounts

OAuth login/registration via the `arctic` library. OAuth account records stored separately from core user records in `oauth_accounts` table, allowing linking multiple providers to one user.

### Password Reset

Time-limited reset tokens stored in `password_resets` table. Email sent via Resend with a reset link.

### Account Deletion

Full GDPR-compliant account deletion. User data removed or anonymized. Implemented on the `/app/settings` danger zone.

### Data Export

Users can request and download an export of their data. Route: `users.ts`.

### Connected Accounts

Settings page (`/app/settings/connected-accounts`) for managing linked social platform OAuth connections.

---

## Monetization

### Credit System

Credit-based usage model. Each generation costs a number of credits. Credits are stored as transactions in `credit_transactions`. Routes: `credits.ts`.

Balance visible in the UI via `CreditBalance` and `BalanceCard` components. Low-credit banner warns users when balance is low.

### Subscription Plans

Stripe subscriptions with recurring plans:
- Creator Monthly
- Creator Annual
- Pro Monthly
- Pro Annual

Stripe webhook handler processes subscription lifecycle events (`webhooks.ts`).

### One-Time Credit Packs

Users can also purchase credit packs (Starter, Builder, Creator) as one-time purchases via Stripe.

### Credits Page

`/app/credits` - pricing table and purchase flow.

---

## Growth and Community

### Referral Program

Users get a referral link. Signups via the link are tracked in the `referrals` table. Referral rewards (credits or other incentives) are granted on conversion. Landing page: `/referrals`. Dashboard card: `ReferralCard` component.

### Creator / Influencer Program

Influencer submissions tracked in `influencer_submissions` table. Creator verification tracked in `creator_verifications` table. Dedicated marketing page: `/creators`.

### Email Subscribers

Pre-launch and newsletter signups captured in `email_subscribers` table. Route: `emailSubscribe.ts`.

---

## Onboarding

### Setup Wizard

4-step guided onboarding flow at `/app/setup`. Walks new users through creating their first voice profile, connecting a platform, and running their first generation.

### Onboarding Route

Separate `/app/onboarding` section for post-registration guidance.

---

## Compliance and Safety

### Terms of Service

Full terms of service page at `/terms` (MDX).

### Privacy Policy

Full privacy policy at `/privacy` (MDX).

### Abuse Reporting

Public abuse report form at `/report-abuse`. Server route `abuse.ts` handles submissions.

### GDPR

Account deletion and data export features as described above.

---

## Marketing and Public Pages

| Page | Description |
|---|---|
| `/` | Landing page |
| `/analyze` | Public voice analyzer (no login) |
| `/pricing` | Pricing table |
| `/creators` | Creator/influencer program landing page |
| `/faq` | FAQ (MDX) |
| `/referrals` | Referral program landing page |
| `/blog` | Blog |
| `/blog/how-doppelscript-learns-your-voice` | Blog post |
| `/blog/the-words-we-ban` | Blog post about the em-dash and anti-slop rules |
| `/blog/why-your-linkedin-posts-sound-like-everyone-elses` | Blog post |

Includes `sitemap.ts` and `robots.ts` for SEO. OpenGraph image generation via `opengraph-image.tsx`.

---

## Infrastructure Features

### Background Job Processing

`ai_jobs` table and BullMQ workers handle async AI tasks (corpus analysis, inline judge scoring). Jobs are processed separately from the request lifecycle.

### Staging Environment

Full staging environment mirroring production. Separate Neon database, Railway services, Vercel preview, R2 bucket, Stripe test keys. Auto-deploys on push to `main`.

### Health Endpoint

`GET /health` returns 200 for Railway and deploy workflow health checks.

### Rate Limiting

`express-rate-limit` applied to API routes to prevent abuse.

### Analytics

PostHog events tracked server-side for key user actions.

### Error Monitoring

Sentry integrated on the server for runtime error capture and alerting.

---

## Developer Experience

### Bruno API Requests

Bruno request files for all API endpoints (Phase 0 deliverable).

### Git Hooks (lefthook)

Pre-commit hooks enforce:
- Em dash ban
- Format check (`pnpm format:check`)
- Lint (`pnpm lint --max-warnings=0`)
- Structure check (no Tailwind imports, no flat `.tsx` component files)
- Fix-commit gate (fix-prefixed commits must include a test file)

Pre-push hooks enforce:
- Format check
- Lint
- Server build
- Server test suite

### Evaluation Framework

`/eval` workspace for benchmarking voice analysis and generation quality.

### E2E Tests

Playwright tests in `/e2e` covering core user flows.
