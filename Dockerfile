FROM oven/bun:1.3 AS base
WORKDIR /app

# Install all dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install

# Build frontend
FROM deps AS build-web
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/
RUN bun run --filter '@notes/web' build

# Production image
FROM base AS production
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN bun install

COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/
COPY --from=build-web /app/apps/web/dist apps/web/dist

# Run migrations then start server
WORKDIR /app/apps/server
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
VOLUME /app/apps/server/data

CMD ["sh", "-c", "bun src/db/migrate.ts && bun src/index.ts"]
