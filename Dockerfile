FROM oven/bun:1.3 AS base
WORKDIR /app

# --frozen-lockfile fails the build if bun.lock and package.json drift.
# Drift was the silent precondition behind the prior crash-loop where
# stale workspace symlinks shipped inside the image: we never want a
# "best effort" install during a build.
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

# Build frontend
FROM deps AS build-web
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/
RUN bun run --filter '@notes/web' build

# Production image
FROM base AS production
# curl is the smallest HEALTHCHECK client; the bun base is debian-derived.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl \
	&& rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# --frozen-lockfile requires the workspace layout (all package.json files)
# to match the lockfile, even if we won't ship the web sources here.
RUN bun install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/
COPY --from=build-web /app/apps/web/dist apps/web/dist

WORKDIR /app/apps/server
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
VOLUME /app/apps/server/data

# start-period covers the migrate step before the first probe runs. After
# that, three failed probes flip the container to "unhealthy" so the
# dashboard surfaces a crash-loop instead of it sitting silently red.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

CMD ["sh", "-c", "bun src/db/migrate.ts && bun src/index.ts"]
