# API Contracts

Status: FROZEN upon merge of PH-PLAN-001.

## Tenant API
- GET /api/me
- GET /api/dashboard
- GET/PUT /api/settings/strategy
- GET/PUT /api/settings/risk
- POST /api/autopilot/start
- POST /api/autopilot/stop
- GET /api/orders
- GET /api/trades
- GET /api/positions
- GET /api/pnl
- GET /api/health/provider

## Admin API
- GET /api/admin/tenants
- GET /api/admin/tenants/:id
- POST /api/admin/tenants/:id/suspend
- POST /api/admin/tenants/:id/resume
- POST /api/admin/tenants/:id/kill
- POST /api/admin/global-kill
- GET /api/admin/health
- GET /api/admin/audit

## Contract rules
- Authentication and authorization are server-side; tenant_id derives from auth context and is never trusted from arbitrary client input.
- Mutations use request/idempotency identifiers.
- Trading mutations return accepted/current state, not fabricated finality.
- Error envelopes contain a stable code, safe message and correlation ID; never secrets.
- Starting LIVE requires accepted live-readiness state, tenant live_enabled and current provider eligibility/auth preflight.
- Admin APIs require explicit platform-admin authorization and append audit records.
