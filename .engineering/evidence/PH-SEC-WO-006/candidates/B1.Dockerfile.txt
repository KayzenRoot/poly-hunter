FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

USER root
RUN apt-get update && apt-get install -y --only-upgrade --no-install-recommends libpcre2-8-0 && rm -rf /var/lib/apt/lists/*
USER node

WORKDIR /workspace

RUN mkdir -p /workspace && chown node:node /workspace

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/web/package.json apps/web/package.json
COPY --chown=node:node apps/worker/package.json apps/worker/package.json
COPY --chown=node:node packages/contracts/package.json packages/contracts/package.json
COPY --chown=node:node packages/domain/package.json packages/domain/package.json
COPY --chown=node:node packages/db/package.json packages/db/package.json
COPY --chown=node:node packages/testkit/package.json packages/testkit/package.json

RUN mkdir -p apps/web/.next && chown -R node:node /workspace

USER node

RUN npm ci --ignore-scripts

COPY --chown=node:node tsconfig.base.json ./
