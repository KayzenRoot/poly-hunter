# PH-M00-WO-002 Evidence Bundle

Status: IMPLEMENTED / LOCAL VALIDATION PASS. Exact-head hosted checks are reported in PR #11 and the task closeout; this bundle omits its containing commit SHA.

## Repository and lineage

- Repository: `KayzenRoot/poly-hunter`.
- Branch: `feat/ph-m00-local-docker`.
- PR: [#11](https://github.com/KayzenRoot/poly-hunter/pull/11), OPEN draft.
- Base: `main@518aef27896cfb83257c60bfa8baa90636e08588`.
- Implementation source commit tested locally: `5f68c416b91c289fb593679d15d9bee68de3e9ed`.
- This bundle intentionally does not include the SHA of its own containing evidence commit. The final pushed PR head and its CI result are checked separately.
- Context Lock admission preflight passed before implementation: branch and base matched; all 13/13 critical-source object IDs matched; no pre-existing worktree changes were present.

## Runtime

- Docker Desktop: `4.88.1 (237512)`.
- Docker Engine: `29.7.2`, Linux `amd64`.
- Docker Compose: `v5.4.0`.
- Development image: `polyhunter-dev:local`, image ID `sha256:553f47bda2d6ce611ff4a2556f24199c3826d51563e76c047566a5f57368c808`, 344,520,576 bytes.
- Image runtime: Node `v24.21.0`, shared by both services; both containers run as `node` (UID 1000), with no privileged mode and no Docker socket mount.
- Compose uses the stable project/network name `polyhunter-local` and volume `polyhunter-local-web-next`; npm scripts pass `--project-name polyhunter-local` so a host `COMPOSE_PROJECT_NAME` cannot rename this stack.
- Final observed services: `polyhunter-web` running and `healthy`, bound only to `127.0.0.1:3000`; `polyhunter-worker` running.
- Containers were left running after validation.

## Docker and live feedback checks

- `docker version`: PASS (client and Engine `29.7.2`).
- `docker compose version`: PASS (`v5.4.0`).
- `docker compose --project-name polyhunter-local config --quiet`: PASS.
- `npm run docker:rebuild` (Compose build and start): PASS; both services use the same Node 24 development image.
- `docker compose --project-name polyhunter-local ps`: PASS; web healthy and worker running.
- HTTP check at `http://localhost:3000`: PASS, HTTP `200` and the expected engineering-shell heading.
- Web source-reload smoke: changed the heading in `apps/web/app/page.tsx`; the changed heading appeared in the HTTP response with status `200`; restored the source and confirmed the original heading returned with status `200`. The web container remained healthy.
- Worker source-restart smoke: changed the worker startup message in `apps/worker/src/index.ts`; nodemon logged a restart and ran the changed entrypoint. Restored the original message; nodemon restarted again and logged `PolyHunter worker shell started without product behavior.` The source file has no remaining smoke-test change.
- Host source files are bind-mounted; host `node_modules` is neither mounted nor required. The web `.next` cache uses a named volume.

## Dependencies and Windows file watching

- Added exact-pinned development dependency `nodemon@3.1.14` because Node's built-in watch did not detect a host source edit through Docker Desktop's Windows bind mount in the required smoke check.
- `nodemon`'s `chokidar@3` dependency was affected by [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); an npm `overrides` entry pins the compatible watcher to `chokidar@4.0.3`. The container's `npm ls nodemon chokidar --depth=1` confirmed this exact tree, and the worker smoke check confirmed change detection.
- The web uses Next.js Webpack in the Docker dev command and enables 1-second polling only when `POLYHUNTER_DOCKER_DEV=1`. This was selected after Turbopack did not react to the Windows-mounted edit. Next.js documents polling as a Docker development fallback with additional CPU/I/O cost and documents the Webpack fallback: [local development guide](https://nextjs.org/docs/app/guides/local-development), [Turbopack reference](https://nextjs.org/docs/app/api-reference/turbopack).

## Local validation

Host runtime: Node `v26.4.0`, npm `11.17.0`, Git `2.55.0.windows.3`.

- `npm ci`: PASS; 89 packages added, 95 audited, 0 vulnerabilities.
- `npm run validate`: PASS on implementation source commit `5f68c416b91c289fb593679d15d9bee68de3e9ed`.
  - Biome lint and format: PASS.
  - TypeScript checks for workspaces and tests: PASS.
  - Vitest: 3 files, 6 tests passed.
  - Workspace production builds, including Next.js: PASS.
  - Included `npm audit --audit-level=high`: PASS, 0 vulnerabilities.
- Explicit `npm audit --audit-level=high`: PASS, 0 vulnerabilities.
- `git diff --check`: PASS.
- Secret-pattern review on changed implementation files: PASS; no credential-like literals found.

## Files

- Added: `.dockerignore`, `Dockerfile.dev`, `compose.yaml`, `apps/web/next.config.ts`.
- Updated: `README.md`, root `package.json`, `package-lock.json`.
- Added this Evidence Bundle after the implementation commit so its contents do not claim their own commit SHA.
- Temporary web and worker smoke markers were restored; neither application entrypoint has a remaining change.

## Scope and residual risks

- No PolyHunter product behavior, provider integration, trading, credentials, database, or PH-M01 work was added.
- This is a local development image, not a production deployment image. `node:24-bookworm-slim` is a floating patch tag; a future rebuild may resolve a newer Node 24 image.
- Polling gives reliable Windows Docker Desktop feedback but adds file-system polling overhead and can increase CPU/I/O use on larger checkouts. Web and worker polling are set to 1 second.
- npm 11 printed an `allow-scripts` warning that `esbuild@0.25.12`'s postinstall was not approved. Install, validation, tests and builds succeeded without approving additional scripts; this remains visible for future dependency-policy review.
- The exact-head GitHub Actions receipt for the final evidence commit is externalized to PR checks and the task closeout to avoid self-reference.

## Proposed checkpoint delta (after review and merge)

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
- product implementation: `NOT_STARTED`
- liveTradingAuthorized: `false`

This is a proposal only. It does not alter the canonical checkpoint or admit another Work Order; promotion requires an approved exact-head audit and merge.

## STOP

PH-M00-WO-002 is locally validated and the Docker Compose services remain running. Do not begin PH-M01 in this Work Order.
