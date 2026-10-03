# Backlog / Module Map

Status: FROZEN upon merge of PH-PLAN-001.

| Module | Classification | Purpose |
|---|---|---|
| PH-M00 Governance & Harness Foundation | NECESSARY | repo layout, contracts, CI/test harness, config |
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

## Ordering
M00 -> M01 -> M02 -> M03 -> M04/M05 -> M06 -> M07 -> M08/M09/M10 -> M11 -> M12.

Implementation Work Orders are created one admitted increment at a time. No module bypasses an unresolved correction/blocker in its dependency path.
