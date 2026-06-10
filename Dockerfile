# --- Base ---
FROM node:22 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# --- Dependencies ---
# Every workspace package.json must be present so pnpm can build the workspace
# graph and resolve the workspace:^ deps (@repo/constants, @repo/types, etc.).
FROM base AS deps
COPY apps/server/package.json apps/server/package.json
COPY apps/client/web/package.json apps/client/web/package.json
COPY packages/constants/package.json packages/constants/package.json
COPY packages/tokens/package.json packages/tokens/package.json
COPY packages/types/package.json packages/types/package.json
RUN LEFTHOOK=0 pnpm install --frozen-lockfile

# --- Build server ---
# packages/ source is required at build time: the server imports @repo/constants
# (runtime values) and @repo/types (compile-time), resolved from source via the
# workspace symlinks in node_modules.
FROM deps AS build-server
COPY packages/ packages/
COPY apps/server/ apps/server/
RUN pnpm --filter ./apps/server run build

# --- Build web client (for local/CI use) ---
FROM deps AS build-web
COPY packages/ packages/
COPY apps/client/web/ apps/client/web/
RUN pnpm --filter web run build

# --- Production server (used by Railway) ---
FROM base AS server
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/server/node_modules apps/server/node_modules
COPY --from=build-server /app/apps/server/dist apps/server/dist
COPY apps/server/migrations apps/server/migrations
# @repo/* are consumed from source at runtime (no build step), so the workspace
# symlinks in node_modules need their package sources present in the image.
COPY packages/ packages/
COPY package.json pnpm-workspace.yaml ./
# Start script: run migrations then start server
RUN printf '#!/bin/sh\nset -e\napps/server/node_modules/.bin/node-pg-migrate -m apps/server/migrations up\nexec node apps/server/dist/index.js\n' > /app/start.sh && chmod +x /app/start.sh
EXPOSE 3001
CMD ["/app/start.sh"]
