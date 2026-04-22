# Doppelscript

Express 5 + Next.js 15 monorepo for Doppelscript. This file is auto-loaded on every session and contains rules that apply to the whole repo. Workspace-specific conventions live next to the code they govern:

- `apps/client/web/CLAUDE.md` for frontend, styling, component patterns, TanStack Query, no-Tailwind, per-component folders, `displayName`, `data-test-id`, Railway deployment (auto-loaded when working in `apps/client/web/`)
- `apps/client/CLAUDE.md` for shared React and TypeScript conventions across all client surfaces (auto-loaded when working in `apps/client/`)
- `apps/client/extension/CLAUDE.md` for WXT browser extension conventions (auto-loaded when working in `apps/client/extension/`)
- `apps/client/mobile/CLAUDE.md` for Expo mobile conventions (auto-loaded when working in `apps/client/mobile/`)
- `apps/server/CLAUDE.md` for backend, database, SQL safety, auth, CSRF implementation, Railway (auto-loaded when working in `apps/server/`)
- `packages/types/CLAUDE.md` for shared TypeScript types used by server and clients
- `packages/client-shared/CLAUDE.md` for platform-agnostic client code (API wrapper, Zod schemas, utilities)
- `packages/tokens/CLAUDE.md` for design token system

Workspace files layer on top of this file. If a rule in a workspace file and a rule in this file appear to conflict, this file wins and the conflict is a bug to file.

---

## Non-Negotiable Rules (Cross-Cutting)

These apply to the whole repo. Additional non-negotiables specific to each workspace live in the workspace-level CLAUDE.md files listed above.

