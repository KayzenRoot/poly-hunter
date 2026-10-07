# Docker clean smoke receipt

Date: 2026-10-07. Docker Desktop 4.88.1; Docker Engine client/server 29.7.2; Docker Compose v5.4.0; Docker Scout CLI v1.24.0.

Previously executed successfully in this Work Order:
- `docker compose config --quiet` — PASS.
- `docker build --pull --no-cache -t polyhunter-dev:ph-m02-wo-001 -f Dockerfile.dev .` — PASS; pinned Node 24 base resolved to `node@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20`.
- `docker compose build --pull --no-cache` — PASS.
- `docker compose up -d --wait` — PASS.

Rechecked on 2026-10-07 after validation:
- `docker compose ps --format json` — postgres `running/healthy`; web `running/healthy`; worker `running` (Compose has no worker healthcheck).
- `GET http://localhost:3000` — HTTP 200.
- Final image `polyhunter-dev:local` ID/RepoDigest: `sha256:d38a0a1222ef551cf5926496ffdc8c0fd06d8950e2d0a1b6d0c2f5c8d1a54b62`.
- PostgreSQL image: `postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
- Compose project observed from running container labels: `hive-v102`; network `hive-v102_default`; web port is bound to `127.0.0.1:3000`; PostgreSQL port 5432 is not published to the host.
- Containers remain running for inspection.

Risk/limitation: Dockerfile.dev and compose.yaml are fingerprint-locked and unchanged. They install/mount the existing app workspaces but do not copy or install the newly added `packages/polymarket` workspace. The applications do not import that package in this Work Order, so current web/worker smoke does not prove provider-package execution inside Docker. The new package was fully typechecked, unit-tested, and included in the local workspace build.

Environment note: initial compose startup reported existing named volumes scoped under the `polyhunter-local` project while the current process environment selected `hive-v102`. No volume was removed or reset. Current containers run under `hive-v102` and reuse the configured named volumes.
