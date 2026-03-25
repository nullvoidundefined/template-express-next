# --- Base ---
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# --- Dependencies ---
FROM base AS deps
COPY server/package.json server/package.json
COPY web-client/package.json web-client/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod=false

# --- Build server ---
FROM deps AS build-server
COPY server/ server/
RUN pnpm --filter server run build

# --- Build web client ---
FROM deps AS build-web
COPY web-client/ web-client/
RUN pnpm --filter web-client run build

# --- Production server ---
FROM base AS server
COPY server/package.json server/package.json
COPY web-client/package.json web-client/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod
COPY --from=build-server /app/server/dist server/dist
COPY server/migrations server/migrations
EXPOSE 3000
CMD ["node", "server/dist/index.js"]

# --- Production web client ---
FROM base AS web
COPY --from=build-web /app/web-client/.next/standalone ./
COPY --from=build-web /app/web-client/.next/static .next/static
COPY --from=build-web /app/web-client/public public
EXPOSE 3000
CMD ["node", "server.js"]
