# Server Conventions

Auto-loaded when working in `server/`. The root `../CLAUDE.md` non-negotiable rules still apply; these rules layer on top for backend and database work. If a rule in this file and the root file appear to conflict, the root file wins and the conflict is a bug to file.

---

## Backend Conventions

Applies to all `server/` code.

### Stack

- Express 5 plus TypeScript on Railway.
- PostgreSQL on Neon via `pg` driver. Raw SQL, no ORM.
- Zod for request validation and type derivation.
- Pino for structured logging.
- Redis (ioredis) where needed.
- Anthropic Claude API for LLM calls (if applicable).

### Directory Structure

```
src/
├── index.ts                      # Express app entry point
├── config/                       # Configuration modules
│   ├── env.ts                    # Environment helpers (isProduction, etc.)
│   └── corsConfig.ts             # CORS middleware config
├── constants/                    # Hard-coded constants
│   └── session.ts
├── db/
│   └── pool/
│       └── pool.ts               # PostgreSQL pool + query wrapper + transaction helper
├── handlers/                     # HTTP request handlers (thin: validate, delegate, respond)
│   ├── auth/
│   │   └── auth.ts
│   └── jobs/
│       └── jobs.ts
├── middleware/
│   ├── csrfGuard/
│   │   └── csrfGuard.ts
│   ├── errorHandler/
│   │   └── errorHandler.ts
│   ├── notFoundHandler/
│   │   └── notFoundHandler.ts
│   ├── rateLimiter/
│   │   └── rateLimiter.ts
│   ├── requestLogger/
│   │   └── requestLogger.ts
│   └── requireAuth/
│       └── requireAuth.ts
├── repositories/                 # Data access layer (all SQL lives here)
│   ├── auth/
│   │   └── auth.ts
│   └── jobs/
│       └── jobs.ts
├── routes/                       # Express router definitions
│   ├── auth.ts
│   └── jobs.ts
├── schemas/                      # Zod schemas + derived TypeScript types
│   ├── auth.ts
│   └── job.ts
├── services/                     # Business logic layer
│   └── example.service.ts
├── types/                        # TypeScript ambient declarations
│   └── express.d.ts
└── utils/
    └── logs/
        └── logger.ts             # Pino logger instance
```

### Layer Responsibilities

| Layer        | Does                                                                | Does NOT                                   |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| Handlers     | Validate input (Zod), call services or repos, return HTTP responses | Contain business logic, run SQL            |
| Services     | Orchestrate business logic, call repos, call external APIs          | Parse HTTP requests, return HTTP responses |
| Repositories | Run parameterized SQL queries, return typed results                 | Know about HTTP, validate input            |
| Middleware   | Cross-cutting concerns (auth, logging, CORS, rate limiting)         | Contain business logic                     |

Never skip layers. Handlers call services or repositories. Repositories never call handlers.

### File Naming (Backend)

| What         | Convention               | Example                        |
| ------------ | ------------------------ | ------------------------------ |
| Middleware   | `camelCase/camelCase.ts` | `errorHandler/errorHandler.ts` |
| Routes       | `kebab-case.ts`          | `auth.ts`, `jobs.ts`           |
| Handlers     | `kebab-case.ts`          | `jobs.ts`                      |
| Repositories | `kebab-case.ts`          | `jobs.ts`, `auth.ts`           |
| Services     | `kebab-case.service.ts`  | `example.service.ts`           |
| Schemas      | `kebab-case.ts`          | `job.ts`                       |
| Utils        | `camelCase.ts`           | `parsePagination.ts`           |
| Constants    | `camelCase.ts`           | `session.ts`                   |

### Import Ordering (Backend)

```typescript
// 1. Environment setup (always first if present)
// 4. Local imports by layer (config, db, middleware, repos, schemas, services, utils)
import { corsConfig } from 'app/config/corsConfig.js';
import { query } from 'app/db/pool/pool.js';
import * as jobsRepo from 'app/repositories/jobs/jobs.js';
import type { Job } from 'app/schemas/job.js';
import { logger } from 'app/utils/logs/logger.js';
import 'dotenv/config';
// 3. Third-party packages (alphabetical)
import type { Request, Response } from 'express';
import express from 'express';
// 2. Node builtins (alphabetical)
import crypto from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
```

