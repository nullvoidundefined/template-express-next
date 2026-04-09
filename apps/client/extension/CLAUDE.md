# Extension Conventions

Auto-loaded when working in `apps/client/extension/`. The root `../../../CLAUDE.md` non-negotiable rules still apply; these rules layer on top for browser extension work. If a rule in this file and the root file appear to conflict, the root file wins and the conflict is a bug to file.

---

## Framework

**Use WXT (Web Extension Tools) for all browser extensions.** WXT is the required framework for this template. It provides a unified build pipeline that targets Chrome (Manifest V3), Firefox, Safari, and Edge from a single codebase with zero per-browser forking.

```
https://wxt.dev
```

Why WXT over alternatives:
- First-class TypeScript and React support.
- Unified manifest: one `wxt.config.ts` generates the correct manifest per browser.
- HMR dev server for rapid iteration without manual reload cycles.
- Auto-imports for WXT's composable APIs (no repetitive import boilerplate).
- Built-in entrypoint conventions: `entrypoints/background.ts`, `entrypoints/content.ts`, `entrypoints/popup/index.html` are picked up automatically.
- `browser` polyfill built in (wraps `chrome.*` with promise-based `browser.*` for cross-browser compatibility).

Do not use raw `chrome.*` APIs. Always use `browser.*` from the WXT runtime. This is the single most important rule for cross-browser compatibility.

---

## Stack

- **Framework:** WXT
- **Language:** TypeScript (strict mode). No `any`; use `unknown` and narrow.
- **UI:** React 19 for popup and options pages. SCSS Modules for all styling.
- **Styling:** Same conventions as `apps/client-web/CLAUDE.md`. SCSS Modules, CSS custom properties, no Tailwind.
- **State:** React Context for popup/options UI state. No Redux or Zustand.
- **Storage:** `browser.storage.local` and `browser.storage.sync` via the storage composable. Never `localStorage` or `sessionStorage`.
- **Messaging:** `browser.runtime.sendMessage` / `browser.runtime.onMessage` wrapped in typed message helpers. No raw string-based message types.
- **Package manager:** pnpm. Register in the monorepo as `apps/client-extension`.

---

## Directory Structure

```
apps/client/extension/
├── wxt.config.ts                 # WXT configuration (manifest fields, browser targets)
├── package.json
├── tsconfig.json
├── entrypoints/                  # WXT magic directory: each file becomes an entrypoint
│   ├── background.ts             # Service worker (MV3) / background page (Firefox MV2)
│   ├── content.ts                # Content script (injected into pages)
│   └── popup/
│       ├── App.tsx               # Popup root component
│       ├── index.html            # Popup shell
│       └── main.tsx              # Popup entry
├── components/                   # Shared React components (popup + options)
│   └── Button/
│       ├── Button.tsx
│       └── Button.module.scss
├── lib/                          # Extension-specific helpers (no web equivalent)
│   ├── messages.ts               # Typed message definitions and send/receive wrappers
│   └── storage.ts                # Typed storage accessors (local + sync)
├── providers/                    # React context and provider components
│   └── QueryProvider.tsx         # TanStack Query client config + provider
├── services/                     # HTTP infrastructure
│   └── api.ts                    # Typed fetch wrapper (WXT_API_URL)
├── state/                        # State layer: hooks that own state + side-effects
│   └── useAuth.ts                # Auth state (user, login, logout, register)
├── assets/                       # Static assets (icons, images)
│   └── icon-128.png
└── public/                       # Files copied verbatim to the extension root
    └── icons/
```

Rules:

- `entrypoints/` is WXT's magic directory. Files here become extension entrypoints automatically.
- Shared logic that is used by more than one entrypoint lives in `lib/` (extension-specific) or `services/` / `state/` (same as web and mobile). Do not put shared logic inside a single entrypoint file.
- Components follow the same per-folder convention as `apps/client/web/`: `ComponentName/ComponentName.tsx` plus `ComponentName.module.scss`.
- No barrel `index.ts` files. Import directly from the file.

---

## Non-Negotiable Rules (Extension-Specific)

These layer on top of the root non-negotiables in `../../CLAUDE.md`. If they conflict, root wins and file a bug.

1. **Never use `chrome.*` directly.** Always use `browser.*` from the WXT runtime. This is what makes the same code run on Firefox, Safari, and Edge without per-browser forks.
2. **Typed messages only.** All `runtime.sendMessage` calls use a typed discriminated union. No raw strings or untyped payloads. See the Messaging section.
3. **No localStorage or sessionStorage.** Extension context is not a web page. Use `browser.storage.local` (device-scoped) or `browser.storage.sync` (cross-device) via the typed storage helpers in `lib/storage.ts`.
4. **Manifest V3 first.** Write for MV3 (service worker background, no persistent background pages). WXT handles the MV2 Firefox fallback automatically. Do not add MV2-only patterns to shared code.
5. **Minimal permissions.** Request only the permissions the current feature requires. Never request broad host permissions (`<all_urls>`) unless the feature genuinely needs them. Prefer `activeTab` where possible.
6. **Content scripts are sandboxed.** Never import extension-internal state directly into a content script. Communicate through the message bus only.
7. **TanStack Query for all server state in popup and options UI.** Use `useQuery` and `useMutation`; no raw `useEffect` + `fetch` in React components. The background service worker may use raw `fetch` since it runs outside React.
8. **Named exports only.** No `export default` anywhere. Same rule as the rest of the monorepo.

