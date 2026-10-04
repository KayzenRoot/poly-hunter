# PH-SEC-WO-005 — Codex Execution Brief

Execute only PH-SEC-WO-005 on branch `security/ph-m01-dev-go-remediation`.

## Read first
- `.engineering/work-orders/PH-SEC-WO-005.md`
- `.engineering/context-locks/PH-SEC-WO-005.json`
- canonical sources referenced by the Context Lock
- PH-SEC-WO-004 evidence
- parent package manifests/lockfile/Dockerfile/Compose

## Preflight
1. Verify branch, parent head, PR #15 state and ancestry.
2. Verify all Context Lock fingerprints.
3. Reconcile the original 35 unique Go CVEs / 64 occurrences / three binary paths.
4. Query authoritative npm metadata live for:
   - esbuild
   - Vite
   - Vitest
   - TypeScript
   - drizzle-kit
   - @esbuild-kit/esm-loader
   - @esbuild-kit/core-utils
5. Record current stable versions/dependency ranges.
6. Build `.engineering/evidence/PH-SEC-WO-005-CANDIDATES.md` before editing.
7. If any locked input is stale, STOP.

## Candidate evaluation order

### A. Stable upstream path
Test supported stable upgrades first in an isolated worktree/candidate lockfile.
Prefer:
- Vite within current Vitest's supported peer range;
- stable Drizzle Kit / tooling combinations;
- patched stable TypeScript if available.

### B. Scoped esbuild override
If stable upstream versions still retain vulnerable esbuild binaries:
- test the narrowest possible override;
- prove which dependency edge is overridden;
- do not commit unless Drizzle generate/migrate + Vite/Vitest + typecheck/build/tests all pass;
- record that the override is outside an upstream range if applicable.

### C. Stable TypeScript fallback
If latest stable TypeScript still ships affected native tsc and no stable patched release exists:
- test the most recent stable non-native TypeScript release;
- do not use beta/rc/nightly;
- adopt only if all typecheck/build/test/integration/Next contracts pass with no product-code modifications.

## Final implementation
Choose the smallest candidate that:
- eliminates all original Go HIGH/CRITICAL blockers;
- introduces no new HIGH/CRITICAL;
- preserves every functional/tooling contract.

Permitted final edits are restricted to tooling/dependency files authorized by the Work Order.

## Mandatory validation
Run and preserve:
- `npm ci`
- `npm run lint`
- `npm run format:check`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm audit --audit-level=high`
- `npm run validate`
- deterministic `db:generate` check
- migration on disposable/test PostgreSQL
- PostgreSQL integration tests
- Docker build `--pull --no-cache`
- Compose config/up/health
- HTTP 200 web
- worker running
- web hot reload and worker restart smoke
- fresh Docker Scout/approved equivalent scan of final dev image
- exact before/after 35-CVE reconciliation
- no-new-HIGH/CRITICAL check

Keep Docker stack running at the end if validation succeeds.

## Result semantics
- `READY_FOR_INDEPENDENT_AUDIT`: all original 35 Go blockers removed, no regression/new HIGH/CRITICAL, all gates pass.
- `BLOCKED_OPTION_REQUIRED`: only prerelease/nightly or unacceptably risky/incompatible options remain.
- `BLOCKED_UNRESOLVED`: attempted stable remediation does not clear blockers.

## Git / PR
- Commit/push on same branch.
- Open/update nested PR against `feat/ph-m01-tenancy-persistence`.
- Keep PR #15 unmerged.
- Do not start PH-M01-WO-002.
- Final report in Brazilian Portuguese.


## CORRECTION DELTA CR-01 — Windows host hot reload

The Go-CVE remediation itself passed: the original 35 Go HIGH/CRITICAL findings are absent and no new HIGH/CRITICAL tuple was introduced. Do not redo candidate selection unless the dependency graph changes.

Correct only the failed web hot-reload gate.

1. Re-read the updated Work Order and Context Lock.
2. Verify the current branch/head and the locked `apps/web/next.config.ts` blob.
3. Inspect the installed Next.js 16 / webpack dev configuration.
4. Modify only `apps/web/next.config.ts` to enable development-only webpack polling when `POLYHUNTER_DOCKER_DEV=1`.
5. Prefer a webpack callback that preserves existing config and sets `config.watchOptions.poll` to a conservative interval such as 1000 ms only in dev/Docker mode. Preserve `allowedDevOrigins`.
6. Do not modify Compose, Dockerfile, application pages/routes/components, dependencies, schema or migrations.
7. Rebuild/recreate only as required to load config.
8. Prove this exact sequence without manual container touch:
   - establish original HTTP content;
   - edit a harmless visible marker in `apps/web/app/page.tsx` from the Windows host checkout;
   - confirm the edit appears inside the container;
   - wait for automatic webpack recompilation;
   - confirm HTTP response changes;
   - restore the original file from the host;
   - confirm automatic recompilation restores HTTP output;
   - confirm `git diff -- apps/web/app/page.tsx` is empty.
9. Rerun typecheck, build, validate, Docker Compose health, web HTTP 200, worker restart smoke, and a fresh Docker Scout scan.
10. Reconcile that original Go blockers remain zero and no new HIGH/CRITICAL appears.
11. Update PH-SEC-WO-005 Evidence Bundle and receipts.

Result:
- hot reload PASS + all other gates green => `READY_FOR_INDEPENDENT_AUDIT`
- config-only polling cannot pass => `BLOCKED_OPTION_REQUIRED`

Stay on PR #29. Do not merge PR #15 and do not begin PH-M01-WO-002.
