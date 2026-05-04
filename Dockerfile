# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    g++ \
    make \
    openssl \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/money/package.json packages/money/package.json

RUN npm ci --ignore-scripts

FROM deps AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=false

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=${NEXT_PUBLIC_ENABLE_DEMO_FALLBACK}
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN npm rebuild
RUN npm run build:money
RUN npm run build --workspace @personal-erp/api
RUN npm run build --workspace @personal-erp/web
RUN rm -rf apps/web/.next/cache

FROM build AS prod-node-modules
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runtime-base
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM runtime-base AS api

ENV PORT=4100

COPY --from=prod-node-modules --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /app/packages/contracts/src ./packages/contracts/src
COPY --from=build --chown=node:node /app/packages/money/package.json ./packages/money/package.json
COPY --from=build --chown=node:node /app/packages/money/dist ./packages/money/dist

USER node
EXPOSE 4100
CMD ["node", "apps/api/dist/apps/api/src/main.js"]

FROM runtime-base AS migrate

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma

USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"]

FROM runtime-base AS web

ENV PORT=3100
ENV HOSTNAME=0.0.0.0

COPY --from=prod-node-modules --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=node:node /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=build --chown=node:node /app/apps/web/.next ./apps/web/.next
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /app/packages/contracts/src ./packages/contracts/src
COPY --from=build --chown=node:node /app/packages/money/package.json ./packages/money/package.json
COPY --from=build --chown=node:node /app/packages/money/dist ./packages/money/dist

USER node
EXPOSE 3100
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/web", "--hostname", "0.0.0.0", "--port", "3100"]
