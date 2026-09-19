# P2: rule gaps

Gaps against the current rules or the template-fastapi-nuxt design. Source: `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`. Items without a ticket get one when they are picked up.

| Item                                                                                                 | Audit finding | Ticket  | Status  |
| ---------------------------------------------------------------------------------------------------- | ------------- | ------- | ------- |
| CI: aggregate `ci` check, integration job, drift and checklist gates, staged-only pre-commit         | 13            | IAN-135 | Backlog |
| Generate OpenAPI and client types from the Zod schemas, with a CI drift check                        | 10            |         | Backlog |
| One `{ data }` success envelope; a distinct forbidden error code                                     | 11            |         | Backlog |
| Dockerfiles for API, worker, and web; slim non-root images with HEALTHCHECK; compose waits on health | 12            |         | Backlog |
| Test that the rate limiter actually limits; refuse to start in production without `REDIS_URL`        | 14            |         | Backlog |
| Wire or delete the circuit breaker and R2 client; make the breaker per provider                      | 15            |         | Backlog |
| Timeouts and telemetry on every outbound client; honor `POSTHOG_HOST`; type analytics event names    | 16            |         | Backlog |
