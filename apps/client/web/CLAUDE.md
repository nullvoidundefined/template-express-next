# Web Client Conventions

Auto-loaded when working in `apps/client/web/`. The root `../../../CLAUDE.md` non-negotiable rules and the shared client rules in `../CLAUDE.md` both apply; these rules layer on top for Next.js, SCSS, and Railway deployment. If a rule here and the parent files conflict, the parent wins and the conflict is a bug to file.

---

## Frontend Conventions

Applies to all `apps/client/web/` code.

### Framework and Stack

- Next.js 15 with App Router (`src/app/`)
- React 19 with functional components only. No class components.
- TypeScript in strict mode. No `any`; use `unknown` and narrow.
- SCSS Modules for all component styling. See the Styling section.
- TanStack Query (React Query) for all server state. No raw `useEffect` plus `fetch`.
- Radix UI for headless primitives (dialogs, dropdowns, toasts, toggles, select, etc.), styled with SCSS modules.
- No Tailwind. All styling through SCSS modules and CSS custom properties.

### Directory Structure

The top-level client structure (web, extension, mobile, shared packages) is documented in `../CLAUDE.md`. This section covers the web-specific layout only.

```
src/
├── app/
│   ├── (auth)/                       # Unauthenticated route group
│   │   ├── auth.module.scss          # Shared form styles (login + register)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (protected)/                  # Authenticated route group
│   │   ├── layout.tsx                # Auth-guarding layout
│   │   └── dashboard/
│   │       └── page.tsx
│   ├── globals.scss                  # CSS custom properties, reset, base typography
│   ├── layout.tsx                    # Root layout (metadata, fonts, providers)
│   └── page.tsx                      # Landing / splash page
├── components/                       # Shared UI (per-folder: Name/Name.tsx + Name.module.scss)
│   └── ui/                           # Radix-based primitives
│       ├── Button/
│       │   ├── Button.tsx
│       │   └── Button.module.scss
│       └── Toast/
│           ├── Toast.tsx
│           └── Toast.module.scss
├── providers/                        # React context and provider components
│   └── QueryProvider.tsx             # TanStack Query client config + provider
├── state/                            # Custom React hooks (state layer)
│   └── useAuth.ts                    # Auth state: user, login, logout, register
└── services/                         # HTTP infrastructure
    └── api.ts                        # Typed fetch wrapper (NEXT_PUBLIC_API_URL)
```

Rules:

- No `lib/` directory. HTTP infrastructure belongs in `services/`, state and side-effect logic in `state/`.
- Each component lives in its own folder: `ComponentName/ComponentName.tsx` plus `ComponentName.module.scss`. Never a flat `.tsx` directly under `components/`.
- Pages follow Next.js App Router file conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`).
- Route groups use parentheses: `(auth)` for unauthenticated pages, `(protected)` for auth-guarded pages.
- No `index.ts` barrel files. Import directly from the source file.
- Types shared with other surfaces belong in `@repo/types`, not in a local `types/` directory.

### File Naming

| What               | Convention               | Example                      |
| ------------------ | ------------------------ | ---------------------------- |
| Components         | `PascalCase.tsx`         | `ChatBox.tsx`, `Header.tsx`  |
| SCSS modules       | `PascalCase.module.scss` | `ChatBox.module.scss`        |
| Pages              | `page.tsx` (Next.js)     | `app/dashboard/page.tsx`     |
| Layouts            | `layout.tsx`             | `app/(protected)/layout.tsx` |
| Hooks              | `camelCase.ts`           | `useAuth.ts`, `useToast.ts`  |
| Utilities          | `camelCase.ts`           | `api.ts`, `queryClient.ts`   |
| Types              | `camelCase.ts`           | `index.ts`                   |
| Global styles      | `globals.scss`           | `app/globals.scss`           |
| Route-level styles | `camelCase.module.scss`  | `dashboard.module.scss`      |

### Component Patterns

File structure, top to bottom, in this exact order:

1. Directive (`'use client'`) if needed
2. Imports (grouped, each group alphabetized: React/Next, third-party, local `@/`, relative, SCSS last)
3. Type definitions, alphabetized by type name, with keys alphabetized inside each type
4. Constants and configuration objects, keys alphabetized
5. Pure helper functions (no hooks, no side effects)
6. The component function, destructured props alphabetized to match the type
7. `displayName` assignment
8. Named export statement

```typescript
'use client';

// Imports
import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import styles from './ChatBox.module.scss';

