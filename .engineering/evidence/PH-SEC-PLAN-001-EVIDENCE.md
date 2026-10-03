# PH-SEC-PLAN-001 Evidence Bundle

Status: OWNER_APPROVED / READY_FOR_FINAL_AUDIT.

## Base
main@e1237cda839829a6a4eedba3b9917d6ee45c6352

## Trigger
PR #15 / PH-M01-WO-001 is BLOCKED by HIGH/CRITICAL findings in official Node 24 and PostgreSQL 17 images. Tested official variants did not produce a zero-finding candidate.

## Standards review
The policy is grounded in:
- CISA VEX minimum elements and product statuses;
- CISA NOT_AFFECTED status justifications;
- CISA KEV as known-exploitation input;
- FIRST EPSS as empirical prioritization context only;
- NIST SSDF RV.2 vulnerability analysis and response practices.

## Safety properties
- Raw HIGH/CRITICAL remains blocking by default.
- AFFECTED and UNDER_INVESTIGATION always block.
- NOT_AFFECTED requires exact evidence and cannot be inferred from low EPSS or absence from KEV.
- No generic ignore/suppression is admitted.
- HIGH/CRITICAL NOT_AFFECTED requires independent audit plus explicit owner approval.
- Dispositions expire/fail closed.
- Privileged/live-money/auth/secrets paths remain stricter.
- No current PR #15 finding is reclassified by this policy PR.

## Review correction
CodeRabbit identified an over-broad reachability condition. It was corrected so reachability alone does not bar NOT_AFFECTED when an adversary cannot control the vulnerable operation or an effective inline mitigation blocks exploitation. The hard blocker now requires an exploitable path with satisfied prerequisites and no effective inline mitigation.

## Canonical promotion
Owner authorized continuation/adoption. This branch now promotes:
- ADR-0007;
- D-0022 in Decisions Ledger;
- Security VEX gate;
- Test Plan VEX proof obligations;
- DoD resolution semantics;
- canonical VEX policy document.

## Current PR #15 status
Still BLOCKED. No CVE is reclassified here. A separate exact-image blocker-resolution Work Order is required after this PR merges.

## STOP
After final exact-head audit and merge, create a separate Work Order for per-CVE PR #15 disposition. Do not begin PH-M01-WO-002.
