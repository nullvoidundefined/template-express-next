# Engineering Audit: template-express-next (Final, 2026-04-09)

**Auditor:** CTO perspective, primary concern = preventing another "three days of slop code" incident caused by drifted CLAUDE.md files and bad in-repo precedents.
**Scope:** Delta audit on top of `docs/audits/2026-04-09-engineering.md`. Focus areas: (1) CLAUDE.md vs code accuracy, (2) bad precedents, (3) missing enforcement, (4) test infrastructure reality, (5) dependency gaps.
**Last commit audited:** `e8ff293 feat: add Playwright E2E scaffold with auth flow tests`
**Verified by running:** `pnpm --filter ./apps/server run test` and `pnpm --filter ./apps/client/web run test`.

---

## Executive Summary

Enormous progress since the prior audit. The three original P0s (missing `bullmq`/`ioredis`/`playwright`, application-specific code leakage, wrong package names) are fixed. Legacy dashboard code is gone. Migrations are reduced to `users` and `sessions`. Tests have been moved into `src/__tests__/`. Web tests, E2E scaffolding, and scoped pre-commit hooks have landed.

However, the template is **still not ready for a developer to clone, install, and trust**. A clean `pnpm install && pnpm test` on `main` today produces a **red server test suite** from a real bug (not an environment problem), the documented auth happy path routes users to a page that does not exist, the CLAUDE.md-vs-code drift you specifically wanted eliminated still has five live contradictions that will mislead the first developer who reads them, and the fix-commit-gate, em-dash ban, and other "enforced" rules have no corresponding hooks on disk.

**Top three priorities (P0 blockers):**

1. **Server tests are red on a clean clone.** `src/__tests__/middleware/requestLogger/requestLogger.test.ts` fails at module load with a vi.mock hoisting error. The `vi.mock` factory references `pino` from a top-level import that is hoisted after the mock. Every developer who clones this template today sees 1 failed suite on their first `pnpm test`. This poisons trust in the test signal permanently.
2. **Auth happy path redirects to a 404.** Both `login/page.tsx` and `register/page.tsx` call `router.push('/dashboard')` on success, but no `/dashboard` route exists. There is no `(protected)/` route group, no `dashboard/page.tsx`, nothing. The unit test asserts the redirect URL matches that dead route, so the test is green. The E2E test asserts `page.toHaveURL('/dashboard')` and will **fail on first run** once the user lands on Next.js's 404. The template ships a demo auth flow that looks like it works in unit tests but is broken end to end.
3. **"Enforced" rules in CLAUDE.md have no hooks.** Root CLAUDE.md Enforcement section claims the em-dash ban, fix-commit gate, and format check are enforced by PreToolUse hooks and lefthook. Only `lefthook.yml` format/lint hooks exist in this repo; the PreToolUse em-dash hook and the fix-commit gate are not in `lefthook.yml`. These are documented as guaranteed and will be silently violated. This is the exact failure mode the user said they want eliminated.

---

## Operational Basics

| Check | Status | Notes |
|---|---|---|
| Tests run in CI | YES | `.github/workflows/ci.yml` runs `pnpm run test:coverage` |
| Tests actually pass | **NO (P0)** | 1 suite fails at load on clean checkout. See #1 above. |
| CI green | **UNKNOWN / likely red** | The failing test is in the committed tree; CI will reject. |
| E2E tests exist and are wired | PARTIAL | `playwright.config.ts` and `e2e/auth.spec.ts` exist. **Not wired to CI.** `ci.yml` has no Playwright step. `pnpm test:e2e` exists at root but nothing invokes it on push. |
| E2E tests will pass | **NO** | They assert redirect to `/dashboard` which does not exist. |
| Frontend tests exist | YES | `apps/client/web/src/__tests__/` with 2 passing suites (10 tests). |
| Frontend tests wired to pre-push | YES | `lefthook.yml` pre-push runs `test-web`. |
| Error tracking | NO | No Sentry integration, no documented plan. |
| Rollback plan | NO | No documented rollback procedure. |
| Monitoring | PARTIAL | `/health` and `/health/ready` exist; no alerting. |

---

