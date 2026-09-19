# P0: launch blockers

Correctness or security defects that ship in every fork. Source: `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`. Linear project: template-express-next.

| Item | Audit finding | Ticket | Status |
|---|---|---|---|
| Web state store tests import renamed modules, so `main` CI is red and e2e never runs | Found while pushing IAN-128 | IAN-129 | Done (PR #2, 6463faf) |
| E2E seed script imports modules from an older layout | Found by the first e2e run | IAN-136 | Done (PR #2, 6463faf) |
| Failed and stale Stripe webhook events are never re-claimed on redelivery | 1 | IAN-128 | Done (PR #3, 82df324) |
| Idempotency middleware caches 5xx responses, races on concurrent retries, and does not bind keys to one request | 2 | IAN-130 | Backlog |
