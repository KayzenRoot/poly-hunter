# PH-M00-WO-002 Evidence Bundle

Status: IMPLEMENTED / LOCAL VALIDATION PASS. Exact-head hosted checks are reported in PR #11 and the task closeout; this bundle omits its containing commit SHA.

## Repository and lineage

- Repository: `KayzenRoot/poly-hunter`.
- Branch: `feat/ph-m00-local-docker`.
- PR: [#11](https://github.com/KayzenRoot/poly-hunter/pull/11), OPEN draft.
- Base: `main@518aef27896cfb83257c60bfa8baa90636e08588`.
- Implementation source commit tested locally: `5f68c416b91c289fb593679d15d9bee68de3e9ed`.
- Sonar correction commit tested locally: `51b0047ff5eb3043e4ed6327b1faac587788dc23`.
- This bundle intentionally does not include the SHA of its own containing evidence commit. The final pushed PR head and its CI result are checked separately.
- Context Lock admission preflight passed before implementation: branch and base matched; all 13/13 critical-source object IDs matched; no pre-existing worktree changes were present.

## Runtime

- Docker Desktop: `4.88.1 (237512)`.
- Docker Engine: `29.7.2`, Linux `amd64`.
- Docker Compose: `v5.4.0`.
- Development image: `polyhunter-dev:local`, image ID `sha256:828bf8a6ff545bed4f9b3c7a1ce9520fed4767bc97acb80735ea887741cdd986`, 344,520,263 bytes; built from `node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
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

## Sonar correction delta

- The first pushed head `1c0c649175bf838f9f68c67399e8d435e5c66a27` passed Node 24 validation and Socket checks. SonarCloud failed its new-code security rating (`C`, required `A`) and annotated `Dockerfile.dev` lines 3 and 20 for development debug mode and allowing package lifecycle scripts.
- Removed the image-wide `NODE_ENV=development`; Compose continues to set `NODE_ENV=development` for both local services.
- Changed the image install to `npm ci --ignore-scripts`, preventing third-party lifecycle scripts from running during the image build.
- Rebuild with the corrected Dockerfile: PASS. Docker npm install added 90 packages, audited 96, and reported 0 vulnerabilities.
- After the corrected rebuild, web and worker both started as `node`; web reached `healthy` and returned HTTP `200`; web hot-reload and worker restart smoke checks both passed again.
- Exact-head hosted checks for correction head `51b0047ff5eb3043e4ed6327b1faac587788dc23` plus this evidence commit are reported separately at PR #11.

## Dependencies and Windows file watching

- Added exact-pinned development dependency `nodemon@3.1.14` because Node's built-in watch did not detect a host source edit through Docker Desktop's Windows bind mount in the required smoke check.
- `nodemon`'s `chokidar@3` dependency was affected by [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); an npm `overrides` entry pins the compatible watcher to `chokidar@4.0.3`. The container's `npm ls nodemon chokidar --depth=1` confirmed this exact tree, and the worker smoke check confirmed change detection.
- The web uses Next.js Webpack in the Docker dev command and enables 1-second polling only when `POLYHUNTER_DOCKER_DEV=1`. This was selected after Turbopack did not react to the Windows-mounted edit. Next.js documents polling as a Docker development fallback with additional CPU/I/O cost and documents the Webpack fallback: [local development guide](https://nextjs.org/docs/app/guides/local-development), [Turbopack reference](https://nextjs.org/docs/app/api-reference/turbopack).

## Local validation

Host runtime: Node `v26.4.0`, npm `11.17.0`, Git `2.55.0.windows.3`.

- `npm ci`: PASS; 89 packages added, 95 audited, 0 vulnerabilities.
- `npm run validate`: PASS on the implementation and again after the Dockerfile correction in commit `51b0047ff5eb3043e4ed6327b1faac587788dc23`.
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
- Sonar correction: updated `Dockerfile.dev` to keep the development mode in Compose and disable install lifecycle scripts in the image.
- Added this Evidence Bundle after the implementation commit so its contents do not claim their own commit SHA.
- Temporary web and worker smoke markers were restored; neither application entrypoint has a remaining change.

## Scope and residual risks

- No PolyHunter product behavior, provider integration, trading, credentials, database, or PH-M01 work was added.
- This is a local development image, not a production deployment image. `node:24-bookworm-slim` is a floating patch tag; a future rebuild may resolve a newer Node 24 image.
- Polling gives reliable Windows Docker Desktop feedback but adds file-system polling overhead and can increase CPU/I/O use on larger checkouts. Web and worker polling are set to 1 second.
- Host npm 11 printed an `allow-scripts` warning that `esbuild@0.25.12`'s postinstall was not approved. Host validation, tests and builds succeeded; the Docker image now disables all dependency lifecycle scripts.
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
