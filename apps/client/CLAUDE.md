# Client Conventions

Auto-loaded when working anywhere inside `apps/client/`. The root `../../CLAUDE.md` non-negotiable rules still apply; these rules layer on top for all client-side work. The workspace-specific file layers on top of this file in turn:

- `apps/client/web/CLAUDE.md` for Next.js, SCSS Modules, Radix UI, Railway deployment

If a rule here and the workspace file conflict, this file wins and the conflict is a bug to file. If a rule here and the root file conflict, the root file wins.

---

## Directory Structure

```
apps/client/
└── web/                              # Next.js 15 App Router (see web/CLAUDE.md)
    └── src/
        ├── app/
        │   ├── (auth)/               # Route group: unauthenticated pages
        │   │   ├── auth.module.scss  # Shared auth form styles
        │   │   ├── login/
        │   │   │   └── page.tsx
        │   │   └── register/
        │   │       └── page.tsx
        │   ├── (protected)/          # Route group: authenticated pages
        │   │   ├── layout.tsx        # Auth-guarding layout
        │   │   └── dashboard/
        │   │       └── page.tsx
        │   ├── globals.scss          # CSS custom properties, reset, base typography
        │   ├── layout.tsx            # Root layout (metadata, fonts, providers)
        │   └── page.tsx              # Landing / splash page
        ├── components/               # Shared UI components (per-folder rule)
        │   └── ComponentName/
        │       ├── ComponentName.tsx
        │       └── ComponentName.module.scss
        ├── providers/                # React context and provider components
        │   └── QueryProvider.tsx     # TanStack Query client config + provider
        ├── services/                 # HTTP infrastructure
        │   └── api.ts                # Typed fetch wrapper (NEXT_PUBLIC_API_URL)
        └── state/                    # State layer: hooks that own state + side-effects
            └── useAuth.ts            # Auth state (user, login, logout, register)
```

Shared packages (consumed by the web client and server):

```
packages/
├── tokens/                           # @repo/tokens - design tokens source of truth
│   └── src/tokens.ts                 # Typed TS const; generate-scss.ts writes dist/_tokens.scss
├── types/                            # @repo/types - domain types shared across server + web client
│   └── src/index.ts                  # Re-exports all shared types
└── constants/                        # @repo/constants - shared constants (analytics events, etc.)
    └── src/
        └── analytics.ts              # Typed PostHog event name constants
```

Rules:

- The `(auth)` route group is for unauthenticated pages and `(protected)` for authenticated pages.
- `services/api.ts` is the fetch wrapper. Base URL comes from `NEXT_PUBLIC_API_URL`.
- `providers/QueryProvider.tsx` holds the TanStack Query client config and provider.
- `state/useAuth.ts` holds auth state and operations.
- `components/` always uses per-folder structure: `ComponentName/ComponentName.tsx` plus the co-located style file. Never a flat `.tsx` file directly under `components/`.
- `state/` contains custom React hooks that own state and side effects, and nothing else. No utilities, no types.

---

## TypeScript

All client code is TypeScript in strict mode.

### Core Rules

- **No `any`.** Use `unknown` and narrow explicitly. The one exception is third-party types that ship as `any` internally; do not re-export or widen them.
- **Strict mode always on.** `tsconfig.json` must include `"strict": true`. Do not disable individual strict checks to silence an error; fix the type instead.
- **`type` for most things, `interface` for extension contracts.** Use `type` for unions, intersections, mapped types, and component props. Use `interface` when you intentionally want declaration merging (e.g., extending `Window`, extending Express `Request`).
- **Discriminated unions over boolean flags.** Prefer `type Status = 'idle' | 'loading' | 'error' | 'success'` over four separate boolean props. The union makes impossible states unrepresentable.
- **Zod for runtime validation at boundaries.** Any data that crosses a trust boundary (API response, form input, storage read, message payload) is validated with a Zod schema. The TypeScript type is derived from the schema with `z.infer`, never written separately.
- **No non-null assertion (`!`) except on DOM queries where null is provably impossible.** Every other non-null assertion is a suppressed bug. Use optional chaining and explicit null checks instead.

### Props and Types

```typescript
// Props type: use `type`, not `interface`. Named {ComponentName}Props.
// Keys alphabetized.
type ButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

// Union types: alphabetize members.
type Status = 'error' | 'idle' | 'loading' | 'success';

// Zod-derived type: the schema IS the source of truth.
import { z } from 'zod';
const userSchema = z.object({
  email: z.string().email(),
  id: z.string().uuid(),
  name: z.string(),
});
type User = z.infer<typeof userSchema>;

// Shared types that cross more than one component: `src/types/index.ts`.
// Component-local types: defined in the same file as the component, above it.
```

