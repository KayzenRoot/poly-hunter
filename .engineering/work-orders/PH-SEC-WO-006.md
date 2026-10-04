# PH-SEC-WO-006 — Remediate remaining 22 dev-image CVEs

Issue: #30
Parent implementation: PH-M01-WO-001 / PR #15
Parent head: 6c6c05fc5d332a88b70cd5778ac9bba91df798df
Remediation branch: security/ph-m01-dev-nongo-remediation
Risk: HIGH_ASSURANCE / SECURITY_BLOCKER_REMEDIATION.

## OBJECTIVE
Eliminate all 22 remaining unique HIGH/CRITICAL non-Go findings from the exact PolyHunter development image while preserving the canonical Node.js 24 local-development runtime and all existing functional/tooling contracts.

## CONTEXT
PH-SEC-WO-005 has been independently audited and merged into the blocked parent branch:
- 35 original Go stdlib HIGH/CRITICAL CVEs => 0;
- Windows Docker host hot reload restored;
- no new HIGH/CRITICAL tuple introduced.

The exact CR-01 final scan now contains only 22 unique HIGH/CRITICAL findings:
- Perl: 6 (4 HIGH, 2 CRITICAL)
- util-linux: 4 HIGH
- npm brace-expansion: 4 HIGH
- gcc-12: 2 HIGH
- npm undici: 1 HIGH
- npm tar: 1 HIGH
- pcre2: 1 HIGH
- npm ip-address: 1 HIGH
- zlib: 1 HIGH
- npm http-cache-semantics: 1 HIGH

Total: 20 HIGH + 2 CRITICAL.

## SCOPE
Development-image/base-tooling remediation only.

Authorized implementation files:
- `Dockerfile.dev`
- `package.json` / `package-lock.json` only if a stable npm/tooling compatibility adjustment is strictly necessary and does not alter application dependency semantics
- evidence/receipts for this Work Order

No application/domain/schema/migration/TenantContext behavior change.

## OUT OF SCOPE
- Node major-version change: Node.js 24 is frozen by Architecture.
- PH-M01-WO-002 identity/RBAC.
- Trading/Polymarket behavior.
- Product/domain refactors.
- Scanner suppression/ignore.
- VEX disposition as a substitute for available remediation.
- Alpine adoption without separate explicit owner approval if it is the only passing option.

## FILES / SOURCES TO READ
Canonical main:
- AGENTS.md
- .engineering/CHECKPOINT.json
- .engineering/SECURITY.md
- .engineering/TEST-BENCHMARK-PLAN.md
- .engineering/DEFINITION-OF-DONE.md
- .engineering/REVIEW-PROGRESS-REPORTING.md
- .engineering/ARCHITECTURE.md
- .engineering/DECISIONS-LEDGER.md

Parent branch/head:
- Dockerfile.dev
- compose.yaml
- package.json
- package-lock.json
- apps/web/next.config.ts
- .engineering/evidence/PH-SEC-WO-005-EVIDENCE.md
- .engineering/evidence/PH-SEC-WO-005/validation/CR-01/polyhunter-dev-cr01.sarif

## LOCKED FINDING SET
The executor must deterministically reconcile the exact 22-CVE final-scan set before editing.

### Debian/base OS
Perl:
- CVE-2026-48962 HIGH
- CVE-2026-48959 HIGH
- CVE-2026-82560 HIGH
- CVE-2026-57432 HIGH
- CVE-2026-12087 CRITICAL
- CVE-2026-13221 CRITICAL

util-linux:
- CVE-2026-78409 HIGH
- CVE-2026-78410 HIGH
- CVE-2026-78408 HIGH
- CVE-2026-76642 HIGH

gcc-12:
- CVE-2026-102010 HIGH
- CVE-2026-95619 HIGH

pcre2:
- CVE-2026-103111 HIGH

zlib:
- CVE-2026-85091 HIGH

### npm bundled in the Node base image
brace-expansion:
- CVE-2026-102276 HIGH
- CVE-2026-102278 HIGH
- CVE-2026-14257 HIGH
- CVE-2026-69152 HIGH

Other npm-bundled packages:
- CVE-2026-19534 / undici HIGH
- CVE-2026-73566 / tar HIGH
- CVE-2026-69192 / ip-address HIGH
- CVE-2026-93748 / http-cache-semantics HIGH

## ARCHITECTURE RULES
1. Node.js major remains 24.
2. Prefer official Node images and immutable digests.
3. Prefer current supported Debian-family variants before changing distro family.
4. Prefer upstream/base-image remediation over manual mutation of npm internals.
5. No wildcard suppression or CVE ignore.
6. Final image must remain reproducible from Dockerfile + pinned base digest/tag decision.
7. Existing Compose topology and non-root runtime contract remain intact.
8. Windows host hot reload from PH-SEC-WO-005 must remain functional.
9. Previously eliminated 35 Go HIGH/CRITICAL findings must remain at zero.