1. **No em dashes.** U+2014 is banned in every output: responses, code, comments, commit messages, markdown, prompts, tests, audit reports. Substitute period, comma, semicolon, colon, parens, or line break. En dashes and hyphens are fine. Enforced by a PreToolUse hook.
2. **Follow the stack defined in this file and the workspace files.** If the code you see on disk contradicts the convention files, the convention files win. Do not match existing patterns if the existing patterns violate the rules. Fix the drift; do not propagate it.
3. **Test-first bug fixes.** Write a failing test that reproduces the bug, make it pass with the smallest change, commit test plus fix together. See Bug Fix Process.
4. **Alphabetical ordering is mandatory.** Type definitions, type keys, object keys, JSX props, destructured props, union type members, and imports within each group are all alphabetized. This removes decision fatigue, eliminates merge conflicts from arbitrary reordering, and makes scanning faster.
5. **Named exports only across the whole codebase.** Never `export default`, in either the frontend or backend. Every file ends with an explicit `export { Name }` statement. Exception: Next.js App Router convention files (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`, `route.ts`) require `export default` and are exempt from this rule.
6. **CSRF: header-only pattern.** `X-Requested-With: XMLHttpRequest` is required on every state-changing request. Frontend attaches the header in its fetch wrapper; backend middleware refuses the request if the header is missing. No token endpoint. Implementation details for both sides live in the respective workspace files.
7. **Shared types live in `packages/types/`.** Any TypeScript type that is used by two or more surfaces (server, web, extension, mobile) must be defined in `@repo/types` and imported from there. Never duplicate a type definition across workspaces. If a type starts in one workspace and a second workspace needs it, move it to `packages/types/` immediately.
8. **Test files live in `__tests__/`, never beside source files.** Every workspace keeps its tests in a `src/__tests__/` directory that mirrors the source tree. No `Component.test.tsx` next to `Component.tsx`. See the Testing Conventions section. This overrides any co-location guidance found in workspace-level CLAUDE.md files.
9. **Every feature ships a complete checklist.** Before closing any user-facing feature: add a row to `docs/feature-list/features.md`; create or update a user story in `docs/user-stories/`; a Playwright E2E spec in `e2e/` must exist; squash merge onto `main`; delete shipped specs and plans from `docs/superpowers/`.
10. **Squash merge all feature branches.** `git merge --squash` only. Never a regular merge or rebase. One commit per feature on `main`.
11. **`fix:` commits require a test file.** If the commit subject starts with `fix:`, `bug:`, `bugfix:`, or `hotfix:`, at least one test file must be staged. Enforced by lefthook. Infrastructure changes use `chore:`, not `fix:`.
12. **PostGIS from day one** (when geographic data is needed). Never store lat/lng as plain floats and do math in application code. The `geography` or `point` column type ships in the first migration that needs it.
13. **node-pg-migrate default values: bare strings, never double-quoted.** `default: 'active'` not `default: "'active'"`. The builder API adds its own quoting; passing a pre-quoted string produces triple-quoted DDL and causes CHECK constraint failures on INSERT. Enforced by lefthook.
14. **The `set_updated_at` trigger is created once and reused.** Define the trigger function in the users migration. Every subsequent table wires it up with `CREATE TRIGGER ... EXECUTE FUNCTION set_updated_at()`. Never redefine the function.
15. **Analytics events as typed constants, no magic strings.** All PostHog event names live in `packages/constants/src/analytics.ts` and are imported from there. Never pass a raw string to `posthog.capture()`.
16. **PostHog events route through a reverse proxy.** Use an opaque path matching the product vocabulary (never `/analytics`, `/tracking`, `/posthog`, or `/telemetry`). Configure before launch; retroactive setup loses early funnel data.
17. **Environment validation at startup.** Every server calls `validateEnv()` before any middleware registration. A server that boots with missing env vars and fails on the first request is harder to debug than one that crashes immediately.
18. **Health endpoints on every API service.** `/health` (liveness, always 200) and `/health/ready` (readiness, verifies DB connectivity). Register before all application routes.
19. **`NODE_ENV` must always be explicitly set.** Every Railway service has `NODE_ENV=production`. Never leave it unset or defaulted.
20. **SSL: never `rejectUnauthorized: false`.** Use the conditional pattern gated on `isProduction()`. This was left in Doppelscript for weeks and silently disabled certificate validation in production.
21. **CORS: never wildcard with credentials.** `CORS_ORIGIN` must be the exact stable Railway production URL. Never a preview or ephemeral URL.
22. **CSRF: header-only pattern.** (Same as rule 6 -- also listed here for visibility.) The `csrfGuard` middleware enforces it on the server. No token endpoint.
23. **Session cookies: correct `SameSite` and `Secure` flags.** `SameSite: 'lax'` when frontend and backend share the same Railway domain. `SameSite: 'none'` + `secure: true` only when running on separate domains. `httpOnly: true` always.
24. **Per-component folder structure.** Every component lives in `ComponentName/ComponentName.tsx` plus `ComponentName.module.scss`. Never a flat `.tsx` directly under `components/`.
25. **`displayName` and `data-test-id` on every component.** Set `ComponentName.displayName = 'ComponentName'` immediately after the function definition. Outermost DOM element has `data-test-id` in kebab-case.
26. **TanStack Query for all server state.** No raw `useEffect` + `fetch` in components. All API calls go through `useQuery` and `useMutation`.
27. **Cloudflare R2 for all image storage.** Store keys in the database, not full URLs. Derive the public URL at read time. Validate file size and MIME type on the server before upload.
28. **Sentry on both server and client from day one.** Initialize before any business logic. Set user context in `loadSession`. Upload source maps in CI on every production deploy.
29. **Commit `pnpm-lock.yaml` with every `package.json` change.** CI uses `--frozen-lockfile`.
30. **Build runs on pre-push.** The lefthook `pre-push` hook runs `pnpm build`. A broken build never lands on `main`.

---

## Stack

- **Monorepo:** pnpm workspaces. `apps/server/` (Express 5 + TypeScript), `apps/client/web/` (Next.js 15), `apps/client/extension/` (WXT), `apps/client/mobile/` (Expo), `packages/tokens/` (shared design tokens), `packages/types/` (shared TypeScript types), `packages/client-shared/` (shared client utilities, API wrapper, Zod schemas).
- **Frontend:** Next.js 15 App Router, React 19, SCSS Modules, TanStack Query, Radix UI primitives, Vitest + React Testing Library, Playwright.
- **Mobile:** Expo managed workflow, Expo Router, React Native, EAS Build.
- **Extension:** WXT (Chrome MV3, Firefox, Safari, Edge from one codebase).
- **Design tokens:** `packages/tokens/` is the single source of truth for all visual values. Web and extension consume `dist/_tokens.scss` (CSS custom properties). Mobile imports the JS object directly.
- **Backend:** Express 5, TypeScript, Zod, Pino, `pg` (raw SQL), Anthropic SDK where applicable.
- **Database:** PostgreSQL on Neon. Migrations via `node-pg-migrate` (ESM). No ORM.
- **Auth:** Custom cookie-based sessions (SHA-256 hashed tokens, 7-day TTL). Cookie name `sid`. Implementation details in `apps/server/CLAUDE.md`.
- **Deployment:** Railway (server + web). EAS for mobile builds.

### Key Commands

```bash
pnpm dev                    # Start both server + client-web
pnpm build                  # Build both
pnpm lint                   # Lint all workspaces
pnpm format:check           # Check formatting
pnpm test                   # Run server unit tests
pnpm test:coverage          # Unit tests with coverage
pnpm --filter server run test:integration
pnpm --filter server run migrate:up
pnpm --filter server run migrate:down
```

---

## Cloud Deployment (Cross-Cutting)

### General Rules

- Always set `NODE_ENV`. Every remote deployment must have `NODE_ENV=production`. Never leave it unset or defaulted.
- Never deploy to production without a local smoke test.
- One service per Railway project. Keep API, Redis, and Postgres as separate Railway services within one project.
- Commit after every task, deploy after every phase.

Railway deployment details live in `apps/server/CLAUDE.md` (API service) and `apps/client/web/CLAUDE.md` (web service).

### Pre-Deploy Checklist

- [ ] `NODE_ENV` is set correctly on all services.
- [ ] All env vars are set (no placeholders like `TODO` or empty strings).
- [ ] Migrations have run successfully against the target DB.
- [ ] `GET /health` returns 200 on the API service.
- [ ] A smoke test of core flows passes.

---

## Multi-Repo and Multi-Agent Work

### Audit Before Acting

Before launching agents or making changes across repos:

1. **Grep across all repos first.** A single `grep -rl 'pattern'` shows which repos already have the code. Only target repos that actually need changes.
2. **Read task/TODO status upfront.** Check if tasks are already done or partially complete.
3. **Check the environment.** Verify assumptions (is the directory a git repo? does the branch exist? is the file already present?) before launching work that depends on them.

### Minimize Prompt Size

- Use a shared template file. Instead of embedding the full code in every agent prompt, write a single template file first, then tell each agent "copy from `{source-repo}` and adapt."
- Reference by path, not by content.
- Use diff-style instructions for variations.

### Batch and Sequence Intelligently

- Batch similar repos into one agent. One agent can `cd` between them.
- Do the first repo manually, then templatize.
- Sequential with pattern reuse beats parallel with redundancy.

### Model Selection for Agents

| Task Type               | Recommended Model | Examples                                                                           |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| Mechanical / repetitive | Sonnet or Haiku   | Copy a pattern, add a CI config file, rename imports, apply a known fix            |
| Deep reasoning          | Opus              | Architecture decisions, complex refactoring, debugging, designing new abstractions |

Default to the cheaper model. Reserve Opus for tasks where the agent needs judgment calls, complex interactions, or non-obvious failure debugging.

### Subagent Worktree Discipline

Dispatch prompts that do git work must include, in order:

1. The absolute worktree path as the first shell command (`cd /abs/path`).
2. A `git branch --show-current` verification that confirms the expected branch before any `git add` or `git commit`.
3. The verification and the commit chained in a single `Bash` invocation with `&&`, so cwd cannot drift between calls.

---

## Commit Rules

- Always commit `pnpm-lock.yaml` alongside `package.json` changes. CI uses `--frozen-lockfile` and will fail if they are out of sync.
- Run `pnpm test` before pushing. The pre-push hook may skip tests; verify manually.
- Never push without a green test suite.
- Infrastructure and config fixes use `chore:`, not `fix:`. Before writing a commit subject that starts with `fix:`, ask: "could a unit test verify this change?" If the answer is "no, it requires a deploy to verify," use `chore:` instead. This keeps the fix-commit gate honest.
  - **Examples that must be `chore:`:** Dockerfile changes, `package.json` dep removals, pnpm workspace config, Next.js config, Railway config, env var renames, lefthook config.
  - **Examples that stay `fix:`:** business logic formula changes, SQL bug fixes, race conditions, validation bugs, rendering bugs with a reproducible test case.

---

## Bug Fix Process

1. Write a failing test that reproduces the bug.
2. Fix the bug.
3. Confirm the test passes.
4. Run full test suite.
5. Commit.

### Business logic formulas must have a concrete-value test

Any function that computes a price, credit cost, token estimate, or any other business-visible number must have at least one unit test that asserts `fn(concreteInput) toBe(concreteExpectedValue)` with a comment explaining the business rationale. English-prose descriptions of expected behavior do not count; the assertion must be mechanical.

### Two fix commits on the same file within 30 minutes means: stop and write the test first

If you find yourself writing a second `fix:` commit that touches the same file as the first one you pushed in the last 30 minutes, stop. You do not yet understand the failure. Write a test that reproduces the full scope of the bug. Run it to confirm it fails. Then fix.

---

## Testing Conventions

### Where tests live

Every workspace places tests in `src/__tests__/`, mirroring the source tree one-for-one. Never place a test file beside its source file.

```
src/
├── handlers/
│   └── auth/
│       └── auth.ts
├── services/
│   └── example.service.ts
├── components/
│   └── Button/
│       └── Button.tsx
└── __tests__/
    ├── handlers/
    │   └── auth/
    │       └── auth.test.ts
    ├── services/
    │   └── example.service.test.ts
    └── components/
        └── Button/
            └── Button.test.tsx
```

Rules:

- The path inside `__tests__/` matches the path inside `src/` exactly. `src/handlers/auth/auth.ts` has its test at `src/__tests__/handlers/auth/auth.test.ts`.
- One test file per source file. Do not split a file's tests across multiple test files.
- Integration tests that span multiple layers go in `src/__tests__/integration/`. Name them after the flow they test: `auth-flow.test.ts`, `create-item.test.ts`.
- Test utilities and shared fixtures go in `src/__tests__/helpers/`. Never import from outside this directory in test files.
- `vitest.config.ts` at each workspace root sets `include: ['src/__tests__/**/*.test.ts']` (or `.tsx`).

### Why not co-located

Co-located tests (`Component.test.tsx` next to `Component.tsx`) scatter test files across every directory and make it impossible to tell at a glance whether a directory contains source, tests, or both. A single `__tests__/` tree means:

- `find src -name '*.test.*'` returns zero results outside `__tests__/`.
- Deleting a component never silently orphans a test.
- CI can target `src/__tests__/` directly without glob gymnastics.
- The source tree is readable without filtering noise.

---

## Tooling Setup Checklist

The following must be configured from commit one. These are not "add later" tasks.

### ESLint

- `@typescript-eslint/eslint-plugin` with `strictTypeChecked` ruleset.
- `eslint-plugin-unused-imports` -- unused imports are an error, not a warning.
- `curly: 'error'` -- always use braces on if/else/for/while.
- `@typescript-eslint/no-explicit-any` -- no `any`, ever. Use `unknown` and narrow.
- `@typescript-eslint/naming-convention` -- camelCase for functions and variables, PascalCase for types and components.
- Lint warnings are build failures. CI must run `pnpm lint --max-warnings=0`.

### Prettier

```json
{
  "singleQuote": true,
  "jsxSingleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 80,
  "arrowParens": "always",
  "bracketSpacing": true
}
```

### Lefthook

`lefthook.yml` at the repo root must include at minimum:

```yaml
pre-commit:
  parallel: true
  commands:
    lint-server:
      glob: 'apps/server/**/*.{ts,js}'
      run: pnpm --filter ./apps/server run lint
    lint-web:
      glob: 'apps/client/web/**/*.{ts,tsx}'
      run: pnpm --filter ./apps/client/web run lint
    format-check:
      glob: '**/*.{ts,tsx,js,scss}'
      run: pnpm format:check
    no-em-dash:
      glob: '*.{ts,tsx,js,md,scss}'
      run: |
        EMDASH=$(printf '\xe2\x80\x94')
        if grep -rn "$EMDASH" {staged_files} 2>/dev/null; then
          echo 'Em dash (U+2014) found. Use a period, comma, or colon instead.'
          exit 1
        fi
    migration-defaults:
      glob: '**/migrations/**/*.{ts,js}'
      run: |
        pattern="default:\s*[\"'].*[\"'].*[\"']"
        if grep -En "$pattern" {staged_files} 2>/dev/null; then
          echo 'ERROR: Migration default appears double-quoted. Use bare strings or pgm.func().'
          exit 1
        fi

commit-msg:
  commands:
    fix-requires-test:
      run: |
        subject=$(head -1 {1})
        if echo "$subject" | grep -qE '^(fix|bug|bugfix|hotfix)(\(.+\))?!?:'; then
          if ! git diff --cached --name-only | grep -qE '\.(test|spec)\.(ts|tsx|js)$'; then
            echo 'fix: commits require at least one test file staged.'
            exit 1
          fi
        fi

pre-push:
  commands:
    build:
      run: pnpm build
```

### PostHog

- Install `posthog-node` on the server for server-side event tracking.
- Install `posthog-js` on the client for pageview and UI interaction tracking.
- All event names are typed constants in `packages/constants/src/analytics.ts`. No magic strings.
- Route all PostHog traffic through a reverse proxy at an opaque path. Configure before launch.

### Sentry

- Install `@sentry/node` on the server, `@sentry/nextjs` on the web client.
- Initialize before any business logic in both `app.ts` and `layout.tsx`.
- Set `environment: process.env.NODE_ENV` in both initializations.
- Wire Sentry user context in `loadSession` middleware.
- Upload source maps to Sentry in CI on every production deploy.

### Cloudflare R2

- Create the R2 bucket and API token before writing any image upload code.
- Add a CDN domain in front of R2 for public reads (not the default R2 URL).
- Validate all env vars at startup via `validateEnv()`.
- Image keys follow `{entity-type}/{entity-id}/{uuid}.{ext}`. Store keys in the DB, not full URLs.
- File size and MIME type validation happen on the server before the R2 upload.

### Railway

```
Railway Project
├── api        # Express/TypeScript server
├── web        # Next.js frontend
├── postgres   # Managed Postgres (with PostGIS extension enabled if needed)
└── redis      # Managed Redis (for BullMQ background jobs)
```

- Set the root directory for each service in Railway settings (`apps/server/` and `apps/client/web/`).
- Set `NODE_ENV=production` on both `api` and `web` services.
- Run migrations as a `prestart` script, not a separate deploy step.
- Railway healthcheck path: `/health`.
- Set all env vars before the first deploy. A deploy with missing vars is not a deploy.

---

## Auth Boilerplate

Auth must be present from commit one. Do not build any user-facing functionality before the auth system is wired.

### Architecture

Custom cookie sessions. No Passport.js. No NextAuth. No JWT. A `sid` cookie holds a raw token; the database stores only its SHA-256 hash.

```
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me          (requires auth)
PATCH /auth/me         (requires auth)
POST /auth/forgot-password
POST /auth/reset-password
```

### Database migrations (ship in this order)

**Migration 1: create-users** -- includes the shared `set_updated_at()` trigger function.

**Migration 2: create-sessions** -- `token_hash`, `user_id`, `expires_at`. Index all three columns.

**Migration 3: create-password-resets** -- `token_hash`, `user_id`, `expires_at`, `used_at`.

### Session constants

```typescript
export const SESSION_COOKIE_NAME = 'sid';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
```

### Auth repository key patterns

- Tokens: SHA-256 hash goes in DB, raw token goes in the cookie. A DB dump never exposes live sessions.
- `createUserAndSession`: single transaction. Never create them separately.
- `authenticate`: returns `null` for both wrong email and wrong password. Never distinguish which case.
- `loginUser`: deletes only expired sessions, then creates a new one. Allows concurrent sessions.
- Password reset tokens expire in 1 hour. On success: update password, mark token used, delete all sessions.
- bcrypt salt rounds: 12.

### Session cookie options

```typescript
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
    sameSite: isProduction() ? ('lax' as const) : ('lax' as const),
    secure: isProduction(),
  };
}
```

Use `SameSite: 'lax'` when frontend and backend share the same Railway domain. Switch to `'none'` + `secure: true` only if running on separate domains.

### Middleware

**`loadSession`**: populates `req.user` and sets Sentry user context. Never blocks unauthenticated requests.

**`requireAuth`**: returns 401 if `req.user` is undefined. Wire per-route on protected endpoints.

Register `loadSession` globally in `app.ts` after cookie-parser, before routes.

### Handler security rules

- `register`: catch Postgres `'23505'` and return 409 "Email already registered". Never re-throw raw Postgres errors.
- `login`: return 401 "Invalid email or password" on failure. Never say which field was wrong.
- `logout`: always return 204, even if no session existed.
- `forgotPassword`: always return 200 regardless of whether the email exists.
- `resetPassword`: check both `used_at` and `expires_at`. On success: update password, mark token used, delete all user sessions.

### Next.js middleware pattern

`ROUTE_MAP` (exact paths) + `PREFIX_RULES` (dynamic segments). Default to `'private'` for unlisted routes. Cookie presence check only -- real auth gate is the `(protected)` layout server component.

### Route groups

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── loading.tsx
│   └── auth.module.scss
├── (protected)/
│   ├── layout.tsx   # server component: calls /auth/me, redirects if null
│   └── ...
└── layout.tsx       # root: providers, Sentry, PostHog init
```

