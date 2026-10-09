# ADR-0008 — Dependency-aware parallel module waves

Status: PROPOSED for independent governance audit and owner merge decision
Date: 2026-10-09
Work Order: PH-GOV-PARALLEL-001
Decision request: D-0024
Scope: engineering workflow and scheduling, not new feature scope.

## Context

BACKLOG.md contains fifteen modules PH-M00..PH-M14 but its original linear order forces a separate prompt for nearly every increment. The owner wants one orchestrated Codex prompt to assign one agent per module, maximize feasible concurrency and defer broad repeated tests until all code in the wave is integrated.

## Decision proposed

1. A Work Order batch may include several non-overlapping module Work Orders after their individual dependency-path gates pass. One agent per module, one coordinator for common contracts and integration.
2. Keep stable PH-M IDs and module classifications unchanged. Do not count M10 IMPORTANT or M13/M14 FUTURE as MVP-NECESSARY.
3. Require versioned contract-first preflight; one writer for shared contracts, DB schema, auth, Docker/CI, root manifests and checkpoint. No agent may write to another agent's worktree.
4. Separate code-build phase (no voluntary broad test runs between small edits) from a consolidated, obligatory validation phase after code freeze; final unit/integration/CI/security/migration/replay/Docker and independent HIGH_ASSURANCE audit remain unchanged.
5. Allow concurrency only for contract-stable, dependency-free or safely mocked foundations, not for unresolved dependencies or live-money behavior. Fail closed when an upstream Work Order is BLOCKED.
6. Every lane retains its own Work Order, Context Lock, Evidence Bundle, PR and audit. The wave receipt records integration tests and merge ordering.
7. No implicit LIVE activation, VEX approval, checkpoint promotion or merge. Existing PH-M02-WO-001 STOP rules remain binding while that PR is open.

## Supersedes

Only the sequential-admission *scheduling* sentence in BACKLOG.md after this ADR is approved and merged. No existing frozen Scope, DoD, Security policy, Architecture, decision D-0001..D-0023, PH-M02-WO-001 stop rule or material financial safety gate is superseded.

## Alternatives

- Sequential module-by-module: easiest context but excess prompts and idle independent work.
- Unrestricted parallel writes: rejected because shared files/dependency races and broken security gates.
- No tests until all project modules finish: rejected because unverified HIGH_ASSURANCE financial changes cannot be merged safely; consolidated tests at **wave code freeze** satisfy the intent without weakening final gates.

## Consequences

Reduced handoff overhead is a hypothesis, not a measured improvement. Inter-agent contract coordination and batch corrections may erase savings. Validate prompt/CI cost and defect rate after first successful wave; scale down concurrency if collisions or churn are high.

See .engineering/plans/PH-PARALLEL-WAVES-001.md for dependency graph, file boundaries and test cadence.
