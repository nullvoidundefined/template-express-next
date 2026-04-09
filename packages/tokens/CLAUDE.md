# Design Tokens Conventions

Auto-loaded when working in `packages/tokens/`. The root `../../CLAUDE.md` rules apply.

---

## Purpose

This package is the single source of truth for all visual values: colors, spacing, radii, typography, and transitions. Every other surface reads from here. Nothing hardcodes a value independently.

Do not add a token speculatively. A value used in only one place is a magic number, not a token. Extract it here when the second consumer needs it.

---

## What belongs here

- Colors (brand, surface, text, semantic states)
- Spacing scale
- Border radii
- Font sizes, weights, letter spacing, and line heights
- Transition durations

## What does NOT belong here

- Component-specific values (button padding, card gap) unless they are reused across multiple components
- Breakpoints (those live in the consuming app's SCSS)
- One-off overrides

---

## Directory Structure

```
packages/tokens/
├── package.json
├── tsconfig.json
├── src/
│   ├── tokens.ts          # Source of truth: typed TS const object
│   ├── generate-scss.ts   # Script: reads tokens.ts, writes dist/_tokens.scss
│   └── index.ts           # Re-exports tokens and derived types
└── dist/                  # Generated; do not edit by hand
    ├── index.js
    ├── index.d.ts
    └── _tokens.scss
```

---

## Editing Tokens

1. Edit `src/tokens.ts` only. Never edit `dist/` files by hand.
2. Run `pnpm --filter @repo/tokens run build` after any change. This recompiles TypeScript and regenerates `dist/_tokens.scss`.
3. Commit `src/tokens.ts` and the regenerated `dist/_tokens.scss` in the same commit.

---

## Rules

- All keys are alphabetized within each category (colors, radii, spacing, etc.).
- Token names are camelCase in TypeScript; `generate-scss.ts` converts them to kebab-case CSS custom properties automatically.
- Semantic naming only. Describe purpose, not appearance: `accent`, not `orange`. `foregroundMuted`, not `gray`.
- No runtime logic. `tokens.ts` is a plain `as const` object with no functions or conditionals.
- `dist/_tokens.scss` is committed to git so consumers do not need to run the build script themselves.

---

## Consuming This Package

### Web and extension (SCSS custom properties)

```scss
// globals.scss
@use '@repo/tokens/scss';

// Then in any component SCSS:
.button {
  background: var(--accent);
  border-radius: var(--radii-button); // if CSS vars are generated for radii
}
```

The generated `_tokens.scss` injects CSS custom properties into `:root`. Import it once in `globals.scss`.

### Mobile and programmatic use (direct JS import)

```typescript
import { tokens } from '@repo/tokens';

const styles = StyleSheet.create({
  button: {
    backgroundColor: tokens.colors.accent,
    borderRadius: tokens.radii.button,
  },
});
```

Install as a workspace dependency:

```bash
pnpm --filter web add @repo/tokens
pnpm --filter mobile add @repo/tokens
pnpm --filter extension add @repo/tokens
```

---

## Adding a New Token Category

1. Add the new category object to `tokens.ts`, keys alphabetized.
2. Update `generate-scss.ts` if the new category should emit CSS custom properties.
3. Run `pnpm --filter @repo/tokens run build`.
4. Commit `src/tokens.ts`, `src/generate-scss.ts` (if changed), and `dist/_tokens.scss` together.