## P0: CLAUDE.md vs Code Drift (Primary Concern)

This is the section that directly addresses "avoid ending up in the same circumstances as yesterday." Each contradiction below will cause an AI or a developer following CLAUDE.md to produce wrong code.

### P0-D1: Server entry point contradicts `apps/server/CLAUDE.md`

`apps/server/CLAUDE.md` "Entry Point Pattern" mandates two files:
- `src/index.ts` loads env, then `await import('app/app.js')`.
- `src/app.ts` creates and starts the Express server.

The actual code has `src/index.ts` doing the dynamic import, **but `src/app.ts` does not start the server** in the shape the doc shows. Instead, `src/app.ts` contains `app.listen(PORT, HOST, ...)` at module scope alongside `pool.on('error')`, `process.on('uncaughtException')`, `process.on('SIGTERM')`, the session cleanup interval, and the shutdown handler. This is functional but contradicts the "two-file pattern" as documented. The documented example shows `app.ts` exporting `app` and starting an HTTP server with a separate call; the real code conflates those responsibilities.

**Severity: Major.** A developer (or AI) following the doc will try to split the file and break the graceful shutdown chain.

**Fix: either** rewrite the doc to describe the actual structure (`index.ts` is a thin env-loader shim, `app.ts` contains everything including listen/shutdown), **or** refactor `app.ts` to match the doc.

### P0-D2: `/dashboard` route group is documented and missing

`apps/client/CLAUDE.md` and `apps/client/web/CLAUDE.md` both show a full `(protected)/layout.tsx` + `(protected)/dashboard/page.tsx` scaffold in their directory diagrams. The actual `apps/client/web/src/app/` has only `(auth)/`. No `(protected)/`, no `dashboard/`, nothing.

**This is worse than just a doc drift** because both `login/page.tsx:26` and `register/page.tsx:26` call `router.push('/dashboard')` and the login unit test at `apps/client/web/src/__tests__/app/(auth)/login/page.test.tsx:72` asserts `push` was called with `/dashboard`. The test passes by asserting the navigation call, not by verifying the destination exists. This is exactly "green test, broken app" confidence theater.

The E2E test at `e2e/auth.spec.ts:14` asserts `await expect(page).toHaveURL('/dashboard')`. It will fail on first real run because Next.js will serve 404 for `/dashboard`.

**Severity: Critical.** The template's shipped demo flow is structurally broken.

**Fix: create** `apps/client/web/src/app/(protected)/layout.tsx` with an auth guard and `(protected)/dashboard/page.tsx` with a stub. Or, if the intent is to leave this to the user, remove the `/dashboard` redirects from the auth pages and the unit-test assertion and the E2E assertion.

### P0-D3: `/health` endpoint contradicts `apps/server/CLAUDE.md` (now resolved, retained for retirement log)

The previous audit flagged that `/health` did a DB + Redis + queue check. The current `app.ts` has been corrected to match the CLAUDE.md contract: `/health` returns `{ status: 'ok' }` fast, `/health/ready` does DB check. **This is fixed.**

### P0-D4: Named-export rule vs actual `export default` usage

