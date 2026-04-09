# template-express-next

Express 5 + Next.js 15 monorepo template. This file is auto-loaded on every session and contains rules that apply to the whole repo. Workspace-specific conventions live next to the code they govern:

- `apps/client/web/CLAUDE.md` for frontend, styling, component patterns, TanStack Query, no-Tailwind, per-component folders, `displayName`, `data-test-id`, Vercel deployment (auto-loaded when working in `apps/client/web/`)
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
- **Deployment:** Railway (server) plus Vercel (web). EAS for mobile builds.

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

Railway and server-specific deployment details live in `apps/server/CLAUDE.md`. Vercel specifics live in `apps/client/web/CLAUDE.md`.

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

| Task Type | Recommended Model | Examples |
|-----------|------------------|----------|
| Mechanical / repetitive | Sonnet or Haiku | Copy a pattern, add a CI config file, rename imports, apply a known fix |
| Deep reasoning | Opus | Architecture decisions, complex refactoring, debugging, designing new abstractions |

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
  - **Examples that must be `chore:`:** Dockerfile changes, `package.json` dep removals, pnpm workspace config, Next.js config, Vercel serverless bundle fixes, env var renames, lefthook config.
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

## Enforcement

Pre-commit hooks in `lefthook.yml` refuse commits that violate these rules. If a hook fires, fix the underlying code, not the hook. Do not bypass with `--no-verify` without explicit user authorization.

Enforced today:

- **Em dash ban:** a PreToolUse hook on Write/Edit/Bash blocks U+2014 in any output.
- **Format check:** `pnpm format:check` on pre-commit.
- **Lint:** `pnpm lint` on pre-commit.
- **Fix-commit gate:** commits with `fix:` / `bug:` / `bugfix:` / `hotfix:` subjects must include at least one test file.
- **Pre-push full suite:** `pnpm format:check`, `pnpm lint`, server build, server tests.

If a new rule is worth enforcing, add it as a hook, not as documentation. Documentation is a request. A hook is a refusal.
