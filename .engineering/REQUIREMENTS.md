# Requirements

Status: FROZEN upon merge of PH-PLAN-001.

## Product requirements
- REQ-001 Multi-tenant isolation: every tenant-scoped record/action is bound to tenant_id and authorization context.
- REQ-002 User and admin control planes are separated; admin actions are privileged and audited.
- REQ-003 Autopilot supports REPLAY, PAPER and LIVE, with LIVE disabled by default.
- REQ-004 Market data uses officially supported Polymarket APIs/streams and handles reconnect/stale data deterministically.
- REQ-005 Primary MVP strategy is Micro Maker Scalper; secondary is Arbitrage Sentinel.
- REQ-006 Strategy output is a proposal only. Risk Engine approval is mandatory before Execution can create/cancel orders.
- REQ-007 AI cannot directly place/cancel orders, set exposure, override risk or bypass eligibility.
- REQ-008 Per-tenant risk controls include max order size, max market exposure, max total exposure, max open positions/orders and daily loss stop.
- REQ-009 Global and tenant kill switches stop new orders and cancel eligible open orders through an idempotent emergency path.
- REQ-010 Order intents, risk decisions, submissions, acknowledgements, fills, cancels and closes produce Event Journal records.
- REQ-011 Secrets are never stored/logged in plaintext; browser clients never receive trading secrets.
- REQ-012 Prefer official scoped/session trading authorization without withdrawal capability when supported; unsupported safe authorization blocks LIVE.
- REQ-013 Geographic eligibility is checked fail-closed before enabling LIVE and before live execution when revalidation is required.
- REQ-014 No feature may route around Polymarket restrictions.
- REQ-015 Order lifecycle is idempotent and reconciles remote vs local truth.
- REQ-016 Paper fills model spread, tick size, queue/fill uncertainty, fees and adverse selection conservatively.
- REQ-017 Live readiness requires objective replay/paper acceptance; backtest profit alone is insufficient.
- REQ-018 PnL distinguishes realized, unrealized, fees/rebates and capital exposure.
- REQ-019 System remains safe when AI is unavailable.
- REQ-020 Tenant failures are isolated except for explicit global safety actions.
- REQ-021 Every production change has Work Order, Context Lock, tests, Evidence Bundle, PR and audit.
- REQ-022 No HIGH/CRITICAL known defect may merge for live-money paths.
- REQ-023 Free-tier-first deployment is supported for pilot scale when provider capacity/terms allow; portability is required.
- REQ-024 Logs/telemetry redact secrets and sensitive credential material.
- REQ-025 The product never represents expected or historical returns as guaranteed future income.
- REQ-026 Local development must be runnable through Docker Compose before PH-M01, with the web service reachable at http://localhost:3000, the worker continuously running, source-change feedback suitable for active development, and no real credentials required for startup.