- Use the `type` keyword for type-only imports.
- Use `app/*` path alias mapping to `src/*`. Never relative `../../` beyond one level.
- All local imports end with `.js` extension (ESM resolution).

### Entry Point Pattern

Every backend has two files at the entry point.

`src/index.ts` loads secrets or env, then dynamically imports app code:

```typescript
// Load env / secrets before any app modules initialize
import 'dotenv/config';

await import('app/app.js');
```

`src/app.ts` creates and starts the Express server:

```typescript
import express from 'express';
import http from 'node:http';

export const app = express();
// ... middleware and routes

const port = Number(process.env.PORT) || 3001;
const server = http.createServer(app);
server.listen(port, () => {
  logger.info({ port }, 'Server started');
});
```

This two-file pattern ensures any secrets or config are populated in `process.env` before SDK clients are constructed.

### Build Tool

All backends build with `tsc` plus `tsc-alias`:

```json
{
  "scripts": {
    "build": "tsc && tsc-alias",
    "start": "node dist/index.js"
  }
}
```

- Never use `tsup`. It bundles to a single file and breaks the `app/*` path alias resolution at runtime.
- `tsc-alias` rewrites `app/*` path aliases in compiled output so `node dist/index.js` resolves correctly.

### Health Endpoints

```typescript
// Fast liveness check. Always returns 200.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness check. Verifies DB connectivity.
app.get('/health/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});
```

- `/health` is Railway's healthcheck path (fast, no DB call).
- `/health/ready` is used for smoke tests after deploy.
- Register these routes before all application routes and before `notFoundHandler`.

### Environment Validation

Every server validates required env vars at startup. In production, `CORS_ORIGIN` must be set:

```typescript
export function validateEnv() {
  const required = ['DATABASE_URL', 'SESSION_SECRET'];
  if (isProduction()) {
    required.push('CORS_ORIGIN');
  }
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
```

Call `validateEnv()` at the top of `app.ts`, before any middleware registration.

### Express App Structure

Middleware is applied in this exact order:

```typescript
app.set('trust proxy', 1);
app.use(helmet());
app.use(corsConfig);
app.use(requestLogger);
app.use(rateLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(csrfGuard);
app.use(loadSession);

// Routes
app.use('/auth', authRouter);
app.use('/jobs', jobsRouter);

// Error handlers (always last)
app.use(notFoundHandler);
app.use(errorHandler);
```

### Router Pattern

```typescript
import * as jobHandlers from 'app/handlers/jobs/jobs.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const jobsRouter = express.Router();

jobsRouter.use(requireAuth);
jobsRouter.get('/', jobHandlers.listJobs);
jobsRouter.post('/', jobHandlers.createJob);
jobsRouter.get('/:id', jobHandlers.getJob);
jobsRouter.put('/:id', jobHandlers.updateJob);
jobsRouter.delete('/:id', jobHandlers.deleteJob);

export { jobsRouter };
```

- Import handlers with `import * as` namespace import.
- Apply auth middleware at the router level, not per route.
- Named export for the router.

### Handler Pattern

```typescript
import * as jobsRepo from 'app/repositories/jobs/jobs.js';
import { createJobSchema } from 'app/schemas/job.js';
import type { Request, Response } from 'express';

export async function createJob(req: Request, res: Response): Promise<void> {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }

  const job = await jobsRepo.createJob(req.user!.id, parsed.data);
  res.status(201).json({ data: job });
}
```

- Return type is always `Promise<void>`.
- Validate with `safeParse`, not `parse`. Handle errors explicitly.
- Return early on validation failure.
- Let unhandled errors propagate to the global error handler.

### Response Format

```typescript
// Success, single resource
res.json({ data: job });
res.status(201).json({ data: job });

// Success, collection with pagination
res.json({ data: jobs, meta: { total, limit, offset } });

// Error
res.status(400).json({ error: { message: 'Validation failed' } });
res.status(401).json({ error: { message: 'Authentication required' } });
res.status(404).json({ error: { message: 'Not found' } });
res.status(409).json({ error: { message: 'Email already registered' } });
```

Always wrap in `{ data: ... }` for success, `{ error: { message: ... } }` for errors.

### Validation (Zod)

Schemas live in `src/schemas/` alongside their derived types:

```typescript
import { z } from 'zod';

export const jobSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable(),
});

export const createJobSchema = z.object({
  title: z.string().max(255).optional(),
  company: z.string().max(255).optional(),
});

export type Job = z.infer<typeof jobSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
```

