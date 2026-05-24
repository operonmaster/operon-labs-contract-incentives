# ------------------------------------------------------------------------------
# Stage 1: Build the Next.js standalone bundle
# ------------------------------------------------------------------------------
FROM node:24-alpine AS builder

ARG ENVIRONMENT=nonprod
ENV ENVIRONMENT=$ENVIRONMENT \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Workspace manifests first for Docker layer caching.
COPY package.json package-lock.json ./
COPY src/apps/web/package.json src/apps/web/
COPY src/packages/audit-log/package.json src/packages/audit-log/
COPY src/packages/hedera-executor/package.json src/packages/hedera-executor/
COPY src/packages/incentive-agent/package.json src/packages/incentive-agent/
COPY src/packages/policy-engine/package.json src/packages/policy-engine/
COPY src/packages/um-platform/package.json src/packages/um-platform/

RUN npm ci

# Copy application sources and build the production standalone server.
COPY tsconfig.json vitest.config.ts eslint.config.mjs ./
COPY src/ src/

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Minimal Node runtime for Cloud Run
# ------------------------------------------------------------------------------
FROM node:24-alpine

WORKDIR /srv/www

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080

RUN addgroup -S operon && adduser -S operon -G operon

COPY --from=builder --chown=operon:operon /app/src/apps/web/.next/standalone ./
COPY --from=builder --chown=operon:operon /app/src/apps/web/.next/static ./src/apps/web/.next/static

USER operon

EXPOSE 8080

CMD ["node", "src/apps/web/server.js"]
