# PH-M02-WO-001 — Evidence Bundle / CR-07

- Status: `READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT`
- Review: 5448950464
- PR: #43
- Branch: `feat/ph-m02-public-provider-foundation`
- Work Order base: `main@a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c`
- Audited parent head: `d298c0610dd5dce0e4e08a14640c361e00b285ff`
- Assessment date: 2026-10-07

The final pushed head is recorded in PR #43 and the exact-head CI receipt after push. This bundle intentionally does not claim its own commit SHA.

## Scope and prior corrections

This pass closes only CR-07 for PH-M02-WO-001. The independent review accepted CR-01 through CR-06 as evidence. No PH-M02-WO-002 work, merge, canonical checkpoint promotion, credentials, live provider requests, order placement, signing, or trading capability was introduced. `liveTradingAuthorized=false` remains in effect.

The only product/configuration file changed for CR-07 is [Dockerfile.dev](../../Dockerfile.dev): it now uses the immutable official Node 24 Trixie digest, stable npm 12.2.0, and exact npm-bundled package refreshes whose versions and integrity hashes were checked. Application manifests, lockfiles, provider code, Compose, schema, migrations, TenantContext, auth, and trading code were not changed in this correction pass.

CR-01 through CR-06 remain accepted and their regressions remain in the full test suite. CR-07 candidate comparisons and raw candidate scan receipts are in [CR-07-CANDIDATES.md](PH-M02-WO-001/CR-07-CANDIDATES.md). The isolated candidate apt refresh found no newer Trixie repository candidate for util-linux, zlib1g, or libstdc++6.

## Final artifacts and scanner results

Docker Scout CLI `1.24.0`; full final SARIF scans contain no per-result suppressions.

| Image | Immutable digest | Findings | LOW | MEDIUM | HIGH | CRITICAL | SARIF SHA-256 |
|---|---|---:|---:|---:|---:|---:|---|
| `polyhunter-dev:local` | `sha256:3e7475d7fce403540855f0397f023b20ad9ab79b3767ea6ee6499afd570fbc47` | 35 | 26 | 7 | 2 | 0 | `3e61ddbfbad2ca881db4de09a2668be4700ac1d83e2a3d7bd31571f37c061cbc` |
| `postgres:17.11-alpine3.24` | `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` | 58 | 7 | 26 | 23 | 2 | `307df3f8cab60c17141e51d1f3237cc198f5e376aea2e4ad5581baec322a59c6` |

Final dev image HIGH findings are CVE-2026-95619 and CVE-2026-85091. The PostgreSQL image has 25 HIGH/CRITICAL results; 24 existing Go/libxml2 approvals remain bound to the exact unchanged PostgreSQL digest, and CVE-2026-85091 is proposed for review. Scout's terminal notice of four PostgreSQL exceptions is preserved; the SARIF suppression count is zero and no exception is treated as clearing a finding.

The full raw scans, image IDs, summary counts, container status, and SARIF hashes are in [cr07-full-final-scan-reconciliation.txt](PH-M02-WO-001/cr07-full-final-scan-reconciliation.txt). Machine-readable scanner/VEX reconciliation: [security-scans.json](PH-M02-WO-001/security-scans.json). Human-readable scan summary: [security-scans.md](PH-M02-WO-001/security-scans.md).

## CR-07 VEX result

Six exact-image/source rows have individual proposals:

- Dev CVE-2026-95619: aligned `operator new` symbol exists, but exact final libstdc++ uses validated `posix_memalign` with the requested size; vulnerable overflow operation is absent.
- Dev CVE-2026-85091: exact Debian zlib 1.3.1 source lacks `gz_vacate`; Node's separate bundled zlib is reached through stream APIs, without a `gzprintf`/`gzvprintf` app path.
- PostgreSQL CVE-2026-85091: vulnerable Alpine zlib is present, but exact consumer imports omit the vulnerable formatted gzip entry points; only PostgreSQL server processes run, and app code does not start dump/restore.
- Trixie util-linux CVE-2026-76642: required root-controlled fstab helper entry/hook is absent; fstab is root-owned and contains only the unconfigured-base comment, and no mount helper or app invocation exists.
- Trixie util-linux CVE-2026-78408: requires a privileged operator `nsenter --join-cgroup` operation against an attacker-controlled target; the app has no call path, `nsenter` is not SUID, PID namespaces are private, and `CAP_SYS_ADMIN` is absent from the service bounding set.
- Trixie util-linux CVE-2026-78410: required root-controlled fstab-authorized bind source/hook is absent; the app cannot modify fstab or invoke mount.

All six rows remain `UNDER_INVESTIGATION`, each with `proposedDisposition=NOT_AFFECTED`, exact evidence references, KEV/EPSS, upstream fix state, and expiry. `independentAuditor=null` and `ownerApproval=null` for every proposal. No executor self-approval exists. CVE-2026-78409 is reconciled as not affected by the final util-linux v2.41.5 version because Red Hat states the affected range begins at v2.42; it is not carried as a current finding.

