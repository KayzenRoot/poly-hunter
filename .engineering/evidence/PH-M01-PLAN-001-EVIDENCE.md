# PH-M01-PLAN-001 Evidence Bundle

Status: CANDIDATE — awaiting exact-head audit.

## Base
main@5377ed44bcd1f962a5c121acf2e85495b991f7a7

## Scope
Planning/governance only. No runtime, dependency, database, migration, auth provider, credential or secret implementation.

## Frozen candidate decisions
- PostgreSQL durable store; PostgreSQL 17 local Docker service.
- Drizzle code-owned schema/migrations.
- Supabase Auth pilot provider behind IdentityPort.
- Server-derived TenantContext from identity + active membership.
- owner/admin/member tenant roles; platform_admin separate.
- AES-256-GCM application-level secret envelope with server-only master key.
- PH-M01 split into four proof-bearing Work Orders.

## Assurance
PH-M01 is HIGH_ASSURANCE. Cross-tenant access, privilege escalation, session confusion and secret leakage are blockers.

## Prepared next increment
PH-M01-WO-001 — Tenancy & Persistence Foundation only. Supabase Auth and secret vault remain out of scope.

## STOP
Do not implement PH-M01 in PH-M01-PLAN-001.