Root CLAUDE.md rule 5 was updated to include a Next.js App Router exception: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`, `route.ts` are exempt. Good, the doc matches the reality of the Next.js files.

**But:** files outside App Router still use `export default` and are not covered by the exception:

- `apps/server/src/db/pool/pool.ts:63` runs `export default pool;` (backend; rule says "never `export default`, in either the frontend or backend")
- `apps/client/extension/entrypoints/background.ts:5` runs `export default defineBackground(...)` (WXT convention, not Next.js)
- `apps/client/extension/entrypoints/content.ts:5` runs `export default defineContentScript(...)` (WXT convention)

The WXT entrypoint files are a genuine framework requirement like Next.js. The `pool.ts` default export is a straight violation with no framework excuse. The file also does named exports of `query` and `withTransaction`, so the default export is duplicative.

**Severity: Major** for `pool.ts` (false precedent that will propagate), **minor** for WXT files (needs a documented exception in root CLAUDE.md).

**Fix:** remove `export default pool;` from `pool.ts`. Add WXT entrypoints to the exception list in root CLAUDE.md rule 5.

### P0-D5: `eslint-config-prettier` version skew across workspaces

Two workspaces pin radically different major versions:
- `apps/server/package.json`: `"eslint-config-prettier": "^10.1.8"`
- `apps/client/web/package.json`: `"eslint-config-prettier": "^8.6.0"`

Version 8 to 10 is two major bumps. CLAUDE.md does not mention this. Lint and format drift between workspaces is exactly the "bad precedent that compounds" pattern. A developer adding a new rule to one workspace will assume the other matches.

**Severity: Major.** Silent drift in tooling configuration.

**Fix: unify on `^10.x`** (the server version). Bump web client and commit lockfile.

### P0-D6: `e2e/auth.spec.ts` uses 4-space indentation, rest of repo uses 2-space

The entire server and web codebase uses 2-space indentation (matching the Prettier config `tabWidth: 2` in `apps/client/web/CLAUDE.md`). `e2e/auth.spec.ts` and `playwright.config.ts` use **4-space** indentation. There is no Prettier config at the repo root and Playwright files are not scoped into any workspace's format:check. First time someone runs `pnpm format` on the repo root (or wires Prettier to cover `e2e/`), every line gets reformatted.

**Severity: Major.** New precedent being set in a freshly-committed file. Fix before it propagates.

**Fix:** reformat `e2e/auth.spec.ts` and `playwright.config.ts` to 2 spaces. Add `e2e/**` to a root-level Prettier config or to an existing workspace's format command.

---

## P1: Bad Precedents Already in the Committed Code

These are patterns a developer or AI will copy when adding the next feature. Each one violates a CLAUDE.md rule.

### P1-B1: `handlers/auth/auth.ts` returns a hand-rolled transform instead of using shared types

`toUserResponse(user: User)` in `handlers/auth/auth.ts:9` maps `created_at` to `createdAt` inline. The web client defines its own `User` type in `state/useAuth.ts:7` with a `// TODO: move to @repo/types` comment. Both sides manually describe the same shape. This is exactly the pattern that generated the `created_at` vs `createdAt` bug that commit `ff5c943` fixed. The **mechanism** that caused the bug is still in place.

**Severity: P1.** The next field added to the user shape will drift again. The tests green-light the drift because the server test asserts `createdAt` against a hand-built literal, not against a `@repo/types` shape.

**Fix:** define `UserResponse` in `packages/types/src/index.ts`, import it from both the server handler and the web `useAuth.ts`, delete the web-local definition. This is the concrete justification for `@repo/types` existing at all. Right now `packages/types` is an empty stub file and no workspace depends on it. A shared type package that nothing imports is theatre.

### P1-B2: `api.ts` on the web client performs unchecked property access on `unknown`

`apps/client/web/src/services/api.ts:25` reads:

```
throw new Error(data?.error?.message ?? 'Request failed');
```

where `data` is typed as `unknown`. This should emit a TypeScript error in strict mode on `data?.error?.message` (property access on `unknown`). The fact that the file compiles suggests the project's strict flags or lint rules are not catching it (ESLint does not enforce `no-unsafe-member-access`). A developer following this pattern will paste the same `unknown`-then-`?.` pattern and strict mode will silently fail to catch real bugs.

**Severity: P1.** This precedent teaches the next contributor that unchecked property access on `unknown` is acceptable.

**Fix:** add a Zod schema for the error response shape (`{ error: { message: string } }`), parse the response body through it, and only then access `parsed.error.message`. This is what the root CLAUDE.md says to do at trust boundaries.

### P1-B3: Login test mocks `@/state/useAuth` in a way that hides a hoisting hazard

`apps/client/web/src/__tests__/app/(auth)/login/page.test.tsx`:

```
vi.mock('@/state/useAuth', () => ({
  useAuth: () => ({ ..., login: mockLogin, ... }),
}));
const mockLogin = vi.fn();
```

`vi.mock` is hoisted above all imports. `mockLogin` is declared **after** the mock call. This works only because the factory returns a function that captures `mockLogin` by closure and is not called until later. If a developer refactors this to return `{ useAuth: { login: mockLogin } }` (object literal) it will crash at hoist time with `Cannot access 'mockLogin' before initialization`. This is the same error class as the server `requestLogger.test.ts` failure (P0). The mock style works **here** by accident.

**Severity: P1.** Bad precedent that will bite during a trivial refactor. Replace with `vi.hoisted()` for clarity.

### P1-B4: `pool.ts` exports both `default pool` and the named functions

As noted in P0-D4, `pool.ts` has both `export default pool` and `export { query, withTransaction }`. Files that import from it import the default and the named ones together (`import pool, { query } from 'app/db/pool/pool.js'` in `app.ts:3`). A future developer will either import the default pool in one place and named `pool` in another, creating two "pool" references, or will keep the default-then-named pattern and spread it to other files.

**Severity: P1.** This is the seed of export-style drift.

### P1-B5: No component follows the documented `components/ComponentName/` folder pattern

`apps/client/web/CLAUDE.md` section "Directory Structure" and rule 3 of the frontend non-negotiables require per-component folders with co-located `.module.scss`. The template has **zero components** in `apps/client/web/src/components/`. The directory exists but is empty. Every inline form in `login/page.tsx` and `register/page.tsx` is raw JSX with no extracted components.

This is not wrong (pages are allowed to be pages), but it means the first developer **has no example** of the mandatory `ComponentName/ComponentName.tsx + ComponentName.module.scss + displayName + data-test-id` pattern they are supposed to follow. The CLAUDE.md describes a pattern the template never demonstrates. AIs asked to "create a component following the template's conventions" will have no in-repo reference and will improvise.

**Severity: P1.** The template needs at least one example component that fully demonstrates the convention, including `displayName`, `data-test-id`, and a passing test.

### P1-B6: `apps/client/extension` and `apps/client/mobile` have no `package.json`

`pnpm-workspace.yaml` lists `apps/client/extension` and `apps/client/mobile` as workspaces. Neither directory has a `package.json`. `pnpm install` may emit warnings about missing manifests on every run. The workspaces are half-scaffolded: they have `entrypoints/`, `providers/`, `services/`, `state/`, but no manifest, no dependencies, no build config.

**Severity: P1.** The pnpm-workspace entry is aspirational, not real. Either remove them from `pnpm-workspace.yaml` until they are real, or ship minimal `package.json` stubs so the workspace graph resolves cleanly.

---

## P2: Missing or Broken Enforcement

### P2-E1: Em-dash ban is documented as enforced; no hook exists in this repo

Root CLAUDE.md "Enforcement" section claims: "Em dash ban: a PreToolUse hook on Write/Edit/Bash blocks U+2014 in any output." This is a *user-level* hook in Ian's personal Claude Code settings, not a repo-level hook. There is no `.claude/hooks/` or equivalent in this repo. The rule is enforced **only** on Ian's machine, not on any other contributor's machine and not in CI. If the user's global hook ever breaks or is not installed on a fresh machine, the rule silently stops firing. CLAUDE.md presents it as a guarantee of the repo.

**Fix:** document honestly that this is a user-level hook and ship a repo-level grep (`lefthook.yml` pre-commit and a CI step) that greps for U+2014 in the staged diff. The repo is the only place an enforcement guarantee can be made.

### P2-E2: Fix-commit-requires-test gate is documented as enforced; no hook in `lefthook.yml`

Same pattern: CLAUDE.md says "Fix-commit gate: commits with `fix:` / `bug:` / `bugfix:` / `hotfix:` subjects must include at least one test file." `lefthook.yml` has four `pre-commit` jobs (lint-server, lint-web, format-server, format-web) and two `pre-push` jobs. **No fix-commit gate exists.** A developer writing `fix: foo` without a test will succeed.

The previous audit noted four unpaired fix commits in the 30-day history. That pattern will continue without enforcement.

**Fix:** add a `commit-msg` hook in `lefthook.yml` that runs a small script. The script checks the commit subject against the fix pattern and, if matched, checks the staged file list for at least one file matching `**/*.test.ts*`. Reject if none.

### P2-E3: Pre-push does not run `pnpm build`

CLAUDE.md Enforcement says: "Pre-push full suite: `pnpm format:check`, `pnpm lint`, server build, server tests." The actual `lefthook.yml` pre-push runs only `test-server` and `test-web`. No format check, no lint, no build. The README implies otherwise and the enforcement section explicitly lists build. Build errors (missing types, wrong import paths) will land on `main` and only get caught in CI.

**Fix:** add `format-check`, `lint`, and `build` jobs to pre-push, or update the doc to reflect reality.

### P2-E4: CI does not run E2E tests

`playwright.config.ts` and `e2e/auth.spec.ts` are committed. `package.json` scripts include `test:e2e`. Nothing in `.github/workflows/ci.yml` invokes it. The E2E suite is a committed artifact that never runs. A template documenting E2E as mandatory must run E2E in CI; otherwise the suite decays. Given P0-D2 (the tests would fail today), adding the CI step will surface the `/dashboard` bug immediately, which is the right outcome.

### P2-E5: Server vitest coverage threshold is 80%, CLAUDE.md says 60%

`apps/server/vitest.config.ts:28-32` sets branches/functions/lines/statements thresholds to 80%. Parent project convention docs at `/Users/iangreenough/Desktop/code/personal/.claude/CLAUDE.md` say "Coverage target: 60% minimum." The root repo `apps/server/CLAUDE.md` also says "Coverage target: 60% minimum." The actual threshold is 80%. Either the doc lied or the threshold drifted.

**Severity: P2.** Harmless now (coverage is high), but it is one more place CLAUDE.md and reality disagree.

### P2-E6: No `.prettierrc` at the repo root

Formatting rules are implicit in each workspace's `prettier` command. There is no root Prettier config. Files outside a workspace (top-level `README.md`, `docs/`, `e2e/`, `lefthook.yml`, `Dockerfile`, `playwright.config.ts`) are not formatted by any workspace's format task. The 4-space indentation in `e2e/auth.spec.ts` is a direct consequence. Without a root Prettier config, every new top-level file depends on whatever the author's editor defaults to.

---

## P3: Test Infrastructure Reality

### P3-T1: The server test failure (confirmed on clean `main`)

Running `pnpm --filter ./apps/server run test` gives: `Test Files 1 failed | 12 passed`. **Confirmed on a clean checkout of `main`.**

The failure is in `requestLogger.test.ts` because of a hoisting bug in `vi.mock`. Note: `vi.mock('app/utils/logs/logger.js', () => ({ logger: pino({ level: 'silent' }) }))` references `pino`, which is imported at the top of the test file. Vitest hoists the `vi.mock` call above the import. At the moment the factory is called during module setup, `pino` has not been initialized yet, and the factory throws `Cannot access '__vi_import_2__' before initialization`.

**Fix:** use `vi.hoisted` to declare the logger reference before the mock. Standard vi.mock pattern.

### P3-T2: Pre-push runs tests but this broken test will be caught

Since `lefthook.yml` pre-push runs `test-server`, the failure **will** fire on the next `git push`. Good news: the hook will block the push. Bad news: the failing test is already committed on `main`, so either the hook was bypassed with `--no-verify` at some point or the test was broken by a change that was not pre-pushed through this path. Either way, the chain of custody for "when did this test start failing" is a worthwhile forensic exercise for the R-207 "investigate hook drift" rule.

### P3-T3: Tests that exist are real, not tautological (good news)

I read the three test files with the most surface area:
- `apps/server/src/__tests__/handlers/auth/auth.test.ts` mocks the repo boundary (the correct boundary per the Testing anti-patterns R-200 list), asserts HTTP status codes and response body shapes. **Real tests.**
- `apps/client/web/src/__tests__/app/(auth)/login/page.test.tsx` uses RTL `getByRole`, `getByLabelText`, asserts user-visible behavior (disabled state, error alert role, href). **Real tests.** However, see P1-B3 for the hoisting fragility and P0-D2 for the `/dashboard` assertion that will break when E2E actually runs.
- `apps/client/web/src/__tests__/services/api.test.ts` stubs global fetch, asserts request options and response handling. **Real tests.**

The test quality is good. The problem is the failing one, the coverage of redirection targets, and the missing enforcement that these tests keep mirroring reality as code changes.

### P3-T4: Web coverage threshold is 60%, but there is exactly 1 page-level test

With only 2 test files (api + login page), coverage across the web client will be far below 60%. A `pnpm test:coverage` run on the web client will fail the coverage gate **unless coverage excludes enough files**. The web `vitest.config.ts` excludes only `src/__tests__/**`. Everything else counts. The gate is not running yet on coverage (`pre-push` runs `test-web` not `test:coverage`), so this will surface the first time someone runs the coverage task. Either add more tests or relax the excludes to cover-only `services/`.

---

## P3: Dependency Gaps

### P3-D1: `packages/types` and `packages/client-shared` have no consumers

Both packages exist. Neither is listed in any other workspace's `package.json` `dependencies`. Both have stub `src/index.ts` files with only comments. The root CLAUDE.md rule 7 says "Shared types live in `packages/types/`. Any TypeScript type that is used by two or more surfaces must be defined in `@repo/types` and imported from there." But there are no shared types yet, and **the web client has already violated the rule** by declaring its own `User` type in `state/useAuth.ts:7` with a TODO comment. The rule is half-born.

**Severity: P3.** Not blocking. But the rule should either be enforced (move `User` now, even as the only type) or the packages should be marked "not yet activated" so a developer does not waste time importing from empty files.

### P3-D2: Root `package.json` has `@bottomlessmargaritas/claude-architecture-prompts` as a runtime dependency

```
"dependencies": {
  "@bottomlessmargaritas/claude-architecture-prompts": "3.0.0"
}
```

This is a template repository. It should not have runtime dependencies at the repo root. This package exists only for Claude Code tooling context. It should be a `devDependencies` entry at most, or moved out entirely. A developer cloning this template to build a production app will inherit a Claude-tooling dependency in their production dependency graph.

**Severity: P2.** Downgrade this to `devDependencies` or remove from the template.

### P3-D3: `apps/client/web/package.json` `"engines"` still at `>=20.9.0`

Root and server say `>=22.0.0`. Web says `>=20.9.0`. Prior audit flagged. Still not fixed.

---

## Credential Exposure Scan

Delta from prior audit. No new artifacts committed that would reintroduce credential paths. `.env.example` is clean of secrets. No new .env* files committed. Git history is unchanged in the relevant commits. No scan required beyond the prior audit's pass. Deferring full rescan until next cadence.

---

## Bad Precedent Register (Summary)

| ID | Location | Precedent | Impact |
|---|---|---|---|
| P1-B1 | `handlers/auth/auth.ts` + `state/useAuth.ts` | Hand-rolled type transform, duplicated User type | Every new shared type will drift |
| P1-B2 | `services/api.ts` | `unknown` + `?.` chained access | Teaches unchecked property access at trust boundary |
| P1-B3 | `login/page.test.tsx` | `vi.mock` referencing TDZ-risk variable | Will crash under trivial refactor |
| P1-B4 | `db/pool/pool.ts` | Both default and named export | Export-style drift |
| P1-B5 | `components/` empty | No example of `ComponentName/ComponentName.tsx` pattern | AI/developer has no in-repo reference |
| P1-B6 | extension, mobile | Workspace declared without package.json | pnpm warnings, phantom workspaces |
| P0-D6 | `e2e/auth.spec.ts` | 4-space indent in a 2-space repo | New precedent in a fresh file |

---

## Runbook-vs-Code Drift Scan

No `docs/runbooks/` directory exists. Nothing to compare. Consider adding a Railway deploy runbook and a rollback runbook to satisfy the "Monitoring / Rollback plan" gap.

---

## Workspace Hygiene

One copy of the project at the expected path. No duplicates detected.

---

## Prioritized Recommendations

### P0: Blocking, fix before any developer clones this template

**1. Fix the requestLogger test hoisting bug.**
`apps/server/src/__tests__/middleware/requestLogger/requestLogger.test.ts` needs to use `vi.hoisted` or import `pino` inside the factory. Diagnosis in P3-T1. Verify with `pnpm --filter ./apps/server run test` and confirm green.

**2. Create the `/dashboard` route or remove the redirect.**
The documented, tested, E2E-asserted happy path lands on a 404. Either create `apps/client/web/src/app/(protected)/layout.tsx` (with auth guard) and `(protected)/dashboard/page.tsx`, or change the post-login redirect to `/` (the landing page). If creating the protected route, the layout should redirect unauthenticated users to `/login`, which also satisfies the E2E test at `e2e/auth.spec.ts:34`.

**3. Ship repo-level hooks for the three "enforced" rules.**
- Em-dash: add a pre-commit lefthook job that greps staged files for U+2014 and refuses the commit. Do not rely on a user-level hook for a guarantee the repo claims to make.
- Fix-commit gate: add a `commit-msg` lefthook job that checks subject against the fix pattern and requires a staged test file.
- Pre-push build: add `build` to the pre-push lefthook commands alongside `test-server` and `test-web`.

### P1: Fix this sprint

**4. Populate `@repo/types` with the shared `User` type today.**
Define `UserResponse` in `packages/types/src/index.ts`, add `@repo/types` to `apps/server/package.json` and `apps/client/web/package.json`, import from both sides, delete the duplicated web-local type. This is the concrete justification for the package existing. Until this happens, rule 7 in root CLAUDE.md is aspirational.

**5. Remove `export default pool` from `apps/server/src/db/pool/pool.ts`.**
Keep only named exports. Update `app.ts` import.

**6. Add an exemplar component under `apps/client/web/src/components/`.**
One component, full folder structure, displayName, data-test-id, SCSS module, a Vitest test that asserts behavior. Pick something trivially useful, like a `Button` that the login and register pages could use. This gives the pattern a living reference in the repo.

**7. Reformat `e2e/auth.spec.ts` and `playwright.config.ts` to 2-space indentation. Add a root `.prettierrc` and a `format:check` that covers the root-level files (`e2e/`, `docs/`, `Dockerfile`, etc.).**

**8. Unify `eslint-config-prettier` major version across workspaces.**

**9. Replace the `vi.mock` + TDZ pattern in `login/page.test.tsx` with `vi.hoisted()`.**
Prevents the same class of failure as P0-#1.

**10. Wire E2E tests to CI.**
Add a Playwright step to `.github/workflows/ci.yml` that runs after unit tests. Mark the E2E tests as broken for now if necessary, but wire the task.

**11. Remove extension and mobile from `pnpm-workspace.yaml` until they have a `package.json`**, or add minimal manifests.

**12. Fix `services/api.ts` to parse the error response with Zod.**

### P2: Next sprint

**13. Downgrade `@bottomlessmargaritas/claude-architecture-prompts` out of runtime dependencies.**

**14. Reconcile the server vitest coverage threshold (80%) with the documented 60%.**
Pick one and make the docs match.

**15. Fix `apps/client/web/package.json` `"engines"` to `>=22.0.0`.**

**16. Add a Railway deploy runbook and a rollback runbook under `docs/runbooks/`.**
Also addresses the missing rollback plan from operational basics.

**17. Add an error-tracking integration plan to the deployment docs.**
Sentry or equivalent. A production template with no error tracking is incomplete.

**18. Refactor `apps/server/src/app.ts` to match the documented two-file pattern**, or rewrite the doc to reflect the current structure.

### P3: Nice to have

**19. Add negative-input tests to auth handlers.** Oversized payload, injection attempt, malformed encoding. Currently covered only on the happy path and the documented error paths.

**20. Wire a repo-level Prettier config so the full file tree has one source of truth for formatting.**

---

## Closing Note

You asked me to prevent the "three days of slop code because CLAUDE.md was wrong" failure mode. The five live CLAUDE.md-vs-code contradictions above (D1, D2, D4, D5, D6) are exactly that class of trap. The three missing enforcement hooks (E1, E2, E3) are promises the repo is not keeping. The six bad precedents (B1 through B6) are the examples the next session will copy. And the server test suite is red on a clean clone, which destroys the cheapest available signal that anything else is working.

Fix the four P0 items (one failing test, one dead redirect, three missing hooks, CLAUDE.md drift cleanup) before any more feature work. The template is **very close** to being something you can trust, but it is not there today.
