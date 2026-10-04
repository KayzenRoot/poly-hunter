# PH-SEC-WO-005-CR-01 — Evidence Addendum

**Status:** `READY_FOR_INDEPENDENT_AUDIT`
**Branch:** `security/ph-m01-dev-go-remediation`
**PR:** #29, open and draft; base `feat/ph-m01-tenancy-persistence`
**Correction input head:** `d2e02ce54e3145f68e34b97e908d5c973043cfc3`
**Scope:** webpack development polling in `apps/web/next.config.ts`, and evidence/receipts only.

## Preflight

- Checked out the authorized branch and fast-forwarded from the prior local head to the current PR head; no reset, rebase, or force push.
- Validated all 14 fingerprints in the updated PH-SEC-WO-005 Context Lock against the canonical main SHA, parent SHA, and locked branch config blob. All matched.
- Confirmed PR #29 is `OPEN`, draft, based on `feat/ph-m01-tenancy-persistence@fa3e7c5272f4d04f31189867dc324a838279b8be`.
- Confirmed parent PR #15 is `OPEN` and `mergedAt=null`.
- Did not repeat dependency candidate selection or change the dependency graph.

## Configuration change

`apps/web/next.config.ts` preserves `allowedDevOrigins: ["127.0.0.1"]` and keeps the empty config outside `POLYHUNTER_DOCKER_DEV=1`. In Docker dev, the existing webpack callback receives its config; only when `dev` is true it merges existing `config.watchOptions` and sets `poll: 1000`, then returns the config. The current Docker command still runs `next dev --webpack`.

The installed Next.js version is `16.3.8`. The configuration callback is supported by the Next.js webpack config API; webpack documents `watchOptions.poll` as the polling interval in milliseconds and specifically notes containers/Docker as a use case. Sources: [Next.js webpack config](https://nextjs.org/docs/pages/api-reference/config/next-config-js/webpack), [webpack watch options](https://webpack.js.org/configuration/watch/).

## Host Windows hot-reload proof

The final probe was performed after recreating the web service with the corrected config. No file was touched or edited inside a container.

| Step | Evidence |
|---|---|
| Original page | Host SHA-256 `ede0b86bb57e4d1fee6f78034ba7c455273caa4c77fca48b33e9e3434ca83579`; original HTTP response contains `PolyHunter engineering shell`, HTTP 200. |
| Host edit | Added visible marker `CR01_FINAL_HOST_WINDOWS_POLL_20261004` temporarily to `apps/web/app/page.tsx` from the Windows checkout. |
| Container mount | `docker exec ... grep` found the marker in `/workspace/apps/web/app/page.tsx`. |
| Watcher wait / recompilation | Waited 5 seconds (five 1000 ms polling intervals) while the web process stayed continuously running. A subsequent HTTP request returned the newly rendered page with the marker, HTTP 200; this output change proves the dev server consumed the host-side source update. Timestamped Next request logs are in `validation/CR-01/web-logs-host-edit-final.log`. Web container `StartedAt` stayed `2026-10-04T18:54:18.631566522Z` across the edit. |
| Host restore | Rewrote the original page bytes from the Windows host. Container mount no longer contained the marker. After another 5 seconds, HTTP returned the original shell text with no marker, HTTP 200. Timestamped logs are in `validation/CR-01/web-logs-host-restore-final.log`; the web container `StartedAt` remained unchanged. |
| Zero application diff | Restored SHA-256 equals the original SHA-256 above. `git diff -- apps/web/app/page.tsx` is empty. |

The exact sequence and hashes are in `validation/CR-01/hot-reload-proof-final.txt`; raw changed/restored HTTP bodies are `http-host-edit-final.html` and `http-host-restored-final.html`.

A preliminary diagnostic waited only for a standalone `Compiled` banner in Next logs and did not find one; its raw log is retained as `validation/CR-01/web-compile-after-host-edit.log`. The final acceptance proof therefore used the required observable outcome: host change propagated into the container, the continuously running server returned the changed page after the polling interval, and restoration returned the original page. The web process `StartedAt` did not change. The first `npm run validate` attempt also flagged only Biome formatting in the new config; the file was formatted and all final checks below were rerun successfully.

## Regression gates

| Gate | Result | Receipt |
|---|---|---|
| `npm run typecheck` | PASS | `validation/CR-01/npm-typecheck-final.log` |
| `npm run build` | PASS; Next production build compiled successfully | `validation/CR-01/npm-build-final.log` |
| `npm run validate` | PASS; lint, format, typecheck, 7 tests, build, and audit all passed; audit reported 0 vulnerabilities | `validation/CR-01/npm-validate-final.log` |
| `docker compose config --quiet` | PASS | `validation/CR-01/compose-config-final.txt` |
| Compose health / HTTP | PASS; web `healthy`, PostgreSQL `healthy`, worker `running`, `http://localhost:3000` HTTP 200 with original page | `validation/CR-01/compose-ps-final-verified.txt`, `runtime-final-verified.txt`, `http-final.html` |
| Worker restart smoke | PASS; worker `StartedAt` changed from `2026-10-04T16:41:58.405623523Z` to `2026-10-04T18:54:53.992204352Z`, state `running`; `docker top` and `/proc/1/cmdline` show the worker's Node/nodemon command active | `validation/CR-01/worker-restart-proof-final.txt`, `worker-process-final.txt` |

All final Compose commands explicitly selected project `polyhunter-local`, matching the running stack. The shell had inherited `COMPOSE_PROJECT_NAME=hive-v102`; an initial attempt with that unrelated name aborted on existing container-name conflicts before replacing services. Its unattached temporary network was inspected and removed. The valid project stack remained running throughout the proof and is left running.

## Final Docker Scout scan

- Tool: Docker Scout CLI `v1.24.0`, commit `b1c9331b2166aef7ec690aa16fd655b8798ea4c6`, Go `1.26.3`.
- Command: `docker scout cves local://polyhunter-dev:local --format sarif --output .engineering/evidence/PH-SEC-WO-005/validation/CR-01/polyhunter-dev-cr01.sarif`.
- Image: `polyhunter-dev:local`, image ID and repo digest `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`.
- Raw SARIF SHA-256: `ae4819ad65096ee74634c7987540eda82837e3ca280ac7d692e5b6f2245d278d`.
- Scout reported 76 vulnerability results. Reconciliation against the locked baseline found 22 unique HIGH/CRITICAL CVEs (20 HIGH, 2 CRITICAL), all non-Go and already present; all original 35 Go CVEs have 0 HIGH/CRITICAL occurrences and 0 unique CVEs; there are 0 new HIGH/CRITICAL tuples.
- Raw Scout output, version, image identity and deterministic comparison are in `validation/CR-01/docker-scout-cr01.txt`, `docker-scout-version-final.txt`, `image-identity-final.txt`, and `sarif-comparison-final.json`.

## Files, risks, and stop condition

- The only non-evidence file changed for CR-01 is `apps/web/next.config.ts`. `apps/web/app/page.tsx` was restored byte-for-byte; generated `apps/web/next-env.d.ts` was restored. No Compose, Dockerfile, dependency, route, schema, migration, TenantContext, or product behavior change was made.
- The previously approved esbuild override remains outside upstream-declared ranges, as documented in the parent Evidence Bundle. 22 pre-existing non-Go HIGH/CRITICAL CVEs remain outside PH-SEC-WO-005 scope and are not suppressed.
- Result: `READY_FOR_INDEPENDENT_AUDIT`. All CR-01 acceptance and regression gates passed. PR #29 remains open/draft and unmerged; PR #15 remains open/unmerged. Docker Compose was left running.
