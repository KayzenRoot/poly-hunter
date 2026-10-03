# ADR-0005 — Tenant authorization derives from server identity + membership

Status: CANDIDATE in PH-M01-PLAN-001; APPROVED upon merge.

## Decision
A tenant context is created only on the server from an authenticated identity and an active tenant membership. Client-provided tenant identifiers are selectors at most, never authorization proof.

Canonical tenant roles are owner/admin/member. Platform administrators use a separate platform role and are not modeled as a magic tenant membership.

## Consequences
All tenant-scoped repositories/actions require a validated TenantContext. Cross-tenant isolation and privilege escalation are HIGH_ASSURANCE proof obligations.
