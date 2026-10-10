# ADR-0008 — Dependency-aware parallel module waves

Status: OWNER-APPROVED WITH CONDITIONS; EFFECTIVE FOR SCHEDULING; G0 PREREQUISITES VERIFIED AT main@c15ed37253c9ee7f250ba435434b17b71fa54526; G1/G2 PREP ACCEPTED VIA PR #61; NEW EXACT-HEAD LOCKS REQUIRED FOR CONDITIONAL ADMISSION
Date: 2026-10-09
Work Order: PH-GOV-PARALLEL-001
Decision: D-0024 (owner approval recorded 2026-10-10 UTC)
Scope: engineering workflow and scheduling, not new feature scope.

## Context

BACKLOG.md contains fifteen modules PH-M00..PH-M14 but its original linear order forces a separate prompt for nearly every increment. The owner wants one orchestrated Codex prompt to assign one agent per module, maximize feasible concurrency and defer broad repeated tests until all code in the wave is integrated.

## Decision approved with conditions

1. A Work Order batch may include several non-overlapping module Work Orders after their individual dependency-path gates pass. One agent per module, one coordinator for common contracts and integration.
2. Keep stable PH-M IDs and module classifications unchanged. Do not count M10 IMPORTANT or M13/M14 FUTURE as MVP-NECESSARY.
3. Require versioned contract-first preflight; one writer for shared contracts, DB schema, auth, Docker/CI, root manifests and checkpoint. No agent may write to another agent's worktree.
4. Separate code-build phase (no voluntary broad test runs between small edits) from a consolidated, obligatory validation phase after code freeze; final unit/integration/CI/security/migration/replay/Docker and independent HIGH_ASSURANCE audit remain unchanged.
5. Allow concurrency only for contract-stable, dependency-free or safely mocked foundations, not for unresolved dependencies or live-money behavior. **D-0025 / ADR-0009 is a narrowly approved successor** to this clause's blanket scheduling ban: while PH-M02 still stops after WO-001, at most PH-M04, PH-M05, PH-M07, PH-M08, PH-M09 and PH-M11 may be conditionally admitted to their *specifically reviewed pure/mock foundation WO-001 scope* once new exact-main Context Locks, full per-lane security/dependency checks, ownership proofs and admission receipts pass. PH-M03 remains prohibited until PH-M02-WO-005 is accepted AND checkpoint-promoted. Real integration paths remain blocked until their upstream dependencies are accepted. A failed upstream dependency always blocks its dependent operation.
6. Every lane retains its own Work Order, Context Lock, Evidence Bundle, PR and audit. The wave receipt records integration tests and merge ordering.
7. No implicit LIVE activation, VEX approval, checkpoint promotion or merge. PH-M02-WO-001 PR #43 was accepted and merged; the canonical `STOP_AFTER_PH_M02_WO_001` checkpoint remains intact until PH-M02's next separately accepted increment. ADR-0009 only permits independent foundation code under bounded preconditions and does not promote PH-M02 or authorize PH-M03.

## Owner approval and effectiveness gate

The Project Owner approved adoption of D-0024 in the current Codex task on 2026-10-10 UTC, conditional on maintaining all security, independent-audit, testing and dependency gates in this ADR and the canonical Work Orders. PR #57 passed the separate exact-head review at `b39a3e36bc040826a331537996ef673663954823` and was merged as `c869cd4fb0378ab1c0c850425497d08a9178552e`; therefore D-0024 is effective for scheduling. This does not admit PH-M03+ Work Orders or Context Locks. Gate G0 required PH-M02-WO-001 exact-head review, valid owner/auditor VEX dispositions with no unresolved applicable HIGH/CRITICAL findings, and accepted/merged checkpoint. These prerequisites were verified as satisfied on `main@c15ed37253c9ee7f250ba435434b17b71fa54526`: PR #43 merged `350f468789f655a6388fd2558265011a09859e65` and checkpoint PR #58 merged `c15ed37253c9ee7f250ba435434b17b71fa54526`. This enables G1 planning, NOT automatic G2 admission or implementation. Recheck VEX expiry `2026-10-15T13:00:00Z`, artifact/source drift and any new security findings before each later gate. No checkpoint state or LIVE authority changes through this approval.

## Supersedes

Only the sequential-admission *scheduling* sentence in BACKLOG.md after this ADR is approved and merged. No existing frozen Scope, DoD, Security policy, Architecture, decision D-0001..D-0023, PH-M02-WO-001 stop rule or material financial safety gate is superseded.

## Alternatives

- Sequential module-by-module: easiest context but excess prompts and idle independent work.
- Unrestricted parallel writes: rejected because shared files/dependency races and broken security gates.
- No tests until all project modules finish: rejected because unverified HIGH_ASSURANCE financial changes cannot be merged safely; consolidated tests at **wave code freeze** satisfy the intent without weakening final gates.

## Consequences

Reduced handoff overhead is a hypothesis, not a measured improvement. Inter-agent contract coordination and batch corrections may erase savings. Validate prompt/CI cost and defect rate after first successful wave; scale down concurrency if collisions or churn are high.

See .engineering/plans/PH-PARALLEL-WAVES-001.md for dependency graph, file boundaries and test cadence. **ADR-0009 / D-0025** provides the later owner-directed *conditional foundation scheduling* exception; it does not supersede frozen M02 start requirements for PH-M03.
