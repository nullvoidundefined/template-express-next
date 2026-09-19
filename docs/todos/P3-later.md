# P3: hygiene

Source: `docs/audits/2026-09-19-fastapi-nuxt-parity-audit.md`.

| Item                                                                              | Audit finding    | Ticket | Status  |
| --------------------------------------------------------------------------------- | ---------------- | ------ | ------- |
| Rename tables per R-334 (`user_sessions`, `billing_webhook_events`, and so on)    | 17               |        | Backlog |
| Drop the unused required `SESSION_SECRET`                                         | 18               |        | Backlog |
| Gate database SSL on the environment rather than on `DATABASE_CA_CERT` presence   | 18               |        | Backlog |
| Move session and idempotency cleanup out of every API replica into one worker job | 18               |        | Backlog |
| Check the reset token before hashing the new password                             | 18               |        | Backlog |
| Give readiness its own connection instead of the shared pool                      | 18               |        | Backlog |
| Make `stripe_events.processed_at` record completion, not the claim time           | Noted in IAN-128 |        | Backlog |
