# P2: rule gaps

Gaps against the current rules or the template-fastapi-nuxt design. Source: `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`. Items without a ticket get one when they are picked up.

| Item                                                                                                                                   | Audit finding       | Ticket  | Status                |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------- | --------------------- |
| CI: aggregate `ci` check, integration job, drift and checklist gates, staged-only pre-commit                                           | 13                  | IAN-135 | Backlog               |
| Generate OpenAPI and client types from the Zod schemas, with a CI drift check                                                          | 10                  |         | Backlog               |
| One `{ data }` success envelope; a distinct forbidden error code                                                                       | 11                  |         | Backlog               |
| Dockerfiles for API, worker, and web; slim non-root images with HEALTHCHECK; compose waits on health                                   | 12                  |         | Backlog               |
| Test that the rate limiter actually limits; refuse to start in production without `REDIS_URL`                                          | 14                  |         | Backlog               |
| Wire or delete the circuit breaker and R2 client; make the breaker per provider                                                        | 15                  |         | Backlog               |
| Timeouts and telemetry on every outbound client; honor `POSTHOG_HOST`; type analytics event names                                      | 16                  |         | Backlog               |
| Order Stripe webhook events by `created`, so an older event arriving late cannot overwrite newer subscription state                    | Noted in PR #5      |         | Backlog               |
| Harden the idempotency response hold: replay redirect Location, catch a held send that throws, drop a second end during a hold         | Review of PR #6     | IAN-150 | Backlog               |
| Move data-aware billing components out of `components/` (convention: atomic, prop-driven) and share error codes between server and web | Review of PR #9     |         | Backlog               |
| Announce the billing return banner on arrival (focus or heading), since a status region present at load is not announced               | Review of PR #9     |         | Backlog               |
| Fix the pre-existing OpenAPI lint errors (3.0 `nullable` in a 3.1 file; public routes without `security`)                              | Found during PR #6  |         | Backlog               |
| Fix the Toast story's stale `../../../state/useToast` import, which likely breaks the Storybook build                                  | Found during PR #9  |         | Backlog               |
| Add the Stripe block to `apps/server/.env.example` (the harness blocks agent edits to `.env*`; text in PR #9's body)                   | PR #9               |         | Owner                 |
| Group node built-ins and path-alias imports to match the harness import gate                                                           | Found pushing PR #9 | IAN-154 | Done (PR #8, 078dc4f) |