- Schema names: camelCase plus `Schema` suffix.
- Type names: PascalCase, derived with `z.infer`.
- Input schemas are separate from data model schemas.
- Schemas validate at the handler layer, not the repository layer.

### Repository Pattern

```typescript
import { query } from 'app/db/pool/pool.js';
import type { Job } from 'app/schemas/job.js';

export async function getJobById(
  id: string,
  userId: string,
): Promise<Job | null> {
  const result = await query<Job>(
    `SELECT * FROM jobs WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

export async function createJob(
  userId: string,
  input: CreateJobInput,
): Promise<Job> {
  const result = await query<Job>(
    `INSERT INTO jobs (user_id, title, company)
         VALUES ($1, $2, $3)
         RETURNING *`,
    [userId, input.title ?? null, input.company ?? null],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}
```

- Parameterized queries only (`$1, $2, ...`). Never string interpolation.
- Every query includes `user_id` scoping for multi-tenant safety.
- Return `null` for not-found, not empty arrays.
- `RETURNING *` on inserts and updates.
- Named exports, imported as namespace: `import * as jobsRepo from '...'`.

### Error Handling (Backend)

Global error handler (last middleware):

```typescript
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error({ err, reqId: req.id }, 'Unhandled error');
  res.status(500).json({
    error: {
      message: isProduction()
        ? 'Internal server error'
        : err instanceof Error
          ? err.stack
          : String(err),
    },
  });
}
```

- Hide stack traces in production.
- Specific database errors (e.g., `23505` unique violation) caught in handlers, not globally.
- Cache operations degrade gracefully. Catch and log, never rethrow.

### Logging

```typescript
logger.info({ event: 'register_success', userId: user.id }, 'User registered');
logger.warn(
  { event: 'login_failure', reason: 'user_not_found' },
  'Login failed',
);
logger.error({ err, jobId }, 'Failed to process job');
logger.debug({ hash }, 'Cache hit');
```

- Structured context objects first, message string second.
- Pretty printing in development, JSON in production.
- Request IDs via `pino-http` middleware.
- Always pass error objects as `{ err }`. Pino serializes them properly.

### Database Pool

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  ssl: isProduction()
    ? {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
      }
    : false,
});
```

- Query wrapper logs duration in development.
- Transaction helper: `withTransaction(async (client) => { ... })`.
- Pool lives in `src/db/pool/pool.ts`.

### Export Patterns

| What          | Export Style                                       | Import Style                                |
| ------------- | -------------------------------------------------- | ------------------------------------------- |
| Handlers      | Named: `export async function listJobs(...)`       | `import * as jobHandlers from '...'`        |
| Repositories  | Named: `export async function getJobById(...)`     | `import * as jobsRepo from '...'`           |
| Services      | Named: `export async function analyzeJob(...)`     | `import { analyzeJob } from '...'`          |
| Schemas/Types | Named: `export const jobSchema`, `export type Job` | `import { jobSchema, type Job } from '...'` |
| Routers       | Named: `export { jobsRouter }`                     | `import { jobsRouter } from '...'`          |
| Middleware    | Named: `export function requireAuth(...)`          | `import { requireAuth } from '...'`         |
| Logger        | Named: `export const logger`                       | `import { logger } from '...'`              |

No default exports in the backend. Named exports only.

### TypeScript Patterns (Backend)

- Types for Zod-derived models: `type Job = z.infer<typeof jobSchema>`.
- Interfaces for callback and service contracts: `interface StreamCallbacks { onToken: ... }`.
- Types for unions: `type ProgressEvent = { type: 'tool_start'; ... } | { type: 'tool_result'; ... }`.
- Extend Express Request in `types/express.d.ts`:

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
export {};
```

### RESTful Route Naming

```
GET    /jobs              # list (paginated)
POST   /jobs              # create
GET    /jobs/:id          # get single
PUT    /jobs/:id          # full update
PATCH  /jobs/:id          # partial update
DELETE /jobs/:id          # delete
POST   /jobs/analyze      # action on collection
GET    /links/:id/summary # nested resource
```

### Testing (Backend)

- Vitest as the test runner (configured in `vitest.config.ts`).
- Supertest for HTTP integration tests (Express routes).
- Coverage target: 60% minimum (branches, functions, lines, statements).
- Test files live in `src/__tests__/`, mirroring the source tree. See the root `CLAUDE.md` Testing Conventions section.

Handler tests mock the repository layer and test HTTP behavior:

```typescript
vi.mock('app/repositories/jobs/jobs.js');

