# PH-GOV-PARALLEL-001 — Module waves / multiagent orchestration

Status: G1 CONTRACTS AND G2 CANDIDATE PACK ACCEPTED VIA MERGED PR #61; D-0025/ADR-0009 CONDITIONAL FOUNDATION EXCEPTION PROPOSED; NO WAVE A LANE AUTOMATICALLY ADMITTED
Owner direction: 2026-10-09. Baseline: main@a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c.
Purpose: fewer executor prompts through safe parallel lanes, without modifying the 15 frozen PH-M00..PH-M14 modules.

## Source hierarchy and admission

Current canonical CHECKPOINT.json at main@c15ed37253c9ee7f250ba435434b17b71fa54526: `phase=M02_INCREMENT_IMPLEMENTED`, `stopState=STOP_AFTER_PH_M02_WO_001`, `completedThroughModule=PH-M01`, `nextLegalStage=AWAIT_OWNER_DIRECTION`, `liveTradingAuthorized=false`. PR #43 accepted/merged in governance as `350f468789f655a6388fd2558265011a09859e65`; checkpoint promotion PR #58 merged as `c15ed37253c9ee7f250ba435434b17b71fa54526`. The exact image PostgreSQL VEX approvals are current for documented local-development runtime only, expiring `2026-10-15T13:00:00Z`; fresh Docker store stack has healthy historical receipt while old VHDX/PGDATA remains preserved and unavailable. PH-M02 overall and PH-M02-WO-002 remain incomplete/not admitted. PR #44 AGENTS.md remains separate. G0 conditions below have been met at this exact source baseline; G1 typed-contract freeze and G2 per-lane Work Order/Context Lock admission are still required. Coordination issue #59 owns G1/G2 preparation.
Gate G0: PR #43 must pass exact-head independent review, owner-required VEX decisions, contain no unresolved HIGH/CRITICAL findings, have its M02 checkpoint accepted and be merged. Until every G0 condition passes, no PH-M03+ execution Work Order or Context Lock may be admitted, including pure/mock lanes. Tracking issues and non-binding planning may continue, but do not authorize contract freeze or implementation. No product increment can bypass an unresolved blocker in its dependency path.
Gate G1: freeze versioned typed contracts and file ownership at a single exact base SHA. Validate compatibility with M02 current branch once accepted; recompile stale locks on any source/ADR/checkpoint change. An orchestrator locks shared files.
Gate G2: seven versioned source-bound WO/Context Lock/checklist/evidence candidates were accepted as a **non-executing pack** in PR #61 (merge `117fcd1887cfaf350f276a1fd3ec201865073c14`). They are STALE after merge, requiring exact-current-main fingerprint recompilation. If ADR-0009/D-0025 is accepted, six named pure/mock lanes M04/M05/M07/M08/M09/M11 may be conditionally admitted and implemented as foundations in one Codex prompt **only when** all separate per-lane preflight checks, deterministic lock validation, dependency proofs and immutable admission receipts pass. M03 remains NOT_ADMITTED until M02-WO-005 checkpoint promotion. PH-M02-WO-002 may proceed in its own separate HIGH_ASSURANCE module lane, with an independently admitted Work Order/lock. Verify current multiagent capability rather than assuming more than the three observed lane slots plus coordinator. Without capacity, queue distinct agents in safe isolated batches, not shared checkout.
Gate G2.5 / D-0025 (if independently accepted and merged): executor must record each pre-dispatch module admission proof against the exact current main, refreshed source/contract hash sets, distinct worktree ownership and VEX freshness. Never auto-admit M03. An affected lane failing its gate stays idle while eligible lanes proceed. See ADR-0009.\nGate G3: integration and a single consolidated wave test campaign after code freeze. Green CI alone never replaces independent HIGH_ASSURANCE audit, evidence and checkpoint gates.
Gate G4: independently review every lane (risk-based) plus integrated wave. Merge approved module PRs in dependency order, rebase/retarget and revalidate changed heads, then promote checkpoint only after objective approval. No auto-merge where an existing WO prohibits it.

## Dependency graph (runtime)

PH-M00 -> PH-M01 -> PH-M02(public read-only) -> PH-M03 -> PH-M04 strategy integration.
PH-M04 StrategyProposal -> PH-M05 RiskDecision -> PH-M06 order/reconciliation/journal.
PH-M02 authenticated order capability + geo/eligibility + PH-M05 -> PH-M06 (LIVE disabled).
PH-M03/04/05/06 -> PH-M07 end-to-end replay/paper. PH-M07 simulator foundation can be built independently from versioned contract/fake inputs.
PH-M01 + read-only DTO contracts -> PH-M08 user UI and PH-M09 admin UI shells (without privileged mutations).
PH-M09 kill-switch commands + PH-M05 risk + PH-M06 execution require gated integration later.
PH-M11 telemetry base can start independently; deployment/recovery acceptance requires integrated stack.
PH-M10 is IMPORTANT, not MVP. PH-M13/M14 are FUTURE. PH-M12 is final independent acceptance, never a normal wave.

## Planned lanes (contract-first; not implementation admission)

