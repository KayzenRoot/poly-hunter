# Security

Status: FROZEN upon merge of PH-PLAN-001.

## Assurance class
LIVE trading, signer/session authorization handling, tenant admin actions, kill switches and exposure accounting are HIGH_ASSURANCE.

## Trust boundaries
Browser <-> Web/API <-> Postgres <-> Worker <-> Polymarket APIs/streams <-> AI provider.

## Security invariants
- SEC-001 Tenant isolation is enforced server-side on every tenant resource.
- SEC-002 Admin authorization is distinct from tenant-user authorization.
- SEC-003 Trading secrets never reach browser/client bundles.
- SEC-004 No plaintext trading secret appears in database fields, logs, traces, crash dumps or Git.
- SEC-005 Secrets at rest use application-level encryption and key rotation support.
- SEC-006 Prefer least-authority scoped/session trading authorization when officially supported.
- SEC-007 LIVE requires explicit tenant enablement plus a safety preflight.
- SEC-008 Geographic eligibility is fail-closed. No bypass path exists.
- SEC-009 Every live mutation binds tenant, strategy version, risk decision and idempotency identity.
- SEC-010 Kill switches are privileged, audited and idempotent.
- SEC-011 Stale/unknown market data blocks new live entries.
- SEC-012 Provider/API ambiguity never becomes ALLOW.
- SEC-013 AI output is untrusted input: schema-validated, bounded and never executed as code.
- SEC-014 Rate limits/backoff prevent retry storms and duplicate orders.
- SEC-015 Secret-bearing errors are redacted before persistence.
- SEC-016 Dependency/container/secret scans become release gates once implementation starts.
- SEC-017 No live order path is admitted without reconciliation and recovery evidence.
- SEC-018 No HIGH/CRITICAL unresolved finding may enter main for live-money paths.

## Threat focus
Cross-tenant data access, credential theft, duplicate order submission, stale-book execution, race conditions, worker split-brain, admin privilege misuse, malicious AI output, provider outage and mistaken eligibility assumptions.

## PH-M01 identity, tenancy and secret invariants
- SEC-019 Authenticated user identity is derived from a verified server-side session/provider subject, never from client JSON.
- SEC-020 TenantContext is derived from an active membership on the server; a submitted tenant_id is never sufficient authorization.
- SEC-021 Tenant role values are constrained; platform_admin is separately authorized and audited.
- SEC-022 Session invalidation or membership removal must fail closed on the next authoritative request check.
- SEC-023 Application secret encryption uses authenticated encryption with unique nonces and explicit key-version metadata; master key material never persists in Postgres/Git/client bundles.
- SEC-024 Authentication/session/secret values are covered by redaction and leak-detection tests.
