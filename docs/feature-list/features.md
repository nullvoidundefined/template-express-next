# Feature List

All user-facing features shipped in this boilerplate.

All application API routes below are served under the `/v1` prefix (e.g. `POST /v1/auth/register`); the `Routes` column omits it for brevity. Health checks (`/health`, `/health/ready`) and the Stripe webhook (`/webhooks/stripe`) stay at root.

## Auth

| Feature          | Routes                       | Notes                                                                      |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Register         | `POST /auth/register`        | bcrypt 12 rounds; SHA-256 session token; 409 on duplicate email            |
| Login            | `POST /auth/login`           | Returns session cookie; does not distinguish wrong email vs wrong password |
| Logout           | `POST /auth/logout`          | Always 204; clears session cookie and DB row                               |
| Get current user | `GET /auth/me`               | Requires auth; returns `{ user }`                                          |
| Update profile   | `PATCH /auth/me`             | Verifies `currentPassword` before hashing and saving `newPassword`         |
| Forgot password  | `POST /auth/forgot-password` | Always 200; fire-and-forget email via Resend; prevents user enumeration    |
| Reset password   | `POST /auth/reset-password`  | Validates token, updates password hash, invalidates all sessions           |

## Posts (sample resource)

| Feature     | Routes              | Notes                                                                            |
| ----------- | ------------------- | -------------------------------------------------------------------------------- |
| Create post | `POST /posts`       | Requires auth; `validate(createPostSchema)`; returns `{ data }` (201)            |
| List posts  | `GET /posts`        | Requires auth; user-scoped; paginated `{ data, meta: { limit, offset, total } }` |
| Get post    | `GET /posts/:id`    | Requires auth; user-scoped; 404 `POSTS_NOT_FOUND` for missing or non-owned       |
| Update post | `PUT /posts/:id`    | Requires auth; user-scoped; `validate(updatePostSchema)`; 404 when not owned     |
| Delete post | `DELETE /posts/:id` | Requires auth; user-scoped; 204 on success, 404 when not owned                   |

## Web client

| Feature              | Route              | Notes                                                           |
| -------------------- | ------------------ | --------------------------------------------------------------- |
| Login page           | `/login`           | Shows reset-success banner on `?reset=true`                     |
| Register page        | `/register`        |                                                                 |
| Forgot password page | `/forgot-password` | Shows submitted state after request sent                        |
| Reset password page  | `/reset-password`  | Reads `?token=` from URL; client-side password match validation |
| Dashboard            | `/dashboard`       | Auth-guarded via `(protected)` layout                           |

## Observability

| Feature               | Where        | Notes                                                                                                                                       |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| PostHog analytics     | Server + web | Server: `trackEvent` on all 6 auth events. Web: pageview tracking, identify on login/register, reset on logout. Reverse proxy at `/ingest`. |
| Sentry error tracking | Server + web | Server: `expressErrorHandler` + Sentry user context on session load. Web: client/server/edge configs via `instrumentation.ts`.              |

## Infrastructure

| Feature                | Notes                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Custom session cookies | `sid` cookie; SHA-256 hash in DB; 7-day TTL; `httpOnly`, `SameSite: lax`                          |
| CSRF protection        | Header-only (`X-Requested-With: XMLHttpRequest`); no token endpoint                               |
| Rate limiting          | Auth endpoints gated by `authRateLimiter`                                                         |
| Session cleanup        | Background interval deletes expired sessions hourly                                               |
| Health endpoints       | `GET /health` (liveness), `GET /health/ready` (DB connectivity)                                   |
| Password reset emails  | Resend SDK; lazy-initialized; no-op without `RESEND_API_KEY`                                      |
| Idempotency keys       | `Idempotency-Key` header replays the stored response for authenticated POST/PUT within 24h        |
| Scheduled cleanup      | pg_cron hourly prune of expired sessions + stale idempotency keys; silently skips without pg_cron |
| OpenAPI spec           | `apps/server/docs/openapi.yaml` (OpenAPI 3.1) documents all `/v1` routes + `{ code, error }`      |
| Analytics constants    | `@repo/constants` package with typed `ANALYTICS_EVENTS`                                           |
| Integration tests      | `pnpm --filter @template/server run test:integration`; skips without `DATABASE_URL`               |
