# PH-SEC-WO-007 — Exact-image VEX disposition for remaining 22 dev CVEs

Issue: #undefined
Parent implementation: PH-M01-WO-001 / PR #15
Parent head: 7d5be250255bd20cb0b20d6713f6f41c52c73b47
Branch: security/ph-m01-dev-nongo-vex
Risk: HIGH_ASSURANCE / SECURITY_BLOCKER_DISPOSITION.

## OBJECTIVE
Determine, for every one of the 22 remaining unique HIGH/CRITICAL findings in the exact restored PolyHunter development image, whether the exact artifact is FIXED, evidence-backed VEX NOT_AFFECTED, AFFECTED, or UNDER_INVESTIGATION under ADR-0007. Produce owner-reviewable evidence without weakening the no-known-HIGH/CRITICAL-defect rule.

## CONTEXT
PH-SEC-WO-005 removed the original 35 Go stdlib HIGH/CRITICAL findings and preserved Windows Docker hot reload. PH-SEC-WO-006 tested supported Node 24 candidates and was independently APPROVED AS EVIDENCE, but no candidate reached 0 HIGH/CRITICAL. The exact restored image remains:
- polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3
- locked set: 22 unique findings, 20 HIGH + 2 CRITICAL
- original 35 Go findings: 0 HIGH/CRITICAL

The canonical VEX policy permits a scanner finding to cease blocking only when FIXED or independently verified NOT_AFFECTED with owner approval. AFFECTED and UNDER_INVESTIGATION remain blockers.

## SCOPE
Evidence-only exact-artifact applicability analysis of the locked 22 findings:
- Perl: CVE-2026-48962, CVE-2026-48959, CVE-2026-82560, CVE-2026-57432, CVE-2026-12087, CVE-2026-13221
- util-linux: CVE-2026-78409, CVE-2026-78410, CVE-2026-78408, CVE-2026-76642
- gcc-12: CVE-2026-102010, CVE-2026-95619
- pcre2: CVE-2026-103111
- zlib: CVE-2026-85091
- npm brace-expansion: CVE-2026-102276, CVE-2026-102278, CVE-2026-14257, CVE-2026-69152
- npm undici: CVE-2026-19534
- npm tar: CVE-2026-73566
- npm ip-address: CVE-2026-69192
- npm http-cache-semantics: CVE-2026-93748

## OUT OF SCOPE
- Product/domain/schema/migration/TenantContext changes.
- Dockerfile or package dependency mutation.
- Node major-version change.
- Scanner suppression, ignore, waiver, severity downgrade, or wildcard VEX.
- Self-approval of NOT_AFFECTED.
- PH-M01-WO-002 identity/RBAC.
- Polymarket/trading behavior.

## FILES / SOURCES TO READ
Canonical main:
- AGENTS.md
- .engineering/CHECKPOINT.json
- .engineering/SECURITY.md
- .engineering/TEST-BENCHMARK-PLAN.md
- .engineering/DEFINITION-OF-DONE.md
- .engineering/REVIEW-PROGRESS-REPORTING.md
- .engineering/DECISIONS-LEDGER.md
- .engineering/decisions/ADR-0007-VEX-DISPOSITION-GATE.md

Parent exact head:
- Dockerfile.dev
- compose.yaml
- package.json
- package-lock.json
- apps/web/next.config.ts
- .engineering/evidence/PH-SEC-WO-005/validation/CR-01/polyhunter-dev-cr01.sarif
- .engineering/evidence/PH-SEC-WO-005-EVIDENCE.md
- .engineering/evidence/PH-SEC-WO-006-EVIDENCE.md
- .engineering/evidence/PH-SEC-WO-006-CANDIDATES.md

