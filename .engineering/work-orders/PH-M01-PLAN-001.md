# PH-M01-PLAN-001 — Plan Identity, Tenancy & Secrets

Issue: #12
Base: main@5377ed44bcd1f962a5c121acf2e85495b991f7a7
Branch: planning/ph-m01-identity-tenancy-secrets
Risk: HIGH_ASSURANCE planning.

## OBJECTIVE
Freeze PH-M01 architecture, assurance obligations and implementation sequence; prepare PH-M01-WO-001 only.

## CONTEXT
PH-M00 is complete. Local Docker is canonical. PH-M01 is the next NECESSARY module and owns tenant/auth/secret security boundaries.

## SCOPE
Module plan; persistence/auth/authorization/secret decisions; implementation sequencing; ADRs; PH-M01-WO-001; planning Context Lock; evidence; proposed checkpoint delta.

## OUT OF SCOPE
Runtime code, dependencies, Postgres service, migrations, Supabase mutation/configuration, login UI, secrets, Polymarket and trading.

## FILES / SOURCES TO READ
Exact main Checkpoint, Backlog, Requirements, Scope, Architecture, Security, Data Model, API Contracts, Integration Contracts, Test Plan, DoD, Decisions and AGENTS.

## REQUIREMENTS
REQ-001, REQ-002, REQ-011, REQ-020, REQ-021, REQ-022, REQ-024 plus local-Docker REQ-026 are controlling.

## ARCHITECTURE RULES
Provider-isolated identity; server-derived TenantContext; server-only DB; Postgres/Drizzle; no client authorization by tenant_id; encrypted secret envelope; no plaintext secret persistence.

## CONSTRAINTS
Planning/docs only. No dependency/package/runtime changes. No PH-M02 behavior.

## ACCEPTANCE CRITERIA
- Four-step PH-M01 implementation sequence frozen.
- High-assurance proof obligations explicit.
- ADRs align with frozen Source Pack.
- PH-M01-WO-001 is executable in principle but NOT_ADMITTED.
- Context Lock binds exact source fingerprints.
- Checkpoint delta proposes only post-merge Context Lock compilation.

## TESTS
Exact diff/path review, source consistency, Context Lock JSON parse/fingerprint audit, no runtime/dependency files.

## DELIVERABLES
Module plan, ADRs, PH-M01-WO-001, Context Lock, Evidence Bundle and checkpoint delta.

## REVIEW FORMAT
APPROVED / CORRECTION REQUIRED / BLOCKED with exact-head scope/security/traceability review.

## STOP CONDITION
Do not implement PH-M01-WO-001 in this planning Work Order.
