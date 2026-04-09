# Criticism Audit (Final): template-express-next

**Date:** 2026-04-09
**Auditor:** Devil's Advocate (criticism audit role, second pass)
**Model:** Opus
**Primary concern:** Prevent the user from spending another three days writing code that turns out to be slop because of bad CLAUDE.md rules and bad in-repo precedent.
**Last commit audited:** e8ff293
**Supersedes:** `2026-04-09-criticism.md` (prior audit, same day)

---

## The Brutal Truth

Yesterday's audit called this repo an application pretending to be a template. That framing is now obsolete, and credit is due: in the commits between `0e53ffe` and `e8ff293` the author did exactly the afternoon cleanup the prior audit recommended. The dashboard code is gone. The migrations are down to `users` and `sessions`. The package names match the template. Tests moved to `src/__tests__/`. A Playwright scaffold landed. A `tsconfig.json` arrived in `packages/types/`. A stub `src/index.ts` arrived in `packages/client-shared/`. This is a substantially better template than the one audited yesterday.

That is the good news. The bad news is that the cleanup was visual. A fresh clone of `e8ff293` today, running `pnpm install && pnpm build`, **fails the TypeScript type check** in `apps/client/web/src/services/api.ts:25` because the HTTP wrapper dereferences `.error.message` on a value typed as `unknown`. A fresh `pnpm test` produces **13 test files attempted, 1 failing to load entirely** because a `vi.mock` factory accesses a symbol (`logger`) from an out-of-order import chain in `requestLogger.test.ts`. The pre-push hook runs `test:coverage` but not `build`, so the broken build ships green through CI gating and only fails when a human actually runs the command.

This is the exact failure mode the user asked me to stop: code patterns that look plausible, pass the cheap checks, and poison the well for the next three days of feature work. A new feature built on top of `api.ts` in its current shape will either inherit the `unknown`-deref bug or the developer will silently "fix" it by typing it as `any`, at which point every API response shape in the app is now `any`-laundered and type safety is gone for the rest of the project. The `requestLogger` test-ordering bug is the kind of thing an agent will "fix" by reaching for `vi.hoisted` or by disabling the test, neither of which is the right fix, and the next test a developer writes in this template will pattern-match to whichever wrong fix landed first.

In short: the prior audit's structural findings have been addressed, and a new set of smaller but sharper findings has replaced them. The template is no longer a fork with a misleading label. It is now a clean-looking template with load-bearing bugs on the first lines of code a developer will ever touch, and a rule layer that still does not enforce its own claims. That is closer to what the user was burned by yesterday: a surface that signals "this is the way" while teaching the wrong thing.

**The single most important recommendation from this audit: a red `pnpm install && pnpm build && pnpm test` on a fresh clone of `main` must be treated as a Fatal release blocker. Today, that command is red. The rest of this audit is details.**

---

## What Improved Since the Prior Audit

Credit where it is due, without padding. The following prior-audit findings are now fixed, verified in the current tree:

- Application code stripped. `apps/server/src/handlers/` contains only `auth/`. `apps/server/migrations/` contains only `users` and `sessions`. `.env.example` no longer has Twilio, Slack, Resend, GitHub.
- Package name corrected. Root `package.json` is `template-express-next`. Server is `@template/server`.
- Missing deps removed. `bullmq`, `ioredis`, `playwright` are no longer referenced by any source file, because the source that referenced them is gone.
- Tests moved into `src/__tests__/` mirroring the source tree, matching the rule in the root `CLAUDE.md`. Verified by listing, 13 files in the server workspace, all under `__tests__/`.
- `packages/types/` has a `tsconfig.json` (`92b179d`).
- `packages/client-shared/src/index.ts` exists as a stub (`db393de`), so the export map at least resolves.
- Named-exports rule now has an explicit App Router exception (`e2c71a0`).
- Playwright E2E scaffold exists (`e8ff293`), with `playwright.config.ts` and `e2e/auth.spec.ts` covering register, login, invalid login, and protected-route redirect.
- Web workspace has a real test infrastructure (`b57017e`): `vitest.config.ts`, `@testing-library/react`, jsdom env, 2 passing test files, setup file.
- Lefthook pre-commit is now scoped to the affected workspace per staged glob, not full-repo (`a36d311`).
- README rewritten to describe the template itself, not a dashboard application (`bb208aa`).

This is real work. If yesterday's audit is being used as the yardstick, most of the P0 and P1 items closed in a single afternoon. That is what the author is capable of, and it is worth saying plainly.

---

## Fatal Findings (the 3-days-of-slop risk)

### F-1. `pnpm build` fails on a fresh clone

**File:** `apps/client/web/src/services/api.ts:25`

```ts
const data: unknown = await res.json();
if (!res.ok) {
    throw new Error(data?.error?.message ?? 'Request failed');
}
```

`data` is typed `unknown`. `data?.error` is a type error, confirmed by running `pnpm --filter ./apps/client/web run build`:

```
Type error: Property 'error' does not exist on type '{}'.
./src/services/api.ts:25:27
```

The whole Next.js build fails. The server build succeeds, so `pnpm build` at the root is red because of this one file. A developer cloning this template at 11pm, installing, and running `pnpm build` sees a compile error in the most central file in the frontend: the HTTP wrapper that every feature will use. First impression: "this template is broken." First impression is correct.

Worse, this file is load-bearing. Every feature in the web client will either call `api()` directly or be built on top of it. The wrong fix (the one an agent will reach for first) is `const data = (await res.json()) as any`, which launders `any` through every response type in the app and destroys type safety for the rest of the project's life. The right fix is a narrow type guard or a Zod parse of the error envelope. The template does not demonstrate either. It ships a type error and lets the developer pick.

