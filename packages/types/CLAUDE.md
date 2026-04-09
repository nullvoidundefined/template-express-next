# Shared Types Conventions

Auto-loaded when working in `packages/types/`. The root `../../CLAUDE.md` rules apply.

---

## Purpose

This package is the single source of truth for TypeScript types that are used by two or more surfaces (server, web, extension, mobile). Any type that crosses the client/server boundary or is shared across two or more client apps belongs here.

Do not duplicate types. If a type already exists here, import it; do not redefine it elsewhere.

Do not add types here speculatively. Move a type here when the second consumer needs it.

---

## What belongs here

- Domain model types (`User`, `Session`, `Post`, etc.)
- API request and response shapes
- Enum-equivalent union types (`UserRole`, `Status`, etc.)
- Shared error shapes

## What does NOT belong here

- Zod schemas (those live in `packages/client-shared/src/schemas/` for client validation; server validation schemas live in `apps/server/src/schemas/`)
- React prop types (those live in the component file)
- Platform-specific types (React Native, WXT, Next.js)
- Runtime code of any kind (this package is type-only)

---

## Directory Structure

```
packages/types/
├── package.json
├── src/
│   ├── index.ts      # Re-exports every type this package exposes
│   └── user.ts       # Example: one file per domain entity
└── tsconfig.json
```

---

## Rules

- No runtime code. Every file contains only `type` and `interface` declarations plus re-exports.
- No default exports. Every file ends with a named `export type { ... }` statement.
- One file per domain entity. Do not put all types in a single file.
- All exports go through `src/index.ts`. Consumers import from `@repo/types`, never from a deep path.
- Types must be expressible in plain TypeScript. No Zod, no class decorators, no runtime dependencies.

---

## Consuming This Package

Install as a workspace dependency:

```bash
pnpm --filter server add @repo/types
pnpm --filter web add @repo/types
pnpm --filter extension add @repo/types
pnpm --filter mobile add @repo/types
```

Import with the `type` keyword:

```typescript
import type { User, UserRole } from '@repo/types';
```

---

## Example Type File

```typescript
// src/user.ts

export type UserRole = 'admin' | 'member' | 'viewer';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
};

export type { User, UserRole };
```
