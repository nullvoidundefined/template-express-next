# Group node built-ins and path-alias imports to match the harness import gate

Branch: `chore/prettier-alias-import-group`
Ticket: IAN-154 (blocks IAN-131)
Timing: found and fixed in one sitting on 2026-09-19, about 25 minutes from the blocked push to this document, per `git log` and `date`.

## Summary

The workspace Prettier import sorter and the harness push ESLint gate required opposite import orders, so no new file importing through `app/` (server) or `@/` (web), or mixing `node:` built-ins with packages, could pass both: the pre-commit hook formats with Prettier, and the push gate then rejects the result. It went unnoticed because the gate checks only added lines, and it surfaced on IAN-131's push.

## What changed

- Both workspace Prettier configs gain two `importOrder` groups: `^node:(.*)$` before third-party modules and the path alias (`^app/(.*)$` on the server, `^@/(.*)$` on the web client) after them. This is the layout the gate's `import-x/order` configuration documents.
- Both workspaces are reformatted; outside the two configs, every changed line is an import reordering or a blank line between groups.
- The server config stops import-sorting TypeScript samples inside Markdown (`embeddedLanguageFormatting: 'off'`), which the web config already did; otherwise the new groups reshuffled the illustrative examples in `apps/server/CLAUDE.md`.
- `requestLoggerMiddleware.ts` imports `node:crypto` instead of the bare `crypto` specifier, so it sorts with the other built-ins.

## Architectural decisions

- **Align Prettier to the gate, not the gate to Prettier.** The harness configuration already documents this layout and was reconciled with the same sorter in July for another repository; changing the gate would be a public harness change affecting every repository. The owner chose this option.
- **Keep the ESLint configs where they are.** The gate defers import ordering to a local ESLint config at the repository root; moving this monorepo's per-workspace configs to the root would be a larger change than the formatter alignment.

## Testing

- The gate's `lint.mjs` over all 82 reformatted TypeScript files, whole files rather than added lines: zero `import-x/order` findings.
- Format check, `tsc`, and ESLint clean in both workspaces; server unit 233, web unit 34, integration 45 (three consecutive runs; one earlier run had a single timing failure that did not reproduce); `pnpm build` succeeds.

## Reflection

I first read the conflict as a harness bug. The gate's own comments showed it had been reconciled with this exact sorter before, and that the repository-specific gap was only the two missing groups plus the Markdown override. Reading the rule's configuration before choosing a fix turned a proposed harness change into a two-line config change.
