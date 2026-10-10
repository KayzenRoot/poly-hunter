# ADR-0009 — Conditional parallel foundations during the PH-M02 stop

Status: **OWNER-DIRECTED WITH CONDITIONS / EFFECTIVE ONLY AFTER EXACT-HEAD GOVERNANCE ACCEPTANCE AND MERGE**
Date: 2026-10-10
Decision: D-0025 (owner direction: maximize independently owned module development in the next local Codex Desktop orchestration, delegate GitHub governance to ChatGPT, do not relax safety)
Supersedes: only the **blanket scheduling prohibition** on independent PH-M03+ *foundations* in ADR-0008 §5 and its related planning text; never the PH-M03 prerequisite or any existing module, work-order security/integration gate.

## Reason and bounded authority

The owner explicitly requested maximum feasible distinct module agents in the next execution prompt. PR #61 was governance-accepted and merged as `117fcd1887cfaf350f276a1fd3ec201865073c14`, freezing G1 contracts and seven candidate G2 lane scopes. The current machine checkpoint still reads `M02_INCREMENT_IMPLEMENTED / STOP_AFTER_PH_M02_WO_001 / completedThroughModule=PH-M01 / liveTradingAuthorized=false`.

The stop after WO-001 remains binding for additional **PH-M02** increments: WO-002 through WO-005 must follow their separately admitted HIGH_ASSURANCE order. It does not imply every downstream *independent, simulated or mock-only foundation* must sit idle. The blanket scheduling sentence can be narrowly amended without authorizing real trading or pretending M02 is complete.

## Standing, CONDITIONAL owner-governance admission for six foundations

Only these exact `WO-001` candidates from merged PR #61 may be individually admitted to **isolated foundation-only code execution** while the M02 checkpoint STOP remains in place:

| Module / tracker | Permitted bounded implementation only | Prohibited dependencies and claims |
|---|---|---|
| PH-M04 / #46 | Deterministic strategy proposal functions using injected `MarketSnapshot` / fake clock / explicit `FeeModel` | No live market subscription, orders, profitability guarantees, M03 integration, signing |
| PH-M05 / #47 | Pure simulation-only, fail-closed risk evaluation and breakers with fixtures | No execution authorization, position DB writes, real-money risk authority; HIGH_ASSURANCE independent review |
| PH-M07 / #49 | Deterministic replay and conservative paper-fill foundation over injected fixtures | No real fills, authenticated trading, end-to-end M06 acceptance |
| PH-M08 / #50 | Tenant dashboard with visibly mock/unavailable/disabled data and controls | No real tenant data, auth/session changes, real orders, operational LIVE controls |
| PH-M09 / #51 | Admin diagnostic shell with inert `NO_OP` kill-switch placeholder | No privileged API, real kill mutations, RBAC bypass; HIGH_ASSURANCE independent review |
| PH-M11 / #53 | Redacted bounded in-process diagnostics/telemetry foundation | No production deployment, raw identifiers/secret logs, worker wiring or infrastructure changes |

The owner's requested parallelism constitutes advance **scope/scheduling direction** for these six, and the merged G1/G2 pack supplies already-reviewed candidate plans. This standing authorization is **conditional**, not a blanket admission, and is **not itself the evidence of a gate passing**. For EACH lane the coordinator must prove and persist, *before dispatching a coding agent*:

1. Exact accepted main SHA after this ADR merge, versioned G1 contract fingerprint and refreshed original Work Order/Context Lock/frozen-source/runtime hash sets. Old PR #61 Context Locks are never executable; regenerate all seven candidate locks under their existing stable IDs. Validate the candidate pack on the new baseline, with focused negative tamper cases. The coordinator is sole editor of shared contracts and governance files.
2. Exact lane path ownership with no overlap and one isolated worktree/branch per lane; no changes to packages/contracts, root manifests, DB/auth, CI/Docker, secrets, VEX, policies or CHECKPOINT from lane agents. A necessary shared-path change is a coordinator-mediated correction and contract re-freeze before more writing.
3. Per-lane dependency-path proof: accepted PH-M01 infrastructure/G1 data types are sufficient for pure/mock scope; any real integration blocked by unfinished M02/M03/M05/M06 stays **UNADMITTED**, even when foundation code is permitted.
4. Fresh security/KEV/EPSS findings review and exact-local-artifact PostgreSQL VEX validity, expiring `2026-10-15T13:00:00Z`. Expired/changed digest/runtime/exposure/advisory blocks affected operations until re-evaluated. No copying a VEX approval to new images or production.
5. Committed per-lane admission receipt referencing this exact accepted governance decision, the compiled locks, immutable source SHA, dependency proof, identity of assigned agent/reviewer, and `liveTradingAuthorized=false`. If receipt/preflight fails, do not dispatch that lane. Do not claim six admissions if only fewer passed.