// Types, alphabetized by type name
type ChatBoxProps = {
    onSend: (message: string) => void;
    tripId: string;
};

type Status = 'error' | 'idle' | 'loading' | 'success';

// Constants, keys alphabetized
const STATUS_LABELS: Record<Status, string> = {
    error: 'Something went wrong',
    idle: 'Ready',
    loading: 'Loading',
    success: 'Done',
};

// Helpers
function formatPrompt(input: string): string {
    return input.trim();
}

// Component
function ChatBox({ onSend, tripId }: ChatBoxProps) {
    // hooks first, grouped by purpose (state, refs, queries, effects, derived)
    const [input, setInput] = useState('');

    // handlers prefix with `handle`
    const handleSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        // ...
    }, []);

    return (
        <div className={styles.chatBox} data-test-id='chat-box'>
            {/* ... */}
        </div>
    );
}

ChatBox.displayName = 'ChatBox';

export { ChatBox };
```

Rules:

- **Named exports only.** Never use `export default`. Every file ends with an explicit `export { ComponentName }` statement. This applies to components, pages, layouts, hooks, and utilities.
- **`displayName` required.** Every component sets `ComponentName.displayName = 'ComponentName'` immediately after the function definition and before the export. For compound components, every sub-component sets its own scoped displayName (e.g., `'Card.Header'`).
- **`data-test-id` on the root element.** Every component's outermost rendered DOM element has a `data-test-id` attribute in kebab-case matching the component name (`UserCard` becomes `data-test-id='user-card'`). List items append a unique identifier (`data-test-id={`user-card-${userId}`}`). Never use `data-test-id` for styling or application logic; it exists exclusively for test targeting.
- Props types use the `{ComponentName}Props` suffix, defined above the component.
- `'use client'` directive on every interactive component (has state, handlers, effects).
- `useCallback` for event handlers and async functions passed as props.
- Destructure props in the function signature; the destructured order matches the alphabetical order of the type definition.
- No inline styles. Use SCSS modules for all styling.
- No `React.FC`. Use plain function declarations with typed props.
- Use `ComponentPropsWithoutRef<'button'>` (or `WithRef`) to extend native element props instead of hand-rolling HTML attributes.
- Event handler naming: external callbacks prefix with `on` (`onSelect`), the internal handler implementation prefixes with `handle` (`handleSelect`).
- Boolean props are adjectives or past participles (`disabled`, `expanded`). Use `isLoading` only when ambiguity demands the prefix.
- Never pass `useState` setters directly as props. Wrap them in a named callback that describes intent.
- Avoid `options` bags or config objects for props. Flat props are easier to read, diff, and memoize.
- Prefer composition (compound components, render props, slots) over configuration (variant flags, boolean matrices).

### Import Ordering

Imports are grouped with blank lines between groups, in this order:

```typescript
// 1. React / Next.js
import { useEffect, useState } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

// 2. Third-party packages
import { useMutation, useQuery } from '@tanstack/react-query';

// 3. Local imports (@ alias paths)
import { api } from '@/lib/api';
import type { Trip } from '@/types';

// 4. Relative imports (sibling components, utils)
import { formatDate } from './utils';

