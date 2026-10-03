# Architecture

Status: FROZEN upon merge of PH-PLAN-001.

## Style
TypeScript-first modular monorepo, ports/adapters, deterministic critical path and event-journaled state transitions.

## Proposed topology
- apps/web: Next.js tenant/admin UI and authenticated control API.
- apps/worker: long-running trading worker; owns streams, tenant runners and live execution.
- packages/domain: strategy/risk/order domain without provider coupling.
- packages/contracts: schemas and typed boundaries.
- packages/polymarket: official-provider adapter.
- packages/ai: DeepSeek-compatible adapter behind AIProviderPort.
- packages/db: Postgres repositories/migrations.
- packages/testkit: replay, fake clock, provider simulators and fixtures.

## Critical path
Market Data -> Strategy Proposal -> Risk Decision -> Execution Intent -> Polymarket Adapter -> Reconciliation -> Journal.

AI is outside the critical path:
Market/News Context -> AI Adapter -> cached advisory context -> Strategy may consume bounded advisory fields. Missing or stale AI context must never weaken Risk.

## Tenant execution
A TenantRunner owns one tenant's loop and configuration snapshot. Failures are circuit-broken per tenant. A global supervisor can suspend all runners.

## State authority
Postgres is durable authority for application state. Polymarket remains authority for remote order/fill status. Reconciliation records drift explicitly.

## Concurrency
- Idempotency keys for external mutations.
- Versioned configuration updates.
- Per-tenant execution lease so only one live runner owns a tenant.
- Order state machine forbids impossible transitions.

## Performance
No LLM calls on tick/order critical paths. Real-time processing keeps compact in-memory book state; material trading decisions are journaled.

## Portability
All services are containerizable. Provider-specific adapters/configuration stay outside domain packages.

## Local development runtime
Before PH-M01, the canonical runnable developer environment is Docker Compose.

Development-only topology:
- web: Node.js 24 development container running the Next.js App Router shell and later UI/API code, published on host port 3000.
- worker: Node.js 24 development container running the worker continuously with source-change restart support.
- shared source: packages and TypeScript configuration are visible to both services.
- dependencies: installed inside the development image; host node_modules is not required.
- safety: no privileged containers, no Docker socket mount and no real credential requirement for base startup.

The local Docker stack is separate from PH-M11 production deployment/orchestration. Production image hardening, reverse proxying, hosted secrets, persistence and infrastructure remain owned by PH-M11.

Developer feedback target: source edits should become visible without rebuilding the entire image when only application/package source changed. Dependency/package-manifest changes may require an explicit rebuild.

## PH-M01 identity and tenancy boundary
- `packages/db` owns PostgreSQL schema, migrations and server-only repositories.
- `IdentityPort` isolates the selected auth provider from domain/application authorization.
- Pilot identity provider is Supabase Auth; provider-specific SSR/session code stays in the web identity adapter.
- `TenantContext` is created server-side from authenticated identity plus active membership and is required by tenant-scoped repositories/actions.
- Client-provided tenant identifiers are selectors only, never authorization proof.
- Local development adds PostgreSQL 17 to the existing Docker Compose stack.
- Secret encryption is application-level and server-only; encrypted persistence is introduced in PH-M01-WO-003, not in the tenancy foundation.
