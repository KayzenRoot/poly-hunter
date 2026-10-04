# PH-SEC-WO-005 — Remediate dev-image Go toolchain CVEs

Issue: #28
Parent implementation: PH-M01-WO-001 / PR #15
Parent head: fa3e7c5272f4d04f31189867dc324a838279b8be
Analysis/remediation branch: security/ph-m01-dev-go-remediation
Risk: HIGH_ASSURANCE / SECURITY_BLOCKER_REMEDIATION.

## OBJECTIVE
Remove the 35 unique HIGH/CRITICAL Go stdlib findings from the exact PolyHunter development image by changing only development-tooling/dependency composition, while preserving all existing product, database, migration, test and Docker development behavior.

## CONTEXT
PH-SEC-WO-004 completed a full binary/symbol analysis and proved that further blanket VEX waiver is not justified:
- 56 unique HIGH/CRITICAL CVEs in the dev image;
- 35 unique Go stdlib CVEs in scope here;
- 64 Go stdlib scanner occurrences;
- 61/64 occurrences contain vulnerable symbols;
- affected binaries:
  1. nested esbuild 0.18.20 from `@esbuild-kit/core-utils` under Drizzle tooling;
  2. top-level esbuild 0.25.12 used by Vite/Drizzle tooling;
  3. native TypeScript tsc 7.0.2 built with Go 1.26.4.

The correct next increment is remediation, not another generic reachability pass.

## SCOPE
Tooling/dependency remediation only.

Allowed files:
- `package.json`
- `package-lock.json`
- `packages/db/package.json`
- `Dockerfile.dev` only if dependency composition cannot be remediated safely without it
- narrowly scoped tooling scripts/configuration required to preserve current migration/typecheck/test contracts
- Work Order evidence/receipts

No application/domain/schema/migration-data/TenantContext behavior change is authorized.

## OUT OF SCOPE
- Any PH-M01-WO-002 identity/auth work.
- Any trading/Polymarket behavior.
- Application/domain refactors.
- Database schema changes or new migrations.
- VEX reclassification of the 35 Go CVEs without remediation.
- Non-Go dev-image findings; those remain for a later increment.
- Prerelease/nightly dependency adoption without explicit separate owner decision.

## FILES / SOURCES TO READ
Canonical main:
- AGENTS.md
- .engineering/CHECKPOINT.json
- .engineering/SECURITY.md
- .engineering/TEST-BENCHMARK-PLAN.md
- .engineering/DEFINITION-OF-DONE.md
- .engineering/REVIEW-PROGRESS-REPORTING.md

Parent branch/head:
- package.json
- package-lock.json
- packages/db/package.json
- Dockerfile.dev
- compose.yaml
- .engineering/evidence/PH-SEC-WO-004-EVIDENCE.md
- .engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.md
- .engineering/evidence/PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif

External package metadata must be revalidated at execution time with authoritative npm metadata before edits.

## KNOWN DEPENDENCY LINEAGE
At the locked parent head:
- `drizzle-kit 0.31.11` depends on `@esbuild-kit/esm-loader`, `esbuild ^0.25.4`, and `tsx`.
- `@esbuild-kit/esm-loader` / `@esbuild-kit/core-utils` are deprecated upstream and the nested core-utils chain resolves `esbuild ~0.18.20`.
- root `vite 6.4.3` resolves top-level `esbuild 0.25.12`.
- root `typescript 7.0.2` resolves native `@typescript/typescript-linux-x64 7.0.2`.

Planning-time public metadata observed:
- esbuild latest stable: 0.28.2;
- Vite latest stable: 8.3.2;
- TypeScript latest stable: 7.0.2;
- drizzle-kit latest stable: 0.31.11.
Executor must revalidate all of these.

## ARCHITECTURE RULES
1. Prefer upstream-supported stable upgrades over overrides.
2. Keep application/runtime semantics unchanged.
3. Keep migration generation and application deterministic.
4. Keep Docker local workflow compatible with Node 24 and existing Compose topology.
5. Do not convert a security problem into a silent scanner suppression.
6. Do not introduce prerelease/nightly packages without a separate approved decision.
7. If a toolchain downgrade is evaluated, it must be a currently supported stable release and must prove no regression across all affected contracts.

## CANDIDATE ORDER