// 5. Style imports (always last)
import styles from './Component.module.scss';
```

- Use the `type` keyword for type-only imports.
- Sort specifiers alphabetically within each import.
- Use the `@/` path alias for `src/` imports, never relative `../../` beyond one level.

### TypeScript Patterns

TypeScript rules (strict mode, no `any`, `type` vs `interface`, Zod schemas, discriminated unions) are defined in `../CLAUDE.md` and apply here without repetition. Web-specific additions:

- Zod-inferred types when sharing shapes with the backend: `type Job = z.infer<typeof jobSchema>`.
- Props types are local to their component file, defined above the component.
- Shared frontend types go in `src/types/index.ts`.

### State Management

- TanStack Query for all server state (fetching, caching, mutations).
- Zustand for cross-component client state: `useToastStore`, `useModalStore`, `useTheme`. See the Zustand Stores section in `../CLAUDE.md`.
- React Context for auth session object and other app-wide providers.
- `useState` for local UI state (form inputs, toggles).
- `useCallback` for memoizing handlers.
- `useRef` for DOM refs and stable references.
- No Redux, Jotai, or Recoil.

### API Calls

All API calls go through a typed fetch wrapper in `src/services/api.ts`:

```typescript
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, json: unknown) =>
    apiFetch<T>(path, { method: 'POST', json }),
  patch: <T>(path: string, json: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', json }),
  del: (path: string) => apiFetch(path, { method: 'DELETE' }),
};
```

- Base URL from `NEXT_PUBLIC_API_URL` env var (or relative URLs when the frontend and API share a Railway domain).
- `credentials: 'include'` on every request.
- `X-Requested-With: XMLHttpRequest` header for CSRF (header-only pattern; no token endpoint).
- Errors throw with the server's error message.
- Components use TanStack Query hooks, not direct `api` calls in effects.

### Error Handling

- Toast component for API and server errors. Never show raw error text inline.
- Inline errors only for form validation (field-level messages).
- TanStack Query `onError` callbacks route to toast.
- Never show stack traces to the user.

### Next.js Patterns

- App Router only. No Pages Router.
- `layout.tsx` for root layout (metadata, fonts, global providers).
- Route groups `(auth)`, `(protected)` for shared layouts.
- `loading.tsx` and `error.tsx` boundary files where appropriate.
- Metadata exported from server components:
  ```typescript
  export const metadata: Metadata = {
    title: 'App Name',
    description: 'Description here',
  };
  ```
- Font system via `next/font/google` with CSS variable injection.

### Next.js Middleware Route Map

`src/middleware.ts` uses two structures to determine access level for each route:

- `ROUTE_MAP`: exact path matches (`Record<string, Access>`). Add new exact paths here.
- `PREFIX_RULES`: prefix matches (`Array<{ prefix, access }>`). Add new route groups here (e.g., `/settings`, `/admin`).
- Default for unlisted routes: `'private'`.

Access values: `'public'` (no auth required), `'private'` (must have `sid` cookie), `'admin'` (must have `sid` + admin flag).

To add a new route:

1. Public page: add `'/your-path': 'public'` to `ROUTE_MAP`.
2. Protected section: add `{ prefix: '/your-section', access: 'private' }` to `PREFIX_RULES`.
3. The `sid` cookie presence is the only check in middleware. The real auth gate is the `(protected)` layout server component.

### API Proxy Route

All `/api/*` requests are proxied to the Express backend via `src/app/api/[...path]/route.ts`. This lets server components and actions call the API without CORS issues and without exposing `INTERNAL_API_URL` to the browser.

- Env var: `INTERNAL_API_URL` (Railway internal URL; not `NEXT_PUBLIC_`).
- The proxy forwards the method, body, and `Cookie` header. It does not forward all headers to avoid leaking internal values.
- Client-side code still uses `NEXT_PUBLIC_API_URL` through `services/api.ts`.

### Storybook

Every component in `src/components/` requires a co-located `*.stories.tsx` file created or updated in the same commit as the component. `export default` is allowed in story files and `.storybook/` config files -- this is an explicit exception to the named-exports-only rule.

### Testing (Frontend)

- Vitest as the test runner (shared config with backend).
- `@testing-library/react` for component testing. Test behavior, not implementation.
- `@testing-library/user-event` for simulating user interactions.
- Test files live in `src/__tests__/`, mirroring the source tree. See the root `CLAUDE.md` Testing Conventions section.
- Mock API calls with `vi.mock('@/services/api')`.
- Test what users see and do, not internal state or props.

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
    it('shows success message after submit', async () => {
        render(<MyComponent />);
        await userEvent.click(screen.getByRole('button', { name: /submit/i }));
        expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
});
```

Playwright for end-to-end testing of complete user flows. Tests live in `e2e/` at the project root. Cover critical paths: auth, navigation, CRUD, error states.

### Radix UI

Use Radix UI primitives for all interactive UI elements. Radix provides accessible, unstyled headless components. Style them with SCSS modules.

When to use Radix:

- Dropdowns, select menus, comboboxes: `@radix-ui/react-select`, `@radix-ui/react-dropdown-menu`.
- Dialogs, modals: `@radix-ui/react-dialog`.
- Toasts: `@radix-ui/react-toast`.
- Toggles, switches: `@radix-ui/react-toggle`, `@radix-ui/react-switch`.
- Tooltips: `@radix-ui/react-tooltip`.
- Tabs: `@radix-ui/react-tabs`.

Component library structure:

```
src/components/ui/
├── Button/Button.tsx + Button.module.scss
├── Select/Select.tsx + Select.module.scss
├── Badge/Badge.tsx + Badge.module.scss
├── Toggle/Toggle.tsx + Toggle.module.scss
└── Toast/Toast.tsx + Toast.module.scss
```

### ESLint Rules

- `@typescript-eslint/naming-convention`: camelCase for functions and variables, PascalCase for types and components.
- `curly: 'error'`. Always use braces.
- No unused imports (`eslint-plugin-unused-imports`).
- No explicit `any`.

Lint warnings ship as blockers. CI must fail on any warning. `pnpm lint --max-warnings=0`.

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

---

## Styling Conventions

### Stack

- SCSS Modules (`.module.scss`) for all component styles.
- Global SCSS (`globals.scss`) for CSS custom properties, resets, and base styles.
- CSS Custom Properties for theming (colors, spacing tokens).
- No Tailwind. Never use utility classes.
- No BEM. Never use `block__element--modifier` naming.
- No CSS-in-JS. No styled-components, emotion, or inline style objects.
- No plain CSS. Always use SCSS for nesting and variables.

### File Structure

```
src/
├── app/
│   └── globals.scss                   # Custom properties, resets, base typography
├── styles/                            # (optional) Shared SCSS partials
│   ├── _variables.scss                # SCSS variables ($breakpoints, $radii, etc.)
│   └── _mixins.scss                   # Reusable mixins (responsive, truncate, etc.)
├── components/
│   └── ChatBox/
│       ├── ChatBox.tsx
│       └── ChatBox.module.scss        # Scoped styles for this component
```

- Every component has a co-located `.module.scss` file in the same folder.
- Global styles live in `src/app/globals.scss`.
- Shared SCSS partials (variables, mixins) live in `src/styles/` and are imported with `@use`.
- Page-level styles use `camelCase.module.scss`.

### CSS Custom Properties (Design Tokens)

Define all design tokens as CSS custom properties in `globals.scss`:

```scss
:root {
  // Colors
  --background: #ffffff;
  --foreground: #222222;
  --foreground-muted: #717171;
  --border: #ebebeb;
  --surface: #f7f7f7;
  --surface-alt: #f0f0f0;
  --surface-hover: #f0f0f0;
  --surface-active: #e0e0e0;
  --accent: #e8651a;
  --accent-hover: #c85411;
  --accent-light: #fdecd9;
  --background-translucent: rgba(255, 255, 255, 0.92);
}
```

Rules:

- All colors come from custom properties. Never hardcode hex values in component SCSS.
- Exception: pure white (`#fff`) and error red (`#ef4444`) may be used directly.
- Token names use kebab-case: `--foreground-muted`, `--surface-hover`.
- Semantic naming. Describe purpose, not appearance: `--accent`, not `--orange`.

### Class Naming

Use camelCase for all class names:

```scss
// ChatBox.module.scss
.chatBox { ... }
.messageList { ... }
.inputArea { ... }
.sendButton { ... }
```

Rules:

- camelCase for all class names.
- No BEM. Never use `__` or `--` in class names.
- No kebab-case. Never use `.chat-box` or `.message-list`.
- Variant classes are separate: `.chip` plus `.chipSelected`, not `.chip--selected`.
- State classes are also camelCase: `.active`, `.disabled`, `.loading`.
- Screen-reader-only utility: `.srOnly`.

### SCSS Nesting

Use SCSS nesting for:

1. Pseudo-classes and pseudo-elements (`&:hover`, `&::before`)
2. State modifiers via parent selector (`.user &`, `.assistant &`)
3. Direct child elements (`p`, `span`, `input` inside a scoped class)
4. Media queries (nested inside the class they modify)

```scss
.navLink {
  padding: 8px 16px;
  color: var(--foreground-muted);
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    background: var(--surface-hover);
    color: var(--foreground);
  }

  &.active {
    background: var(--surface-active);
    font-weight: 600;
  }
}
```

Rules:

- Nest only 2 levels deep maximum (excluding pseudo-classes).
- Use `&` for pseudo-classes, pseudo-elements, and compound selectors.
- Never nest more than 3 levels. Flatten and create a new class instead.

### Responsive Design

Use `@media` queries nested inside the class they modify or at the bottom of the module file:

```scss
.features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 800px) {
  .features {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

@media (max-width: 480px) {
  .features {
    grid-template-columns: 1fr;
  }
}
```

Breakpoints:

```scss
$bp-mobile: 480px;
$bp-tablet: 800px;
$bp-desktop: 1200px;
```

- Desktop-first with `max-width` media queries.
- Breakpoints go at the bottom of the module file, grouped together.

### Spacing and Sizing

- Use `px` values directly. No rem/em conversion required.
- Common spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
- Border radius scale: `4px` (subtle), `8px` (standard), `10px` (buttons), `12px` (cards), `16px` (large cards), `20px` (pills), `50%` (circles).
- Max content width: `1400px` with `margin: 0 auto`.
- Page padding: `24px` horizontal, reduced to `16px` on mobile.

### Typography

- Font: `var(--font-geist-sans), system-ui, sans-serif` set in `globals.scss`.
- Base size: `14px` for body text.
- Scale: `11px` (badges), `12px` (captions), `13px` (small text), `14px` (body), `15px` (form labels), `16px` (subheadings), `18px` (subtitles), `28px` (section titles), `48px` (desktop hero).
- Font weights: 400, 500, 600, 700, 800 (hero titles only).
- Letter spacing: `-0.03em` (hero), `-0.02em` (headings), `0.05em` (uppercase labels).
- Line heights: `1.1` (hero), `1.5` (body and small), `1.6` (paragraph).

### Transitions and Animations

- Standard transition: `transition: background 0.15s` or `transition: color 0.15s`.
- Multiple properties: `transition: background 0.15s, color 0.15s, border-color 0.15s`.
- Duration: `0.15s` for hover states, `0.2s` for state changes.
- Easing: default (ease). Do not specify unless needed.
- Keyframe animations use camelCase: `@keyframes typingDot { ... }`.

### Interactive Elements

Buttons:

```scss
.primaryButton {
  padding: 12px 28px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

Inputs:

```scss
.input {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--foreground);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;

  &::placeholder {
    color: var(--foreground-muted);
    opacity: 0.6;
  }

  &:focus {
    border-color: var(--accent);
  }
}
```

Rules for all interactive elements:

- Always set `font-family: inherit`.
- Always set `cursor: pointer` on clickable elements.
- Always handle `:disabled` state with `opacity` plus `cursor: not-allowed`.
- Use `:hover:not(:disabled)` to prevent hover styles on disabled elements.
- Use `outline: none` on inputs, with `border-color` change on `:focus`.

### Global Reset

```scss
:root {
  // Design tokens here
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

a {
  color: inherit;
  text-decoration: none;
}
```

### SCSS Module Import in TSX

```tsx
import styles from './ChatBox.module.scss';

// Single class
<div className={styles.chatBox}>

// Multiple classes
<div className={`${styles.message} ${styles.user}`}>

// Conditional class
<button className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}>
```

- Import as `styles` (always this name).
- Access classes via `styles.camelCaseName`.
- Compose with template literals for multiple and conditional classes.
- Never use `classnames` or `clsx` libraries. Template literals are sufficient.

### SCSS Formatting

- 2-space indentation.
- Properties ordered by box model: position, display, sizing, spacing, border, background, typography, transition.
- One declaration per line.
- Opening brace on the same line as the selector.
- Blank line between rule blocks.
- Trailing semicolons on all declarations.

---

## Non-Negotiable Rules (Frontend-Specific)

These layer on top of the root non-negotiables in `../../../CLAUDE.md`. If they conflict, root wins and file a bug.

1. **No Tailwind, ever.** All styling is SCSS Modules plus CSS custom properties. See the Styling Conventions section.
2. **TanStack Query is mandatory for server state.** No raw `useEffect` + `fetch` in components. See the API Calls section.
3. **Per-component folder structure.** Every component lives at `src/components/ComponentName/ComponentName.tsx` plus `ComponentName.module.scss`. No flat `.tsx` files under `src/components/`.
4. **Every React component has a `displayName` and a `data-test-id`.** See the Component Patterns section for the exact format. `displayName` is `ComponentName` (or `Parent.Child` for compound components). `data-test-id` is kebab-case matching the component name, attached to the outermost rendered DOM element.
5. **Path alias:** `@/` resolves to `src/`. Never relative `../../` beyond one level.

---

## Railway Deployment (Web Service)

The Next.js frontend deploys as a `web` Railway service within the same project as the API, Postgres, and Redis services.

- Set the root directory to `apps/client/web/` in the Railway service settings.
- Set `NODE_ENV=production` on the web service.
- Set all env vars on the web service before the first deploy.
- When the frontend and API share a Railway domain, cookies use `SameSite: 'lax'`. No same-origin rewrite required.
- Railway's default Next.js health check applies; no custom `/health` route needed on the web service.