### Narrowing Patterns

```typescript
// Unknown narrowing
function processResponse(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Expected object');
  }
  if (
    !('name' in data) ||
    typeof (data as { name: unknown }).name !== 'string'
  ) {
    throw new Error('Expected name string');
  }
  return (data as { name: string }).name;
}

// Prefer Zod parse over manual narrowing at boundaries
const user = userSchema.parse(apiResponse); // throws on invalid shape
```

### Import Discipline

- Use the `type` keyword for type-only imports. This keeps runtime bundles clean and makes the import intent explicit.

```typescript
import type { User } from '@/types';
import type { Metadata } from 'next';
import { userSchema } from '@/schemas/user';
```

- Sort type imports after value imports within the same group. Alphabetize specifiers within each import.

---

## React

### Component Categories

Every React file falls into one of two categories. Assign the category before writing the file; it determines what the file is allowed to contain.

**Atomic components** -- reusable building blocks composed of HTML elements. They are layout-agnostic, accept props, and have no knowledge of the page they live on. Examples: `Button`, `InputField`, `Badge`, `Avatar`, `Card`. These live in `components/`.

Rules for atomic components:

- Accept all content via props. No hard-coded copy.
- No direct API calls, no TanStack Query hooks, no navigation calls.
- Styled entirely through their own SCSS module.
- Should be renderable in isolation with a few props.

**Pages and containers** -- top-level views that assemble atomic components into a full layout. Examples: `LoginPage`, `DashboardScreen`, `SettingsContainer`. These live in `app/`.

Rules for pages/containers:

- Are composed primarily of imported components. Minimal raw HTML or JSX elements directly in the return statement.
- Own data fetching via TanStack Query (`useQuery`, `useMutation`) or state from `state/`.
- Own navigation and routing logic.
- As a rule of thumb: if the JSX return block has more than a handful of raw HTML elements that are not component calls, extract them into a named component first.

The test: look at the JSX returned by the component. If it reads like an assembly of named components (`<Header />`, `<LoginForm />`, `<Footer />`), it is a page. If it reads like raw elements (`<div>`, `<input>`, `<button>`), it is an atomic component. A file that mixes both categories heavily is a sign that an extraction is overdue.

### Component Structure

File structure, top to bottom, in this exact order:

1. Directive (`'use client'`, `'use server'`) if needed
2. Imports (grouped with blank lines between groups, each group alphabetized internally)
3. Type definitions, alphabetized by name, keys alphabetized inside each type
4. Constants and static configuration objects, keys alphabetized
5. Pure helper functions (no hooks, no side effects)
6. The component function, props destructured alphabetically to match the type
7. `displayName` assignment
8. Named export statement

```typescript
'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

import styles from './LoginForm.module.scss';

type LoginFormProps = {
  onSuccess: (userId: string) => void;
  redirectTo?: string;
};

const DEFAULT_REDIRECT = '/dashboard';

function formatEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function LoginForm({ onSuccess, redirectTo = DEFAULT_REDIRECT }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    // ...
  }, []);

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
    </form>
  );
}

LoginForm.displayName = 'LoginForm';

export { LoginForm };
```

### Rules

- **Named exports only.** See root CLAUDE.md rule 5 for the canonical statement and exceptions.
- **`displayName` on every component.** Set immediately after the function, before the export. Compound sub-components use scoped names: `Card.Header.displayName = 'Card.Header'`.
- **No `React.FC`.** Plain function declarations with explicitly typed props. `React.FC` hides the return type and breaks some inference patterns.
- **`useCallback` for handlers passed to child components or native elements.** These go through shallow comparison; unstable references cause unnecessary re-renders.
- **No `useState` setters as props.** Wrap them in a named callback that describes intent: `onEmailChange` not `setEmail`.
- **Flat props over config objects.** `<Button label='Save' variant='primary' />` is easier to read, diff, and memoize than `<Button config={{ label: 'Save', variant: 'primary' }} />`.
- **Composition over configuration.** Prefer compound components and slots over boolean flag matrices. A component with five boolean variants is a sign it should be two components.
- **No inline style objects.** Use SCSS Modules for all styling.

### Hooks

```typescript
// Custom hook: camelCase, prefixed with `use`.
function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  // All hooks at the top, grouped by purpose:
  // 1. State (useState, useReducer)
  // 2. Refs (useRef)
  // 3. External state (useQuery, useContext)
  // 4. Effects (useEffect, useLayoutEffect)
  // 5. Derived values (useMemo)
  // 6. Callbacks (useCallback)

  return { user };
}

export { useAuth };
```

