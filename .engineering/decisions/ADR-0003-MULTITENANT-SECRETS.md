# ADR-0003 — Multi-tenant isolation and least-authority trading credentials

Status: APPROVED.

## Decision
PolyHunter is multi-tenant from the first product increment. Tenant trading secrets are isolated/encrypted and the preferred provider credential is the least-authority officially supported mechanism, such as scoped/session trading authorization without withdrawal capability when compatible.

## Consequences
No plaintext secrets; no client-side trading secrets; tenant-scoped authorization on every operation; provider capability and eligibility checks fail closed.
