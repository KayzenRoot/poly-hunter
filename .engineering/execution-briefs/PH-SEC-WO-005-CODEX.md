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
