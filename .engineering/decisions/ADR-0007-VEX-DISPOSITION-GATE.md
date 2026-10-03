# ADR-0007 — VEX-based disposition for third-party vulnerability findings

Status: PROPOSED / OWNER_APPROVAL_REQUIRED.

## Context
PH-M01-WO-001 is blocked because exact Docker Scout scans of official Node 24 and PostgreSQL 17 images report HIGH/CRITICAL findings while tested upstream image variants do not provide a zero-finding alternative.

The existing rule "never advance with a known HIGH/CRITICAL defect" remains correct. The unresolved question is when a scanner finding is demonstrably NOT_AFFECTED rather than an exploitable defect in the exact PolyHunter runtime.

## Proposed decision
Adopt the policy in `.engineering/proposals/PH-SEC-VEX-POLICY.md`.

A scanner HIGH/CRITICAL defaults to UNDER_INVESTIGATION and blocks. It stops blocking only after FIXED or evidence-backed VEX NOT_AFFECTED disposition.

AFFECTED or UNDER_INVESTIGATION HIGH/CRITICAL remains an absolute blocker.

## Important non-decision
This ADR does not accept risk for PR #15 and does not declare any current CVE NOT_AFFECTED. Each current finding needs its own exact-image analysis after this ADR is explicitly approved.

## Consequences
- scanner counts alone no longer equal semantic exploitability;
- no scanner finding is silently ignored;
- per-CVE receipts become versioned evidence;
- KEV, reachability, privilege and environment become formal proof inputs;
- HIGH/CRITICAL dispositions require independent audit + owner approval;
- stale disposition automatically fails closed.

## Rejected alternatives
1. **Ignore all upstream-image CVEs** — rejected as unsafe.
2. **Require literal zero scanner findings forever** — rejected as operationally brittle when official upstream images contain unreachable/non-applicable findings and no clean image exists.
3. **Accept AFFECTED HIGH/CRITICAL by business risk sign-off** — rejected because it conflicts with the PolyHunter HIGH_ASSURANCE rule.