### Candidate A — supported stable upgrades
Revalidate and test latest stable compatible versions first.
- Prefer upgrading Vite within Vitest's supported peer range.
- Prefer a stable Drizzle/Drizzle Kit path if it removes the deprecated esbuild-kit chain.
- Prefer any stable TypeScript patch that ships a remediated native compiler if available by execution time.

### Candidate B — scoped compatibility override
Only when Candidate A cannot remove nested/top-level esbuild findings:
- test a scoped npm override for the specific esbuild dependency chain in an isolated worktree/candidate lockfile;
- do not commit the override unless Drizzle generate/migrate, Vite/Vitest, build, typecheck and integration contracts all pass;
- an out-of-declared-range override is acceptable only with explicit compatibility evidence in the Evidence Bundle.

### Candidate C — stable TypeScript fallback
If latest stable TypeScript still ships the vulnerable native Go compiler and there is no patched stable release:
- test the most recent stable non-native TypeScript release in an isolated candidate worktree;
- adoption is allowed only if all workspace typechecks/builds/tests, emitted declaration/build contracts, Next.js build and integration tests pass without product-code changes;
- no beta/rc/nightly fallback.

### Failure mode
If no stable/supported candidate eliminates the Go blocker set without regression, STOP with `BLOCKED_OPTION_REQUIRED`.
Do not hide, suppress or waive the findings.

## PREFLIGHT
Before editing:
1. verify branch/base/ancestry;
2. verify parent PR #15 is open/unmerged;
3. verify all Context Lock fingerprints;
4. reparse locked SARIF and confirm 35 unique Go CVEs / 64 occurrences / exact three binaries;
5. query authoritative npm metadata for candidate package versions/dependencies;
6. create a candidate matrix with expected effect before modifying repository files.

Any mismatch => STOP STALE/BLOCKED.

## TESTS
For each candidate actually considered, capture:
- npm dependency tree for esbuild, drizzle-kit, @esbuild-kit/*, Vite, Vitest, TypeScript;
- exact versions and binary `go version -m` metadata;
- targeted smoke commands.

For the final candidate, mandatory:
- clean `npm ci`;
- `npm run lint`;
- `npm run format:check`;
- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- `npm audit --audit-level=high`;
- `npm run validate`;
- Docker rebuild with pull/no-cache;
- `docker compose config --quiet`;
- stack up;
- web HTTP 200;
- worker running;
- PostgreSQL healthy;
- `db:generate` deterministic/no unintended migration drift;
- migration against disposable/test database;
- PostgreSQL integration suite;
- hot reload/restart smoke for web/worker;
- fresh container scan of final dev image;
- exact reconciliation against the original 35-CVE Go set;
- confirm no new HIGH/CRITICAL finding was introduced.

## ACCEPTANCE CRITERIA
1. The final dev image has zero unresolved HIGH/CRITICAL Go stdlib findings from the original 35-CVE set.
2. No new HIGH/CRITICAL finding is introduced by the remediation.
3. The three original vulnerable binary paths are either absent or rebuilt/replaced by binaries whose scan no longer contains the original blocking findings.
4. All mandatory validation/test/Docker/migration/integration checks pass.
5. No application/domain/schema/TenantContext behavior changes.
6. Dependency changes are minimal and documented with rationale.
7. Rollback is a single revert of this Work Order's dependency/tooling commit(s).
8. PR #15 remains draft/unmerged pending independent audit and remaining non-Go findings.

## DELIVERABLES
- final package/lock/tooling changes;
- `.engineering/evidence/PH-SEC-WO-005-EVIDENCE.md`;
- `.engineering/evidence/PH-SEC-WO-005-CANDIDATES.md`;
- before/after dependency trees and scan receipts under `.engineering/evidence/PH-SEC-WO-005/`;
- proposed Checkpoint Delta: none until parent PR #15 is fully unblocked;
- commit/push and nested PR against `feat/ph-m01-tenancy-persistence`.

## REVIEW FORMAT
HIGH_ASSURANCE:
- APPROVED REMEDIATION;
- CORRECTION REQUIRED;
- BLOCKED_OPTION_REQUIRED;
- BLOCKED.

## STOP CONDITION
Stop with `READY_FOR_INDEPENDENT_AUDIT` only if the original 35 Go CVEs are eliminated from HIGH/CRITICAL status with all regression/security gates green.
Otherwise stop `BLOCKED_OPTION_REQUIRED` or `BLOCKED_UNRESOLVED`.
Do not start PH-M01-WO-002.
