# ADR-0004 — PH-M01 persistence and identity boundary

Status: APPROVED upon merge of PH-M01-PLAN-001.

## Decision
Use PostgreSQL as the application durable store, Drizzle for code-owned schema/migrations, and Supabase Auth as the pilot identity provider behind a provider adapter.

Local development uses PostgreSQL 17 in the canonical Docker Compose stack. Production may use Supabase Postgres without coupling domain/repository code to Supabase Data APIs.

## Rationale
This preserves local Docker observability, keeps persistence portable, uses a managed/free-tier-friendly pilot identity/database profile, and isolates provider-specific auth churn from domain rules.

## Consequences
- New workspace `packages/db`.
- Direct DB access is server-side.
- Supabase-specific packages stay in the identity/web adapter boundary.
- Provider migration remains possible without changing tenant authorization semantics.