---

## WXT Configuration

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'My Extension',
    description: 'Description here',
    permissions: ['storage', 'activeTab'],
    // host_permissions added here as needed, not in permissions
  },
  // Build for all targets with: wxt build --browser firefox
  // Default target: chrome
});
```

Key config rules:

- `extensionApi: 'chrome'` tells WXT to use the Chrome types, but the runtime polyfill still exposes `browser.*` for cross-browser calls.
- Add browser-specific overrides in `wxt.config.ts` under `browser` keys, not by duplicating files.
- Keep `manifest.permissions` to the minimum required set. Add permissions in the same commit as the feature that needs them, with a comment explaining why.

---

## Entrypoint Patterns

### Background Service Worker

```typescript
// entrypoints/background.ts
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      // One-time setup on fresh install
    }
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  });
});
```

Rules:

- Background is a service worker in MV3. It can be terminated at any time. Never rely on in-memory state persisting between events. Use `browser.storage.local` for any state that must survive.
- Return `true` from `onMessage` listeners when the response is async.
- One background file. If logic grows large, extract to `lib/` and import into the background.

### Content Script

```typescript
// entrypoints/content.ts
export default defineContentScript({
  matches: ['https://example.com/*'],
  runAt: 'document_idle',
  main() {
    // DOM manipulation here
    // Communicate with background via browser.runtime.sendMessage
  },
});
```

Rules:

- `matches` is the minimum URL pattern required. Never use `<all_urls>` unless necessary.
- `runAt: 'document_idle'` is the default and correct choice for most content scripts.
- Keep content scripts thin. Extract business logic to `lib/` and call it from `main()`.
- Do not import from entrypoints in a content script. Only import from `lib/` and `components/`.

### Popup

```typescript
// entrypoints/popup/main.tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root')!;
createRoot(root).render(<App />);
```

Rules:

- Popup UI is React. Same component conventions as `apps/client-web/CLAUDE.md`.
- Popups are destroyed when closed. Do not store transient state in popup component state and expect it to persist. Use `browser.storage.local` for anything that must survive a popup close.
- Keep popup dimensions reasonable: max `400px` wide, content-height tall. Set explicit width in the root component's SCSS.

---

## Messaging (Typed)

All inter-context communication (popup to background, content to background, background to content) uses a single typed message union defined in `lib/messages.ts`.

```typescript
// lib/messages.ts

// Define all message types as a discriminated union
export type ExtensionMessage =
  | { type: 'GET_USER'; payload: { userId: string } }
  | { type: 'SET_SETTING'; payload: { key: string; value: unknown } }
  | { type: 'PING' };

export type ExtensionResponse =
  | { type: 'GET_USER'; data: { name: string; email: string } | null }
  | { type: 'SET_SETTING'; data: { ok: boolean } }
  | { type: 'PING'; data: 'pong' };

// Typed send helper
export async function sendMessage<T extends ExtensionMessage>(
  message: T,
): Promise<Extract<ExtensionResponse, { type: T['type'] }>['data']> {
  return browser.runtime.sendMessage(message);
}

// Typed listener helper (use in background)
export function onMessage(
  handler: (
    message: ExtensionMessage,
    sender: browser.Runtime.MessageSender,
  ) => Promise<unknown> | unknown,
) {
  browser.runtime.onMessage.addListener(handler);
}
```

Rules:

- Every message type is in the `ExtensionMessage` union. No ad-hoc message objects anywhere else.
- Add new message types to the union in `lib/messages.ts` before using them. This keeps all communication surfaces in one place.
- Background handles all messages. Popup and content scripts only send; they do not listen for arbitrary messages from each other.

---

## Storage (Typed)

All reads and writes to extension storage go through typed helpers in `lib/storage.ts`. Never call `browser.storage.*` directly from a component or entrypoint.

```typescript
// lib/storage.ts
import { storage } from 'wxt/storage';

// Define the storage schema
export type LocalStorage = {
  userId: string | null;
  lastSyncAt: number | null;
};

export type SyncStorage = {
  theme: 'light' | 'dark';
  notifications: boolean;
};

// Typed helpers
export const localStore = {
  getUserId: () => storage.getItem<string>('local:userId'),
  setUserId: (id: string) => storage.setItem('local:userId', id),
  getLastSyncAt: () => storage.getItem<number>('local:lastSyncAt'),
  setLastSyncAt: (ts: number) => storage.setItem('local:lastSyncAt', ts),
};

