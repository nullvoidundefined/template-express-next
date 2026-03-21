# Next.js app template

A minimal **[Next.js 15](https://nextjs.org)** (App Router) + **React 19** + **TypeScript** starter: strict TS, `@/*` path alias, **SCSS** (global + CSS modules), **ESLint** + **Prettier**, and **Geist** fonts via `next/font`.

Use it **standalone** or **copy the package** into a **pnpm monorepo** (for example `apps/web` or `packages/site`).

## Requirements

- **Node** `>=20.9.0` (see `engines` in `package.json`)
- **pnpm** is declared in `packageManager` for [Corepack](https://nodejs.org/api/corepack.html); you can still use npm or yarn if you prefer.

## Standalone

The repo includes **`pnpm-lock.yaml`** (see `packageManager` in `package.json`). Other managers work too; they will create their own lockfile on first install.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm install && npm run dev
# or
yarn && yarn dev
```

## pnpm monorepo

1. Copy this folder into your repo (e.g. `apps/web`).
2. In the **workspace root** `pnpm-workspace.yaml`, include that path (e.g. `apps/*`).
3. From the repo root: `pnpm install`.
4. Add workspace-specific scripts in the root `package.json` if you want, for example `"dev:web": "pnpm --filter template-next-js dev"` (use the `name` from this package’s `package.json`).

No special Next config is required for a normal workspace layout; keep `next.config.ts` at the app root next to this `package.json`.

## Scripts

Use `pnpm <script>` or `npm run <script>` (same names; yarn: `yarn <script>`).

| Script   | Description                         |
| -------- | ----------------------------------- |
| `dev`    | Dev server (Turbopack via Next)     |
| `build`  | Production build                    |
| `start`  | Serve production build              |
| `lint`   | ESLint (`next lint`)                |
| `format` | Prettier (`--write` on project)     |

## Layout

- `src/app/` — App Router routes and layouts (includes an example `/account` page and nav in `layout.tsx`)
- `src/app/globals.scss` — global styles (Geist CSS variables from `layout.tsx`)
- `src/app/page.module.scss` — example CSS module on the home page
- `public/` — static assets
- `next-env.d.ts` — Next TypeScript references (committed so clones typecheck immediately)

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
- [pnpm workspaces](https://pnpm.io/workspaces)