**Severity: Fatal.** This is the exact shape of slop risk the user asked me to catch. A broken build on the critical path file teaches bad habits before the developer has written a single line.

### F-2. `pnpm test` exits non-zero on a fresh clone

**File:** `apps/server/src/__tests__/middleware/requestLogger/requestLogger.test.ts`

Running `pnpm --filter @template/server test` produces:

```
Test Files  1 failed | 12 passed (13)
Tests  90 passed (90)
Caused by: ReferenceError: Cannot access '__vi_import_2__' before initialization
src/__tests__/middleware/requestLogger/requestLogger.test.ts:8:11
src/middleware/requestLogger/requestLogger.ts:1:1
```

All 90 assertions pass. The test file for `requestLogger` fails to load. `vitest` returns exit code 1. The root `pnpm test` script runs this, so `pnpm test` is red on a fresh clone.

The root cause is a `vi.mock('app/utils/logs/logger.js', () => ({ logger: pino(...) }))` that imports `pino` via the factory without `vi.hoisted`, combined with `requestLogger.ts` pulling `logger` at module-load. It is a textbook hoisting-order bug and fixable in three lines. What matters for this audit is not the fix; it is that (a) the template ships with `pnpm test` red, and (b) the pre-push hook `test-server: pnpm --filter ./apps/server run test:coverage` will fail on push, and (c) the developer will now learn that "red tests are the normal state of this repo" from their first hour in it. Every red signal after that is noise because the baseline is already red.

**Severity: Fatal.** Same reason as F-1. A red baseline teaches the developer to ignore red signals.

### F-3. The pre-push hook runs tests but not `build`

**File:** `lefthook.yml`

```yml
pre-push:
  parallel: true
  commands:
    test-server:
      run: pnpm --filter ./apps/server run test:coverage
    test-web:
      run: pnpm --filter ./apps/client/web run test
```

No `build` command. This means F-1 (the web `tsc` failure) is invisible to the pre-push gate. It will only be caught when (a) a human runs `pnpm build`, (b) CI runs `pnpm build`, or (c) Vercel fails the deploy. Every path between commit and deploy that does not run `next build` will report green. That is confidence theater by definition: the hook signals "safe to push" on code that does not compile.

Combined with F-1, this is how the `api.ts` type error got committed in `b57017e`: the hook said yes, the developer pushed, nobody ran build, and now it is on `main`.

**Severity: Fatal.** This is the feedback loop bug. Fix F-3 first (add `build` to pre-push), and F-1 cannot recur without being caught.

---

## Significant Findings

### S-1. The `bottomlessmargaritas` shadow rulebook

**Directory:** `.claude/bottomlessmargaritas/` (committed in `f2166c7 Add @bottomlessmargaritas/claude-architecture-prompts v3.0.0`)

There is a second, complete, parallel rulebook sitting in `.claude/bottomlessmargaritas/`, containing 8 files totaling over 2,000 lines:

- `CLAUDE.md` (73 lines)
- `CLAUDE-BACKEND.md` (701 lines)
- `CLAUDE-DATABASE.md` (328 lines)
- `CLAUDE-FRONTEND.md` (344 lines)
- `CLAUDE-MULTI-REPO.md` (71 lines)
- `CLAUDE-SPEC-TO-BUILD.md` (41 lines)
- `CLAUDE-STYLING.md` (396 lines)
- `CLOUD-DEPLOYMENT.md` (341 lines)

These files are not referenced by any of the primary `CLAUDE.md` files. They are not in `.gitignore`. They are not loaded by the session-start hook. They have drifted from the primary rulebook (the prior author uses em dashes liberally, which are banned in the primary rules). And because they are named `CLAUDE.md`, `CLAUDE-BACKEND.md`, `CLAUDE-FRONTEND.md`, they are exactly what a confused agent will find if it greps for "CLAUDE.md files in this repo" and loads all of them.

This is a supply-chain-ish risk in the rule layer. Someone installed a third-party "claude architecture prompts" package (`@bottomlessmargaritas/claude-architecture-prompts@3.0.0`, still declared as a root `dependency` in `package.json`) and its files landed inside `.claude/` next to the real rulebook. If a session loads both rulebooks, it gets contradictory rules on backend layering, frontend structure, styling, and database conventions, and there is no tiebreak. This is the single biggest drift risk in the current repo.

**Evidence this has already caused confusion:** the primary `.claude/CLAUDE.md` files use the `src/__tests__/` rule; the shadow rulebook does not. The primary rules ban em dashes; the shadow rulebook is saturated with them. An agent loading the shadow file sees "em dashes are fine" and propagates them.

**Severity: Significant.** Not Fatal because the shadow rulebook is probably not loaded by default today. But it is a loaded gun with the safety off, and a single wrong glob in a future session hook will pull the trigger.

**Recommendation:** delete `.claude/bottomlessmargaritas/` entirely. Remove `@bottomlessmargaritas/claude-architecture-prompts` from the root `package.json` dependencies. It is a runtime dependency of nothing. Its presence in `dependencies` (not `devDependencies`) also means it will be installed in the production Docker image, which is a supply-chain exposure for zero gain.

### S-2. The two stale workspace READMEs

**Files:**
- `apps/client/web/README.md`
- `apps/server/README.md`

Both are from the upstream standalone templates that were used to assemble this monorepo. Neither has been updated. Both contradict the current template in concrete, misleading ways:

