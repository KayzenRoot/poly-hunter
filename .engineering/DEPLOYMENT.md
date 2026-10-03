# Deployment

Status: FROZEN upon merge of PH-PLAN-001.

## Pilot objective
Operate 1–2 tenants at minimal cost, targeting free tiers where practical while preserving portability and safety.

## Logical deployment
- Web UI/API: stateless web platform or small container.
- Database/Auth: managed Postgres/Auth profile.
- Trading worker: continuously running container/VM with outbound network access.
- Secrets: deployment secret store/master key outside Git and outside database plaintext.
- DNS/TLS: managed edge provider.

## Initial provider profile
Implementation may target a free-tier stack such as Supabase for Postgres/Auth, a free web-hosting tier for the dashboard and a free/always-free compatible VM/container host for the worker. Provider availability and terms are external and must be revalidated at deployment time. Architecture must not depend on a free tier existing forever.

## Environments
local -> test/replay -> staging/paper -> production/live.

LIVE production credentials are prohibited from non-production environments.

## Release
Container images/build artifacts are immutable and versioned. Production worker deploy requires exact commit SHA, migration state, config version and rollback/roll-forward plan.

## Observability
Health, provider connection, per-tenant runner state, order-reconciliation lag, error rate and kill-switch state must be visible before LIVE.