Rules:

- Hooks live in `state/` at the workspace root (e.g., `apps/client/web/src/state/`).
- Never call hooks conditionally. Unconditional hook calls are enforced by the React hooks lint rule.
- Custom hooks return plain objects, not arrays (unless following the `[value, setter]` tuple convention for symmetry with `useState`).

### State Management

- **TanStack Query for all server state.** Fetch, cache, refetch, and mutate through `useQuery` and `useMutation`. No raw `useEffect` + `fetch`.
- **Zustand for cross-component client state.** Modal queue, toast queue, UI preferences, and complex form state shared across routes. See the Zustand Stores section.
- **React Context for app-wide providers.** Auth session object. One context per concern; do not bundle unrelated state into a single context.
- **`useState` for local UI state.** Form inputs, toggles, and component-level state that nothing else needs.
- **No Redux, Jotai, or Recoil** in this template.

### Zustand Stores

Zustand stores live in `apps/client/web/src/state/` alongside hooks. Use them when state must be accessed or mutated by components that are not in a direct parent-child relationship.

**When to use Zustand vs alternatives:**

| Situation                                     | Use                       |
| --------------------------------------------- | ------------------------- |
| Server data (API response, list, single item) | TanStack Query            |
| Auth session object accessible app-wide       | React Context             |
| Toast notifications triggered from anywhere   | Zustand (`useToastStore`) |
| Modal queue (open/close from any component)   | Zustand (`useModalStore`) |
| Theme preference persisted to localStorage    | Zustand (`useTheme`)      |
| Form input controlled by one component        | useState                  |

**`useToastStore` API:**

```typescript
const { addToast } = useToastStore();
addToast('Saved', 'success'); // type defaults to 'info', duration to 5000ms
addToast('Failed to save', 'error', 8000);
```

Types: `'error' | 'info' | 'success'`. Toasts auto-dismiss after `duration` ms.

**`useModalStore` API:**

```typescript
const { openModal, closeModal, closeAllModals } = useModalStore();
const id = openModal(<MyComponent />, { preventClose: false });
closeModal();        // close top modal
closeModal(id);      // close specific modal by ID
closeAllModals();    // close all modals
```

Modals stack. `preventClose: true` disables the backdrop click and ESC dismiss.

**`useTheme` API:**

```typescript
const { setTheme, theme } = useTheme();
setTheme('dark'); // 'dark' | 'light' | 'system'
```

Storage key: `app-theme`. Applied via `data-theme='dark'` attribute on `<html>`. Flash prevention requires an inline script in the root layout before hydration.

### Error Handling in UI

- API and server errors surface through a Toast component. Never render raw error messages inline next to the failed action.
- Form validation errors are inline at the field level. These are the only inline errors.
- Never show stack traces to the user. In dev mode, log to the console. In production, send to an error tracking service.
- Components that fetch data include an error state. A component that shows a spinner forever on error is a broken component.

### Accessibility

All interactive elements must be usable without a mouse and must be announced correctly by screen readers. This is enforced by the `eslint-plugin-jsx-a11y` rule set.

Web minimums:

- Semantic HTML: `<button>` for actions, `<a>` for navigation, `<nav>`, `<main>`, `<section>` for structure. No `<div onClick>`.
- Every `<img>` and `<Image>` has descriptive `alt` text. Decorative images use `alt=""`.
- Every form input has an associated `<label>` or `aria-label`.
- Icon-only buttons have `aria-label`.
- Heading hierarchy follows h1 to h2 to h3 with no skips.
- Keyboard navigation: all interactive elements reachable by Tab, activatable by Enter/Space.
- Focus styles are visible. Never `outline: none` without a replacement focus indicator.
- Color contrast meets WCAG AA (4.5:1 normal text, 3:1 large text).
- Respect `prefers-reduced-motion` for animations.

### Testing

- Vitest + React Testing Library for component and hook tests.
- Query by role, label, and text. Never query by class name or component internals.
- Mock API calls at the `services/api` boundary, not at the fetch level.
- Test files live in `src/__tests__/`, mirroring the source tree. See the root `CLAUDE.md` Testing Conventions section.
- One test file per source file. Do not split a file's tests across multiple test files.

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/LoginForm/LoginForm';

