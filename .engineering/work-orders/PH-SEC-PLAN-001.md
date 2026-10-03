# PH-SEC-PLAN-001 — VEX-based vulnerability disposition policy

Issue: #16
Base: main@e1237cda839829a6a4eedba3b9917d6ee45c6352
Branch: planning/ph-sec-vex-policy
Risk: HIGH_ASSURANCE governance / BLOCKER_RESOLUTION.

## OBJECTIVE
Produce an owner-reviewable policy for distinguishing raw scanner findings from evidence-backed NOT_AFFECTED dispositions without weakening the no-known-HIGH/CRITICAL-defect rule.

## CONTEXT
PR #15 is BLOCKED because no tested official Node 24/PostgreSQL 17 image reaches zero HIGH/CRITICAL scanner findings.

## SCOPE
Policy proposal, ADR-0007 proposal, standards mapping, planning Context Lock and evidence.

## OUT OF SCOPE
Canonical Security/DoD mutation, PR #15 CVE disposition, code, image changes, suppressions, checkpoint promotion, PH-M01-WO-002.

## FILES / SOURCES TO READ
AGENTS, Source Hierarchy, Checkpoint, Security, Test Plan, DoD, Decisions, PH-M01-WO-001 and current PR #15 blocker evidence.

## REQUIREMENTS
- Preserve "AFFECTED/UNDER_INVESTIGATION HIGH/CRITICAL blocks".
- CISA-compatible VEX statuses/justifications.
- KEV as hard input.
- EPSS prioritization only, never exemption.
- exact digest/component/environment binding.
- independent audit + owner approval for HIGH/CRITICAL NOT_AFFECTED.
- time-bounded expiry.
- no generic suppression.

## ACCEPTANCE CRITERIA
Proposal is internally consistent, standards-grounded and cannot be used as a blanket bypass. PR #15 remains blocked.

## TESTS
Exact diff/path audit; cross-check against existing Security/DoD; verify no canonical gate changed; verify no runtime files.

## DELIVERABLES
Policy proposal, candidate ADR, Context Lock, Evidence Bundle and owner decision request.

## REVIEW FORMAT
APPROVE POLICY / REVISE POLICY / REJECT POLICY.

## STOP CONDITION
Stop before changing canonical Security/DoD or reinterpreting PR #15 CVEs. Explicit owner approval is required.
