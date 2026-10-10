# Docker runtime smoke receipt

Date: 2026-10-07. Docker Desktop 4.88.1; Docker Engine client/server 29.7.2; Docker Compose v5.4.0; Docker Scout CLI v1.24.0.

The local environment exports COMPOSE_PROJECT_NAME=hive-v102, so all Work Order operations explicitly selected project polyhunter-local.

## Build and configuration

- Dockerfile.dev pins node:24-bookworm-slim by immutable digest sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20.
- The clean Compose build used docker compose --project-name polyhunter-local build --pull --no-cache after the provider package manifest and lockfile changes.
- docker compose --project-name polyhunter-local config --quiet — PASS.
- Final development image polyhunter-dev:local has image ID sha256:1ae037eb5c185605951c688d14d19133f70e2f386fe956b20a4e4460d4338792.
- The Postgres tag was freshly pulled and remained at postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24.

## Runtime checks

- Compose project polyhunter-local: postgres running/healthy; web running/healthy; worker running under nodemon.
- Worker container Node version: v24.21.0.
- Worker-side import smoke for @polyhunter/polymarket returned function for createPolymarketDiscovery.
- Web GET http://localhost:3000 — HTTP 200.
- A grep of the running web container's actual Next.js dev static assets at apps/web/.next/dev/static found no @polymarket/client import.
- PostgreSQL has no published host port; worker is the only service with the provider workspace source bind mount.
- Runtime and container details are retained in docker-runtime-final.txt and compose-runtime-final.json.

Containers remain running under project polyhunter-local.

Limitation: worker has no Compose healthcheck; its running state is verified by Compose process status and the active nodemon/node process listing. This Work Order does not connect to Polymarket with credentials or exercise trading/private endpoints.
