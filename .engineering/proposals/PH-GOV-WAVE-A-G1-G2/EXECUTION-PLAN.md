# Wave A one-prompt Codex Desktop orchestration proposal

Status: **PROPOSED / NOT AN EXECUTION AUTHORIZATION**
Candidate lanes: exactly #45/M03, #46/M04, #47/M05, #49/M07, #50/M08, #51/M09, #53/M11.

## Capability verified in this task

The current Codex Desktop session exposes agent dispatch/status tools and allowed three read-only subagents to run concurrently with the coordinator (four total active slots including the primary). A managed-worktree creation capability is also present. This demonstrates actual bounded parallel support, not seven-way concurrency. Capacity is environment-specific: at execution time, check current slots, memory, repository state, and worktree creation before dispatch. The safe plan supports at most **three concurrent lane agents plus the coordinator** in the current observed capacity; queue remaining lanes in conflict-free batches.

No implementation agent or feature worktree was started for this governance preparation. At future execution, create exactly one isolated managed worktree/branch per module from the one admitted SHA. Never share a mutable worktree between agents. If worktree creation or agent dispatch is unavailable, keep the same ownership/gates and execute the lanes sequentially in one coordinator prompt; do not let agents write concurrently to the same checkout.

## Admission barrier — must pass before dispatch

1. Governance accepts and merges G1/G2; all seven Work Orders/Context Locks are recompiled against the resulting exact `main` SHA. Old candidate locks from this PR are stale after merge.
2. Planning authority resolves ADR-0008 §5's PH-M02-WO-001 STOP gate. The checkpoint currently stops after WO-001, not M02 completion. M03 additionally remains blocked until PH-M02-WO-005 is promoted per the frozen M02 module plan. No PH-M03+ implementation may start while these gates remain unresolved.
3. Refresh the exact KEV/EPSS source receipts before admission; reconcile item-level changes. Check PostgreSQL VEX exact digest, local runtime, component/config drift, new findings, and the `2026-10-15T13:00:00Z` owner-approval expiry. No VEX status may transfer to another digest or environment.
4. Confirm all 15 frozen module IDs/classifications still match the baseline, issue cards remain open/not admitted, and no new blocking finding exists on each dependency path.
5. Confirm every lane has its own assigned agent, branch, worktree, candidate lock, and independent reviewer. M05 and M09 require HIGH_ASSURANCE review; M07 fill-model claims require independent review. No author self-approval.

If any item fails, do not dispatch the affected lane. Preserve the stop state and report the precise gate.

## One Codex execution prompt after admission

The future coordinator prompt should: validate the seven exact locks, create seven distinct managed worktrees at the admitted SHA, dispatch only the number of lane agents supported by current capacity, and maintain one immutable path manifest per lane. The coordinator owns shared files and final integration. No lane agent may write into another lane's worktree or alter shared contracts, root manifests, DB/auth, Docker/CI, policies, or checkpoint.

### Rolling dispatch for current four-slot capacity

After all upstream gates are cleared, use three worker slots at a time. The order is dependency-aware, not an assertion that every lane can be integrated at once:

1. **Batch A:** M03, M04, M05. M03 consumes only the accepted M02 public read adapter; M04 and M05 remain deterministic/injected. M03 is not dispatchable until its specific WO-005 promotion gate clears.
2. **Batch B:** M07, M08, M09. M07 builds standalone replay/paper foundations against versioned fixtures; M08/M09 build mock/disabled shells. M07 end-to-end acceptance still waits for M06, which is outside this Wave A batch. M09 kill controls remain non-operational.
3. **Batch C:** M11 foundation. Production deployment, recovery, and integrated operational acceptance remain future PH-M11 scope.

If current capacity is lower, reduce each batch size without changing branch isolation. If it is higher, retain the file ownership and dependency gates; do not use extra capacity to start blocked dependencies.

## Code freeze and integration

- Lane work is completed on individual branches with declared changed paths, tests, evidence, exact HEAD, and checkpoint delta proposal. No branch may claim another lane's integration.
- Coordinator verifies path ownership and merges candidates serially into a disposable integration branch in this order: M03 (after WO-005 gate), M04, M05; then M07 foundation. M08 and M09 shell PRs may integrate after their own M01/read-only auth review. M11 foundation integrates independently. Full M07 end-to-end proof remains blocked until PH-M06 is separately admitted and accepted.
- Merge ordering does not imply merge approval. Every lane retains its own exact-head independent verdict and required owner gates.
- No checkpoint is promoted as part of the executor prompt. Planning/governance authority promotes only individually accepted module deltas after merge and objective audit.

## Validation cadence

Per lane during coding: deterministic lane tests, package/web typecheck/build as affected, lint/format on touched source, contract compilation, secret/client-boundary checks where relevant, `git diff --check`, and exact-head CI for each PR. Do not run repeated broad suites after each small edit.

After all admitted lanes are frozen and the integration branch is assembled, run one consolidated campaign: `npm ci`; lint; format check; typecheck; unit tests; build; npm audit; `npm run validate`; PostgreSQL migration/integration tests on a disposable test database if a DB path is touched; replay/paper property, fault and deterministic-time tests; route/runtime smoke for web shells; worker health/telemetry smoke; Docker Compose runtime/health checks only if runtime configuration changed; exact final Docker/dependency scans when image/dependency inputs change; and GitHub Actions on the final exact head. Re-run affected scopes after corrections and then rerun the final consolidated campaign on the new integrated HEAD. Final exact-head CI, independent audits, unresolved HIGH/CRITICAL gate, VEX expiry checks, and checkpoint controls are never skipped.

## Safety stop

`liveTradingAuthorized=false` throughout. No signing, authenticated orders, live market mutation, geoblock bypass, credential work, secret logging, real admin mutations, VEX self-approval, historical VHDX/backup/PGDATA mutation, merge, or checkpoint promotion is authorized by this plan.
