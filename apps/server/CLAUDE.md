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
- Anthropic Claude API for LLM calls (if applicable).

### Directory Structure

```
src/
├── index.ts                      # Thin entry: loads dotenv, dynamically imports server.ts
├── server.ts                     # Listener + process lifecycle (calls createApp)
├── app.ts                        # createApp(deps) factory: builds the wired app, no listen()
├── worker.ts                     # BullMQ worker entry point (separate process)
├── clients/                      # Stateful SDK wrappers (one module per external provider)
│   ├── analyticsClient.ts        # PostHog client
│   ├── queueClient.ts            # BullMQ queue + createWorker factory
│   ├── r2Client.ts               # Cloudflare R2 upload/presign/delete
│   ├── redisClient.ts            # Two-client Redis setup (BullMQ + rate limiter)
│   └── stripeClient.ts           # Lazy Stripe client singleton
├── config/
│   ├── corsConfig.ts             # CORS middleware config
│   └── envConfig.ts              # Zod-validated env (see Env Config section)
├── constants/                    # Hard-coded constants and error codes
│   ├── authConstants.ts
│   ├── errorCodesConstants.ts    # ERROR_CODES constant + createErrorResponse factory
│   ├── httpConstants.ts
│   └── sessionConstants.ts
├── database/
│   └── databasePool.ts           # PostgreSQL pool + query wrapper + transaction helper
├── handlers/                     # HTTP request handlers (thin: validate, delegate, respond)
│   ├── authHandler.ts
│   ├── billing/
│   │   ├── billingHandler.ts     # Subscription/plan handlers
│   │   ├── portalHandler.ts      # Billing portal handler
│   │   └── webhookHandler.ts     # Stripe webhook handler
│   └── postsHandler.ts
├── middleware/
│   ├── csrfGuardMiddleware.ts
│   ├── errorHandlerMiddleware.ts
│   ├── idempotencyMiddleware.ts
│   ├── notFoundHandlerMiddleware.ts
│   ├── rateLimiterMiddleware.ts
│   ├── requestLoggerMiddleware.ts
│   ├── requireAuthMiddleware.ts
│   └── validateMiddleware.ts
├── repositories/                 # Data access layer (all SQL lives here)
│   ├── authRepository.ts
│   ├── billingRepository.ts      # Subscription queries
│   ├── idempotencyRepository.ts
│   └── postsRepository.ts
├── routes/                       # Express router definitions
│   ├── authRoutes.ts
│   ├── billingRoutes.ts
│   └── postsRoutes.ts
├── schemas/                      # Zod schemas + derived TypeScript types
│   ├── authSchema.ts
│   ├── billingSchema.ts
│   └── postsSchema.ts
├── services/                     # Business logic and domain utilities
│   ├── billingService.ts         # Stripe billing orchestration
│   ├── circuitBreakerService.ts  # Redis-backed circuit breaker
│   ├── emailService.ts           # Password reset email (Resend)
│   ├── hashService.ts            # SHA-256 token hashing
│   ├── loggerService.ts          # Pino logger instance
│   ├── parseIdParamParser.ts     # Parse and validate :id route param
│   └── parsePaginationParser.ts  # Parse and validate pagination query params
└── types/                        # TypeScript ambient declarations
    └── express.d.ts
```

### Layer Responsibilities

| Layer        | Does                                                                         | Does NOT                                           |
| ------------ | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| Handlers     | Read validated input, call services or repos, return HTTP responses          | Contain business logic, run SQL, re-validate input |
| Services     | Orchestrate business logic, call repos, call clients                         | Parse HTTP requests, return HTTP responses         |
| Repositories | Run parameterized SQL queries, return typed results                          | Know about HTTP, validate input                    |
| Clients      | Wrap one external SDK or provider, expose thin typed calls                   | Contain domain logic, know about HTTP or repos     |
| Middleware   | Cross-cutting concerns (auth, body validation, logging, CORS, rate limiting) | Contain business logic                             |

