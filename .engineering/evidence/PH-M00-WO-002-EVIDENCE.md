# PH-M00-WO-002 Evidence Bundle

Status: APPROVED_FOR_PROMOTION / owner audit NOT_INDEPENDENT.

## Repository and lineage
- Repository: `KayzenRoot/poly-hunter`.
- Branch: `feat/ph-m00-local-docker`.
- PR: #11.
- Base: `main@518aef27896cfb83257c60bfa8baa90636e08588`.
- Implementation source commit tested locally: `5f68c416b91c289fb593679d15d9bee68de3e9ed`.
- Sonar correction commit tested locally: `51b0047ff5eb3043e4ed6327b1faac587788dc23`.
- Pre-promotion audited candidate: `6af0b596c9812bcafa80074e48e2422deb5c7d96`.
- Context Lock admission preflight passed: branch/base matched and 13/13 critical-source fingerprints matched.
- Final promotion head is re-audited externally after this checkpoint/evidence commit to avoid self-reference.

## Runtime
- Docker Desktop: `4.88.1 (237512)`.
- Docker Engine: `29.7.2`, Linux `amd64`.
- Docker Compose: `v5.4.0`.
- Development image: `polyhunter-dev:local`, validated image ID `sha256:828bf8a6ff545bed4f9b3c7a1ce9520fed4767bc97acb80735ea887741cdd986`, built from the recorded Node 24 slim digest.
- Image runtime: Node `v24.21.0`.
- Both containers run as `node` UID 1000.
- No privileged mode and no Docker socket mount.
- Stable Compose project: `polyhunter-local`.
- Final local state recorded by executor: `polyhunter-web` running/healthy on `127.0.0.1:3000`, `polyhunter-worker` running.
- Containers were left running after validation.

## Docker and feedback validation
- `docker version`: PASS.
- `docker compose version`: PASS.
- `docker compose --project-name polyhunter-local config --quiet`: PASS.
- Compose build/start: PASS.
- `docker compose ... ps`: PASS.
- HTTP `http://localhost:3000`: PASS / 200.
- Web source reload smoke: PASS and source restored.
- Worker source restart/reload smoke: PASS and source restored.
- Host source is bind-mounted; host `node_modules` is neither mounted nor required.
- Web `.next` cache uses a named volume.

## Security correction
- Initial Sonar finding on development debug/image lifecycle-script handling was corrected before approval.
- Image-wide `NODE_ENV=development` was removed; Compose supplies development mode only at runtime.
- Docker install uses `npm ci --ignore-scripts`.
- Corrected rebuild and both reload smokes passed.
- SonarQube Cloud final Quality Gate: PASS, 0 new issues, 0 security hotspots.

## Dependencies / Windows file watching
- Added exact-pinned `nodemon@3.1.14` because built-in Node watch did not reliably detect Windows Docker Desktop bind-mount changes.
- npm override pins nodemon's watcher to `chokidar@4.0.3` to remove the cited vulnerable watcher version.
- Socket Security reports no vulnerability finding for the direct nodemon dependency.
- Next.js Docker development uses Webpack plus 1-second polling only under `POLYHUNTER_DOCKER_DEV=1`.
- Polling overhead is accepted for this local-development increment.

## Local validation recorded by executor
Host runtime: Node `v26.4.0`, npm `11.17.0`, Git `2.55.0.windows.3`.

- `npm ci`: PASS, 0 vulnerabilities.
- `npm run validate`: PASS after implementation and again after Dockerfile correction.
- Biome lint/format: PASS.
- TypeScript checks: PASS.
- Vitest: 3 files / 6 tests PASS.
- Workspace builds / Next.js build: PASS.
- `npm audit --audit-level=high`: PASS / 0 vulnerabilities.
- `git diff --check`: PASS.
- secret-pattern review: PASS.

## Exact-head hosted validation
For pre-promotion head `6af0b596c9812bcafa80074e48e2422deb5c7d96`:
- GitHub Actions run `37141322730`: SUCCESS.
- Node 24 validation: SUCCESS.
- clean npm install: 0 vulnerabilities.
- lint/format/typecheck: PASS.
- Vitest: 3 files / 6 tests PASS.
- build: PASS.
- high-severity npm audit: 0 vulnerabilities.
- SonarQube Quality Gate: PASS.
- no open review threads.

## Scope
No PH-M01, Polymarket/provider integration, wallet, database, auth, tenant business logic, strategy/risk/execution, AI or production deployment was introduced.

## Residual risks
- 1-second polling adds local CPU/I/O overhead.
- `node:24-bookworm-slim` remains a floating patch tag for future rebuilds; the validated digest is recorded above.
- Host npm reports an esbuild allow-scripts advisory. Host validation succeeds and Docker dependency installation explicitly disables lifecycle scripts.
- I could not independently attach the ChatGPT review session to the user's local Docker daemon because the available local-command bridge was unavailable; runtime evidence therefore comes from the executor's local run plus the user's observed running stack. This Work Order is STANDARD and does not require an independent runtime operator.

## Promoted checkpoint delta
After final exact-head re-audit and merge:
- status remains: `SOURCE_PACK_FROZEN`
- phase: `M00_IMPLEMENTATION_COMPLETE`
- stopState: `STOP_AFTER_PH_M00_WO_002`
- completedThroughModule: `PH-M00`
- activeWorkOrder: `NONE`
- preparedWorkOrder: `NONE`
- nextLegalStage: `AWAIT_OWNER_DIRECTION`
- mainProductionDenominatorWeight: `0`
- earnedProductionWeight: `0`
- overallCompletionPercent: `0`
- liveTradingAuthorized: `false`

## STOP
PH-M00-WO-002 is approved for checkpoint promotion. Do not begin PH-M01 in this Work Order.
