# PH-M02-WO-001 — Evidence Bundle / CR-07

- Audited input head `d4b48a8605719df818c0b7cd8517ab55d2b553d3`: GitHub Actions Validate PASS, run [37712387792](https://github.com/KayzenRoot/poly-hunter/actions/runs/37712387792). Correction head `5ea9950eb34ac5070885664ef5d9997946106732`: Validate PASS, run [37725131129](https://github.com/KayzenRoot/poly-hunter/actions/runs/37725131129). The old `PENDING_EXACT_HEAD_CI` note was stale. This correction changes evidence/governance only; the subsequent evidence-only final head is validated separately and recorded in PR #43. Work Order disposition is `BLOCKED_UNRESOLVED` due the zlib reachability proof gap, independent of CI.
- Review: 5450599754
- PR: #43
- Branch: `feat/ph-m02-public-provider-foundation`
- Work Order base: `main@a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c`
- Audited parent head: `d4b48a8605719df818c0b7cd8517ab55d2b553d3`
- Assessment date: 2026-10-08

The final correction commit SHA and its exact-head Validate result are recorded in the PR #43 body and hosted checks. This bundle intentionally avoids a self-referential commit SHA claim.

## Scope and prior corrections

This pass closes only CR-07 for PH-M02-WO-001. The independent review accepted CR-01 through CR-06 as evidence. No PH-M02-WO-002 work, merge, canonical checkpoint promotion, credentials, live provider requests, order placement, signing, or trading capability was introduced. `liveTradingAuthorized=false` remains in effect.

The only product/configuration file changed for CR-07 is [Dockerfile.dev](../../Dockerfile.dev): it uses the immutable official Node 24 Trixie digest, stable npm 12.2.0, and exact npm-bundled package refreshes whose versions and integrity hashes were checked. The SonarCloud follow-up adds `--ignore-scripts` to that global npm install after `docker:S6505` identified lifecycle-script execution risk. Application manifests, lockfiles, provider code, Compose, schema, migrations, TenantContext, auth, and trading code were not changed in this correction pass.

CR-01 through CR-06 remain accepted and their regressions remain in the full test suite. CR-07 candidate comparisons and raw candidate scan receipts are in [CR-07-CANDIDATES.md](PH-M02-WO-001/CR-07-CANDIDATES.md). The isolated candidate apt refresh found no newer Trixie repository candidate for util-linux, zlib1g, or libstdc++6.

## Final artifacts and scanner results

Docker Scout CLI `1.24.0`; full final SARIF scans contain no per-result suppressions.

| Image | Immutable digest | Findings | LOW | MEDIUM | HIGH | CRITICAL | SARIF SHA-256 |
|---|---|---:|---:|---:|---:|---:|---|
| `polyhunter-dev:local` | `sha256:1da515470671ec8175b1a1ff77dc408c333c0121f862f23f351288fb19d81fd1` | 35 | 26 | 7 | 2 | 0 | `3e61ddbfbad2ca881db4de09a2668be4700ac1d83e2a3d7bd31571f37c061cbc` |
| `postgres:17.11-alpine3.24` | `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` | 58 | 7 | 26 | 23 | 2 | `307df3f8cab60c17141e51d1f3237cc198f5e376aea2e4ad5581baec322a59c6` |

Final dev image HIGH findings are CVE-2026-95619 and CVE-2026-85091. The PostgreSQL image has 25 HIGH/CRITICAL results; 24 existing Go/libxml2 approvals remain bound to the exact unchanged PostgreSQL digest, and CVE-2026-85091 is proposed for review. Scout's terminal notice of four PostgreSQL exceptions is preserved; the SARIF suppression count is zero and no exception is treated as clearing a finding.

The full raw scans, image IDs, summary counts, container status, and SARIF hashes are in [cr07-full-final-scan-reconciliation.txt](PH-M02-WO-001/cr07-full-final-scan-reconciliation.txt). Machine-readable scanner/VEX reconciliation: [security-scans.json](PH-M02-WO-001/security-scans.json). Human-readable scan summary: [security-scans.md](PH-M02-WO-001/security-scans.md).

## CR-07 VEX result

Six exact-image/source rows remain `UNDER_INVESTIGATION`. Five retain individual, unapproved proposals; the PostgreSQL zlib proposal was withdrawn by CR-07-AUD-01 because the expanded consumer inventory found a plausible indirect `dlsym` path that was not tested through a valid PostgreSQL ABI trigger sequence. The exact attacker-controlled arbitrary SQL path also remains unproven.

Five rows retain individual proposals:

- Dev CVE-2026-95619: aligned `operator new` symbol exists, but exact final libstdc++ uses validated `posix_memalign` with the requested size; vulnerable overflow operation is absent.
- Dev CVE-2026-85091: exact Debian zlib 1.3.1 source lacks `gz_vacate`; Node's separate bundled zlib is reached through stream APIs, without a `gzprintf`/`gzvprintf` app path.
- PostgreSQL CVE-2026-85091: exact Alpine zlib is present and mapped. The 237-ELF inventory found 11 direct `libz.so.1` consumers, including `postgres`, `libxml2`, `pgcrypto.so`, `libLLVM`, and PostgreSQL client utilities; all 87 PostgreSQL module `.so` objects were scanned and none directly imports `gzprintf`/`gzvprintf`. However, `postgres` uses `dlopen`/`dlsym`, `pgcrypto.so` depends on libz, and POSIX handle lookup includes dependency symbols. The current database role is superuser. No valid PostgreSQL-ABI adapter/trigger sequence or application-controlled arbitrary SQL path was demonstrated. The finding remains `UNDER_INVESTIGATION` with no proposed disposition; see the CR-07-AUD-01 receipts.
- Trixie util-linux CVE-2026-76642: required root-controlled fstab helper entry/hook is absent; fstab is root-owned and contains only the unconfigured-base comment, and no mount helper or app invocation exists.
- Trixie util-linux CVE-2026-78408: requires a privileged operator `nsenter --join-cgroup` operation against an attacker-controlled target; the app has no call path, `nsenter` is not SUID, PID namespaces are private, and `CAP_SYS_ADMIN` is absent from the service bounding set.
- Trixie util-linux CVE-2026-78410: required root-controlled fstab-authorized bind source/hook is absent; the app cannot modify fstab or invoke mount.

All six rows remain `UNDER_INVESTIGATION` with exact evidence references, KEV/EPSS, upstream fix state, and expiry. Five have `proposedDisposition=NOT_AFFECTED`; PostgreSQL zlib has `proposedDisposition=null` and no executor disposition. `independentAuditor=null` and `ownerApproval=null` for every proposed row. No executor self-approval exists. CVE-2026-78409 is reconciled as not affected by the final util-linux v2.41.5 version because Red Hat states the affected range begins at v2.42; it is not carried as a current finding.

Full per-occurrence proof and evidence hashes: [CR-07-VEX.json](PH-M02-WO-001/CR-07-VEX.json) and [CR-07-VEX.md](PH-M02-WO-001/CR-07-VEX.md). Advisory/source review: [cr07-source-revalidation.md](PH-M02-WO-001/cr07-source-revalidation.md). KEV/EPSS receipts: [cr07-kev-epss-reconciliation.json](PH-M02-WO-001/cr07-kev-epss-reconciliation.json). The six proposals are not approvals; independent security audit and project-owner approval remain required by ADR-0007.

## Validation and runtime evidence

The final follow-up image was rebuilt with `--pull --no-cache` after adding `--ignore-scripts`. Its exact image ID is `sha256:1da515470671ec8175b1a1ff77dc408c333c0121f862f23f351288fb19d81fd1`; the full fresh scans were rerun against this artifact and yielded the same CVE result set. The audited input head d4 has GitHub Actions Validate PASS (run 37712387792), and the correction head 5ea9950 has Validate PASS (run 37725131129). The final evidence-only follow-up head is gated by exact-head Validate; its SHA and result are recorded in PR #43. No CI result changes the unresolved VEX finding.

The actual final Dockerfile/image tree was checked with:

- `npm ci` — PASS; 159 packages installed, 167 audited, zero dependency vulnerabilities ([follow-up receipt](PH-M02-WO-001/npm-ci-cr07-sonarfix.txt)).
- `npm run validate` — PASS; lint/format, root/workspace typechecks, 15 test files / 238 tests, workspace builds, Next.js production build, and audit ([follow-up receipt](PH-M02-WO-001/npm-validate-cr07-sonarfix.txt)).
- `npm audit --audit-level=high` — PASS; zero dependency vulnerabilities ([follow-up receipt](PH-M02-WO-001/npm-audit-cr07-sonarfix.txt)).
- Focused provider, boundary, and secret-material suite — PASS; 6 files / 46 tests ([follow-up receipt](PH-M02-WO-001/focused-security-tests-cr07-sonarfix.txt)).
- `npm run db:migrate` and PostgreSQL integration — PASS; 66 tests ([migration receipt](PH-M02-WO-001/db-migrate-cr07-sonarfix.txt), [integration receipt](PH-M02-WO-001/postgres-integration-cr07-sonarfix.txt)).
- `docker compose --project-name polyhunter-local build --pull --no-cache web worker` — PASS; final dev image ID matches the fresh scan ([build receipt](PH-M02-WO-001/docker-build-cr07-sonarfix.log)).
- `docker compose --project-name polyhunter-local config --quiet` and stack recreate — PASS ([runtime receipt](PH-M02-WO-001/docker-up-cr07-sonarfix.log)).
- Web `http://localhost:3000` — HTTP 200; web healthcheck healthy.
- Worker restart smoke — PASS; Compose restart succeeded, nodemon and worker Node processes were confirmed with `docker top`, provider import resolved `createPolymarketDiscovery=function`.
- PostgreSQL — running and healthy; exact official image digest unchanged; host port is not published.
- Authored-document whitespace, JSON/NDJSON parsing, embedded VEX evidence hashes, final SARIF hashes, and `git diff --check` results are recorded in [cr07-final-artifact-validation.txt](PH-M02-WO-001/cr07-final-artifact-validation.txt). Structured JSON/SARIF is byte-preserved; text receipts normalize only line endings and trailing terminal whitespace for clean diffs.

Receipts for the latest image include [cr07-sonar-remediation.txt](PH-M02-WO-001/cr07-sonar-remediation.txt), [post-image boundary checks](PH-M02-WO-001/cr07-sonarfix-boundary-check.txt), [worker runtime inspection](PH-M02-WO-001/dev-cr07-final-runtime-inspection.txt), [worker restart smoke](PH-M02-WO-001/cr07-worker-restart-smoke.txt), and [Compose runtime snapshot](PH-M02-WO-001/cr07-compose-runtime-final.json). The in-container `ps` utility was absent; daemon-side `docker top` supplied the process proof.

The prior CR-01..CR-06 review accepted the Windows host-edit hot-reload proof. No application source file changed in CR-07, so that exact-source evidence remains applicable. The original CR-07 runtime receipt captured Compose running and healthy. A fresh `docker compose ps` during CR-07-AUD-01 found no project containers currently running; this evidence-only correction did not start or mutate services. The image digest and runtime artifacts remain unchanged, so no rebuild or rescan was needed.

## CR-07-AUD-01 correction evidence

The expanded exact-image static inventory, all-module hash list, process maps, current database privilege/extension state, PostgreSQL loader source, PostgreSQL C UDF ABI, POSIX handle-resolution rule, and residual uncertainty are recorded in [cr07-aud-01-source-path-assessment.txt](PH-M02-WO-001/cr07-aud-01-source-path-assessment.txt) and the linked receipts. The exact image digest is unchanged; this evidence-only correction does not require rebuild/rescan. Context Lock drift and PR/CI preflight are recorded in [cr07-aud-01-preflight.txt](PH-M02-WO-001/cr07-aud-01-preflight.txt).

Affected validation was rerun after the receipt and VEX edits: focused security-boundary tests passed 17/17; `npm run validate` passed lint, format, typecheck, all 238 tests, workspace builds, Next.js build, and `npm audit --audit-level=high`. Evidence structure/hash reconciliation and exact-head hosted Validate for the pushed correction head are recorded in [cr07-aud-01-validation.txt](PH-M02-WO-001/cr07-aud-01-validation.txt) and PR #43.

## JEV and review state

TypeSafe JEV 1.13.0 `jev_gate` reviewed only this correction and returned `escalate` (composite 0.8563, safe_to_apply 0.19; four claims verified, one unsupported, two needing review). It verified the expanded inventory and unresolved path, and did not approve or clear the security finding. The full receipt is [jev-cr07-aud-01-gate.json](PH-M02-WO-001/jev-cr07-aud-01-gate.json). Its advisory is not a security verdict; exact evidence and independent auditor/owner decisions remain controlling.

## Risks and limitations

- Raw scanner HIGH findings remain visible in both image scans; proposed NOT_AFFECTED records are pending independent audit and owner approval. A reviewer may reject a proposal, in which case the finding remains a blocker.
- The exact PostgreSQL digest still contains Alpine zlib `1.3.2-r0`; the `1.3.2-r1` fix is absent. Expanded inspection found a standards-plausible `dlsym` dependency lookup from `pgcrypto.so` to libz, but did not prove a valid PG-ABI trigger sequence or attacker-controlled SQL path; the finding is unresolved.
- Debian Trixie repository metadata has no newer package candidate for util-linux, zlib1g, or libstdc++6.
- Proposed dispositions expire 2026-10-14T23:59:59Z, or sooner on any digest, scan, advisory, KEV, runtime, or exposure change.
- No canonical checkpoint change is made. The checkpoint delta remains a proposal only. PR #43 remains Draft and unmerged pending independent audit; no WO-002 admission is requested.

## Stop condition

Stop state: `BLOCKED_UNRESOLVED` for CR-07-AUD-01. Exact-head GitHub Actions Validate must still pass on the final pushed head, but passing CI does not resolve the security gap. PostgreSQL zlib remains `UNDER_INVESTIGATION` without a proposed disposition until the indirect `dlsym`/ABI-compatible trigger premise and attacker-controlled arbitrary SQL path are either proven or excluded with exact-runtime evidence. Do not merge, promote the checkpoint, start WO-002, enable signing, or authorize live trading.


## Correction Delta CR-07-AUD-01

Only the PostgreSQL zlib CVE-2026-85091 evidence/disposition and dependent aggregate status were changed. The prior three-executable import-only argument is withdrawn. Expanded inventory: 237 ELF objects, 87 PG shared objects, 59 control files; zlib SHA-256 `a1e2c03dcdedba98a06a00cadfb67a0e0b1cd93986860ec0c5ce66e789c44e57`; runtime maps include libz; `pgcrypto.so` is installed but not active and links libz; postgres uses handle-based `dlsym`. The raw zlib symbols do not satisfy the documented PostgreSQL C-function ABI by themselves. No dangerous dynamic call or app SQL injection test was attempted. Residual premises are (1) a valid ABI-compatible wrapper/stall/formatted-call sequence and (2) an attacker-controlled arbitrary SQL path under the current superuser role. The result is `BLOCKED_UNRESOLVED`, not self-approved.
