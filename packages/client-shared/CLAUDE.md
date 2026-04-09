# Client Shared Conventions

Auto-loaded when working in `packages/client-shared/`. The root `../../CLAUDE.md` rules apply. This workspace has no framework-specific additions of its own; everything here must work in web, extension, and mobile without modification.

---

## Purpose

This package holds code that is used by two or more client apps and has no platform-specific dependencies. If it imports anything from React Native, WXT, or Next.js, it does not belong here.

Candidates:

- Typed API fetch wrapper (`lib/api.ts`)
- Zod schemas for API response shapes
- TypeScript types for shared domain models
- Auth helpers (token storage interface, session shape)
- Utility functions (date formatting, string helpers, validation)

Do not add code here speculatively. Extract to shared when the second client needs it, not before.

---

## Directory Structure

```
packages/client-shared/
├── package.json
├── src/
│   ├── index.ts          # Re-exports everything this package exposes
│   ├── api.ts            # Typed fetch wrapper (platform-agnostic)
│   ├── schemas/          # Zod schemas for API response shapes
│   │   └── user.ts
│   ├── types/            # Shared TypeScript types
│   │   └── index.ts
│   └── utils/            # Pure utility functions
│       └── format.ts
└── tsconfig.json
```

Rules:

- No default exports. Every file ends with a named `export { ... }` statement.
- No platform imports. No `react-native`, `wxt`, `next`, `react-dom`. Only `react` types are permitted (hooks are not used here; only type imports).
- All exports go through `src/index.ts`. Consumers import from `@repo/client-shared`, never from a deep path inside this package.
- No side effects. Every file in this package is a pure module.

---

## Consuming This Package

Install as a workspace dependency in the consuming app:

```bash
pnpm --filter web add @repo/client-shared
pnpm --filter extension add @repo/client-shared
pnpm --filter mobile add @repo/client-shared
```

Import from the package name, never by relative path:

```typescript
import { api, type User } from '@repo/client-shared';
```

---

## API Wrapper

The fetch wrapper here is platform-agnostic. Each client app may wrap it further to add platform-specific headers or auth token injection, but the core logic lives here.

```typescript
// src/api.ts
export type ApiError = { message: string };

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

async function apiFetch<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...init?.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: ApiError };
    throw new HttpError(res.status, body.error?.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function createApiClient(baseUrl: string) {
  return {
    del: (path: string) =>
      apiFetch<void>(baseUrl, path, { method: 'DELETE' }),
    get: <T>(path: string) =>
      apiFetch<T>(baseUrl, path),
    patch: <T>(path: string, json: unknown) =>
      apiFetch<T>(baseUrl, path, { method: 'PATCH', body: JSON.stringify(json) }),
    post: <T>(path: string, json: unknown) =>
      apiFetch<T>(baseUrl, path, { method: 'POST', body: JSON.stringify(json) }),
  };
}
```

Each client creates its own instance with its base URL:

```typescript
// web: apps/client/web/src/lib/api.ts
import { createApiClient } from '@repo/client-shared';
export const api = createApiClient(process.env.NEXT_PUBLIC_API_URL!);

// extension: apps/client/extension/lib/api.ts
import { createApiClient } from '@repo/client-shared';
export const api = createApiClient(import.meta.env.WXT_API_URL);

// mobile: apps/client/mobile/lib/api.ts
import { createApiClient } from '@repo/client-shared';
export const api = createApiClient(process.env.EXPO_PUBLIC_API_URL!);
```

---

## Schemas

Zod schemas for API response shapes live here when more than one client parses the same response.

```typescript
// src/schemas/user.ts
import { z } from 'zod';

export const userSchema = z.object({
  createdAt: z.coerce.date(),
  email: z.string().email(),
  id: z.string().uuid(),
  name: z.string(),
});

export type User = z.infer<typeof userSchema>;
```

Rules:

- Schema names: camelCase plus `Schema` suffix.
- Types derived with `z.infer`, never written separately.
- One schema file per domain entity. Do not put all schemas in one file.
