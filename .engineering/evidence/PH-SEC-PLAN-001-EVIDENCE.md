# PH-SEC-PLAN-001 Evidence Bundle

Status: PROPOSAL_READY_FOR_OWNER_DECISION.

## Base
main@e1237cda839829a6a4eedba3b9917d6ee45c6352

## Trigger
PR #15 / PH-M01-WO-001 is BLOCKED by HIGH/CRITICAL findings in official Node 24/PostgreSQL 17 images. Tested official variants did not produce a zero-finding candidate.

## Standards review
The proposal is grounded in:
- CISA VEX minimum elements and product statuses;
- CISA NOT_AFFECTED status justifications;
- CISA KEV as known-exploitation input;
- FIRST EPSS as empirical prioritization context;
- NIST SSDF RV.2 vulnerability analysis and risk-response practices.

## Safety properties
- Raw HIGH/CRITICAL remains blocking by default.
- AFFECTED and UNDER_INVESTIGATION always block.
- NOT_AFFECTED requires exact evidence and cannot be inferred from low EPSS or lack of KEV.
- No generic ignore/suppression is admitted.
- HIGH/CRITICAL NOT_AFFECTED requires independent audit + explicit owner approval.
- Dispositions expire/fail closed.
- Privileged/live-money/auth/secrets paths remain stricter.
- No current PR #15 finding is reclassified by this proposal.

## Repository mutation
Only proposal/governance-planning files are introduced. Existing canonical Security, Test Plan, DoD, Decisions Ledger and Checkpoint remain unchanged.

## Owner decision
Required: APPROVE POLICY / REVISE POLICY / REJECT POLICY.

## STOP
Do not merge a canonical policy change or resume PR #15 under VEX until the owner explicitly approves the proposed policy.
