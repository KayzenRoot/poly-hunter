# UI / UX Contract

Status: FROZEN upon merge of PH-PLAN-001.

## Tenant dashboard
Primary screen shows:
- balance and available capital;
- realized PnL today and cumulative;
- current exposure/open orders/positions;
- autopilot mode/status;
- strategy and risk profile;
- trades/fills;
- provider/worker health;
- visually explicit PAPER vs LIVE state.

## Settings
Trading connection, strategy configuration, risk limits, notification preferences and AI provider status. Secret values are write-only and masked after save.

## Admin dashboard
Tenant list/status, worker/provider health, exposure, errors, strategy/version, AI usage/cost, audit log and tenant/global kill switches.

## Safety UX
LIVE activation requires explicit confirmation showing current risk limits and current eligibility/auth health. Kill-switch controls require privileged authorization and show resulting cancel/reconciliation state. PAPER must be visually impossible to confuse with LIVE.
