# Integration Contracts

Status: FROZEN upon merge of PH-PLAN-001.
External facts revalidated: 2026-10-03 against official Polymarket documentation.

## Polymarket adapter
Use only currently supported official APIs/SDKs.

Required capabilities:
- discover markets and metadata;
- consume real-time market/order-book updates;
- create/cancel/query orders;
- consume/reconcile authenticated order/fill updates;
- obtain current fees/tick/min-size information needed for valid orders;
- geographic eligibility preflight;
- supported trading authorization.

## Real-time data
The official market WebSocket is the preferred live book source. Heartbeat/reconnect/staleness are adapter responsibilities. Unknown/stale stream state blocks new LIVE entries.

## Passive market making
GTC/GTD are appropriate passive order lifetimes and post-only is used when an order must add liquidity rather than execute immediately. Actual order policy remains strategy/risk controlled.

## Session Keys
Official docs currently describe Session Keys as beta, scoped/time-limited signers for Deposit Wallet trading; they cannot withdraw funds. They currently require Builder API authorization for the session-key flow. PolyHunter prefers this pattern when the tenant/account path is supported, but capability-detects because beta contracts may change.

## Builder integration
Builder credentials/attribution are platform-level secrets and never exposed to tenants. Builder enrollment, rate limits and session-key prerequisites must be revalidated at implementation/deployment time.

## Geographic eligibility
Before placing LIVE orders, check the official geoblock endpoint and fail closed on blocked/unknown/unreachable eligibility. PolyHunter must not hardcode a bypass or assume a jurisdiction remains eligible.

## AI provider
AIProviderPort supports DeepSeek first. Contract: structured input/output, timeout, schema validation, caching/expiry, redaction and hard fallback to NO_AI_CONTEXT.

## Official references
- https://docs.polymarket.com/market-data/realtime-data
- https://docs.polymarket.com/trading/market-making
- https://docs.polymarket.com/trading/session-keys
- https://docs.polymarket.com/programs/builders/overview
- https://docs.polymarket.com/api-reference/geoblock

## Supabase Auth
Pilot authentication uses Supabase Auth behind `IdentityPort`.

Current official guidance revalidated on 2026-10-03:
- Next.js App Router supports cookie-based server-side auth with the Supabase SSR helper.
- `@supabase/ssr` is currently documented as beta/unstable, so it must remain isolated in the provider adapter rather than leaking into domain/application contracts.
- Browser configuration may contain only publishable/public project values. Server-only secret/service credentials must never enter client bundles.

PH-M01-WO-002 owns the provider integration and must capability-test the selected package versions at execution time.

Supabase Auth references:
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/auth/server-side
- https://supabase.com/docs/guides/auth/quickstarts/nextjs