## CANDIDATE ORDER

### Candidate A — refresh current official Node 24 bookworm-slim
Revalidate the current official `node:24-bookworm-slim` manifest/digest at execution time.
- build against the newest official digest for that tag;
- record Node/npm versions and OS package versions;
- scan before any additional package mutation.

If this alone clears all 22 findings, prefer it.

### Candidate B — current Debian family + supported security/npm refresh
If A does not clear the gate:
- test a minimal Debian security package refresh in the image only when package repositories provide fixed versions;
- test a stable npm update only when the current stable npm release actually removes the bundled npm CVEs;
- do not surgically mutate npm's private nested dependency tree.

### Candidate C — official Node 24 trixie-slim
If A/B fail:
- test the latest official `node:24-trixie-slim` digest;
- preserve Node major 24 and non-root runtime;
- run the complete validation matrix;
- adopt only if all contracts pass and final scan is 0 HIGH/CRITICAL.

### Candidate D — Alpine evidence only
Only if A/B/C fail:
- an official Node 24 Alpine variant may be evaluated in an isolated candidate for evidence;
- do not adopt automatically;
- if Alpine is the only clean candidate, stop `BLOCKED_OPTION_REQUIRED` for an explicit owner/architecture decision because libc/distro family changes.

## PREFLIGHT
Before editing:
1. verify branch/base/ancestry;
2. verify PR #15 remains open/unmerged;
3. verify all Context Lock fingerprints;
4. parse the exact CR-01 SARIF and reconcile exactly 22 unique HIGH/CRITICAL CVEs, 20 HIGH + 2 CRITICAL;
5. verify original 35 Go CVEs remain absent in that exact scan;
6. query authoritative Docker Hub/Node manifest metadata and npm stable metadata;
7. capture candidate base-image digests before building;
8. create `.engineering/evidence/PH-SEC-WO-006-CANDIDATES.md` before implementation edits.

Any mismatch => STOP STALE/BLOCKED.

## TESTS
For every candidate scanned:
- exact base tag + digest;
- Node version;
- npm version;
- OS release;
- affected package versions;
- Docker Scout/equivalent SARIF;
- HIGH/CRITICAL tuple reconciliation.

For the final candidate:
- clean `npm ci`;
- `npm run lint`;
- `npm run format:check`;
- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- `npm audit --audit-level=high`;
- `npm run validate`;
- deterministic `db:generate`;
- migration on disposable PostgreSQL;
- PostgreSQL integration suite;
- Docker build `--pull --no-cache`;
- Compose config/up/health;
- HTTP 200 web;
- Windows-host hot reload proof without in-container touch;
- worker restart smoke;
- final Docker Scout/equivalent scan;
- exact before/after 22-CVE reconciliation;
- verify original 35 Go blockers remain zero;
- verify no new HIGH/CRITICAL.

## ACCEPTANCE CRITERIA
1. Final dev image has **0 HIGH/CRITICAL** findings.
2. All 22 locked non-Go findings are absent from HIGH/CRITICAL.
3. The original 35 Go CVEs remain absent from HIGH/CRITICAL.
4. No new HIGH/CRITICAL is introduced.
5. Node.js remains major 24.
6. All mandatory product/tooling/DB/Docker/hot-reload gates pass.
7. Final base image is recorded by immutable digest.
8. No application/domain/schema/TenantContext behavior change.
9. Rollback is documented.
10. PR #15 remains unmerged pending independent audit.

## DELIVERABLES
- minimal Dockerfile/tooling changes;
- .engineering/evidence/PH-SEC-WO-006-CANDIDATES.md
- .engineering/evidence/PH-SEC-WO-006-EVIDENCE.md
- candidate/final scan receipts under .engineering/evidence/PH-SEC-WO-006/
- exact image/package/version receipts;
- rollback instructions;
- nested PR against feat/ph-m01-tenancy-persistence.

## REVIEW FORMAT
HIGH_ASSURANCE:
- APPROVED REMEDIATION;
- CORRECTION REQUIRED;
- BLOCKED_OPTION_REQUIRED;
- BLOCKED.

## STOP CONDITION
Stop `READY_FOR_INDEPENDENT_AUDIT` only when the final dev image reaches 0 HIGH/CRITICAL with all regression gates green.
If only Alpine/distro-family change or another architecture decision can satisfy the gate, stop `BLOCKED_OPTION_REQUIRED`.
Do not start PH-M01-WO-002.