describe('LoginForm', () => {
  it('calls onSuccess with userId after valid submission', async () => {
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(onSuccess).toHaveBeenCalledWith(expect.any(String));
  });
});
```

---

## Styling System

### No Tailwind

Tailwind is banned. The reasons:

- Utility classes scatter visual decisions across JSX, making them hard to audit in isolation.
- Tailwind's output class names are opaque in DevTools and in test selectors.

The alternative is a shared token system with SCSS Modules as the styling mechanic.

### Shared Design Tokens

All design values (colors, spacing, radii, font sizes, font weights) originate in a single source: `packages/tokens/src/tokens.ts`.

```
packages/tokens/
├── package.json           # name: "@repo/tokens"
├── tsconfig.json
├── src/
│   ├── tokens.ts          # Source of truth: typed TS const object
│   └── generate-scss.ts   # Script: reads tokens.ts, writes dist/_tokens.scss
└── dist/
    ├── index.js           # Built JS
    ├── index.d.ts         # Types
    └── _tokens.scss       # Generated SCSS partial (consumed by web client)
```

The web client consumes tokens via CSS custom properties injected through the SCSS partial: `@use '@repo/tokens/dist/tokens'` in `globals.scss`.

### The Token Contract

`packages/tokens/src/tokens.ts` is the only file that defines visual values. Everything else reads from it:

```typescript
// packages/tokens/src/tokens.ts
export const tokens = {
  colors: {
    accent: '#e8651a',
    accentHover: '#c85411',
    accentLight: '#fdecd9',
    background: '#ffffff',
    backgroundTranslucent: 'rgba(255, 255, 255, 0.92)',
    border: '#ebebeb',
    error: '#ef4444',
    foreground: '#222222',
    foregroundMuted: '#717171',
    surface: '#f7f7f7',
    surfaceActive: '#e0e0e0',
    surfaceAlt: '#f0f0f0',
    surfaceHover: '#f0f0f0',
    white: '#ffffff',
  },
  fontSizes: {
    badge: 11,
    caption: 12,
    small: 13,
    body: 14,
    label: 15,
    subheading: 16,
    subtitle: 18,
    navLogo: 20,
    section: 28,
    heroMobile: 32,
    hero: 48,
  },
  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 800,
  },
  letterSpacing: {
    hero: '-0.03em',
    heading: '-0.02em',
    uppercase: '0.05em',
  },
  lineHeights: {
    hero: 1.1,
    body: 1.5,
    paragraph: 1.6,
  },
  radii: {
    subtle: 4,
    standard: 8,
    button: 10,
    card: 12,
    large: 16,
    pill: 20,
  },
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 40,
    10: 48,
    11: 64,
    12: 80,
  },
  transitions: {
    hover: '0.15s',
    state: '0.20s',
  },
} as const;

export type Tokens = typeof tokens;
```

### Generated SCSS Partial

`packages/tokens/src/generate-scss.ts` reads `tokens.ts` and writes `dist/_tokens.scss`. The generated file is committed to git and regenerated whenever `tokens.ts` changes. Never edit `dist/_tokens.scss` by hand.

```typescript
// packages/tokens/src/generate-scss.ts
import { writeFileSync } from 'node:fs';
import { tokens } from './tokens.js';

const lines: string[] = [
  '// GENERATED FILE. Do not edit by hand.',
  '// Run: pnpm --filter @repo/tokens run generate',
  ':root {',
];

for (const [name, value] of Object.entries(tokens.colors)) {
  const kebab = name.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
  lines.push(`  --${kebab}: ${value};`);
}

lines.push('}');
writeFileSync(
  new URL('../dist/_tokens.scss', import.meta.url),
  lines.join('\n') + '\n',
);
console.log('Generated dist/_tokens.scss');
```

Add a `generate` script to `packages/tokens/package.json`:

```json
{
  "name": "@repo/tokens",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./dist/tokens": "./dist/_tokens.scss"
  },
  "scripts": {
    "build": "tsc && pnpm run generate",
    "generate": "node dist/generate-scss.js"
  }
}
```

### Rules for Adding or Changing Tokens

1. Edit `packages/tokens/src/tokens.ts` only. Never hardcode a value in a component or a `.module.scss` file.
2. Run `pnpm --filter @repo/tokens run build` after any change.
3. Commit `tokens.ts` and the regenerated `dist/_tokens.scss` in the same commit.
4. Do not add tokens for one-off values. If a value is used in only one place, it is not a token; it is a magic number that should be replaced by an existing token or abstracted into a component variant.

### Styling Mechanics

The web client uses SCSS Modules. Token values are consumed via CSS custom properties.

```scss
// Button.module.scss
.button {
  background: var(--accent); // CSS custom property from _tokens.scss
  border-radius: 10px; // tokens.radii.button via CSS var if added
  color: var(--white);
  transition: background var(--transition-hover, 0.15s);
}
```
