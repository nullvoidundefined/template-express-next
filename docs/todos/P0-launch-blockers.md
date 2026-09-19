# P0: launch blockers

Correctness or security defects that ship in every fork. Source: `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`. Linear project: template-express-next.

| Item | Audit finding | Ticket | Status |
|---|---|---|---|
| Web state store tests import renamed modules, so `main` CI is red and e2e never runs | Found while pushing IAN-128 | IAN-129 | In review (PR #2) |
| Failed and stale Stripe webhook events are never re-claimed on redelivery | 1 | IAN-128 | In review, waiting on IAN-129 |
| Idempotency middleware caches 5xx responses, races on concurrent retries, and does not bind keys to one request | 2 | IAN-130 | Backlog |
