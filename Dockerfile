# --- Base ---
# Use the official Playwright Node image which includes all Chromium system dependencies
FROM mcr.microsoft.com/playwright/node:22-noble AS base
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
RUN pnpm install --frozen-lockfile
# Playwright browsers are pre-installed in /ms-playwright on this image,
# but install the specific version our package needs
RUN node_modules/.bin/playwright install chromium

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
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /ms-playwright /ms-playwright
COPY --from=build-server /app/server/dist server/dist
COPY server/migrations server/migrations
COPY package.json pnpm-workspace.yaml ./
EXPOSE 3001
CMD ["node", "server/dist/index.js"]

# --- Production web client ---
FROM base AS web
COPY --from=build-web /app/web-client/.next/standalone ./
COPY --from=build-web /app/web-client/.next/static .next/static
COPY --from=build-web /app/web-client/public public
EXPOSE 3000
CMD ["node", "server.js"]
