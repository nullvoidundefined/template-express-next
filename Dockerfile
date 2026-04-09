# --- Base ---
FROM node:22 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# --- Dependencies ---
FROM base AS deps
COPY apps/server/package.json apps/server/package.json
COPY apps/client/web/package.json apps/client/web/package.json
RUN LEFTHOOK=0 pnpm install --frozen-lockfile

# --- Build server ---
FROM deps AS build-server
COPY apps/server/ apps/server/
RUN pnpm --filter ./apps/server run build

# --- Build web client (for local/CI use) ---
FROM deps AS build-web
COPY apps/client/web/ apps/client/web/
RUN pnpm --filter web run build

# --- Production server (used by Railway) ---
FROM base AS server
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/server/node_modules apps/server/node_modules
COPY --from=build-server /app/apps/server/dist apps/server/dist
COPY apps/server/migrations apps/server/migrations
COPY package.json pnpm-workspace.yaml ./
# Start script: run migrations then start server
RUN printf '#!/bin/sh\nset -e\napps/server/node_modules/.bin/node-pg-migrate -m apps/server/migrations up\nexec node apps/server/dist/index.js\n' > /app/start.sh && chmod +x /app/start.sh
EXPOSE 3001
CMD ["/app/start.sh"]
