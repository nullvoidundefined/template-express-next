# Session Handoff

Session of 2026-09-19 (template-express-next): an engineering audit of this template against the `template-fastapi-nuxt` design, tracked as Linear project template-express-next, then fixes for the two P0 findings and the first P1, plus the harness changes the work exposed. A parallel session shipped PR #7 (rate limiter test flake, IAN-151) the same day; its pending items are carried below.

## Last commit

- `543bd3b` "fix(billing): return Stripe customers to the dashboard, take the price from the server, and add billing actions (#9)" on `main`. This handoff lands in a docs-only PR after it.

## Production state

- Template repository; nothing deployed. `main` CI is green (build-and-test, e2e, docker-build, GitGuardian) for the first time since the initial commit; e2e now actually runs.

## Session metrics

- Merged PRs: 8 in this repository (#2 to #6, #8, #9; #7 came from the parallel session), plus agent-governance #73.
- Files changed on `main` since `1972385`: 127 (5,224 insertions, 518 deletions), including the 82-file import re-sort in #8.
- Rework: IAN-130 4 rounds, IAN-131 2, IAN-138 1, IAN-137 2.
- Velocity flag: SLOW on review overhead. Codex was out of quota all session (reset 2026-09-21 02:26), so every test came from the `test-author` agent and every R-517 review from a Fable subagent.

## What shipped

- Audit and tracking: `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md` (18 findings) and `docs/todos/P0` to `P3` with ticket keys (#4).
- Red `main` fixed: stale web test imports and the e2e seed script (IAN-129, IAN-136; #2).
- Audit P0 1, Stripe webhooks: failed and stale events are re-claimed on redelivery (IAN-128, #3), and completion writes are fenced by a claim attempt (IAN-138, #5).
- Audit P0 2, idempotency: claim before the handler, release on 5xx, timeout, or disconnect; 409 while running; 422 on reuse for a different request; settled before any response is flushed (IAN-130, #6, criteria I-1 to I-21).
- Audit P1 3, billing: Stripe returns to `/dashboard?checkout=...`; the price comes from `STRIPE_PRICE_ID` only; dashboard Upgrade and Manage billing actions; `--error` token meets WCAG AA (IAN-131, #9).
- Tooling: workspace Prettier import groups aligned with the harness `import-x/order` gate, which also fixed the worker's dotenv load order (IAN-154, #8).
- Harness (agent-governance #73, IAN-137): R-518 opens a draft PR on a branch's first push and tells the session to turn on the PR monitor. Now live.

## Pending

- High, about 1.5 hours: IAN-132, route every browser API call through the same-origin proxy. Copilot's thread on PR #9 stays open until this lands.
- High, about 2 hours each: IAN-133 (Sentry preload, request-ID context, no email in logs) and IAN-134 (worker probes, graceful shutdown, reset email as a job; the dotenv order is fixed).
- Medium, about 1.5 hours: IAN-135, CI integration job and aggregate `ci` check. Until then the integration suites guard only locally.
- Medium, about 1 hour: `tdd.sh` cannot run Vitest in pnpm workspaces or this repo's separate integration config (carried from the parallel session; no ticket yet).
- Low, about 45 minutes: IAN-150 (idempotency hold hardening) and the remaining P2 rows added today, among them Stripe event ordering, the Toast story import, and the OpenAPI lint debt.
- Owner: add the Stripe block to `apps/server/.env.example` (text in PR #9's body; the harness blocks agent edits to `.env*` files).
- Owner: the task chip for Codex being blocked by the R-907 test-author guard inside its own process.

## Next session

1. IAN-132: read `apps/client/web/src/services/apiService.ts`, `apps/client/web/src/app/api/[...path]/route.ts`, `apps/server/src/app.ts` (`trust proxy`, rate limiter keying), and section 4 of the audit.
2. Before starting, check `codex login status` and the quota; if Codex is available, it writes the tests (R-907) and runs the R-517 review.
3. Recreate the local test database if a migration was edited on a branch: `template_express_next_test` on the Homebrew Postgres at 127.0.0.1:5432 (the Docker container is shadowed on that port).