### `useAuth` hook

Wraps all auth operations in TanStack Query mutations. Query key: `['auth', 'me']`. Call `posthog.identify(user.id)` on login/register. Call `posthog.reset()` on logout.

### `express.d.ts` type augmentation

```typescript
import type { User } from '@repo/types';
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
```

---

## Docs Directory Structure

```
docs/
├── superpowers/
│   ├── specs/
│   └── plans/
├── todos/
│   ├── P0-launch-blockers.md
│   ├── P1-high-value-post-launch.md
│   ├── P2-nice-to-have.md
│   └── P3-later.md
├── user-stories/
├── feature-list/
│   └── features.md
├── recurring-bugs/
├── session-handoff/
│   └── session-handoff.md
└── query-params.md
```

Rules:

- Todos are the single source of truth for work. All work items live in one of the four priority files.
- Every new route query param is documented in `docs/query-params.md` in the same commit.
- Shipped specs and plans are deleted. The code is the spec once it ships.
- `docs/session-handoff/session-handoff.md` is the single current handoff. Previous handoffs are in git history.

---

## Enforcement

Pre-commit hooks in `lefthook.yml` refuse commits that violate these rules. If a hook fires, fix the underlying code, not the hook. Do not bypass with `--no-verify` without explicit user authorization.

Enforced today:

- **Em dash ban:** a PreToolUse hook on Write/Edit/Bash blocks U+2014 in any output.
- **Format check:** `pnpm format:check` on pre-commit.
- **Lint:** `pnpm lint` on pre-commit.
- **Fix-commit gate:** commits with `fix:` / `bug:` / `bugfix:` / `hotfix:` subjects must include at least one test file.
- **Pre-push full suite:** `pnpm format:check`, `pnpm lint`, server build, server tests.

If a new rule is worth enforcing, add it as a hook, not as documentation. Documentation is a request. A hook is a refusal.
