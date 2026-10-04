FROM node:24-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe

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
