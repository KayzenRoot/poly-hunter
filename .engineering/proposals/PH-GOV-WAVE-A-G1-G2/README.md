# PH-GOV-WAVE-A-G1-G2 — Governance candidate pack

Status: **PROPOSED / NOT ADMITTED / NOT AN IMPLEMENTATION AUTHORIZATION**
Canonical source baseline: `main@85489b2d5f7745e9e4dd81495cda41dcaba1090e`
Governance tracker: [issue #59](https://github.com/KayzenRoot/poly-hunter/issues/59)

This pack contains the additive G1 Wave A TypeScript contracts, ownership rules, one execution plan, and exactly seven candidate G2 Work Orders, Context Locks, acceptance checklists, and evidence templates for the existing PH-M03, PH-M04, PH-M05, PH-M07, PH-M08, PH-M09, and PH-M11 modules. It does not add a module or start product implementation.

Every Work Order and Context Lock here is **CANDIDATE / NOT ADMITTED**. The Context Locks are intentionally tied to the source baseline above and must be recompiled against the accepted governance merge head before any execution admission. A stale candidate cannot authorize work.

## Current gates

- G0 prerequisites in the user request are reflected in merged main at `85489b2d5f7745e9e4dd81495cda41dcaba1090e`.
- G1 and G2 are proposals for governance review; this pack does not accept itself or promote the checkpoint.
- The current checkpoint remains `M02_INCREMENT_IMPLEMENTED`, `STOP_AFTER_PH_M02_WO_001`, `completedThroughModule=PH-M01`, with no active/prepared Work Order and `liveTradingAuthorized=false`.
- ADR-0008 §5 bars admission of any PH-M03+ Work Order/Context Lock while the PH-M02-WO-001 STOP remains active. The frozen PH-M02 module plan separately says not to start PH-M03 until PH-M02-WO-005 is promoted. The repository has no such promotion in the current checkpoint. Planning may proceed; all seven execution lanes remain unadmitted. The planning/governance authority must reconcile the stop before G2 admission.
- PostgreSQL VEX approval is bound only to digest `sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744`, its documented local-development runtime, and expiry `2026-10-15T13:00:00Z`. It is not transferable. Each future execution must revalidate if expired or if the digest, assessed runtime, component, advisory/KEV evidence, or relevant configuration changes.
- The latest checked CISA KEV catalog is newer than the repository snapshot; none of the 24 in-scope PostgreSQL CVEs was listed in that catalog. EPSS data is prioritization only. Before G2 admission, refresh the bounded source receipts and reconcile any item-level delta; do not reopen accepted CR-07 exploitability findings unless that refresh changes relevant evidence.

## Contents

- `G1-CONTRACT-FREEZE.md` — version 1 additive shared contract inventory and semantic boundaries.
- `OWNERSHIP-MATRIX.md` — coordinator-only shared files and seven disjoint lane-owned trees.
- `EXECUTION-PLAN.md` — verified multiagent capacity, isolated worktree approach, gates, sequencing, and validation cadence.
- `work-orders/` — exactly seven candidate Work Orders.
- `context-locks/` — exactly seven source-bound candidate Context Locks.
- `acceptance/` — one deterministic checklist per lane.
- `evidence-templates/` — one blank evidence template per lane.
- `.engineering/evidence/PH-GOV-WAVE-A-G1-G2-EVIDENCE.md` — preparation receipts and validation results.

## Checkpoint disposition

No canonical checkpoint delta is proposed by this preparation PR. `CHECKPOINT.md` and `CHECKPOINT.json` remain untouched and unchanged. A future checkpoint proposal may only be prepared after an admitted lane passes its own Work Order, exact-head CI, independent audit, dependency gates, and required owner/governance approval.