**`apps/server/README.md`:**
- Calls the project `template-express-js` (wrong name)
- Documents `npm install && npm run dev` (wrong package manager)
- Documents `PORT` default as `3000` (server is `3001` today, `3000` is the web client)
- Documents bcrypt with 10 rounds (server uses `SALT_ROUNDS = 12`)
- Documents `CORS_ORIGIN` default as `http://localhost:5173` (it is `http://localhost:3000`)
- Documents a `DATABASE_SSL_REJECT_UNAUTHORIZED` env var that does not exist in the current `env.ts`
- Says "This template ships without domain-specific resources. To add your own (e.g. entities), follow the existing patterns: Add Zod schemas under `src/schemas/` (for example, start from `entity.ts`)" when there is no `entity.ts`. This is the same lie the prior audit flagged about `handlers/jobs/`, just in a different file.
- Contains U+2014 characters throughout.

**`apps/client/web/README.md`:**
- Calls the project "Next.js app template" (wrong name)
- Describes it as a **standalone** package with "Use it standalone or copy the package into a pnpm monorepo" (it is neither standalone nor copy-installable; it is a fixed workspace in this monorepo)
- Says "Node >=20.9.0" (the rest of the repo is Node >=22)
- Mentions Turbopack, which does not work reliably with this pnpm setup (there is a memory entry `feedback-turbopack-pnpm-fix.md` about this)
- Contains U+2014 characters throughout.

A developer cloning this template and reading either workspace README will be taught wrong facts about the template they are standing in. The root README was rewritten (`bb208aa`); the workspace READMEs were not. This is exactly the "gap between what the docs claim and what the code is" pattern the user asked me to catch.

**Severity: Significant.** Both files should be deleted or rewritten to match reality. Deletion is the right call; the root README is sufficient.

### S-3. `pnpm-workspace.yaml` lists phantom workspaces

**File:** `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/server'
  - 'apps/client/web'
  - 'apps/client/extension'
  - 'apps/client/mobile'
  - 'packages/client-shared'
  - 'packages/tokens'
  - 'packages/types'
```

Of the seven workspaces listed, `apps/client/extension/` and `apps/client/mobile/` have **no `package.json`**. Verified:

```
apps/client/extension/: CLAUDE.md, entrypoints/, lib/, providers/, services/, state/     no package.json
apps/client/mobile/:    CLAUDE.md, app/, providers/, services/, state/                   no package.json
```

Both contain real TypeScript source files that import `wxt`, `expo-router`, `react-native`, `@tanstack/react-query`, `@repo/client-shared`, etc. None of those imports can resolve. Neither workspace has `wxt.config.ts` or `app.json` or `eas.json`. Neither is buildable, testable, or runnable. The extension's `background.ts` uses `export default defineBackground(...)` which violates the named-exports rule and which no lint step will catch because there is no lint step in these workspaces.

pnpm treats an entry in `packages:` without a `package.json` as a non-fatal warning, so nothing breaks today. But every developer and every agent reading `apps/client/CLAUDE.md` sees three client surfaces documented, then looks at the tree and sees files, then tries to do something with those files and discovers they are not wired up. This is the same lie the prior audit flagged ("The `packages/` layer is aspirational"), moved one directory down. The prior audit's fix (stub `packages/client-shared/src/index.ts`) was applied; the larger form of the lie (phantom workspaces under `apps/client/`) was not.

**The CLAUDE.md files for these phantom workspaces are particularly dangerous.** `apps/client/extension/CLAUDE.md` confidently mandates WXT, `browser.*` polyfills, cross-browser compatibility, entrypoint conventions, and auto-imports, with opinionated rules like "Do not use raw `chrome.*` APIs. Always use `browser.*` from the WXT runtime." None of this is exercised by any code that runs. When a developer eventually adds a real extension, they will either (a) follow the rules and discover the scaffold does not support them, or (b) ignore the rules because the existing code already ignores them. Either way the rulebook lost.

**Severity: Significant.** Either build the extension/mobile workspaces for real (add `package.json`, deps, config) or delete both directories and remove the rule files. Half-built is the worst option.

### S-4. The "two lefthook.yml" ambiguity is still unresolved

**Files:**
- `/lefthook.yml` (root, real)
- `apps/server/lefthook.yml` (orphan, not used)

The prior audit flagged this. Nothing has been done. The orphan still exists. A developer opening `apps/server/lefthook.yml` sees a config and reasonably assumes it governs pre-commit inside the server workspace. It does not. The installed hooks reference the root file.

**Severity: Significant.** Deletion is a one-line commit. The longer this sits, the more confidence theater it produces.

### S-5. The server build produces `dist/` but the coverage config treats it as excluded, not tracked

This is subtle and load-bearing. `apps/server/vitest.config.ts` excludes `src/index.ts`, `src/constants/**`, `src/config/**`, `src/types/**`, `src/db/**`, `**/rateLimiter.ts`, `src/__tests__/**`, `dist/**`, `migrations/**`, `scripts/**`, `*.config.*`. The coverage threshold is 80% on branches, functions, lines, statements. **With that exclusion list, 80% coverage is reached without actually exercising the hot path of the server.**

