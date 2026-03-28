# --- Base ---
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH="/ms-playwright"
RUN corepack enable

# System dependencies required by Playwright Chromium
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# --- Dependencies (all deps, for building) ---
FROM base AS deps
COPY server/package.json server/package.json
COPY web-client/package.json web-client/package.json
RUN pnpm install --frozen-lockfile
# Install Playwright Chromium browser binary
RUN cd server && npx playwright install chromium

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
RUN pnpm install --frozen-lockfile --prod
# Install Playwright Chromium (no --with-deps since system packages already installed in base)
RUN cd server && npx playwright install chromium
COPY --from=build-server /app/server/dist server/dist
COPY server/migrations server/migrations
EXPOSE 3001
CMD ["node", "server/dist/index.js"]

# --- Production web client ---
FROM base AS web
COPY --from=build-web /app/web-client/.next/standalone ./
COPY --from=build-web /app/web-client/.next/static .next/static
COPY --from=build-web /app/web-client/public public
EXPOSE 3000
CMD ["node", "server.js"]