Dependency flow: `handlers -> services -> repositories -> clients/database`. Never skip layers. Repositories never call handlers. Handlers never import clients directly.

### File Naming (Backend)

| What         | Convention              | Example                  |
| ------------ | ----------------------- | ------------------------ |
| Handlers     | `<noun>Handler.ts`      | `authHandler.ts`         |
| Middleware   | `<noun>Middleware.ts`   | `csrfGuardMiddleware.ts` |
| Repositories | `<noun>Repository.ts`   | `authRepository.ts`      |
| Routes       | `<noun>Routes.ts`       | `authRoutes.ts`          |
| Schemas      | `<noun>Schema.ts`       | `authSchema.ts`          |
| Services     | `<noun>Service.ts`      | `billingService.ts`      |
| Clients      | `<noun>Client.ts`       | `stripeClient.ts`        |
| Parsers      | `<verb><noun>Parser.ts` | `parseIdParamParser.ts`  |
| Constants    | `<noun>Constants.ts`    | `authConstants.ts`       |
| Config       | `<noun>Config.ts`       | `envConfig.ts`           |

Rule: no dots, no hyphens, camelCase only. Type suffix is mandatory.

### Import Ordering (Backend)

```typescript
// 1. Environment setup (always first if present)
// 4. Local imports by layer (config, database, middleware, repos, schemas, services)
import { corsConfig } from 'app/config/corsConfig.js';
import { query } from 'app/database/databasePool.js';
import * as itemsRepo from 'app/repositories/items.js';
import type { Item } from 'app/schemas/item.js';
import { logger } from 'app/services/loggerService.js';
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

### Env Config Pattern

All environment variables are declared in `src/config/env.ts` using a Zod schema. This replaces the manual `validateEnv()` function from the previous pattern.

- **Required vars:** `z.string().min(1, 'VAR is required')` or similar -- Zod throws at startup if absent.
- **Optional vars:** `z.string().optional()` -- code that uses them must guard against `undefined` and degrade gracefully.
- **Production-only warnings:** after parsing, emit `console.warn` for optional vars that should be set in production (e.g., `REDIS_URL`).
- **Add a new var:** add to `envSchema`, re-export from `env`, add to `server/.env.example`.

```typescript
// Required:
DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

// Optional with production warning (handled after parse):
REDIS_URL: z.string().optional(),

// Optional with default:
PORT: z.coerce.number().default(3001),
```

After the schema is parsed, the frozen `env` object is the only place process.env is read. Never access `process.env` directly in application code.

### Entry Point Pattern (factory dependency injection)

Three files split the entry point so the app is built by a factory that can be wired with fakes or a test pool, with no side effects on import.

`src/index.ts` is a thin shim that loads env before any module initializes, then dynamically imports the lifecycle module. The dynamic import is what guarantees `dotenv/config` runs before any module reads `process.env`; do not convert it to a static import (the import sorter would reorder `dotenv/config` after the others and break env load order).

```typescript
// Load env / secrets before any app modules initialize
import 'dotenv/config';

await import('app/server.js');
```

`src/server.ts` owns the listener and process lifecycle: Sentry init, `createApp(deps)`, `app.listen()`, the pool error listener, `uncaughtException`/`unhandledRejection`/`SIGTERM`/`SIGINT` handlers, the session cleanup interval, and graceful shutdown. It builds the real data-access deps and passes them in; the cleanup timer uses the repo returned by `createApp`.

```typescript
import { createApp } from 'app/app.js';
import { pool, query, withTransaction } from 'app/database/pool.js';

const { app, authRepo } = createApp({ query, withTransaction });

const server = app.listen(env.PORT, '0.0.0.0', () =>
  logger.info({ port: env.PORT }, 'Server running'),
);