| Wave | Issue | Lane | Pure/shell foundation candidate | Integration gate |
|---|---|---|---|---|
| A | #45 M03 | Scanner | normalized book read models, staleness policies | Accepted M02 public provider |
| A | #46 M04 | Strategy | deterministic proposal logic on injected snapshots | accepted snapshot + risk contracts |
| A | #47 M05 | Risk | fail-closed pure policy engine | accepted proposal + exposure schemas |
| A | #49 M07 | Replay/Paper | fake clock, conservative simulated fills | merge M03/M04/M05/M06 for end-to-end proof |
| A | #50 M08 | User UI | tenant shell with typed mock/disabled actions | read-only APIs + security review |
| A | #51 M09 | Admin UI | privileged shell with disabled kill controls | M05/M06 kill path contract + RBAC audit |
| A | #53 M11 | Observability | redacted telemetry, diagnostic scaffold | integrated lifecycle/runbooks |
| B | #48 M06 | Execution | no live mutations | M02 authenticated, M05 accepted, M01 DB |
| FINAL | #54 M12 | Live acceptance | evidence/go-no-go only | all NECESSARY systems accepted |

Following D-0025/ADR-0009 governance merge, the maximum eligible **foundation** batch while M02 STOP is active is the six module lanes M04/M05/M07/M08/M09/M11, plus distinct ongoing PH-M02-WO-002 as a seventh module identity (not a Wave A lane). M03's issue #45 remains preplanned, never coded before WO-005 promotion. After M02-WO-005 promotion, M03 joins and can be scheduled with its dedicated agent. Runtime measured capacity was three subagents concurrently + coordinator, so maintain one agent/worktree per assigned module and roll batches; do NOT imply eight simultaneous active agents or invent a bypass. Coordination agents do not become new modules.

## Contract freeze / one writer per shared path

Freeze (as applicable) prior to lane writes:
- MarketSnapshot, BookLevel, BookStaleness, ProviderHealth, MarketFilter
- StrategyProposal, StrategyContext, FeeModel, RiskDecision, RiskLimits, ExposureSnapshot
- ExecutionIntent, OrderState, ReconciliationResult, JournalEvent, KillSwitchCommand
- ReplayTick, PaperFill, ReplayClock
- UserDashboardDTO, AdminHealthDTO, ObservabilityEvent

Shared contract and ownership coordinator is the only writer to:
`packages/contracts/**`, `packages/db/**` schema/migrations, `package.json`, `package-lock.json`, `tsconfig*.json`, `AGENTS.md`, `.github/**`, `Dockerfile.dev`, `compose.yaml`, source policies and CHECKPOINT.
Other agents may read these but must submit proposed changes to coordinator. Each lane owns a non-overlapping directory and may not touch another lane's paths; coordinator resolves interfaces and package composition in integration branch. Record actual ownership matrix after repository preflight; candidates in issue cards are not permission to invent directory layout.

Never share a mutable worktree between writing agents. Store branch + base/head SHA + changed paths + contract fingerprint + evidence for each lane. A lane with unknown/changed source gets STALE and cannot be merged without rebase + retest.

## Testing cadence: code-first, wave-wide validation

Owner intent: implement a complete admitted module/lane without running the full test suite after every small edit. In a batch:
1. Before changes: exact base, dependency/branch/secret/safety checks; no bypass of HIGH/CRITICAL blocks. Static, non-executing source inspections allowed.
2. Code phase: complete each lane in isolation; do not run repeated broad unit/integration suites while writing. Do not modify shared safety-sensitive paths without planned gate. Collect compile concerns as known risks rather than assuming success.
3. Freeze: every lane commits with declared paths, contracts and deliverables; merge candidate only into disposable integration branch.
4. Consolidated validation (once per frozen wave candidate, then re-run only failed/impacted scopes after fixes): unit, lint, format, typecheck, build, integration, PostgreSQL migrations and tenant isolation if touched, replay/paper property/fault checks if applicable, security/VEX scans, Docker Compose web+worker+PostgreSQL runtime, contract integrity, regression and CI.
5. Failure: assign correction to the owning lane; rebase/reintegrate and rerun affected suites + final clean integrated validation. No skipping mandatory exact-head safety checks. No completion or merge before all DoD gates pass.
6. HIGH_ASSURANCE risk/signing/secret/live paths additionally require independent reviewer, proof obligations, recovery/rollback and explicit owner/VEX acceptance where applicable.

Do not disable CI, protections or code security checks to reduce prompts. Automated CI may execute on pushed branches/PRs. This policy delays voluntary broad test invocations during coding but never suppresses mandatory final quality gates.

## Reporting/evidence

One orchestration prompt may contain multiple stable-ID Work Orders. Each module gets own Evidence Bundle/PR/Context Lock and independent verdict. Integrated wave gets a synthetic batch receipt linking each branch head, contract hash, cumulative tests, security scans, Docker and migration receipts, integration diff and dependency order. No module self-approves. Reviews in pt-BR. Include REVIEW-PROGRESS-REPORTING.md snapshot and estimate count of prompts *per wave*, not one prompt per module.

## Current blockers and stop rules

- PR #43 accepted and merged; maintain exact-digest VEX revalidation, security checks and no direct/implicit LIVE authorization.
- Do not alter the previous historical Docker VHDX or databases; fresh empty volumes remain separate and historic storage remains untouched.
- If #43 is still BLOCKED/CORRECTION REQUIRED, do not admit or execute dependent modules; report the specific dependency path and correction delta.
- PR #57, #58 and #61 are merged. G1 freeze and G2 candidate scopes are accepted, but PR #61 exact source candidate locks MUST be regenerated for the current merged main. Under a merged D-0025/ADR-0009, only M04/M05/M07/M08/M09/M11 foundations receive *standing conditional scope approval*, never automatic admission. A per-lane hash/security/ownership/dependency receipt is required before any agent code write. M03 remains blocked until PH-M02-WO-005 checkpoint promotion, and production integrations remain blocked by unfinished dependency paths.
