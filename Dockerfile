# =============================================================================
# STAGE 1: Dependencies - Install and cache workspace dependencies
# =============================================================================
FROM oven/bun:1.4.4 AS deps

WORKDIR /app

# Copy workspace configuration
COPY package.json bun.lock ./

# Copy package.json files for all packages (exclude local db; use published @trycompai/db)
COPY packages/kv/package.json ./packages/kv/
COPY packages/ui/package.json ./packages/ui/
COPY packages/email/package.json ./packages/email/
COPY packages/integration-platform/package.json ./packages/integration-platform/
COPY packages/integrations/package.json ./packages/integrations/
COPY packages/utils/package.json ./packages/utils/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/analytics/package.json ./packages/analytics/
# These four are declared `workspace:*` by apps/app, apps/portal and apps/api.
# Without their manifests `bun install` fails with "failed to resolve".
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/billing/package.json ./packages/billing/
COPY packages/company/package.json ./packages/company/

# Copy app package.json files
COPY apps/app/package.json ./apps/app/
COPY apps/portal/package.json ./apps/portal/
COPY apps/api/package.json ./apps/api/

# Install all dependencies
RUN PRISMA_SKIP_POSTINSTALL_GENERATE=true bun install --ignore-scripts

# =============================================================================
# STAGE 2: Ultra-Minimal Migrator - Only Prisma
# =============================================================================
# Prisma 7 needs bun 1.3+ (Node-compat v24); upstream pins 1.4.4 for CVE-2026-111497.
FROM oven/bun:1.4.4 AS migrator

WORKDIR /app

# Copy local Prisma schema and migrations from workspace.
# scripts/ is needed by the seeder: generate-prisma-client-js.js emits a
# schema using the legacy `prisma-client-js` generator, which populates
# node_modules/@prisma/client. Prisma 7's default generator instead writes to
# a src/generated/prisma folder, leaving `import '@prisma/client'` unresolved
# ("Cannot find module '.prisma/client/default'").
COPY packages/db/prisma ./packages/db/prisma
COPY packages/db/scripts ./packages/db/scripts
# seed.ts ends by importing ../../src/scripts/backfill-framework-versions,
# so the package source is required too — without it seeding completes all
# the template work and then dies on the final backfill.
COPY packages/db/src ./packages/db/src

# Create minimal package.json for Prisma runtime (also used by seeder)
# @prisma/adapter-pg is required by prisma/seed/seed.ts (it constructs
# `new PrismaPg(...)`). Without it the seeder fails with
# "Cannot find module '@prisma/adapter-pg'" *after* migrations succeed, which
# makes it look like a migration problem rather than a missing dependency.
# Versions must track packages/db, because the migrations copied in below come
# from there. Pinning the old @trycompai/db@1.3.4 ships a stale schema.prisma,
# so `prisma generate` produces a client missing fields the seed data uses and
# seeding dies with "Unknown argument `documentTypes`" — after migrations have
# already succeeded, which makes it look unrelated.
RUN echo '{"name":"migrator","type":"module","dependencies":{"prisma":"7.6.0","@prisma/client":"7.6.0","@prisma/adapter-pg":"7.6.0","@trycompai/db":"^2.3.0","zod":"^4.3.6"}}' > package.json

# Install ONLY Prisma dependencies
RUN bun install

# Ensure Prisma can find migrations relative to the published schema path
# We copy the local migrations into the published package's dist directory
RUN cp -R packages/db/prisma/migrations node_modules/@trycompai/db/dist/

# Run migrations against the combined schema published by @trycompai/db
RUN echo "Running migrations against @trycompai/db combined schema"
CMD ["bunx", "prisma", "migrate", "deploy", "--schema=node_modules/@trycompai/db/dist/schema.prisma"]

# =============================================================================
# STAGE 3: App Builder
# =============================================================================
FROM deps AS app-builder

WORKDIR /app

# Copy all source code needed for build
COPY packages ./packages
COPY apps/app ./apps/app
COPY turbo.json ./

# Bring in node_modules for build and prisma prebuild
COPY --from=deps /app/node_modules ./node_modules

# Workspace packages resolve via their `exports` map to dist/, which
# `bun install` does not create. Without this, `next build` fails with
# "Module not found: Can't resolve '@trycompai/auth'" (and '@trycompai/billing').
RUN bunx turbo build \
      --filter=@trycompai/auth \
      --filter=@trycompai/billing \
      --filter=@trycompai/company \
      --filter=@trycompai/db \
      --filter=@trycompai/email \
      --filter=@trycompai/kv \
      --filter=@trycompai/analytics \
      --filter=@trycompai/integration-platform

# Pre-combine schemas and generate the Prisma client into
# node_modules/@prisma/client. The deps stage ran `bun install` with
# `--ignore-scripts` so packages/db's postinstall was skipped; we run
# it explicitly here so `next build` can resolve the generated runtime
# + types when it imports @prisma/client.
RUN cd packages/db && node scripts/combine-schemas.js \
                   && node scripts/generate-prisma-client-js.js

# Ensure Next build has required public env at build-time
ARG NODE_HEAP_MB=6144
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_IS_DUB_ENABLED
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL \
    NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_IS_DUB_ENABLED=$NEXT_PUBLIC_IS_DUB_ENABLED \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production \
    NEXT_OUTPUT_STANDALONE=true \
    NODE_OPTIONS=--max_old_space_size=$NODE_HEAP_MB

