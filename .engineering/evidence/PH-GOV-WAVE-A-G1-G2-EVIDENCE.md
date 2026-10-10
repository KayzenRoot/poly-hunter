# PH-GOV-WAVE-A-G1-G2 Evidence Bundle

Status: **PREPARED FOR GOVERNANCE REVIEW — NOT ADMITTED FOR IMPLEMENTATION**
Repository: `KayzenRoot/poly-hunter`
Source baseline: `main@85489b2d5f7745e9e4dd81495cda41dcaba1090e`
Governance tracker: [issue #59](https://github.com/KayzenRoot/poly-hunter/issues/59)
Candidate pack: `.engineering/proposals/PH-GOV-WAVE-A-G1-G2/`

The dedicated planning PR description records the committed head SHA, exact-head GitHub Actions run, and independent reviewer verdict. This bundle avoids a self-referential head/hash field; its content and all pack artifacts are in the PR diff. No module implementation has started.

## 1. Source preflight

- Fetched `origin/main` before preparation and again before finalization. Both the checkout base and `origin/main` were `85489b2d5f7745e9e4dd81495cda41dcaba1090e`; there was no baseline drift to reconcile.
- PR #43, PR #58, and PR #60 are represented in the merged baseline. PR #60 is the G0 source reconciliation at the requested baseline.
- Current checkpoint is unchanged: `phase=M02_INCREMENT_IMPLEMENTED`, `stopState=STOP_AFTER_PH_M02_WO_001`, `completedThroughModule=PH-M01`, `activeWorkOrder=NONE`, `preparedWorkOrder=NONE`, `nextLegalStage=AWAIT_OWNER_DIRECTION`, `liveTradingAuthorized=false`.
- The Backlog still contains the same 15 module IDs PH-M00 through PH-M14. The seven requested issue cards map to existing NECESSARY modules M03/M04/M05/M07/M08/M09/M11. No module was created, renamed, split, reclassified, or removed.
- Read the source hierarchy, checkpoint views, decisions ledger, ADR-0007, ADR-0008, parallel-wave plan, frozen M02 module plan, Scope, Requirements, Architecture, API/Integration Contracts, Data Model, Security, Test Plan, DoD, Traceability, JEV policy, progress reporting, relevant package manifests and source contracts, and representative Work Orders/Context Locks.
- Current repo issue cards #45/#46/#47/#49/#50/#51/#53 remain open and explicitly `PLANNED / NOT ADMITTED / NO IMPLEMENTATION AUTHORIZED`.

## 2. G1 contracts and ownership

- Added the additive, version 1 provider-neutral contract source `packages/contracts/src/wave-a.ts` and exported it from the existing contracts barrel. Existing M02 provider types and source files were not redefined.
- Added a focused compile/runtime contract test. The new command placeholder is literally `NO_OP`, unavailable, and cannot execute. `RiskDecision.scope` is the literal `simulation_only`; user dashboard DTO fixes LIVE authorization to false; observability DTO has no arbitrary message or payload field.
- Independent review initially found two G1 contract gaps. Before publication, `BookStaleness` was made a discriminated union so missing observations are only `unknown`, and risk decisions were bound to a non-empty closed `RiskDecisionReasonCode` catalog. Compile-time negative assertions cover missing fresh/stale timestamps and arbitrary reason strings; the catalog also has a focused runtime assertion.
- Deferred M06-only order/execution/reconciliation/journal types because no Wave A lane consumes them and M06 has no admitted Work Order. The exact type inventory and intentionally unfrozen semantics are recorded in `G1-CONTRACT-FREEZE.md`.
- The coordinator-only path set and seven mutually exclusive lane ownership sets are in `OWNERSHIP-MATRIX.md`. Lane source/test paths are proposed subtrees under existing workspaces; shared manifests, exports, DB/auth, app/worker entrypoints, Docker/CI, policies, and checkpoint belong to the coordinator.

## 3. G2 candidate batch

Exactly seven candidate Work Orders, seven candidate Context Locks, seven acceptance checklists, and seven evidence templates exist, one each for M03/M04/M05/M07/M08/M09/M11. Every lock:

- names the same exact base SHA `85489b2d5f7745e9e4dd81495cda41dcaba1090e` and required merge base;
- follows the repository Git-blob SHA fingerprint convention and includes SHA-256 fingerprints for frozen canonical sources, package/runtime files, shared contract source, and G1 planning artifacts;
- records `CANDIDATE_NOT_ADMITTED`, `executionAuthorized=false`, `liveTradingAuthorized=false`, and `recompileAfterGovernanceMerge=true`;
- freezes the Work Order, contract, source and package fingerprints; and
- retains lane-specific dependency, security, focused test, independent review, and stop gates.

The versioned `SHA256SUMS.json` manifest has 37 entries, excluding itself and this external Evidence Bundle. `validate-candidate-pack.mjs` verifies exact batch counts, all source/contract/Work Order hashes, mutually exclusive ownership roots, the VEX boundary, and every manifest entry. No Work Order/Context Lock is admitted by this PR.

## 4. Normative stop and dependency gates

G0 planning prerequisites are satisfied at the requested baseline. G1/G2 are only proposed for governance acceptance. A further execution gate remains active and is explicitly preserved:

- ADR-0008 §5 says no PH-M03+ Work Order or Context Lock may be admitted while the PH-M02-WO-001 STOP is active.
- The frozen `.engineering/modules/PH-M02-POLYMARKET-INTEGRATION.md` specifically says not to start PH-M03 until PH-M02-WO-005 is promoted. The current checkpoint contains no WO-005 promotion.
- Therefore all seven module lanes remain unadmitted until planning/governance authority reconciles the active M02 stop. M03 additionally requires the specific WO-005 promotion. This planning PR does not resolve or bypass those gates.
- M07 can only claim standalone replay/paper foundation in Wave A; end-to-end acceptance waits on M03/M04/M05 and M06. M09 has no executable kill switch. M11 is telemetry foundation only, not deployment/recovery acceptance.

## 5. Security/VEX boundary

- `liveTradingAuthorized=false`; no signing, authenticated order, trading mutation, credentials, or LIVE trading was added.
- PostgreSQL VEX evidence remains tied only to manifest digest `sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744`, config digest `sha256:6cfbc1caf64a3c8a85c062ca25eec78a2db1b0edbdca55906ce3d0d376e23e93`, and documented local-development runtime. The 24 raw HIGH/CRITICAL occurrences remain visible and unsuppressed; their 24 exact-runtime proposals have independent audit and conditional owner approval. Expiry is `2026-10-15T13:00:00Z`. No approval transfers to another image or runtime.
- The separately scanned current development image digest is `sha256:6a6c3d9dda7cd7c5d392d34cf28b00034909b4cae14af364a016aae46d7604e2`; its CVE-2026-85091 FIXED state applies only to that digest. Historical Debian image proposals remain separate and unchanged.
- A bounded read-only freshness check saved raw CISA/FIRST receipts under the candidate pack. CISA KEV catalog 2026.10.08 had zero overlap with the 24 PostgreSQL CVEs; FIRST returned all 24 EPSS rows dated 2026-10-09. EPSS remains prioritization-only. The existing exploitability/VEX investigations were not reopened. Context Locks require another bounded source refresh and item-level reconciliation before any future admission.
- No Docker rebuild, rescan, stack change, volume access, VHDX/backup/PGDATA modification, or migration was needed for this contract/governance-only preparation.

## 6. Multiagent capability and plan

The current Codex Desktop session successfully ran three read-only agents concurrently with the coordinator (four total active slots). The managed-worktree capability is available. This verifies real bounded parallel support, not seven concurrent workers. The execution plan caps current concurrency at three lane agents plus coordinator, creates one isolated worktree per module at the accepted exact SHA, queues remaining lanes, and provides a sequential isolated fallback if capacity/worktrees are unavailable. No feature agents or lane worktrees were started for this task.

## 7. JEV receipts

TypeSafe JEV MCP 1.13.0 was used for screened planning inputs and bounded judgments. Exact calls/results are recorded in `receipts/jev-decisions-20261010.md`. The successful verification batch confirmed five claims against Git/checkpoint/M02/owner receipt evidence; comparison left the M03-start relation for review, so deterministic normative sources controlled; the narrow contract choice advisory selected the issue-#59 Wave A set plus inert kill placeholder. The final patch gate returned `escalate` with low-confidence test-gap scoring; deterministic checks and the independent review control, and JEV had no authority to approve VEX, admit work, or override repository source hierarchy.

## 8. Validation performed

| Check | Result | Notes |
|---|---|---|
| `npm ci` | PASS | 159 packages installed, 0 vulnerabilities. npm reported four pending install-script approvals for esbuild packages and two deprecated `@esbuild-kit` packages; existing lock/manifests were not changed. |
| `npm run validate` | PASS (exit 0) | Includes lint, format, typecheck, 240 unit tests, workspace builds, Next.js build, and `npm audit --audit-level=high` with 0 vulnerabilities. Lint emitted one informational `noUselessContinue` notice in the untouched baseline file `packages/db/tests/m01-acceptance.integration.test.ts:945`; it was not changed. |
| `node .engineering/proposals/PH-GOV-WAVE-A-G1-G2/validate-candidate-pack.mjs --write-manifest` | PASS | Wrote the 37-entry SHA-256 manifest after candidate artifacts were finalized. |
| `node .engineering/proposals/PH-GOV-WAVE-A-G1-G2/validate-candidate-pack.mjs` | PASS | Exact seven-lane count, hashes, VEX boundary, and ownership/manifest checks passed. |
| `git diff --check` | PASS | No whitespace errors. |
| GitHub Actions Validate on final head | See dedicated PR | The PR description records the final exact commit and run result. |
| Independent review | **APPROVED** for the corrected G1/G2 candidate diff at source baseline `85489b2d5f7745e9e4dd81495cda41dcaba1090e`; reviewer was separate from the implementation author. | No material findings remain in the candidate diff. This patch review does not equal governance acceptance or a required GitHub PR review. |

No database, integration, Docker, container scan, or VEX re-investigation was run: the changes do not touch those inputs or runtime artifacts. The future consolidated batch campaign and changed-scope retests are fully specified in `EXECUTION-PLAN.md`.

## 9. Checkpoint

No checkpoint delta is proposed. `.engineering/CHECKPOINT.md` and `.engineering/CHECKPOINT.json` are unchanged. This PR requests governance review only; it does not merge, admit a module, promote a checkpoint, or start implementation.

## 10. PR #61 integrity correction — review 5479421095

- Corrected `validate-candidate-pack.mjs` to require exactly the six candidate artifact labels and their stem-bound canonical paths per each of the seven Context Locks. Work Order and shared contract bindings are exact as well.
- Frozen-source and runtime Git fingerprint sets now match independently declared canonical path sets; companion SHA-256 maps must contain the same complete key sets. Duplicate JSON keys, malformed hashes, path substitution/traversal, symbolic-link inputs, and unsafe manifest entries fail closed.
- Candidate-lock and artifact validation completes before manifest handling. `--write-manifest` writes only after all gates pass and uses a temporary file plus atomic rename; failed validation leaves the existing manifest untouched.
- Added `tests/wave-a-validator.test.ts` using temporary isolated fixtures. Thirteen malformed/incomplete variants are each exercised in normal and `--write-manifest` modes, including changed frozen-source/runtime SHA-256 values, with the fixture sentinel manifest checked byte-for-byte after every rejection and the repository manifest checked unchanged.
- Focused correction checks: `node --check .engineering/proposals/PH-GOV-WAVE-A-G1-G2/validate-candidate-pack.mjs` PASS; validator `--write-manifest` PASS (37 entries); normal validator PASS; `npm exec vitest run tests/wave-a-validator.test.ts` PASS (1 test); `npm run typecheck` PASS; `npm exec biome lint tests/wave-a-validator.test.ts` PASS; `git diff --check` PASS. Exact-head GitHub Actions, independent correction review and CodeRabbit re-review are recorded in the PR description after completion.
- TypeSafe JEV MCP 1.13.0 reviewed the bounded patch and returned `escalate` with low-confidence safe-to-apply/test-gap assessments. This is advisory; deterministic checks and the independent correction review control. JEV did not approve governance, execution, VEX, or checkpoint state.
- Scope remains preparation only: all seven lanes remain `CANDIDATE_NOT_ADMITTED`; no module implementation, checkpoint edit/promotion, Docker rebuild, VEX change, or security re-investigation occurred. The PH-M02 STOP remains active, and the frozen PH-M03 dependency on PH-M02-WO-005 promotion remains explicit.
