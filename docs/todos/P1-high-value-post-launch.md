# P1: high value

Defects with a realistic trigger. Source: `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`.

| Item                                                                                                            | Audit finding | Ticket  | Status                                |
| --------------------------------------------------------------------------------------------------------------- | ------------- | ------- | ------------------------------------- |
| Stripe checkout and portal redirect to `/settings`, which has no page; no billing UI                            | 3             | IAN-131 | Done (PR #9, 543bd3b)                 |
| Browser calls the API cross-origin, so the web-side cookie gate fails on separate Railway hosts                 | 4             | IAN-132 | Backlog                               |
| Sentry initializes after Express loads and records the email; request ID not bound to a context; emails in logs | 5, 6, 9       | IAN-133 | Backlog                               |
| Worker loads dotenv too late and has no health probes; password-reset email is fire-and-forget                  | 7, 8          | IAN-134 | Backlog (dotenv order fixed by PR #8) |
