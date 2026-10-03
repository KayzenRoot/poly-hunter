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