Specifically, `rateLimiter.ts` is excluded from coverage entirely, with no comment. `src/config/**` is excluded (that includes `corsConfig.ts` and `env.ts`, both of which affect production behavior). `src/db/**` is excluded (that includes `pool.ts`, which the prior audit flagged as having the `withTransaction` pattern and SSL logic that is directly load-bearing). `src/index.ts` is excluded (that's the entry point).

The 80% coverage claim is technically true and functionally misleading. Everything risky about the server is excluded from the number. This is metrics theater, mild form. The developer sees green 80% and believes the server is well tested. The server is decently tested on auth specifically, and the production-critical plumbing has zero coverage and is called "excluded." Those are different statements.

**Severity: Significant.** Not Fatal because the auth coverage is real and the excluded surfaces are small. But the exclusion list needs comments (why is each path excluded?) or the excluded paths need tests. "No comment, just excluded" is how coverage fiction grows.

### S-6. The root `CLAUDE.md` still mandates rules that have no enforcement

The root `CLAUDE.md` non-negotiable rule list includes:

- **Rule 4: Alphabetical ordering is mandatory.** No hook enforces this. No lint rule enforces this. It is honor-system, and the existing code already violates it in multiple places (see `apps/client/web/src/app/(auth)/login/page.tsx` imports, which are not alphabetized by module path).
- **Rule 7: Shared types live in `packages/types/`.** `@repo/types` is a stub with no exports and no workspace currently imports it. The rule is a wish; no code follows it.
- **Rule 8: Test files live in `__tests__/`.** This is now enforced in practice (server moved its tests, web structure matches), but there is still no lefthook check that refuses a `*.test.ts` file committed outside `__tests__/`. The rule is honor-system and the honor is currently being kept, which is the most fragile possible enforcement state.

The root `CLAUDE.md` ends with the line: "If a new rule is worth enforcing, add it as a hook, not as documentation. Documentation is a request. A hook is a refusal." That is the correct principle. The rules above are documentation. Half the non-negotiables are requests.

**Severity: Significant.** The specific risk the user asked about: "actively dangerous rules." Rule 7 is the one closest to actively dangerous. Following it today means putting a type into `@repo/types`, watching the import fail because the package exports `src/index.ts` directly without a build step and `tsconfig` project references to resolve `.ts` files across workspaces, and concluding that shared types are broken. The rule asks the developer to use machinery that does not work. That is worse than having no rule.

### S-7. `@repo/types` is a typed-source-only package with no working import path

**File:** `packages/types/package.json`

```json
{
    "name": "@repo/types",
    "main": "./src/index.ts",
    "exports": {
        ".": "./src/index.ts"
    }
}
```

`packages/types/src/index.ts` contains only comments; no actual exports. No workspace declares `@repo/types` as a dependency. Even if one did, importing `@repo/types` from `apps/server/` (which uses `tsc` with `NodeNext` resolution) would fail because Node cannot resolve a `.ts` file through an `exports` map at runtime, and `apps/server/tsconfig.json` has no `references` entry for `packages/types/`.

The `tsconfig.json` that landed in `92b208a` for `packages/types/` does help TypeScript's language server resolve the imports during editing, but does not make the package actually usable at runtime or build time. The whole "shared types" story is still a design claim with no exercised path.

**Severity: Significant.** The first developer who tries to share a type per Rule 7 will spend a half-day fighting resolution and conclude that the rule is wrong. That is the "three-day-slop" pattern, compressed.

**Fix test:** add `@repo/types` as a dependency of `apps/server/` and `apps/client/web/`, export a real type (e.g. `User`), import it from both surfaces, run `pnpm build` and `pnpm test`. If both pass, the rule is alive. Today neither command even gets that far.

### S-8. The `login` handler returns the user **before** password verification reaches the response

Not a bug per se, but an architecture smell in the auth handler that a developer will copy. Look at `apps/server/src/handlers/auth/auth.ts` (the `login` function):

```ts
const user = await authRepo.findUserByEmail(email);
if (!user) { return 401; }
const valid = await authRepo.verifyPassword(password, user.password_hash);
if (!valid) { return 401; }
const sessionId = await authRepo.loginUser(user.id);
```

`findUserByEmail` must therefore return `password_hash` to the handler layer. The handler then hands `password_hash` to `verifyPassword`. This means `password_hash` crosses the handler/service boundary. The rule in `apps/server/CLAUDE.md` is that handlers should delegate to services or repos. In this case the handler is orchestrating business logic (look up, verify, create session) that a `loginUser(email, password)` service on the repo would encapsulate cleanly and never let `password_hash` leave the repository layer.

The risk is not a security bug in this file (timing is acceptable, no leakage). The risk is that this handler is the canonical example a developer will copy when adding the next auth-adjacent handler. They will look at how auth is done, see a handler that reaches into repo internals, and learn that "handlers can reach for database fields directly." Then they write a `resetPassword` handler that also grabs `password_hash`, also does multi-step orchestration in the handler, and the layering rule in `CLAUDE.md` is now a fiction maintained by the author but not by anyone who pattern-matches from the auth handler.

**Severity: Significant.** This is an instance of the "worst in-repo precedent" category the user asked about. The handler is not dangerous. The precedent it sets for the next handler is dangerous.

**Fix:** push the find-plus-verify into a `authRepo.authenticate(email, password): Promise<User | null>` that returns a `User` without `password_hash`, and have the handler call that one function.

### S-9. The `apps/client/web/src/services/api.ts` request wrapper fails alphabetical-keys rule and has no generic constraint on `T`

Same file as F-1, different problem. The wrapper declares `async function api<T>(...)` with no constraint on `T`. Callers do `api<User>(...)`, `api<{ items: Item[] }>(...)`, etc. There is no runtime validation that the response matches `T`. The wrapper returns `data as T`. Every API call in the web client is a type assertion, not a type check.

The template documents Zod as the runtime validator at trust boundaries. `api.ts` ignores Zod entirely. The first developer to add a new API call will copy `api<ResponseShape>(...)` and pass whatever the server sent. When the server shape drifts (e.g., `created_at` vs `createdAt`, which is exactly the bug that commit `ff5c943` just fixed), the type assertion lies and the component crashes on a `.toISOString()` call or similar.

The `fix: return camelCase user fields from auth API responses` commit (`ff5c943`) is load-bearing evidence that this class of bug already happened once in this repo. The fix was to change the server. The bug could have been caught at the client by Zod-parsing the response. The template did not catch it, because the wrapper is an assertion, not a parse.

**Severity: Significant.** This is the exact pattern the user got burned by yesterday: precedent in the template that silently launders type safety away. A developer following the existing pattern will inherit the same class of bug repeatedly.

**Fix:** the wrapper should accept a Zod schema, not a type parameter: `api(path, schema, opts)` returning `z.infer<typeof schema>`. The template needs to demonstrate this on at least one call (auth `/me` is the obvious candidate).

---

## Worth Addressing

### W-1. Coverage config magic exclusions

`apps/server/vitest.config.ts` excludes `**/rateLimiter.ts` from coverage with no comment. Either rate limiter is tested elsewhere (it is; see `src/__tests__/middleware/rateLimiter/rateLimiter.test.ts`) and the exclusion is wrong, or it is deliberately excluded because it is hard to test and the exclusion is a confession. The comment that would explain which is missing.

### W-2. Server `engines.node >=22.0.0` but `apps/client/web/engines.node >=20.9.0`

Still unaligned, same as the prior audit flagged. Ten-second fix.

### W-3. `eslint-config-prettier` version skew

Root of the web workspace declares `^8.6.0`; server declares `^10.1.8`. Two major versions apart. Will not cause immediate breakage but will drift.

### W-4. The `apps/server/CLAUDE.md` service-naming rule still says `kebab-case.service.ts`

The server currently has no `services/` directory at all (the auth flow goes handler -> repo directly). So the rule has nothing to violate today. But the rule is specific about a filename pattern that the template does not demonstrate on any real file. The first service file a developer adds will either follow the rule (producing `something.service.ts`) or not (producing `something.ts`), and there is no reference implementation to copy. Recommend: add a `services/example.service.ts` stub that actually demonstrates the pattern, or drop the `.service` suffix requirement.

### W-5. The `apps/server/CLAUDE.md` layer-responsibility table says "Handlers do NOT contain business logic" while `auth.ts` clearly does

See S-8. The doc contradicts the code. Either weaken the rule or refactor the code.

### W-6. `pnpm test` at the root only runs server tests

Root `package.json`:
```json
"test": "pnpm --filter ./apps/server run test"
```

Web tests are not in `pnpm test`. Web tests only run via the pre-push hook. A developer running `pnpm test` at the root believes they tested everything. They did not. This is mild confidence theater at the script-naming level.

### W-7. The `SessionEnd` of the pre-push hook does not check for em dashes

The em-dash `PreToolUse` hook catches them in real-time writes. It does not catch them in files that already exist and get committed. Ten files in the repo contain U+2014 today (the two stale READMEs, the `.claude/bottomlessmargaritas/` files). A `pre-commit` grep for U+2014 across staged files would be the sibling enforcement mechanism and would have blocked the `f2166c7` commit that pulled the shadow rulebook in.

---

## Minor

### M-1. `.env.example` at the server does not have a comment for `SESSION_SECRET` rotation

Low-importance, but for a template that prides itself on security discipline, the one line about rotating session secrets is worth adding.

### M-2. The `playwright.config.ts` has no `testIgnore` and the `e2e/` directory is one file

Fine for now. Will need a `testIgnore` pattern the first time a fixture file lives next to a spec.

---

## What the Template Actively Teaches vs. What It Claims to Teach

The user asked for this framing specifically. Here is the honest answer, per surface.

| Surface | Claims to teach | Actually teaches |
|---|---|---|
| Backend layering | Routes -> handlers -> services -> repos, never skip | Handlers can reach into repo internals when convenient (auth `login`) |
| Frontend data fetching | TanStack Query, no raw `useEffect` + fetch, Zod at boundaries | Untyped `api<T>` wrapper, `data as T`, zero runtime validation |
| Type sharing | `@repo/types` is canonical for cross-surface types | `@repo/types` is an empty stub with no working import path |
| Named exports only | No `export default` except App Router files | App Router exception is in the rule; extension `background.ts` still uses `export default defineBackground(...)` which is neither an App Router file nor compliant |
| Testing | Tests in `__tests__/`, vitest, 80% coverage, RTL, Playwright | Server: yes, mostly. Web: 2 tests, one of which mocks the thing it tests. E2E: 4 specs, never been run by the audit. Coverage excludes everything risky. |
| Multi-surface client | web + extension + mobile, all unified by `@repo/client-shared` | `web` works. `extension` is source files with no `package.json`. `mobile` is source files with no `package.json`. `@repo/client-shared` is an empty stub. |
| Design tokens | `@repo/tokens` is the single source of truth | `@repo/tokens` builds, but no workspace imports it. The web `globals.scss` was presumably supposed to `@use '@repo/tokens/dist/tokens'` but the current web workspace probably does not (not verified in this audit; a fast follow). |
| Em-dash discipline | Banned everywhere, enforced by hook | 10 files in the repo contain U+2014, including both workspace READMEs and the shadow rulebook |
| Fix-commit discipline | Every `fix:` commit ships with a test | Commit `ff5c943 fix: return camelCase user fields from auth API responses` landed; the `auth.test.ts` changes in the same commit look like they do test the new shape. Verified in place. Good. |

**The pattern:** the template is aspirational at the workspace boundary and concrete only inside the server auth surface. Anything a developer builds outside the auth flow is outside the exercised region of the template and will have to be figured out fresh, which is exactly what the user does not want.

---

## Can a Session Using This Template Produce High-Quality Code?

The user asked for a structural answer, not a hedge. Here it is.

**No, not reliably, not yet. Today the template will drift toward slop because the failure modes are load-bearing on the first files a developer touches.** Specifically:

1. `pnpm build` is red. The fix an agent will reach for first is `as any`. That one fix spreads.
2. `pnpm test` is red. The fix an agent will reach for first is `test.skip`. That one skip spreads.
3. The `api<T>` wrapper teaches untyped responses. Every feature inherits the pattern.
4. The auth handler teaches handlers reaching into repo internals. Every new handler inherits the pattern.
5. The phantom workspaces invite an agent to "add an extension" or "add the mobile screen," discover the scaffold is empty, and ship broken half-builds because the rule files insist it is possible.
6. The shadow rulebook in `.claude/bottomlessmargaritas/` is a loaded gun for the first session that greps broadly.

**Yes, if the six fatal and significant findings above are fixed.** The underlying bones are sound: the auth implementation is good, the server layering is correct where it exists, the lefthook staged-scope work landed, the Playwright scaffold is a real foundation, the `__tests__/` reorganization is clean. The rulebook, once the shadow copy is deleted and the dead rules are either enforced or deleted, is defensible. The fix list is an afternoon, not a week.

The honest summary: **this template is two hours of targeted fixes away from being good, and it will produce slop in its current state.** The two hours are the six fatal and significant findings above, in order. Anything else is secondary.

---

## The Rules That Run Claude

The user made the rulebook a primary concern. Here is what I found, ranked.

### Actively dangerous rules (following them produces worse code than ignoring them)

- **Root `CLAUDE.md` Rule 7 ("Shared types live in `packages/types/`").** Following this today requires importing from `@repo/types`, which is a stub with no working resolution across workspaces. The developer will spend a half-day debugging, conclude the rule is wrong, and either work around it or give up on type sharing entirely. The rule is not dangerous because it is wrong; it is dangerous because the infrastructure it demands does not exist, and the error the developer gets when they follow the rule is a resolution error they will blame on their own code.
- **`apps/client/extension/CLAUDE.md` and `apps/client/mobile/CLAUDE.md` in full.** Both files document rich conventions (WXT, `browser.*`, Expo Router, EAS) for workspaces that cannot be installed. Following them produces code that imports modules that are not installed and references config files that do not exist. The rules are not dangerous as rules; they are dangerous because the workspace they govern has no `package.json`, so any code written following the rules is DOA.
- **Root `CLAUDE.md` Rule 5 (named exports only) as applied to the extension.** The existing `apps/client/extension/entrypoints/background.ts` uses `export default defineBackground(...)`. A developer asked to audit compliance will either (a) "fix" the extension to use named exports, breaking WXT's entrypoint convention, or (b) add another exception to the rule. The exception list is now on a slippery slope.

### Dead rules (on paper, unenforced, and the existing code already ignores them)

- **Root `CLAUDE.md` Rule 4 ("Alphabetical ordering is mandatory") for imports.** The login page imports are not alphabetized by module specifier. No hook enforces this. No lint rule is wired to it. The rule exists to reduce merge-conflict noise; the code does not honor it.
- **"No em dashes."** Hook-enforced on `Write/Edit/Bash` in real time, but not enforced on committed files. Ten files in the repo contain U+2014 today. The rule is half-enforced.
- **"`__tests__/` mandatory."** Currently honored by the code, not enforced by any hook. One `git mv` away from drifting silently.
- **`apps/server/CLAUDE.md` "Services are `kebab-case.service.ts`."** No services exist in the server today. Rule cannot be tested. First service added will either honor it or drift.

### Conflicting rules

- **Named exports only + extension `background.ts`.** Partial conflict as noted above. The App Router exception was added; the extension exception was not.
- **Root `CLAUDE.md` layer-responsibility rule vs. the auth handler.** Documented: handlers do not contain business logic. Observed: the login handler contains orchestration logic.
- **`apps/client/web/README.md` vs. the root `README.md`.** Two different sources of truth for what this workspace is and how to run it.
- **Parent-directory `/Users/iangreenough/Desktop/code/personal/.claude/CLAUDE.md` (shared personal conventions) vs. this repo's `CLAUDE.md`.** The parent mandates co-located tests beside source. The project mandates `__tests__/`. No cross-level tiebreak. A session that inherits both will get conflicting guidance in its first scan.
- **Primary rulebook vs. `.claude/bottomlessmargaritas/` shadow rulebook.** Silent, but real, and waiting for a single mistaken glob.

### Redundancy

- **The em-dash ban** is repeated in the root `CLAUDE.md`, the parent `/personal/.claude/CLAUDE.md`, the global `~/.claude/CLAUDE.md`, and (in spirit) the lefthook setup notes. Four sources, no canonical owner, guaranteed drift.
- **The test-first bug fix rule** is in the root `CLAUDE.md` and in the global `~/.claude/CLAUDE.md` as R-004 and R-201. Same risk.
- **The named-exports-only rule** is in the root `CLAUDE.md`, `apps/client/CLAUDE.md`, and `apps/client/web/CLAUDE.md`. Three copies, one of which now has an App Router exception and the others may or may not.

### Gaps (rules that should exist)

- **"`pnpm build` must be green at HEAD"** with a hook that enforces it. This would have caught F-1 before it was committed.
- **"No empty workspace directories in `pnpm-workspace.yaml`"** with a hook that checks each listed path has a `package.json`. This would catch S-3.
- **"No `U+2014` in committed files"** as a pre-commit grep on staged files. The existing hook only catches writes; it does not catch imported or pre-existing content.
- **"No third-party `CLAUDE*.md` files committed under `.claude/`"** with a hook that refuses them. This would have blocked `f2166c7`.
- **"Every rule in `CLAUDE.md` has either a hook reference or an `honor-system:` tag."** The current file mixes enforced and unenforced rules with no visual distinction, and dead rules hide among live ones.

### Overall rule-layer rating: Significant, trending toward Fatal if not addressed.

The meta-rule layer is the biggest risk vector for the user's stated concern. Today's rules would allow the exact situation the user got burned by yesterday. The rules are better written than yesterday's audit found them (App Router exception added, handler naming corrected, test location rule now matches the code). They are still not enforced enough to defend the user from a session that pattern-matches wrong. And the shadow rulebook is a time bomb.

---

## The Hard Prioritization: Five Things to Fix Before Trusting This Template With Real Feature Work

In order, with justification and the one piece of evidence that would overturn each.

### 1. Fix `pnpm install && pnpm build && pnpm test` red-to-green on a fresh clone.

The exact fixes:

- `apps/client/web/src/services/api.ts:25`: replace the unsafe deref with a narrow type guard, or refactor the wrapper to accept a Zod schema and `.parse(await res.json())`. The wrapper fix is the better one because it also closes S-9.
- `apps/server/src/__tests__/middleware/requestLogger/requestLogger.test.ts`: use `vi.hoisted` for the factory, or move the mock to a fixture and import it at the top, or restructure the mock to not close over a top-level `pino` call. Any of the three work.
- Add `build-server` and `build-web` commands to `pre-push` in `lefthook.yml` so this class of bug cannot reach `main` again.

**Evidence that would overturn this priority:** `pnpm install && pnpm build && pnpm test` returns exit code 0 on a fresh clone. Today it returns 1.

### 2. Delete `.claude/bottomlessmargaritas/` and remove `@bottomlessmargaritas/claude-architecture-prompts` from the root `package.json`.

It is a shadow rulebook that contradicts the real one and a runtime dependency that does nothing at runtime. No downside to deletion, no upside to keeping it.

**Evidence that would overturn:** a demonstration of which file in the primary CLAUDE.md graph references any file in `.claude/bottomlessmargaritas/`, plus a use case for `@bottomlessmargaritas/claude-architecture-prompts` at runtime. Neither exists.

### 3. Decide whether `apps/client/extension/` and `apps/client/mobile/` exist.

The three options:

a. Add real `package.json`, deps, and config files. Make them installable and at least `pnpm --filter extension dev` runnable. The extension needs `wxt.config.ts` and a manifest. The mobile app needs `app.json` and expo config. Wire them to CI with a build step.
b. Delete both directories entirely and delete `apps/client/extension/CLAUDE.md` and `apps/client/mobile/CLAUDE.md`. Remove them from `pnpm-workspace.yaml`.
c. Mark them as "design examples, not yet wired up" with a top-of-file banner in each CLAUDE.md and a prominent note in the root README, and leave the code as reference.

Option (c) is the honest middle ground if the author wants to preserve the design thinking without shipping a broken scaffold. Option (b) is the smallest action that eliminates the drift risk. Option (a) is the biggest payoff but the most work.

**Evidence that would overturn:** either `pnpm --filter extension run build` and `pnpm --filter mobile run build` both succeed (option (a) has happened), or the directories and rule files are gone (options (b) or (c) have happened).

### 4. Delete the two stale workspace READMEs.

`apps/client/web/README.md` and `apps/server/README.md` are misleading in concrete ways. The root README is sufficient. One commit, two file deletions.

**Evidence that would overturn:** both READMEs are rewritten to match the current reality (port, package manager, bcrypt rounds, env vars, project name).

### 5. Refactor the auth handler to stop reaching into the repo's internal shape, and demonstrate the `api()` wrapper with a Zod schema.

These are the two biggest precedent-setting bugs in the exercised surface of the template. Fixing both teaches the right pattern in the place the next developer will pattern-match from. Leaving them in place teaches the wrong pattern in the same place.

**Evidence that would overturn:** the auth handler no longer references `user.password_hash` in the handler file (it should be contained in the repo), and at least one call in `apps/client/web/src/state/useAuth.ts` uses `api(path, schema, opts)` with a Zod schema, with the wrapper implementation parsing through the schema.

Everything else on this audit's list is secondary and can wait.

---

## Where the Sibling Audit Is Wrong

Only one sibling audit exists for today: `2026-04-09-engineering.md`. It was written against the state of `main` before the `0e53ffe` cleanup commit. Most of its findings are now obsolete, which is the correct outcome; the author did the work.

Two places where the engineering audit would still be wrong if applied to the current code:

- The engineering audit implicitly trusts the 80% server coverage number (section "Testing"). As noted in S-5, the coverage exclusion list removes `src/config/**`, `src/db/**`, `src/index.ts`, `rateLimiter.ts`, and `src/constants/**` from the denominator. The 80% figure is real, and also structurally misleading about what is tested. An engineering auditor rerunning this check today should flag the exclusion list as the finding, not the coverage percentage.
- The engineering audit's CLAUDE.md accuracy table was exhaustive against the old state and is mostly closed now. It does not flag (because it did not look for) the phantom workspaces under `apps/client/` or the shadow rulebook under `.claude/bottomlessmargaritas/`. These are inside the same class of "doc does not match code" finding, just moved to a different surface. A re-run of the engineering audit on `e8ff293` should extend the accuracy-table checks to the workspace-metadata layer and to the presence of parallel rulebooks.

No disagreement on the auth analysis, the credential exposure scan, or the Dockerfile findings; the cleanup commits resolved those.

---

## Theater Check

The four categories, audited against current state:

- **Security theater:** Low, same as the prior audit. Auth is real, CSRF is real, cookie flags are real. The only notable item is that the server no longer has any actual attack surface (it's two endpoints and auth), so "security theater" would be hard to find even if it were there.
- **Confidence theater:** **Fatal level, same finding as F-1, F-2, F-3, S-5.** Tests report green, coverage reports 80%+, `pre-push` reports green, `pnpm build` is red on a fresh clone. The signal-to-reality gap is wide enough to drive a truck through. This is the theater the user asked me to catch, and it is load-bearing in the template today.
- **Process theater:** Lower than the prior audit called out. The author demonstrably did the afternoon cleanup work. That said: 10 CLAUDE.md files governing 7 workspaces, two of which have no `package.json`, plus a shadow rulebook of another 8 files, is still rule mass far out of proportion to exercised surface. The prior audit's moratorium recommendation still stands: no new rules until (a) the fresh clone runs green and (b) one real feature has shipped through the template as written.
- **Metrics theater:** Mild, same as S-5. The coverage number is structurally misleading about what is tested, because the exclusion list removes the config, db, and entry-point modules.

---

## Is It Actually Running?

| Component | Claim | Verified? |
|---|---|---|
| `pnpm install` on fresh clone | Implied | **VERIFIED** during audit. Lockfile resolves. |
| `pnpm build` on fresh clone | Implied by the template's "getting started" | **FALSE**. Fails at `apps/client/web/src/services/api.ts:25` with a TS error. Confirmed locally during audit. |
| `pnpm test` on fresh clone | Implied | **FALSE**. 12/13 test files pass, 1 fails to load, `vitest` exits 1. Confirmed locally. |
| `pnpm --filter @template/server run test` | 90 tests, 91% coverage claim | **PARTIAL**. 90 assertions pass. 1 test file fails to load. Exit code 1. |
| `pnpm --filter ./apps/client/web run test` | 2 files, 10 tests | **VERIFIED**. All green. |
| `pnpm --filter ./apps/server run build` | Should produce `dist/` | **VERIFIED**. Server build succeeds. |
| `pnpm --filter ./apps/client/web run build` | Should produce `.next/` | **FALSE**. Type check fails in `services/api.ts`. |
| `playwright test` (E2E suite) | 4 specs cover auth flows | **UNVERIFIED**. Not executed in this audit; the specs and config look sensible but the first real run is the test. |
| `lefthook` pre-commit hooks | Scoped to affected workspace | **VERIFIED** by reading `lefthook.yml`. Not observed firing during this audit. |
| `lefthook` pre-push tests | Server + web | **VERIFIED** by reading. Does NOT run `build`, which is the gap that let F-1 land. |
| `apps/client/extension` workspace | pnpm workspace | **FALSE**. No `package.json`. pnpm will warn and skip. |
| `apps/client/mobile` workspace | pnpm workspace | **FALSE**. No `package.json`. |
| `@repo/types` resolves across workspaces | Implied by Rule 7 | **UNVERIFIED** because no workspace imports it. Likely false based on the `main: ./src/index.ts` config with no TS project references. |
| `@repo/tokens` consumed by web | Documented in styling rules | **UNVERIFIED**. `packages/tokens/dist/_tokens.scss` exists. No audit-time verification that `apps/client/web/src/app/globals.scss` actually imports it. Suspect not. |
| `@repo/client-shared` used by any surface | Implied by the shared-client design | **FALSE**. The package is a stub. No workspace declares it as a dep. |

**Rule: absence of evidence is evidence of absence.** The template's working surface today is: the server unit tests except one file, the web unit tests (two files), and the server at runtime if you can ignore the coverage exclusions. Everything else is unverified or verified false.

---

## What Would Make Me Wrong

For each Fatal and Significant finding, the single piece of evidence that would overturn it:

- **F-1 / F-2 / F-3: red `pnpm build && pnpm test` on fresh clone.** What would overturn: a CI run on a freshly cloned `main` HEAD that shows both commands exit 0 and the pre-push hook includes `build` among its commands. Today neither is true.
- **S-1 (shadow rulebook):** deletion of `.claude/bottomlessmargaritas/` and removal of the npm dependency. If the dir is still there tomorrow, the finding stands.
- **S-2 (stale READMEs):** both files deleted or rewritten. A grep for `template-express-js` and `template-next-js` in the repo returns zero results.
- **S-3 (phantom workspaces):** either `package.json` files appear in both, with deps, and `pnpm --filter extension build` and `pnpm --filter mobile build` succeed; or both directories and their CLAUDE.md files are removed from the repo and from `pnpm-workspace.yaml`.
- **S-4 (orphan lefthook):** `apps/server/lefthook.yml` deleted. One commit.
- **S-5 (coverage exclusions):** the exclusion list gains a comment per entry explaining the rationale, or the excluded paths gain tests and come out of the list. Either is acceptable.
- **S-6 (dead rules in the root `CLAUDE.md`):** each non-negotiable rule has either a cited hook or an explicit `honor-system` tag. Alphabetical imports rule is either enforced by lint or removed.
- **S-7 (`@repo/types` is a phantom):** one real type defined in `@repo/types`, imported by both server and web, with `pnpm build` and `pnpm test` passing. Prove the rule by running the rule.
- **S-8 (auth handler precedent):** `apps/server/src/handlers/auth/auth.ts` no longer references `user.password_hash` or any other raw database field; the orchestration lives in a repo or service function.
- **S-9 (`api<T>` precedent):** `apps/client/web/src/services/api.ts` either takes a Zod schema or returns `unknown` and forces the caller to validate. At least one caller demonstrates the correct pattern.

---

## Closing Note

Yesterday the prior audit said the template was a fork with a misleading label. The author spent an afternoon proving that wrong. Today the template is a real template with load-bearing bugs on the critical-path files, a shadow rulebook one glob away from being loaded, two phantom client workspaces, and a pre-push gate that lets broken builds through.

The fix list is small. The three Fatal findings close together with roughly a two-hour session: one TS fix in `api.ts`, one test-hoisting fix in `requestLogger.test.ts`, and one line added to `lefthook.yml`. After that, the Significant findings are each an evening of targeted work, not a rewrite. The template is closer to good than it is to bad. It is not yet ready to be the baseline for three days of feature work.

The discipline that would stop this class of finding from recurring is a single pre-merge check: "clone fresh, `pnpm install && pnpm build && pnpm test`, must exit 0." Everything else this audit found is downstream of that one gate not being wired. Wire it and the template defends itself against the kind of drift that ate three days yesterday.

---

**End of audit.**