## ARCHITECTURE / SECURITY RULES
1. Evidence binds to exact CVE + component/version + exact image digest + environment.
2. Default disposition is UNDER_INVESTIGATION.
3. NOT_AFFECTED requires a policy-valid justification and exact evidence of exploit prerequisites, reachability, privileges, network/input path, and runtime use.
4. Absence from KEV or low EPSS alone never proves NOT_AFFECTED.
5. If vulnerable code is present but not reachable, prove the exact missing execution/input prerequisite.
6. If a component is build/install-only, prove it is not reachable in the relevant runtime or development threat model.
7. npm-bundled findings must distinguish package-manager execution paths from application runtime paths.
8. No malicious exploit payloads against external systems. Use static inspection, binary/package metadata, safe tracing, and benign disposable-container probes only.
9. Any artifact/package/version drift => STOP STALE.
10. No disposition becomes approved in this Work Order. ChatGPT independent audit + explicit owner approval are mandatory.

## PREFLIGHT
Before analysis:
- verify branch, parent head, merge-base and PR #15 open/unmerged;
- verify all Context Lock fingerprints;
- verify exact target image digest;
- deterministically parse the locked SARIF to exactly 22 unique HIGH/CRITICAL: 20 HIGH + 2 CRITICAL;
- verify the original 35 Go findings remain absent at HIGH/CRITICAL;
- reconcile the exact CVE/component set above;
- capture current CISA KEV and FIRST EPSS/source timestamps for prioritization only.

Any mismatch => STOP STALE/BLOCKED.

## REQUIRED ANALYSIS PER CVE
Record:
- scanner tuple and package path/version;
- upstream/advisory affected condition;
- vulnerable code/function/module presence;
- exact execution/reachability path in this image;
- attacker-controlled input prerequisite;
- privilege/capability/network/file-system prerequisite;
- whether the component runs during npm install/build/dev runtime/worker/web runtime;
- safe trace/static/symbol/package evidence;
- KEV status and EPSS snapshot;
- disposition: FIXED / proposed NOT_AFFECTED / AFFECTED / UNDER_INVESTIGATION;
- policy justification;
- exact receipts;
- revalidation/expiry trigger.

## TESTS / EVIDENCE
- deterministic SARIF reconciliation;
- package/binary/module inventory;
- exact file hashes and versions;
- process tree / runtime command evidence where relevant;
- safe disposable-container traces/probes;
- npm CLI dependency/reachability analysis for npm-bundled packages;
- no product code modification;
- git diff --check;
- evidence manifest + SHA-256 index;
- CI/security checks for evidence-only branch.

## ACCEPTANCE CRITERIA
1. 22/22 findings have individual exact-artifact rows.
2. No row is silently omitted or grouped without traceable per-CVE identity.
3. Every proposed NOT_AFFECTED satisfies ADR-0007 evidence requirements.
4. No scanner suppression/ignore is introduced.
5. Exact target image/digest and locked scan remain unchanged.
6. Original 35 Go HIGH/CRITICAL remain zero.
7. No product, Dockerfile, Compose, dependency, schema, migration, TenantContext or trading behavior changes.
8. Evidence Bundle is sufficient for independent HIGH_ASSURANCE audit.
9. If any AFFECTED/UNDER_INVESTIGATION remains, report an exact minimal remediation delta and remain BLOCKED.

## DELIVERABLES
- .engineering/evidence/PH-SEC-WO-007-EVIDENCE.md
- .engineering/evidence/PH-SEC-WO-007-VEX.md
- .engineering/evidence/PH-SEC-WO-007-VEX.json
- .engineering/evidence/PH-SEC-WO-007/ receipts + SHA256SUMS.txt
- updated PR body with exact-head result

## REVIEW FORMAT
- READY_FOR_INDEPENDENT_AUDIT
- CORRECTION REQUIRED
- BLOCKED_UNRESOLVED
- BLOCKED_STALE_CONTEXT

## STOP CONDITION
READY_FOR_INDEPENDENT_AUDIT only when all 22 findings are fully reconciled and every row is either FIXED or a policy-complete proposed NOT_AFFECTED, with zero AFFECTED/UNDER_INVESTIGATION.
If any row remains AFFECTED/UNDER_INVESTIGATION, stop BLOCKED_UNRESOLVED and do not start PH-M01-WO-002.
