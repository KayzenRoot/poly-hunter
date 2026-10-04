# PH-SEC-WO-005-CR-01 — Windows Docker web hot reload

Status: CORRECTION REQUIRED.

## Trigger
PH-SEC-WO-005 removed all 35 original Go HIGH/CRITICAL CVEs and introduced no new HIGH/CRITICAL tuple, but failed the required web hot-reload acceptance gate.

Observed:
- host Windows edit became visible inside the web container;
- Next.js/webpack did not recompile automatically;
- an in-container touch triggered recompilation;
- app content was restored and Docker stack remained healthy.

## Root-cause hypothesis
The Docker Desktop bind mount propagates file contents but the webpack watcher is not receiving reliable native filesystem change events. The current Next config contains a top-level polling-style field, while the canonical Docker command explicitly runs Next.js with webpack.

## Authorized correction
Only `apps/web/next.config.ts` may be added to the implementation diff for CR-01.

The correction must:
- preserve existing `allowedDevOrigins`;
- enable webpack dev polling only under `POLYHUNTER_DOCKER_DEV=1`;
- leave normal non-Docker config unchanged;
- avoid Compose, Dockerfile and product-code changes.

## Proof obligation
A Windows-host file edit must trigger automatic recompilation and HTTP output change with no manual container touch. Restoration must also trigger automatically and leave zero application diff.

## Regression gates
Typecheck, build, validate, Docker health, HTTP 200, worker restart and final Scout scan all pass; original 35 Go blockers remain zero; no new HIGH/CRITICAL.

## STOP
PASS => READY_FOR_INDEPENDENT_AUDIT.
Failure requiring broader runtime/Compose changes => BLOCKED_OPTION_REQUIRED.