export const syncStore = {
  getTheme: () => storage.getItem<'light' | 'dark'>('sync:theme'),
  setTheme: (theme: 'light' | 'dark') => storage.setItem('sync:theme', theme),
  getNotifications: () => storage.getItem<boolean>('sync:notifications'),
  setNotifications: (v: boolean) => storage.setItem('sync:notifications', v),
};
```

Rules:

- Prefix keys with `local:` or `sync:` as WXT requires.
- All storage access is async. Never assume synchronous reads.
- `local` storage: device-only, larger quota (up to 10MB). Use for data that does not need to roam.
- `sync` storage: syncs across devices when signed into the browser. Small quota (100KB total, 8KB per item). Use only for user preferences, not data blobs.
- Expose domain-specific helpers, not raw key strings. Callers never see storage keys.

---

## API Calls

When the extension needs to call the app's API server, use the typed fetch wrapper in `lib/api.ts`. This is the same pattern as `apps/client-web/lib/api.ts`, adapted for the extension context.

```typescript
// lib/api.ts
const BASE_URL = import.meta.env.WXT_API_URL;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...init?.headers,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, json: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(json),
    }),
};
```

Rules:

- Set `WXT_API_URL` as an environment variable (prefixed `WXT_` so WXT exposes it via `import.meta.env`).
- API calls always include `X-Requested-With: XMLHttpRequest` for CSRF compliance with the backend.
- API calls that require auth rely on the session cookie (`credentials: 'include'`). The extension and the web app share the same API server, so the same cookie applies when the user is on the same domain.
- API calls must only happen from the background service worker. Never call the API directly from a content script (CORS will block it). Route through `sendMessage` to background instead.

---

## Cross-Browser Reusability Checklist

Before shipping any feature:

- [ ] Tested in Chrome (primary target).
- [ ] Tested in Firefox (`pnpm wxt build --browser firefox`).
- [ ] No `chrome.*` calls anywhere. Only `browser.*`.
- [ ] No Manifest V2-only patterns (persistent background page, `browser_action`, etc.).
- [ ] Content script `matches` is as narrow as the feature requires.
- [ ] Permissions are minimal; none were added without a comment explaining the need.
- [ ] Storage keys are accessed only through `lib/storage.ts` helpers.
- [ ] Messages are typed and routed through `lib/messages.ts`.
- [ ] No logic duplicated between popup, options, and content scripts. Shared logic is in `lib/`.

---

## Permissions Reference

Request the narrowest permission that satisfies the feature:

| Need | Correct permission |
|------|--------------------|
| Read/write the active tab's URL | `activeTab` |
| Read all tabs | `tabs` |
| Run on specific sites | `host_permissions: ['https://example.com/*']` |
| Run on all sites | `host_permissions: ['<all_urls>']` (requires justification) |
| Read/write local storage | `storage` |
| Send notifications | `notifications` |
| Read browsing history | `history` (sensitive, requires justification) |
| Intercept network requests | `webRequest` (sensitive, MV3 uses `declarativeNetRequest` instead) |

Sensitive permissions (`history`, `<all_urls>`, `webRequest`) require a written justification comment in `wxt.config.ts` next to the permission entry.

---

## Build and Dev Commands

```bash
pnpm wxt dev                          # Dev mode, Chrome, with HMR
pnpm wxt dev --browser firefox        # Dev mode, Firefox
pnpm wxt build                        # Production build for Chrome
pnpm wxt build --browser firefox      # Production build for Firefox
pnpm wxt zip                          # Zip for Chrome Web Store submission
pnpm wxt zip --browser firefox        # Zip for Firefox Add-ons submission
pnpm wxt typecheck                    # Run TypeScript checks only
```

Add these as scripts in `apps/client-extension/package.json`:

```json
{
  "scripts": {
    "dev": "wxt dev",
    "dev:firefox": "wxt dev --browser firefox",
    "build": "wxt build",
    "build:firefox": "wxt build --browser firefox",
    "zip": "wxt zip",
    "zip:firefox": "wxt zip --browser firefox",
    "typecheck": "wxt typecheck",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

---

## Testing

- Unit tests with Vitest for all `lib/` utilities (message helpers, storage helpers, API wrapper).
- No DOM-level testing for popup/options components in this template. Add React Testing Library if the UI grows complex enough to warrant it.
- Cross-browser smoke testing is manual using the dev build in each target browser.
- Test files live in `src/__tests__/`, mirroring the source tree. See the root `CLAUDE.md` Testing Conventions section.

---

## Security

- Never store sensitive data (tokens, passwords) in `browser.storage.sync`. Sync storage can be read by any device the user is signed into.
- Never inject raw user-supplied strings into the DOM via `innerHTML`. Use `textContent` or React for all DOM writes from content scripts.
- Content Security Policy is set in `wxt.config.ts` under `manifest.content_security_policy`. Do not loosen it to unblock a dev convenience.
- `externally_connectable` should list only the specific origins that need to message the extension. Default is empty (no external origins).
