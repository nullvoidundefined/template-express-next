# template-express-js

Minimal Express 5 + TypeScript + PostgreSQL starter API with authentication, security middleware, logging, and testing preconfigured.

## Prerequisites

- Node.js 22+
- PostgreSQL (e.g. [Neon](https://neon.tech), or local)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL
npm run migrate:up
```

### Environment variables

| Variable                           | Required   | Default                 | Description                                  |
| ---------------------------------- | ---------- | ----------------------- | -------------------------------------------- |
| `DATABASE_URL`                     | Yes        | —                       | PostgreSQL connection string                 |
| `PORT`                             | No         | `3000`                  | Server port                                  |
| `CORS_ORIGIN`                      | Production | `http://localhost:5173` | Allowed origin for CORS                      |
| `NODE_ENV`                         | No         | `development`           | `development` or `production`                |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No         | —                       | Set to `false` to skip SSL cert verification |

## Scripts

| Command                    | Description                                |
| -------------------------- | ------------------------------------------ |
| `npm run dev`              | Run with hot reload (`tsx watch`)          |
| `npm run build`            | Compile TypeScript to `dist/`              |
| `npm start`                | Run compiled app (`node dist/index.js`)    |
| `npm run migrate:up`       | Apply pending migrations                   |
| `npm run migrate:down`     | Roll back one migration                    |
| `npm test`                 | Run unit tests                             |
| `npm run test:watch`       | Run tests in watch mode                    |
| `npm run test:coverage`    | Run tests with coverage (80% threshold)    |
| `npm run test:integration` | Run integration tests (real DB; see below) |
| `npm run lint`             | Lint source                                |
| `npm run lint:fix`         | Lint and auto-fix                          |
| `npm run format:check`     | Check formatting (Prettier)                |
| `npm run format`           | Format code                                |

## Architecture

```
Routes → Handlers → Repositories → Database (pg)
```

- **Routes** define endpoints and wire up middleware/validation.
- **Handlers** contain business logic and call repositories.
- **Repositories** execute parameterized SQL queries against the connection pool.
- **Validation** is handled by Zod schemas on incoming request bodies.

Path aliases use `app/*` → `src/*` (configured in `tsconfig.json`, resolved at build time by `tsc-alias`).

## API

Base URL: `http://localhost:3000` (or your `PORT`).

All error responses use the shape `{ error: { message: string } }`.

### Health

- **`GET /health`** — Returns `{ status: "ok", db: "connected" }` or `{ status: "degraded", db: "disconnected" }`.

### Authentication

Auth routes are **not** behind `requireAuth`. Sessions are cookie-based (`sid`, HTTP-only, 7-day TTL).

| Method | Path             | Description                                             |
| ------ | ---------------- | ------------------------------------------------------- |
| `POST` | `/auth/register` | Register (body: `email`, `password`); sets `sid` cookie |
| `POST` | `/auth/login`    | Login (body: `email`, `password`); sets `sid` cookie    |
| `POST` | `/auth/logout`   | Logout; clears session                                  |
| `GET`  | `/auth/me`       | Get current user (requires auth)                        |

Auth endpoints (`/auth/register`, `/auth/login`) are rate-limited to **10 requests per 15 minutes** per IP.

### Extending the API

This template ships without domain-specific resources. To add your own (e.g. `entities`), follow the existing patterns:

- Add Zod schemas under `src/schemas/` (for example, start from `entity.ts`).
- Add repository functions under `src/repositories/` to talk to PostgreSQL.
- Add handlers under `src/handlers/` and wire them up via routers in `src/routes/`.

## Security

| Layer              | Details                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| **Helmet**         | Sets security headers (XSS, clickjacking, MIME sniffing, etc.)                        |
| **CORS**           | Credentials enabled; origin controlled via `CORS_ORIGIN`                              |
| **CSRF**           | State-changing requests require `X-Requested-With` header (any value); 403 without it |
| **Rate limiting**  | 100 req / 15 min globally; 10 req / 15 min on auth endpoints                          |
| **Authentication** | Cookie-based sessions; tokens hashed with SHA-256 before storage                      |
| **Passwords**      | Hashed with bcrypt (10 rounds)                                                        |
| **Body limits**    | JSON and URL-encoded payloads capped at 10 KB                                         |
| **Timeouts**       | 30-second request timeout                                                             |

## Logging

Structured logging via [Pino](https://github.com/pinojs/pino).

- **Production:** JSON output, `info` level.
- **Development:** Pretty-printed, `debug` level.
- Request/response logging via `pino-http` with auto-generated request IDs (`x-request-id`).
- Database queries are logged with duration in non-production environments.

## Git hooks

Pre-commit and pre-push hooks are managed via [Lefthook](https://github.com/evilmartians/lefthook).

- **Pre-commit:** lint, format check (parallel).
- **Pre-push:** test with coverage.

## Testing

Unit tests mock the database layer; integration tests run the full stack against a real PostgreSQL instance.

- **Framework:** Vitest
- **Coverage:** v8 provider, 80% threshold on branches/functions/lines/statements
- **HTTP assertions:** supertest

### Integration tests

- Use a **separate test database** (e.g. a Neon branch or a local `template_express_test`). Set `DATABASE_URL` so integration tests never touch dev/prod data.
- Apply migrations before running: `npm run migrate:up`.
- Run with `npm run test:integration`.

**CI:** Set `DATABASE_URL` to a dedicated test DB and run migrations before `npm run test:integration`. Keep the test DB short-lived if possible (e.g. a Neon branch that gets reset or dropped after the run).
