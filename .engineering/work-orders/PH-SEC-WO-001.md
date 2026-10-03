# PH-SEC-WO-001 — Exact-image VEX analysis for PR #15

Issue: #18
Base implementation branch/head: feat/ph-m01-tenancy-persistence@3ad44a62bbcc00abdc61b34efd6983a2e765aca9
Security analysis branch: security/ph-m01-wo001-vex-analysis
Canonical policy main: main@771f75bbd23fd458e67be1d34024e78e39f5b8af
Risk: HIGH_ASSURANCE / SECURITY_BLOCKER_RESOLUTION.

## OBJECTIVE
Apply canonical ADR-0007 / VEX policy to every HIGH/CRITICAL finding in the two exact final images used by PH-M01-WO-001, producing reproducible per-CVE dispositions without changing product/runtime code.

## CONTEXT
PH-M01-WO-001 is functionally healthy but BLOCKED by container scan findings. The canonical VEX policy permits a HIGH/CRITICAL finding to cease blocking only when FIXED or independently verified as NOT_AFFECTED with exact evidence.

Exact images:
- polyhunter-dev:local @ sha256:6c8701d8141745e1625c392da42ff643389ed1dab1fcddd13d8dcff704180caa
- postgres:17.11-alpine3.24 @ sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24

## SCOPE
For every unique HIGH/CRITICAL CVE present in the two final SARIF receipts:
- identify component/version and exact image digest;
- record scanner severity and scanner evidence;
- determine upstream/vendor status and available fix;
- determine CISA KEV status;
- record FIRST EPSS score/percentile where available;
- verify whether the vulnerable component/code is present;
- analyze runtime execution/reachability;
- analyze attacker-controlled inputs and prerequisites;
- analyze container user, capabilities and network exposure;
- record inline/compensating mitigations;
- assign VEX status: FIXED / NOT_AFFECTED / AFFECTED / UNDER_INVESTIGATION;
- when NOT_AFFECTED, use only an allowed canonical justification and attach reproducible proof;
- record expiry/revalidation trigger.

## OUT OF SCOPE
No Dockerfile, Compose, dependency, schema, migration, TenantContext, repository, application, auth, secret-vault, Polymarket or trading changes. No generic ignores/suppressions. No PH-M01-WO-002. No merge of PR #15.

## FILES / SOURCES TO READ
1. Canonical main@771f75bbd23fd458e67be1d34024e78e39f5b8af:
   - .engineering/proposals/PH-SEC-VEX-POLICY.md
   - .engineering/decisions/ADR-0007-VEX-DISPOSITION-GATE.md
   - .engineering/SECURITY.md
   - .engineering/TEST-BENCHMARK-PLAN.md
   - .engineering/DEFINITION-OF-DONE.md
2. Blocked implementation head:
   - .engineering/evidence/PH-M01-WO-001-EVIDENCE.md
   - final Docker Scout SARIF receipts
   - Dockerfile.dev / compose.yaml for exposure/context only
3. Authoritative external vulnerability sources used for each CVE.

## REQUIREMENTS
1. Default every HIGH/CRITICAL to UNDER_INVESTIGATION.
2. Every CVE gets an explicit record; no bulk status without per-CVE rows.
3. NOT_AFFECTED requires exact evidence tied to digest/component/environment.
4. Absence from KEV is not proof of NOT_AFFECTED.
5. Low EPSS is not proof of NOT_AFFECTED.
6. Scanner severity alone is not reachability proof.
7. Generic suppression/ignore is forbidden.
8. If vulnerable code is attacker-controllable through a valid exploit path with prerequisites satisfied and no effective inline mitigation, NOT_AFFECTED is forbidden.
9. If evidence is incomplete/contradictory, status remains UNDER_INVESTIGATION.
10. AFFECTED or UNDER_INVESTIGATION HIGH/CRITICAL keeps PR #15 BLOCKED.
11. NOT_AFFECTED disposition expires per canonical policy.
12. Final conclusion must be BLOCKED unless every final-image blocker is FIXED or evidence-backed NOT_AFFECTED.

## ANALYSIS METHOD
- Parse the exact SARIF files deterministically to enumerate unique HIGH/CRITICAL CVEs.
- Prefer official/vendor advisories, CISA KEV and FIRST EPSS over secondary summaries.
- Inspect exact images/containers with deterministic commands where needed: package inventory, binary presence, linked/runtime version, process tree, user/capabilities, open/listening ports, configuration and executable paths.
- Do not execute public exploit code against external systems.
- Local benign prerequisite/reachability checks are permitted when they do not create unsafe side effects.
- Preserve raw command output/receipts or stable hashes.

## ACCEPTANCE CRITERIA
- 100% of unique HIGH/CRITICAL CVEs from both final-image receipts are enumerated.
- Every row has status + evidence fields required by canonical policy.
- Counts reconcile exactly back to the SARIF unique-CVE set.
- No unsupported NOT_AFFECTED statement.
- KEV/EPSS snapshots and source timestamps are recorded.
- Independent-from-executor audit can reproduce each NOT_AFFECTED claim.
- Result explicitly states READY_FOR_INDEPENDENT_AUDIT or BLOCKED_UNRESOLVED.
- No product/runtime file is changed.

## TESTS / EVIDENCE
- SARIF parse/count reconciliation.
- Exact image digest verification.
- Container/runtime presence and reachability evidence where relevant.
- KEV and EPSS data capture with timestamp.
- git diff --check.
- exact changed-path review proving evidence/governance-only mutation.
- no secret material added.

## DELIVERABLES
- .engineering/evidence/PH-SEC-WO-001-VEX.json
- .engineering/evidence/PH-SEC-WO-001-VEX.md
- source/command receipts under .engineering/evidence/PH-SEC-WO-001/
- Evidence Bundle summary
- commit/push and nested PR against feat/ph-m01-tenancy-persistence.

## REVIEW FORMAT
HIGH_ASSURANCE: APPROVED / CORRECTION REQUIRED / BLOCKED. Each NOT_AFFECTED HIGH/CRITICAL requires independent security audit and explicit owner approval before it may unblock PR #15.

## STOP CONDITION
Stop with READY_FOR_INDEPENDENT_AUDIT only if all HIGH/CRITICAL findings are FIXED or proposed NOT_AFFECTED with complete proof. Otherwise stop BLOCKED_UNRESOLVED and list every blocker. Do not alter product code or start PH-M01-WO-002.
