FROM oven/bun:1.3-alpine AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock* ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN bun install --frozen-lockfile || bun install

FROM base AS release
ENV NODE_ENV=production
ENV BUN_ENV=production
COPY --from=install /app/node_modules node_modules
COPY package.json bun.lock* ./
COPY packages/core packages/core
COPY apps/api apps/api
WORKDIR /app/apps/api

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3001/health || exit 1

CMD ["bun", "--smol", "run", "src/server.ts"]
