# Re-claim failed and stale Stripe webhook events on redelivery

Branch: `fix/webhook-failed-event-retry`
Source: finding 1 (P0) of the 2026-09-19 engineering audit against the `template-fastapi-nuxt` design
Timing: branch created 13:39, fix committed 13:48 (about 10 minutes of implementation), this document written 8 minutes after the fix commit, per `git reflog`, `git log`, and `date`.

## Summary

The webhook handler records each Stripe event in `stripe_events` before processing it, so that a duplicate delivery is skipped. The claim was an `INSERT ... ON CONFLICT (event_id) DO NOTHING`, which meant any existing row blocked every later delivery. When processing failed, the handler marked the row `failed` and answered 500 so that Stripe would redeliver, but the redelivery then hit the conflict, answered 200, and the event was dropped permanently. A process that crashed after claiming left the row in `processing` with the same result. Both paths silently lost billing state changes, such as a subscription cancellation or a failed payment.

## What changed

- `apps/server/src/repositories/billingRepository.ts`: `claimStripeEvent` now uses `ON CONFLICT ... DO UPDATE ... WHERE`, re-claiming a row whose status is `failed`, or whose status is `processing` and whose `attempted_at` is more than ten minutes old. Processed rows and freshly claimed rows are still skipped. The stale window is the constant `STRIPE_EVENT_CLAIM_STALE_SECONDS`.
- `apps/server/migrations/1771879388551_add-stripe-events-attempted-at.js`: adds `attempted_at timestamptz NOT NULL DEFAULT NOW()`, the time of the latest claim. Existing rows receive the migration time, so a row stuck before the migration becomes re-claimable ten minutes after deploy.
- `apps/server/src/__tests__/integration/webhook-redelivery-flow.test.ts`: four cases against real Postgres, covering a new event claimed once, a processed event not re-claimed, a failed event re-claimed, and a stale processing claim re-claimed.

The webhook handler itself is unchanged: once the claim returns `true` for a redelivery, its existing control flow processes the event and marks it processed or failed.

## Architectural decisions

- **Conditional upsert rather than a read-then-write.** The alternative was to select the row and decide in TypeScript. That opens a race between two concurrent deliveries. `ON CONFLICT DO UPDATE` takes a row lock, and Postgres re-evaluates the `WHERE` clause against the committed row, so exactly one concurrent claimant wins. The reviewer confirmed this by running two simultaneous claims against a scratch database.
- **A new `attempted_at` column rather than reusing `processed_at`.** `processed_at` defaults to `NOW()` at claim time, so it could have served as the claim time with no migration. It was not reused because the name would then mean two things. Correcting `processed_at` to record completion only is left out of this PR's scope.
- **A ten-minute stale window.** A healthy handler finishes in seconds, and the webhook route is registered before the 30-second request-timeout middleware, so no timeout bounds it. Ten minutes leaves a wide margin before a live claim could be taken over, while still recovering well inside Stripe's multi-day retry schedule.
- **Repository-level integration test rather than a handler test.** The defect is in the SQL, which a fake `query` cannot exercise. A handler-level test with real signed payloads would need the frozen `env` module rebuilt with a webhook secret, which adds setup without testing anything the repository test misses.

## Testing

- RED: before the fix, the failed-event case failed with `expected false to be true`, and the stale case failed because `attempted_at` did not exist. The other two cases passed and act as regression guards.
- GREEN: integration suite 20 of 20 and unit suite 192 of 192 against a local Postgres 15; `tsc --noEmit`, ESLint, and Prettier clean; the migration's `down` then `up` round-trip verified.
- Local review: a fresh reviewer given only the diff reported no findings.
- Gap: CI does not run `test:integration`, so this test guards the fix only when run locally until an integration job is added (audit finding 13).

## Reflection

The first version of the stale-window comment justified ten minutes by the 30-second request timeout. Reading `app.ts` again showed the webhook route is registered before that middleware, so the timeout never applies to it; the comment was corrected before commit. The broader lesson is that the ledger's behaviour depended on the one path the unit tests could not reach. The existing webhook tests used a fake repository whose `claimStripeEvent` returned whatever the test told it to, so the redelivery defect was invisible to them by construction.