# Build the app.
# SKIP_TYPE_CHECK: next build type-checks in Bun worker threads that ignore
# their memory cap, which OOMs this stage ("cannot allocate memory") right after
# "Compiled successfully". Types are enforced by `bun run typecheck` outside the
# image build — see the `typescript` block in apps/app/next.config.ts.
RUN cd apps/app && SKIP_ENV_VALIDATION=true SKIP_TYPE_CHECK=true bun run build:docker

# =============================================================================
# STAGE 4: App Production
# =============================================================================
FROM node:22.23.4-alpine AS app

WORKDIR /app

# Copy Next standalone output
COPY --from=app-builder /app/apps/app/.next/standalone ./
COPY --from=app-builder /app/apps/app/.next/static ./apps/app/.next/static
COPY --from=app-builder /app/apps/app/public ./apps/app/public

EXPOSE 3000
CMD ["node", "apps/app/server.js"]

# =============================================================================
# STAGE 5: Portal Builder
# =============================================================================
FROM deps AS portal-builder

WORKDIR /app

# Copy all source code needed for build
COPY packages ./packages
COPY apps/portal ./apps/portal
COPY turbo.json ./

# Bring in node_modules for build and prisma prebuild
COPY --from=deps /app/node_modules ./node_modules

# See the app builder: workspace packages must be built before the Next build
# can resolve them through their exports map.
RUN bunx turbo build \
      --filter=@trycompai/auth \
      --filter=@trycompai/billing \
      --filter=@trycompai/company \
      --filter=@trycompai/db \
      --filter=@trycompai/email \
      --filter=@trycompai/kv \
      --filter=@trycompai/analytics \
      --filter=@trycompai/integration-platform

# Copy the model files next to the portal's generator config. build:docker runs
# `prisma generate --schema=prisma/schema` on that directory, which in a clean
# checkout holds only schema.prisma (no models), so the client would lack every
# model (e.g. `Property 'policy' does not exist on type 'PrismaClient'`).
RUN cd apps/portal && bun run db:getschema

# Ensure Next build has required public env at build-time
ARG NODE_HEAP_MB=6144
ARG NEXT_PUBLIC_BETTER_AUTH_URL
# Without this, the portal's browser code calls the http://localhost:3333
# fallback, so training progress and other API-backed widgets never load.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production \
    NEXT_OUTPUT_STANDALONE=true \
    NODE_OPTIONS=--max_old_space_size=$NODE_HEAP_MB

# Build the portal
RUN cd apps/portal && SKIP_ENV_VALIDATION=true bun run build:docker

# =============================================================================
# STAGE 6: Portal Production
# =============================================================================
FROM node:22.23.4-alpine AS portal

WORKDIR /app

# Copy Next standalone output for portal
COPY --from=portal-builder /app/apps/portal/.next/standalone ./
COPY --from=portal-builder /app/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=portal-builder /app/apps/portal/public ./apps/portal/public

EXPOSE 3000
CMD ["node", "apps/portal/server.js"]

# =============================================================================
# STAGE 7: API Builder (NestJS)
# =============================================================================
FROM deps AS api-builder

WORKDIR /app

COPY packages ./packages
COPY apps/api ./apps/api
# turbo.json is required by `turbo build` below; it is not part of the deps stage.
COPY turbo.json ./

COPY --from=deps /app/node_modules ./node_modules

# Generate the Prisma client into node_modules/@prisma/client, exactly as the
# app builder does. Do NOT use the API's own `build:docker`: that runs
# `prisma generate` with the API's prisma config, which emits to
# apps/api/prisma/src/generated/prisma instead, leaving the stock @prisma/client
# empty. `apps/api/prisma/index.ts` re-exports '@prisma/client', so tsc then
# fails with TS2305 "has no exported member 'Prisma'".
RUN cd packages/db && node scripts/combine-schemas.js \
                   && node scripts/generate-prisma-client-js.js

# The workspace packages the API imports resolve via their `exports` map to
# dist/, which `bun install` does not create. Without this, tsc fails with
# TS2307 "Cannot find module '@trycompai/billing'" (and ~120 knock-on errors).
RUN bunx turbo build \
      --filter=@trycompai/auth \
      --filter=@trycompai/billing \
      --filter=@trycompai/company \
      --filter=@trycompai/db \
      --filter=@trycompai/email \
      --filter=@trycompai/integration-platform

ENV NODE_ENV=production
RUN cd apps/api && SKIP_ENV_VALIDATION=true bunx nest build

# =============================================================================
# STAGE 8: API Production
# =============================================================================
# Bun, NOT node: @trycompai/utils is published as raw TypeScript with no build
# step, and the compiled API still imports it at runtime. Under `node` this
# fails with `SyntaxError: Unexpected token '<'` as soon as devices.service.ts
# is loaded. Bun executes the .ts directly.
FROM oven/bun:1.2.8 AS api

WORKDIR /app

# node_modules and packages/ are both required at runtime: in a Bun workspace
# node_modules/@trycompai/* are symlinks into packages/, so the TypeScript
# sources must be present in the image.
COPY --from=api-builder /app/node_modules ./node_modules
# apps/api declares its own newer `ai` (^6) than the root pin (^5), so bun
# installs a workspace-local copy. Without it the runtime resolves the hoisted
# ai@5, which rejects @ai-sdk/openai@3's v3-spec models and the assistant chat
# 500s with AI_UnsupportedModelVersionError.
COPY --from=api-builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-builder /app/packages ./packages
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=api-builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-builder /app/apps/api/package.json ./apps/api/

ENV NODE_ENV=production \
    PORT=3333

EXPOSE 3333
CMD ["bun", "apps/api/dist/src/main.js"]

# (Trigger.dev hosted; no local runner stage)
