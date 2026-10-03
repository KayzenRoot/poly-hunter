# PH-M01 — Identity, Tenancy & Secrets

Status: FROZEN upon merge of PH-M01-PLAN-001.

## Purpose
Establish the security boundary that every later PolyHunter module depends on: authenticated identity, server-derived tenant context, explicit RBAC, tenant-scoped persistence, and encrypted storage for sensitive tenant credentials.

## Assurance
PH-M01 is HIGH_ASSURANCE. Cross-tenant access, privilege escalation, session confusion or secret disclosure are release blockers.

## Frozen implementation direction

### Persistence
- PostgreSQL is the durable application store.
- Local development uses a PostgreSQL 17 container inside the canonical Docker Compose stack.
- Pilot production profile targets Supabase Postgres, but domain/data access must not depend on Supabase-specific query APIs.
- Drizzle ORM + versioned SQL migrations is the selected application data layer.
- Runtime database access remains server-side; browsers never receive direct database credentials.
- A new `packages/db` workspace owns schema, migrations and repositories.

### Identity
- Pilot identity provider: Supabase Auth behind an `IdentityPort` / provider adapter.
- Next.js sessions are cookie/server validated; authenticated identity is never trusted from client-supplied tenant/user identifiers.
- The current official Supabase SSR helper is treated as an unstable adapter surface and isolated from domain/application code.
- PH-M01 does not use a Supabase service-role/secret key in the browser.
- A user may belong to more than one tenant; active tenant selection is resolved server-side from authenticated membership.

### Tenant authorization
Canonical roles:
- `owner`: tenant ownership/admin permissions.
- `admin`: tenant administration excluding ownership transfer/destructive platform actions.
- `member`: normal tenant usage.
- `platform_admin`: platform-level owner/admin role, never represented as a tenant membership shortcut.

Every tenant-scoped repository/action receives a validated `TenantContext` created server-side from identity + membership. Client-provided `tenant_id` is never authorization evidence.

### Secrets
- Secret plaintext never persists outside the process operation that receives/uses it.
- Application-level envelope format uses Node.js built-in AES-256-GCM.
- The wrapping/master key is server-only configuration, outside Postgres and Git.
- Ciphertext records include key version, nonce/IV, auth tag, purpose, tenant_id and timestamps.
- Secret reads return purpose-specific handles/results, not generic plaintext serialization.
- Rotation metadata and re-encryption path are required before live credentials exist.
- Logs/errors/telemetry redact sensitive values.

## PH-M01 implementation sequence

### PH-M01-WO-001 — Tenancy & Persistence Foundation
HIGH_ASSURANCE.
- Add Postgres 17 local Docker service.
- Add `packages/db` with Drizzle schema/migrations.
- Implement tenants, users, identity_links and tenant_memberships.
- Implement server-only TenantContext and tenant-scoped repository boundary.
- Add migration/integration/isolation tests.
- No real auth provider and no encrypted secret storage yet.

### PH-M01-WO-002 — Identity & RBAC
HIGH_ASSURANCE.
- Integrate Supabase Auth adapter.
- Cookie/server session verification.
- Minimal login/logout/auth callback shell only, not M08 dashboard design.
- Membership resolution and tenant selection.
- owner/admin/member/platform_admin authorization tests.
- Fail closed on stale/invalid session or membership.

### PH-M01-WO-003 — Encrypted Secret Vault
HIGH_ASSURANCE.
- Implement encrypted_secrets persistence and AES-256-GCM envelope.
- Key versioning/rotation metadata.
- write-only/masked API behavior.
- redaction and leak tests.
- No Polymarket credential usage yet.

### PH-M01-WO-004 — M01 Security Acceptance
HIGH_ASSURANCE.
- Adversarial cross-tenant tests.
- privilege-escalation/session-confusion tests.
- migration/recovery/rotation drill.
- secret scanning and exact-head security review.
- Final PH-M01 checkpoint promotion only after all obligations pass.

## Data model refinements
- users(id, status, created_at, updated_at)
- identity_links(id, user_id, provider, subject, created_at), unique(provider, subject)
- tenants(id, name, slug, status, created_at, updated_at)
- tenant_memberships(id, tenant_id, user_id, role, status, created_at), unique(tenant_id, user_id)
- platform_roles(id, user_id, role, created_at), introduced in WO-002; platform_admin is the only MVP platform role.
- encrypted_secrets is deferred to WO-003.

IDs are UUIDs. Tenant-owned tables carry tenant_id. Timestamps are UTC. Roles/status values use constrained DB representations plus TypeScript unions.

## Proof obligations
1. No tenant A operation can read/write tenant B state through any public repository/API path.
2. A membership removal takes effect on the next authoritative request/session check.
3. A client-crafted tenant_id cannot change authorization scope.
4. platform_admin is separately authorized and audited.
5. No authentication/session/secret token appears in browser logs, server logs, errors or Git.
6. Migration up/down or roll-forward guidance exists for every schema change.
7. Local Docker remains healthy and web stays observable at localhost:3000.
8. CI runs Postgres-backed integration tests from a clean environment.
9. No HIGH/CRITICAL finding is mergeable.

## STOP
Do not start PH-M02 until PH-M01-WO-004 promotes PH-M01 complete.