Full per-occurrence proof and evidence hashes: [CR-07-VEX.json](PH-M02-WO-001/CR-07-VEX.json) and [CR-07-VEX.md](PH-M02-WO-001/CR-07-VEX.md). Advisory/source review: [cr07-source-revalidation.md](PH-M02-WO-001/cr07-source-revalidation.md). KEV/EPSS receipts: [cr07-kev-epss-reconciliation.json](PH-M02-WO-001/cr07-kev-epss-reconciliation.json). The six proposals are not approvals; independent security audit and project-owner approval remain required by ADR-0007.

## Validation and runtime evidence

The actual final Dockerfile/image tree was checked with:

- `npm ci` — PASS; 159 packages installed, 167 audited, zero vulnerabilities.
- `npm run validate` — PASS; lint/format, root/workspace typechecks, 15 test files / 238 tests, workspace builds, Next.js production build, and audit.
- `npm audit --audit-level=high` — PASS; zero dependency vulnerabilities.
- Focused provider, boundary, and secret-material suite — PASS; 6 files / 46 tests.
- `docker compose --project-name polyhunter-local build --pull --no-cache web worker` — PASS; final dev image ID matches the scanned digest.
- `docker compose --project-name polyhunter-local config --quiet` — PASS.
- Compose recreate — PASS; PostgreSQL reported healthy before web/worker start.
- Web `http://localhost:3000` — HTTP 200 before and after the worker restart.
- Worker restart smoke — PASS; Compose restart succeeded, nodemon and worker Node processes were confirmed with `docker top`, provider import resolved `createPolymarketDiscovery=function`.
- PostgreSQL — running and healthy; exact official image digest unchanged; host port is not published.
- Authored-document whitespace, JSON/NDJSON parsing, embedded VEX evidence hashes, final SARIF hashes, and `git diff --check` results are recorded in [cr07-final-artifact-validation.txt](PH-M02-WO-001/cr07-final-artifact-validation.txt). Structured JSON/SARIF is byte-preserved; text receipts normalize only line endings and trailing terminal whitespace for clean diffs.

Receipts: [npm-ci-cr07.txt](PH-M02-WO-001/npm-ci-cr07.txt), [npm-validate-cr07.txt](PH-M02-WO-001/npm-validate-cr07.txt), [npm-audit-cr07.txt](PH-M02-WO-001/npm-audit-cr07.txt), [focused-security-tests-cr07.txt](PH-M02-WO-001/focused-security-tests-cr07.txt), [docker-build-cr07-final.log](PH-M02-WO-001/docker-build-cr07-final.log), [docker-up-cr07-final.log](PH-M02-WO-001/docker-up-cr07-final.log), [cr07-worker-restart-smoke.txt](PH-M02-WO-001/cr07-worker-restart-smoke.txt), and [cr07-compose-runtime-final.json](PH-M02-WO-001/cr07-compose-runtime-final.json). The in-container `ps` utility was absent; daemon-side `docker top` supplied the process proof and the receipt records both the attempted probe and substitute evidence.

The prior CR-01..CR-06 review accepted the Windows host-edit hot-reload proof. No application source file changed in CR-07, so that exact-source evidence remains applicable. Docker Compose is left running.

## JEV and review state

TypeSafe/Jev was used only for bounded review/screening with no secrets. Official advisory excerpts screened as `pass` (injection probability 0.20, substance 0.98, relevance 0.92). The final `jev_gate` result and token receipt are stored at [jev-cr07-final-gate.json](PH-M02-WO-001/jev-cr07-final-gate.json) after the final evidence gate. JEV is advisory; exact source, binary, image, and test evidence controls.

## Risks and limitations

- Raw scanner HIGH findings remain visible in both image scans; proposed NOT_AFFECTED records are pending independent audit and owner approval. A reviewer may reject a proposal, in which case the finding remains a blocker.
- The current official PostgreSQL tag still contains Alpine zlib `1.3.2-r0`; its `1.3.2-r1` fix is not present in the current pinned official digest.
- Debian Trixie repository metadata has no newer package candidate for util-linux, zlib1g, or libstdc++6.
- Proposed dispositions expire 2026-10-14T23:59:59Z, or sooner on any digest, scan, advisory, KEV, runtime, or exposure change.
- No canonical checkpoint change is made. The checkpoint delta remains a proposal only. PR #43 remains Draft and unmerged pending independent audit; no WO-002 admission is requested.

## Stop condition

`READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT` — remediation candidates exhausted; exact final image digests and full fresh scans are frozen; each residual finding/source row has an individual proposed disposition with evidence; no self-approval or generic suppression exists. Await independent security auditor and owner decisions.
