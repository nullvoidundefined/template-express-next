# template-express-next

Production-ready monorepo template for fullstack TypeScript applications. Express 5 API on Railway, Next.js 15 frontend on Vercel, PostgreSQL on Neon.

## Stack

```
apps/server/             Express 5 + TypeScript -- REST API, custom auth, raw SQL
apps/client/web/         Next.js 15 App Router -- React 19, SCSS Modules, TanStack Query
packages/tokens/         Design token system (CSS custom properties + JS object)
packages/types/          Shared TypeScript types across all surfaces
packages/client-shared/  Shared API wrapper, Zod schemas, utilities
```

## Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL (local or Neon)

## Getting Started

1. Clone and install:
   ```bash
   git clone <repo> my-app
   cd my-app
   pnpm install
   ```

2. Configure the server:
   ```bash
   cp apps/server/.env.example apps/server/.env
   # Edit apps/server/.env and set DATABASE_URL and SESSION_SECRET
   ```

3. Run migrations:
   ```bash
   pnpm --filter server run migrate:up
   ```

4. Start development servers:
   ```bash
   pnpm dev
   ```

API runs at `http://localhost:3001`, web client at `http://localhost:3000`.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | -- | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | -- | Secret for signing session cookies (generate with `openssl rand -hex 32`) |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3001` | HTTP server port |
| `CORS_ORIGIN` | Prod | `http://localhost:3000` | Allowed origin for CORS (required in production) |
| `DATABASE_CA_CERT` | No | -- | PEM CA cert for SSL verification (Neon, RDS) |

## Deployment

### Server (Railway)

1. Create a Railway project and provision a Postgres database.
2. Link the repo and set root directory to `apps/server/`.
3. Set required env vars: `DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGIN`, `NODE_ENV=production`.
4. Run migrations before first deploy: `pnpm --filter server run migrate:up`.
5. Railway uses the `Dockerfile` `server` stage. The start script runs migrations then starts the server.

### Web Client (Vercel)

1. Import the repo into Vercel.
2. Set root directory to `apps/client/web/`.
3. Set `NEXT_PUBLIC_API_URL` to your Railway API URL.

## Key Commands

```bash
pnpm dev                              # Start API + web client
pnpm build                            # Build all workspaces
pnpm test                             # Run server unit tests
pnpm test:coverage                    # Unit tests with coverage
pnpm lint                             # Lint all workspaces
pnpm format:check                     # Check formatting

pnpm --filter server run migrate:up   # Apply migrations
pnpm --filter server run migrate:down # Roll back last migration
pnpm --filter server run test:integration
```

## Project Conventions

- Named exports only (no `export default` in non-Next.js files)
- CSRF: header-only (`X-Requested-With: XMLHttpRequest`) on all mutating requests
- Tests live in `src/__tests__/`, mirroring the source tree
- Alphabetical ordering: imports, props, type keys, union members
- Shared types go in `packages/types/` the moment two surfaces need them

See `CLAUDE.md` and the workspace-level `CLAUDE.md` files for full conventions.