const cleanupTimer = setInterval(() => {
  void authRepo.deleteExpiredSessions();
}, SESSION_CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

// pool.on('error', ...), process signal handlers, shutdown(): close server, pool.end(), exit
```

`src/app.ts` exports `createApp(deps)`, a factory that builds the fully wired Express app and **does not** call `listen()`. It accepts data-access dependencies (`{ query, withTransaction }`) and constructs the repos, handlers, middleware, and routers internally, then returns `{ app, ...handles }`. Importing `app.ts` has no side effects.

```typescript
function createApp(deps: AppDeps) {
  const { query } = deps;
  const authRepo = createAuthRepo(deps);
  const loadSession = createLoadSession(authRepo);
  const authRouter = createAuthRouter(createAuthHandlers({ authRepo, ... }));
  // ... build app, wire middleware/routers, error handlers
  return { app, authRepo };
}

export { createApp };
```

**Factory DI rule:** repositories, handlers, middleware that need data, and routers are exported as `createXxx(deps)` factory functions (still named exports per the root rule, never `export default`). Each accepts its dependencies as arguments so tests construct the unit with injected fakes and never reach for `vi.mock` of a sibling module. Leaf, stateless modules (pure utils, Zod schemas, constants, the logger, pure middleware like `requireAuth`/`requireAdmin`) stay as plain named exports. The DB layer (`query`/`withTransaction`) is the injection seam: factories receive it, so a fake `query` replaces a mocked pool module.

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

// Stripe webhook needs raw body for signature verification.
// Must be before express.json() -- json parser destroys the raw body.
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleWebhook,
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(csrfGuard);
app.use(loadSession);
app.use(idempotency);

// Application routes are versioned under /v1 (health checks stay at root).
const v1Router = express.Router();
v1Router.use('/auth', authRouter);
v1Router.use('/items', itemsRouter);
app.use('/v1', v1Router);

// Error handlers (always last)
app.use(notFoundHandler);
app.use(errorHandler);
```

**Webhook ordering is non-negotiable.** Any route that requires the raw body (Stripe, GitHub webhooks, etc.) must be registered before `express.json()`.

### Router Pattern

Routers are factory functions that receive their handlers. Pure middleware (`requireAuth`) is imported directly; `createApp` builds the handlers and passes them in.

```typescript
import type { ItemHandlers } from 'app/handlers/items.js';
import { requireAuth } from 'app/middleware/requireAuth.js';
import express from 'express';
import type { Router } from 'express';

function createItemsRouter(handlers: ItemHandlers): Router {
  const itemsRouter = express.Router();

  itemsRouter.use(requireAuth);
  itemsRouter.get('/', handlers.listItems);
  itemsRouter.post('/', validate(createItemSchema), handlers.createItem);
  itemsRouter.get('/:id', handlers.getItem);
  itemsRouter.put('/:id', validate(updateItemSchema), handlers.updateItem);
  itemsRouter.delete('/:id', handlers.deleteItem);

  return itemsRouter;
}

export { createItemsRouter };
```

- The router factory receives the handler object; do not import handler singletons.
- Apply auth middleware at the router level, not per route.
- Validate request bodies at the router with `validate(schema)` from `app/middleware/validate.js`; the handler then reads already-validated input. Do not re-run `safeParse` inside the handler.
- Named export for the factory.

### Worker Process

`src/worker.ts` is a separate Node.js entry point for background job processing. It is not part of the HTTP server.

- Start locally with `pnpm --filter server run worker` (or `pnpm dev:worker` from root).
- In production, deploy as a separate Railway service with start command `node dist/worker.js`.
- The worker exits immediately if `REDIS_URL` is unset (`process.exit(1)`).
- To add a new job type: add the payload type and enqueue helper in `queue.ts`, then add a `case` in `worker.ts`'s `switch(job.name)` block.

### Handler Pattern

Handlers are built by a factory that receives the repo and any side-effecting services. The factory returns the named handler functions; the dependency type drives `ItemHandlers = ReturnType<typeof createItemHandlers>`.

```typescript
import type { ItemsRepo } from 'app/repositories/items.js';
import { createItemSchema } from 'app/schemas/item.js';
import type { Request, Response } from 'express';

interface ItemHandlerDeps {
  itemsRepo: ItemsRepo;
}

function createItemHandlers({ itemsRepo }: ItemHandlerDeps) {
  async function createItem(req: Request, res: Response): Promise<void> {
    // Body is validated by the validate(createItemSchema) route middleware.
    const { title } = req.body as CreateItemInput;

    const item = await itemsRepo.createItem(req.user!.id, { title });
    res.status(201).json({ data: item });
  }

  return { createItem };
}

type ItemHandlers = ReturnType<typeof createItemHandlers>;

export { createItemHandlers };
export type { ItemHandlers };
```

- Return type is always `Promise<void>`.
- Inject the repo and services; never import a repo singleton or `vi.mock` it from a test.
- Validation lives in the `validate(schema)` route middleware, not the handler. The handler reads `req.body as XxxInput` (validated and coerced by the middleware) and never re-runs `safeParse`. Business-rule checks that a Zod schema cannot express (e.g. "current password is correct") stay in the handler.
- Let unhandled errors propagate to the global error handler.
- Build every error body with `createErrorResponse(code, message)` from `app/errors.js`; never hand-write the envelope.

### Response Format

Success responses wrap the payload in `{ data: ... }`. Error responses use the machine-readable `{ code, error }` envelope from `app/errors.js`: `code` is a stable string clients switch on, `error` is the human-readable message. Build it with `createErrorResponse(code, message)`; never hand-write the object.

HTTP status codes come from the `HTTP.STATUS` registry in `app/constants/http.js` (`HTTP.STATUS.BAD_REQUEST`, `HTTP.STATUS.NOT_FOUND`, etc.); never pass a bare numeric literal to `res.status()`. The examples below use literals only to keep the response shape readable.

```typescript
import { ERROR_CODES, createErrorResponse } from 'app/errors.js';

// Success, single resource
res.json({ data: item });
res.status(201).json({ data: item });

// Success, collection with pagination
res.json({ data: items, meta: { total, limit, offset } });

// Error: always { code, error }
res
  .status(400)
  .json(
    createErrorResponse(
      ERROR_CODES.INPUT.VALIDATION_ERROR,
      'Validation failed',
    ),
  );
res
  .status(401)
  .json(
    createErrorResponse(ERROR_CODES.AUTH.REQUIRED, 'Authentication required'),
  );
res
  .status(404)
  .json(createErrorResponse(ERROR_CODES.ROUTING.NOT_FOUND, 'Not found'));
res
  .status(409)
  .json(
    createErrorResponse(
      ERROR_CODES.AUTH.EMAIL_ALREADY_REGISTERED,
      'Email already registered',
    ),
  );
```

`ERROR_CODES` is the single registry of codes (nested by domain: `AUTH`, `BILLING`, `CSRF`, `INPUT`, `POSTS`, `RATE_LIMIT`, `ROUTING`, `SERVER`). Add a new code there before using it; never pass a raw string literal as the code.

### Validation (Zod)

Schemas live in `src/schemas/` alongside their derived types:

```typescript
import { z } from 'zod';

export const itemSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable(),
});

export const createItemSchema = z.object({
  title: z.string().max(255).optional(),
});

export type Item = z.infer<typeof itemSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
```

- Schema names: camelCase plus `Schema` suffix.
- Type names: PascalCase, derived with `z.infer`.
- Input schemas are separate from data model schemas.
- Schemas validate at the router layer via the `validate(schema)` middleware, not in the handler or repository.

### Repository Pattern

A repo is a factory that receives `{ query, withTransaction }` and closes over them. Tests build it with a fake `query`; the pool module is never mocked.

```typescript
import type { PoolClient } from 'app/database/pool.js';
import type { Item } from 'app/schemas/item.js';
import type { QueryResult, QueryResultRow } from 'pg';

interface ItemsRepoDeps {
  query: <T extends QueryResultRow>(
    text: string,
    values?: unknown[],
    client?: PoolClient,
  ) => Promise<QueryResult<T>>;
  withTransaction: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
}

const ITEM_COLUMNS = 'id, user_id, title, created_at, updated_at';

function createItemsRepo({ query }: ItemsRepoDeps) {
  async function getItemById(id: string, userId: string): Promise<Item | null> {
    const result = await query<Item>(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows[0] ?? null;
  }

  return { getItemById };
}

type ItemsRepo = ReturnType<typeof createItemsRepo>;

export { createItemsRepo };
export type { ItemsRepo, ItemsRepoDeps };
```

- Parameterized queries only (`$1, $2, ...`). Never string interpolation.
- Every query includes `user_id` scoping for multi-tenant safety.
- Return `null` for not-found, not empty arrays.
- Explicit column lists, never `SELECT *` / `RETURNING *`. Hoist the list into a `*_COLUMNS` constant.
- Export the `createXxxRepo` factory and its `XxxRepo` / `XxxRepoDeps` types; `createApp` constructs the instance.

### Error Handling (Backend)

Global error handler (last middleware). Emits the same `{ code, error }` envelope as every other error path, deriving the code from the resolved status:

```typescript
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = resolveStatus(err); // err.status / err.statusCode, else 500
  logger.error({ err, reqId: req.id }, 'Unhandled error');
  const code = STATUS_TO_CODE[status] ?? ERROR_CODES.SERVER.INTERNAL_ERROR;
  const message =
    isProduction() && status === 500
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : String(err);
  res.status(status).json(createErrorResponse(code, message));
}
```

- Hide error detail in production for 500s.
- Specific database errors (e.g., `23505` unique violation) caught in handlers, not globally.
- Cache operations degrade gracefully. Catch and log, never rethrow.

### Logging

```typescript
logger.info({ event: 'register_success', userId: user.id }, 'User registered');
logger.warn(
  { event: 'login_failure', reason: 'user_not_found' },
  'Login failed',
);
logger.error({ err, itemId }, 'Failed to process item');
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
- Pool lives in `src/database/pool.ts`.

### Export Patterns

| What            | Export Style                                         | Import Style                                  |
| --------------- | ---------------------------------------------------- | --------------------------------------------- |
| Handlers        | Named: `export { createItemHandlers }`               | `import { createItemHandlers } from '...'`    |
| Repositories    | Named: `export { createItemsRepo }`                  | `import { createItemsRepo } from '...'`       |
| Services        | Named: `export { createItemsService }`               | `import { createItemsService } from '...'`    |
| Routers         | Named: `export { createItemsRouter }`                | `import { createItemsRouter } from '...'`     |
| Data middleware | Named: `export { createLoadSession }`                | `import { createLoadSession } from '...'`     |
| Pure middleware | Named: `export function requireAuth(...)`            | `import { requireAuth } from '...'`           |
| Schemas/Types   | Named: `export const itemSchema`, `export type Item` | `import { itemSchema, type Item } from '...'` |
| Logger          | Named: `export const logger`                         | `import { logger } from '...'`                |

Layers that take dependencies export a `createXxx(deps)` factory; leaf modules (pure middleware, schemas, utils, logger) export plain named bindings. No default exports in the backend. Named exports only. No `import * as` namespace imports of these factories.

### TypeScript Patterns (Backend)

- Types for Zod-derived models: `type Item = z.infer<typeof itemSchema>`.
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
GET    /items              # list (paginated)
POST   /items              # create
GET    /items/:id          # get single
PUT    /items/:id          # full update
PATCH  /items/:id          # partial update
DELETE /items/:id          # delete
POST   /items/process      # action on collection
GET    /items/:id/details  # nested resource
```

### Testing (Backend)

- Vitest as the test runner (configured in `vitest.config.ts`).
- Supertest for HTTP integration tests (Express routes).
- Coverage target: 80% minimum (branches, functions, lines, statements). Matches the threshold in `vitest.config.ts`.
- Test files live in `src/__tests__/`, mirroring the source tree. See the root `CLAUDE.md` Testing Conventions section.

Handler tests build the handlers with a fake repo (constructor injection) and test HTTP behavior. Do not `vi.mock` the repository module:

```typescript
const mockItemsRepo = { listItems: vi.fn() };
const handlers = createItemHandlers({
  itemsRepo: mockItemsRepo as unknown as ItemsRepo,
});

const app = express();
app.use(express.json());
app.get('/items', handlers.listItems);

describe('GET /items', () => {
  it('returns 200 with items list', async () => {
    mockItemsRepo.listItems.mockResolvedValue([mockItem]);
    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
```

Repo tests construct the repo with a fake `query` (`createItemsRepo({ query: vi.fn(), withTransaction })`) instead of mocking the pool. Middleware tests build the data-bound middleware via its factory (`createLoadSession(fakeRepo)`) and mount it on a minimal Express app. Integration tests build the real app with `createApp({ query, withTransaction })`. `vi.mock` is reserved for genuinely external boundaries (e.g. `bcrypt`, or forcing `env` flags via `importOriginal`), never for a sibling layer that the factory can inject. Utility tests are pure unit tests with no mocks needed.

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
  pgm.createTable('items', {
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
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('items', 'user_id');
  pgm.createIndex('items', 'created_at');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable('items');
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

Table naming: plural, lowercase, snake_case: `users`, `items`, `item_tags`. Junction tables combine both names.

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
pgm.createIndex('items', 'user_id');
pgm.createIndex('items', 'created_at');
pgm.createIndex('messages', ['conversation_id', 'created_at']);
```

- Use auto-generated index names.
- Index all foreign key columns.
- Index columns used in `WHERE`, `ORDER BY`, and `JOIN` clauses.
- Create indexes in the same migration as the table they belong to.

### Query Patterns

Connection: all queries go through the pool wrapper in `src/database/pool.ts`:

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
- Authorization roles live on the `users.role` column (`text`, `CHECK (role IN ('user', 'admin'))`, default `'user'`). Every query that builds a user object selects `role`, and `toUserResponse` returns it. Gate admin-only routes with the `requireAdmin` middleware (see Auth and CSRF).

---

## Non-Negotiable Rules (Backend-Specific)

These layer on top of the root non-negotiables in `../CLAUDE.md`. If they conflict, root wins and file a bug.

1. **Parameterized SQL only.** Never string-interpolate into a query. Every query that touches user-owned data includes `user_id` scoping in its WHERE clause.
2. **Path alias:** `app/*` resolves to `src/*`. Never relative `../../` beyond one level. Always end local import paths with `.js` extension (ESM resolution).
3. **Architecture layers:** `routes` wire handlers to paths; `handlers` are thin req/res that validate input and delegate; `services` orchestrate business logic and call repositories plus external APIs; `repositories` run parameterized SQL and return typed rows. Never skip layers. Repositories never call handlers.

---

## Auth and CSRF

### Auth

Custom cookie-based sessions. Cookie name: `sid`, 7-day TTL, httpOnly, secure in prod. Token stored as SHA-256 hash in `sessions` table. `loadSession` middleware populates `req.user` (including `role`). `requireAuth` middleware gates authenticated routes; `requireAdmin` gates admin-only routes (401 when unauthenticated, 403 when `req.user.role !== 'admin'`). Apply `requireAdmin` after `loadSession` on the router or route.

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
- `CORS_ORIGIN` must always be set to the exact Railway production URL.
- Use the stable URL, never a preview or ephemeral URL.

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
| `CORS_ORIGIN`  | Railway production URL | Required in production                |

Healthcheck and zero-downtime:

- Expose `GET /health` on every API service returning `200 { status: 'ok' }`.
- Configure Railway's healthcheck path to `/health`.

Database migrations:

- Run migrations BEFORE the new API code goes live.
- Use a `prestart` script: `npm run migrate && node dist/index.js`.
- Keep `DATABASE_URL` (pooled) and `DATABASE_MIGRATION_URL` (direct) as separate vars.