describe('GET /jobs', () => {
  it('returns 200 with jobs list', async () => {
    vi.mocked(jobsRepo.listJobs).mockResolvedValue([mockJob]);
    const res = await request(app).get('/jobs').set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
```

Middleware tests create a minimal Express app and test behavior in isolation. Utility tests are pure unit tests with no mocks needed.

---

## Database Conventions

### Stack

- PostgreSQL on Neon.
- Migrations: `node-pg-migrate` (builder API, ESM).
- Driver: `pg` (node-postgres). Raw parameterized SQL.
- No ORM. No Knex, Drizzle, Prisma, or TypeORM.

### Migration Files

Location: `server/migrations/` (at the server package root).

Naming: `{UNIX_TIMESTAMP_MS}_{description}.js` (kebab-case description, one logical change per file).

All packages use `"type": "module"` so migrations must use ESM `export` syntax, not CommonJS `exports`:

```javascript
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('jobs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    title: { type: 'varchar(255)' },
    status: { type: 'varchar(50)', notNull: true, default: 'saved' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('jobs', 'user_id');
  pgm.createIndex('jobs', 'created_at');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('jobs');
};
```

Do not use `exports.up = ...`. That is CommonJS and throws `ReferenceError: exports is not defined in ES module scope`.

Rules:

- Always provide both `up` and `down` functions (even though deploys are forward-only; the file must exist).
- Use the `pgm` builder API, not raw SQL (except for triggers and complex DDL).
- Add JSDoc type hints for the `pgm` parameter.
- Comment dependencies: `// Requires users table to exist`.
- Drop in reverse order in `down` (constraints before tables, types after tables).

### Schema Conventions

Table naming: plural, lowercase, snake_case: `users`, `jobs`, `link_tags`. Junction tables combine both names.

Column naming: snake*case exclusively. Foreign keys: `{referenced_table_singular}_id`. Boolean columns: prefix with `is*`or`has\_`.

Primary keys: `uuid`, default `pgm.func('gen_random_uuid()')`. No serial or bigint IDs.

Timestamps: every table includes `created_at` and `updated_at` (both `timestamptz`, default `NOW()`). Use a shared `set_updated_at` trigger function (created once in the users migration, reused on each table).

Foreign keys:

```javascript
user_id: {
    type: 'uuid',
    notNull: true,
    references: 'users',
    onDelete: 'CASCADE',
}
```

- `onDelete: 'CASCADE'` for user-owned data.
- `onDelete: 'SET NULL'` for optional or loose references.
- Foreign key column is always `notNull: true` unless the relationship is optional.

Constraints: use `check:` for enum-ish columns, `pgm.addConstraint` for composite unique.

Array columns: `text[]` with default `pgm.func("'{}'::text[]")`.

JSONB columns: `jsonb` (not `json`) for queryable data. Default `pgm.func("'{}'::jsonb")`.

Custom ENUM types: `pgm.createType(...)` before the tables that use them, `pgm.dropType(...)` after dropping the tables in `down()`.

### Indexes

```javascript
pgm.createIndex('jobs', 'user_id');
pgm.createIndex('jobs', 'created_at');
pgm.createIndex('messages', ['conversation_id', 'created_at']);
```

- Use auto-generated index names.
- Index all foreign key columns.
- Index columns used in `WHERE`, `ORDER BY`, and `JOIN` clauses.
- Create indexes in the same migration as the table they belong to.

### Query Patterns

Connection: all queries go through the pool wrapper in `src/db/pool/pool.ts`:

```typescript
export async function query<T extends QueryResultRow>(
    text: string,
    values?: unknown[],
    client?: PoolClient,
): Promise<QueryResult<T>> { ... }

export async function withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
): Promise<T> { ... }
```

SQL formatting:

- UPPERCASE keywords: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `FROM`, `WHERE`, `JOIN`, `ORDER BY`, `LIMIT`, `RETURNING`.
- lowercase table and column names.
- Parameterized placeholders: `$1`, `$2`, `$3`. Never string interpolation.
- Multi-line queries for readability.

### Type Mapping

| PostgreSQL    | TypeScript                | Zod                            |
| ------------- | ------------------------- | ------------------------------ |
| `uuid`        | `string`                  | `z.string().uuid()`            |
| `varchar(n)`  | `string \| null`          | `z.string().max(n).nullable()` |
| `text`        | `string \| null`          | `z.string().nullable()`        |
| `text[]`      | `string[]`                | `z.array(z.string())`          |
| `integer`     | `number`                  | `z.number().int()`             |
| `boolean`     | `boolean`                 | `z.boolean()`                  |
| `jsonb`       | `Record<string, unknown>` | `z.record(z.unknown())`        |
| `timestamptz` | `Date` or `string`        | `z.coerce.date()`              |
| custom enum   | string union              | `z.enum(['a', 'b', 'c'])`      |

### Access Control

- No RLS policies. Access control is enforced in the API layer.
- Every repository query includes `user_id = $N` scoping.
- No direct frontend-to-database connections.
- The API server is the only database client.

---

## Non-Negotiable Rules (Backend-Specific)

These layer on top of the root non-negotiables in `../CLAUDE.md`. If they conflict, root wins and file a bug.

1. **Parameterized SQL only.** Never string-interpolate into a query. Every query that touches user-owned data includes `user_id` scoping in its WHERE clause.
2. **Path alias:** `app/*` resolves to `src/*`. Never relative `../../` beyond one level. Always end local import paths with `.js` extension (ESM resolution).
3. **Architecture layers:** `routes` wire handlers to paths; `handlers` are thin req/res that validate input and delegate; `services` orchestrate business logic and call repositories plus external APIs; `repositories` run parameterized SQL and return typed rows. Never skip layers. Repositories never call handlers.

---

## Auth and CSRF

### Auth

Custom cookie-based sessions. Cookie name: `sid`, 7-day TTL, httpOnly, secure in prod. Token stored as SHA-256 hash in `sessions` table. `loadSession` middleware populates `req.user`. `requireAuth` middleware gates protected routes.

### CSRF

Header-only pattern. `X-Requested-With: XMLHttpRequest` required on all state-changing requests (POST, PUT, PATCH, DELETE). No token endpoint. The `csrfGuard` middleware rejects requests missing the header on mutating methods.

---

## Security Rules (Deployment)

No exceptions, no shortcuts to facilitate a deploy.

**TLS / SSL:**

- Never set `rejectUnauthorized: false` in any database, Redis, or HTTPS client connection config.
- Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` as an environment variable.
- The correct pattern for `pg` Pool SSL in production:

  ```typescript
  ssl: isProduction()
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
  ```

**Secrets:**

- Never commit `.env` files containing real credentials.
- Never hardcode API keys, passwords, or tokens. Use environment variables.
- Add every new env var to `server/src/config/env.ts` and `server/.env.example`.

**CORS:**

- Never use `origin: '*'` with `credentials: true`.
- `CORS_ORIGIN` must always be set to the exact Vercel production URL in Railway.
- Use the stable URL, never a preview hash URL.

---

## Railway

Project structure:

```
Railway Project
├── api          # Express/TypeScript server
├── postgres     # Managed Postgres (Neon is preferred)
└── redis        # Managed Redis (if using BullMQ or caching)
```

Deploying a service:

1. Link the service to the repo via the Railway MCP or dashboard.
2. Set the root directory to the package being deployed (e.g., `server/`).
3. Set the start command explicitly: `node dist/index.js`.
4. Set `NODE_ENV=production` explicitly.
5. Configure all required env vars before the first deploy.

Environment variables required for every service:

| Variable       | Value                  | Notes                                 |
| -------------- | ---------------------- | ------------------------------------- |
| `NODE_ENV`     | `production`           | Always set. Never omit.               |
| `PORT`         | Railway injects this   | Do not hardcode                       |
| `DATABASE_URL` | Neon connection string | Pooled for API, direct for migrations |
| `CORS_ORIGIN`  | Vercel production URL  | Required in production                |

Healthcheck and zero-downtime:

- Expose `GET /health` on every API service returning `200 { status: 'ok' }`.
- Configure Railway's healthcheck path to `/health`.

Database migrations:

- Run migrations BEFORE the new API code goes live.
- Use a `prestart` script: `npm run migrate && node dist/index.js`.
- Keep `DATABASE_URL` (pooled) and `DATABASE_MIGRATION_URL` (direct) as separate vars.