After those five machine-checkable conditions pass, the coordinator may perform the **narrow preauthorized foundation implementation** in the same Codex Desktop prompt without another round-trip solely for redundant scheduling approval. This does not authorize its own merge, checkpoint promotion, security disposition, or future integration release. Final independent review, CI, per-lane owner/security controls and ChatGPT governance acceptance remain mandatory.

## PH-M03 explicitly EXCLUDED

PH-M03 / issue #45 remains `CANDIDATE_NOT_ADMITTED`. The frozen `.engineering/modules/PH-M02-POLYMARKET-INTEGRATION.md` explicitly prohibits starting PH-M03 until **PH-M02-WO-005 has passed independent HIGH_ASSURANCE review, been accepted and checkpoint-promoted**. No M03 agent may write product code before that event, even for mock/fixture-only logic; it may only read and prepare its plan. Neither this ADR nor G1 completion repeals that frozen requirement.

## PH-M02 progressing alongside eligible foundations

A separate seventh **module identity** is PH-M02 itself: prepare/execute `PH-M02-WO-002` geographic eligibility as a distinct HIGH_ASSURANCE executor lane, with separate worktree, Work Order, Context Lock, exact-head evidence, independent review and owner-governance acceptance. It must be admitted under the PH-M02 module sequence and must NOT touch any foundation lane paths.

WO-003 signing/capabilities, WO-004 authenticated/order adapter and WO-005 final acceptance stay **sequential PH-M02 gates**; do not combine, auto-admit, auto-merge, use real credentials or perform real order mutations in the parallel coding batch. Codex may prepare their next-step planning documents, not claim their completion.

## Parallel capacity and tests

Use **one distinct module agent/worktree per admitted module**, plus a coordinator, subject to actual local Codex agent/worktree availability. PR #61 established three simultaneous read-only agents + one coordinator in that environment; no claim of seven simultaneous slots exists. Maximize actual concurrent slots, then roll over queued, individually isolated agents. Never share a mutable checkout or assign more than one writer to a shared path.

During implementation run focused deterministic lane tests; at code freeze run consolidated integration, replay, security and exact-head CI, with affected-scope corrections. EVERY lane gets separate evidence/PR and independent review; M05/M09/M02-WO-002 are HIGH_ASSURANCE. No unconditional automated merge or checkpoint promotion by Codex.

## Non-negotiable invariants

- Exactly 15 frozen modules PH-M00..PH-M14; scope and MVP classes unchanged.
- `liveTradingAuthorized=false`; risk allow is **simulation_only**, not trade permission; no credentials, signing, authenticated order submissions/cancels, geoblock bypass or live order mutations.
- Preserve ALL historical Docker VHDX, backups, volumes and old PGDATA. New authorized local Docker stack remains separate.
- No security VEX self-approval, no gate suppression, no skip of individual review/DoD.
- Preserve canonical checkpoint until each future incremental governance promotion is separately accepted.
- Uncertain or blocked lane remains isolated and may not contaminate ready lanes.

## Stop condition

`D0025_FOUNDATION_EXCEPTION_EFFECTIVE` only once this ADR and matching ledger/ADR-0008/parallel plan text pass exact-head CI, documented governance review and merge. Then the next Codex prompt can reconcile candidate fingerprints and **conditionally dispatch only eligible lanes**, not PH-M03. A later change to frozen M02 requirements requires a separate, explicitly approved source/authority decision.
