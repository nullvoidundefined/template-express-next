<<<<<<< HEAD
# template-express-next

## Deployment Notes

- **Vercel root directory**: When deploying the `web-client` to Vercel, set the **Root Directory** to `web-client/` in the Vercel project settings. Vercel checks for `next` in the root `package.json` before running install, but in this monorepo the Next.js dependency lives in `web-client/package.json`. Without setting the root directory, builds will fail with "No Next.js version detected."

  The fix is to either:
  1. Set "Root Directory" to `web-client` in the Vercel dashboard project settings, or
  2. Use `vercel --cwd web-client` or connect the GitHub repo with the root directory set to `web-client` in Vercel's project config.
=======
# deployments-health-check-dashboard

## Source of Truth

- **SPEC.md** — full product specification; describes all features, data models, and API contracts
- **tasks.md** — phased implementation tasks; check this for current phase and outstanding work

## Prerequisites

- **PostgreSQL** must be running for the API server (see docker-compose.yml)
- **Redis** must be running for BullMQ job queues (see docker-compose.yml)
- Start both with: `docker compose up -d`

## Playwright / Chromium

Playwright is used for screenshot capture checks. Chromium must be installed separately:

```
npx playwright install chromium
```

## Project Conventions

### Server (Express 5 + TypeScript)

- **Handlers** — thin request/response layer in `server/src/handlers/`; delegate all logic to repositories
- **Repositories** — all DB queries in `server/src/repositories/`; return plain objects, never expose raw pg results
- **Schemas** — Zod validation schemas in `server/src/schemas/`; used in handlers to validate request bodies
- **Routes** — Express routers in `server/src/routes/`; wire handlers to paths here

### Path Aliases

- Use `app/*` path alias, not relative imports (e.g., `import { env } from "app/config/env.js"`)

### Secrets and Environment Variables

- All secrets must live in environment variables — never hard-code
- When adding a new env var:
  1. Add it to `server/src/config/env.ts`
  2. Add it to `server/.env.example` with a blank or example value
  3. Add it to your local `server/.env`

### Package Manager

- Use **pnpm exclusively** — never npm or yarn
- Install to the correct workspace:
  - `pnpm --filter server add <pkg>`
  - `pnpm --filter web-client add <pkg>`
  - Root-level tools: `pnpm add -w <pkg>`

### web-client (Next.js 15 + React 19)

- Use `app/*` path alias for imports within web-client
- Tailwind CSS via `@tailwindcss/postcss`; import with `@import "tailwindcss"` in globals.scss

## Deployment Notes

- **Vercel root directory**: Set to `web-client/` in Vercel project settings
- The fix is to either:
  1. Set "Root Directory" to `web-client` in the Vercel dashboard project settings, or
  2. Use `vercel --cwd web-client` or connect the GitHub repo with the root directory set to `web-client` in Vercel's project config
>>>>>>> 59102fdf5141211c34d7c8def5e9dfb30149d117
