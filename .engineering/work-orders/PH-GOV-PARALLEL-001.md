# PH-GOV-PARALLEL-001 — Parallel module-wave governance

Status: PROPOSED / AWAITING INDEPENDENT AUDIT
Risk: LOW for planning mutation, elevated operational implications if later admitted.
Repository/base: KayzenRoot/poly-hunter main@a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c
Project at base: M01_IMPLEMENTATION_COMPLETE, LIVE false.
Stable ID: PH-GOV-PARALLEL-001

## OBJECTIVE
Reorganize existing fifteen PH-M00..PH-M14 modules into safe independent agent lanes in one execution prompt, each with its own PR and acceptance, and defer broad tests during coding until integrated code freeze.

## CONTEXT
Open PR #43 / PH-M02-WO-001 still needs exact-head independent HIGH_ASSURANCE review and VEX approval; PR #44 adds Matt Pocock guidance. Owner directed parallel execution and post-implementation consolidated tests. Source hierarchy/checkpoint/frozen decisions remain authoritative.

## SCOPE
- Create planning issues for PH-M03..PH-M14, exactly one per remaining module.
- Update BACKLOG ordering/scheduling without changing module identities/classification.
- Add ADR-0008 and proposed D-0024; document contract/folder locks, wave gates, dependency graph and test cadence.
- Reconcile CHECKPOINT.md human text with existing CHECKPOINT.json without changing machine checkpoint.
- Provide executor handoff instructions for the first eligible batch.

## OUT OF SCOPE
No product code, dependencies, CI rules, migrations, Docker/WSL/storage mutation, live signing/order placement, VEX approval, PH-M02 implementation changes, policy bypass, PR #43 merge or automatic checkpoint promotion. Do not overwrite PR #44 AGENTS.md.

## FILES/SOURCES TO READ
AGENTS.md; .engineering/SOURCE-HIERARCHY.md, CHECKPOINT.json/md, DECISIONS-LEDGER.md, BACKLOG.md, SCOPE.md, ARCHITECTURE.md, REQUIREMENTS.md, SECURITY.md, TEST-BENCHMARK-PLAN.md, DEFINITION-OF-DONE.md, TRACEABILITY.md, policies/JEV-PROMPT-POLICY.md; issues #42 and #45..#56; open PR #43/#44; prior ADRs.

## REQUIREMENTS
- Preserve 15 frozen modules M00..M14 and NECESSARY/IMPORTANT/FUTURE classification.
- Freeze dependencies and shared TypeScript contracts before parallel writes.
- One agent per module, one unique branch/worktree per agent, integration coordinator only writer to shared files.
- 7 A-wave candidates; dependency-gated; M06 in later B wave; M12 final.
- Full tests after complete lane implementations + wave freeze, no repeated broad suites during code editing. Never remove mandatory post-freeze gates.
- No module with upstream BLOCKED can be admitted; per-module Work Orders/locks/evidence/reviews required.

## ARCHITECTURE RULES
Ports/adapters, deterministic critical path, typed contracts, server-derived TenantContext, safe AI isolation, no trade authorization bypass; frozen canonical hierarchy prevails.

## CONSTRAINTS
No force-push, no altered history, no deletion of historical Docker VHDX/backup, no disabling CI/security checks, no changes to existing product/PR #43, no live trading.

## ACCEPTANCE CRITERIA
1. 12 unique planning issues #45–#56 accurately map M03–M14.
2. Existing M00/M01 completion and M02 #42/#43 remain identifiable without creating duplicate M02.
3. Plan explicitly defines dependencies, file ownership, concurrency limits, contract-first freeze and no-overlapping-writes.
4. Owner-directed test scheduling defers *voluntary broad suites* only to code freeze, preserving strict exact-head unit/integration/CI/security gates.
5. CHECKPOINT.md shared facts match CHECKPOINT.json and no production weight/progress fabricated.
6. New decision D-0024 clearly marked proposed until audited/merged; previous frozen decision unaffected.
7. A planning-only PR contains the delta and can be independently reviewed without merging PR #43.

## TESTS
Documentation/Markdown structure, all 15 IDs exactly once in canonical backlog, issue links existence, checkpoint JSON-vs-human field consistency, no product paths or contracts changed, git diff --check, PR CI checks when run. Product tests not required for documentation-only PR.

## DELIVERABLES
12 issue URLs; planning file; ADR; updated BACKLOG, DECISIONS-LEDGER, human CHECKPOINT; Evidence Bundle and planning PR; concise executor prompt.

## REVIEW FORMAT
In Portuguese (Brazil): APPROVED / CORRECTION REQUIRED / BLOCKED with exact head SHA, drift/architecture/security/scope checks, evidence, next action, and mandatory Project Progress Snapshot.

## STOP CONDITION
Stop after independent review-ready planning PR, do not self-approve/merge/promote. Do not admit M03+ while the dependent PH-M02 PR #43 is unapproved or unresolved. Do not authorize LIVE.
