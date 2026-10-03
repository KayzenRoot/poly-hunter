# Definition of Done

Status: FROZEN upon merge of PH-PLAN-001.

PolyHunter MVP is complete only when every NECESSARY item is objectively satisfied at an exact accepted head.

## Governance
- Source Pack is current and internally consistent.
- Every merged product increment has Work Order, Context Lock, Evidence Bundle and audit verdict.
- Checkpoint reflects proven state, not intent.

## Product
- Multi-tenant user/admin flows are functional.
- Polymarket integration works in supported/eligible environments.
- Micro Maker Scalper and Arbitrage Sentinel are available in Replay/Paper; LIVE only if PH-M12 accepts it.
- Risk, execution, reconciliation, PnL and Event Journal are functional.
- User/admin dashboards are usable.
- Deployment/recovery runbooks are proven.

## Security
- No plaintext trading secrets.
- Tenant isolation and RBAC tests pass.
- Geoblock/eligibility fails closed.
- Kill switches and least-authority authorization evidence pass.
- No unresolved HIGH/CRITICAL issue.

## Quality
- Unit/lint/typecheck/build/integration required by risk pass.
- Replay/paper evidence is reproducible.
- Fault-injection/recovery tests pass for live-money paths.
- Observability detects stale data, provider disconnect, split-brain and reconciliation drift.

## Trading acceptance
- No guarantee of profit is required or permitted.
- Replay/paper evidence must support a positive or at least non-negative expected-value case under conservative assumptions before live promotion.
- Risk budgets and live thresholds are frozen from evidence in PH-M12, not guessed in this Source Pack.
- LIVE pilot can be disabled globally and per tenant without duplicate-order ambiguity.

## Deployment
- Pilot deployment is documented and recoverable.
- Production exact SHA/config/migration version is observable.
- Backup/restore and roll-forward procedures are demonstrated.

STOP CONDITION: only PH-M12 can declare LIVE_PILOT_ACCEPTED.
