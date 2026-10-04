# PH-SEC-WO-003 — PostgreSQL libxml2 applicability review

Issue: #22
Parent implementation: PH-M01-WO-001 / PR #15
Parent head: c04af277990272310ed86eeb9dce02e74e4df523
Analysis branch: security/ph-m01-postgres-libxml2-vex
Risk: HIGH_ASSURANCE / SECURITY_BLOCKER_RESOLUTION.

## OBJECTIVE
Determine whether CVE-2026-86140 in libxml2 2.13.9-r2 is applicable to the exact PostgreSQL 17.11 local-development image and runtime.

## CONTEXT
PH-SEC-WO-002 independently audited and owner-approved 23 PostgreSQL gosu/Go stdlib findings as NOT_AFFECTED. One PostgreSQL HIGH finding remains:
- CVE-2026-86140
- libxml2 2.13.9-r2
- exact image: postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24

## SCOPE
Evidence-only applicability analysis for this single finding.

## OUT OF SCOPE
No Dockerfile, Compose, dependency, schema, migration, TenantContext or application changes. No dev-image analysis. No PH-M01-WO-002.

## REQUIRED EVIDENCE
1. Verify exact image/package identity and hash the installed libxml2 library.
2. Revalidate authoritative CVE, upstream libxml2 and Alpine package information.
3. Determine whether the affected libxml2 code is present in the exact installed library.
4. Determine whether PostgreSQL in the exact image is compiled, linked or loaded with libxml2.
5. Determine whether the relevant PostgreSQL XML feature path is enabled and reachable in the current PolyHunter local-development configuration.
6. Use only safe static inspection and benign disposable-database feature checks.
7. Record CISA KEV and FIRST EPSS context.
8. Produce one VEX status under ADR-0007: FIXED, NOT_AFFECTED, AFFECTED or UNDER_INVESTIGATION.
9. Incomplete or contradictory proof remains UNDER_INVESTIGATION.
10. Executor may propose NOT_AFFECTED but may not approve it.

## ACCEPTANCE CRITERIA
- Exact artifact identity is proven.
- libxml2 code presence is proven.
- PostgreSQL linkage/load relationship is proven.
- Applicability to the actual local runtime is proven or left UNDER_INVESTIGATION.
- No product/runtime files are changed.
- PR #15 stays unmerged.

## DELIVERABLES
- .engineering/evidence/PH-SEC-WO-003-LIBXML2-VEX.json
- .engineering/evidence/PH-SEC-WO-003-LIBXML2-VEX.md
- .engineering/evidence/PH-SEC-WO-003-EVIDENCE.md
- supporting receipts under .engineering/evidence/PH-SEC-WO-003/
- nested PR against feat/ph-m01-tenancy-persistence.

## REVIEW FORMAT
HIGH_ASSURANCE: APPROVED / CORRECTION REQUIRED / BLOCKED.
Any proposed NOT_AFFECTED disposition requires independent review and explicit owner approval.

## STOP CONDITION
Stop after CVE-2026-86140 is fully evidenced for independent review, or BLOCKED_UNRESOLVED. Do not analyze dev-image findings and do not start PH-M01-WO-002.
