# --- Base ---
FROM node:22 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH="/ms-playwright"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# --- Dependencies ---
FROM base AS deps
COPY server/package.json server/package.json
COPY web-client/package.json web-client/package.json
RUN LEFTHOOK=0 pnpm install --frozen-lockfile
# Install Playwright Chromium + all required system dependencies
RUN node_modules/.pnpm/node_modules/.bin/playwright install chromium --with-deps

# --- Build server ---
FROM deps AS build-server
COPY server/ server/
RUN pnpm --filter ./server run build

# --- Build web client (for local/CI use) ---
FROM deps AS build-web
COPY web-client/ web-client/
RUN pnpm --filter web-client run build

# --- Production server (LAST STAGE — used by Railway) ---
FROM base AS server
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /ms-playwright /ms-playwright
COPY --from=build-server /app/server/dist server/dist
COPY server/migrations server/migrations
COPY package.json pnpm-workspace.yaml ./
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
