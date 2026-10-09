# Backlog / Module Map

Status: FROZEN upon merge of PH-PLAN-001.

| Module | Classification | Purpose |
|---|---|---|
| PH-M00 Governance & Harness Foundation | NECESSARY | repo layout, contracts, CI/test harness, config, local Docker development runtime |
| PH-M01 Identity, Tenancy & Secrets | NECESSARY | auth, RBAC, tenant isolation, secret vault/encryption |
| PH-M02 Polymarket Integration | NECESSARY | market data, auth/session, geoblock, order adapter |
| PH-M03 Market Scanner & Data Engine | NECESSARY | book state, filters, stale-data guard |
| PH-M04 Strategy Engine | NECESSARY | Micro Maker Scalper + Arbitrage Sentinel |
| PH-M05 Risk & Safety Engine | NECESSARY | sizing/exposure/daily loss/circuit breakers |
| PH-M06 Execution, Reconciliation & Journal | NECESSARY | idempotent orders/fills/PnL/event journal |
| PH-M07 Replay & Paper Trading | NECESSARY | deterministic replay and conservative fill simulation |
| PH-M08 User Dashboard | NECESSARY | autopilot, status, trades, risk/settings |
| PH-M09 Admin Control Plane | NECESSARY | tenants, health, exposure, tenant/global kill switch |
| PH-M10 AI Intelligence Adapter | IMPORTANT | DeepSeek-compatible advisory context and safe fallback |
| PH-M11 Observability & Operations | NECESSARY | telemetry, audit, recovery and deployment |
| PH-M12 Live Trading Acceptance | NECESSARY | high-assurance evidence gate before live pilot |
| PH-M13 Billing & Commercialization | FUTURE | subscription/billing/plan enforcement |
| PH-M14 Additional Strategies/Markets | FUTURE | separately proven extensions |

## Dependency-aware wave scheduling (PH-GOV-PARALLEL-001)

This section is a proposed governance change until the planning PR is independently audited and merged; existing unmerged Work Orders retain their own STOP conditions. No module count/classification/scope change.

- Accepted: PH-M00, PH-M01 (see current machine-readable Checkpoint for canonical status).
- Current dependency gate: PH-M02 public-provider foundation (#42, PR #43). PH-M02 order/signing/eligibility capabilities require separately admitted HIGH_ASSURANCE work and are not implied by public-adapter acceptance.
- Wave A candidate, after contracts and per-lane dependencies are admitted: PH-M03 (#45), PH-M04 (#46), PH-M05 (#47), PH-M07 (#49), PH-M08 (#50), PH-M09 (#51), PH-M11 telemetry foundation (#53). Only pure or disabled/mock foundations may be concurrent before integration prerequisites exist; M03 live-data integration waits on accepted M02.
- Wave B after safe capabilities exist: PH-M06 (#48), M07/M08/M09/M11 integrated functionality, and M02 remaining gated provider subincrement(s).
- Final: PH-M12 (#54) after all NECESSARY prerequisites and independent acceptance.
- Not in MVP waves: PH-M10 IMPORTANT (#52); PH-M13/M14 FUTURE (#55/#56).

Implementation Work Orders may be admitted in a multi-Work-Order batch only when their dependency paths have no unresolved correction/blocker, one-writer file ownership is frozen, and each has its own exact-base Context Lock, acceptance gates and Evidence Bundle. Shared contracts integrate through one coordinator. Finish code in isolated lanes before one consolidated full-wave test campaign, but never bypass required preflight, CI, security, HIGH_ASSURANCE or exact-head review gates. See `.engineering/plans/PH-PARALLEL-WAVES-001.md` and `.engineering/decisions/ADR-0008-PARALLEL-IMPLEMENTATION-WAVES.md`.

