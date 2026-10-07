# Official provider capability snapshot

Revalidated: 2026-10-07 against Polymarket's official documentation; no credentials or private data were sent.

| Capability | Current official contract | Implementation decision |
|---|---|---|
| SDK | Official unified TypeScript package is `@polymarket/client`; a `PublicClient` supports public reads and market subscriptions. | Exact package lock: `@polymarket/client@0.12.0`; registry metadata on 2026-10-07 reports Node engine `>=24`. The SDK's public market feed supports the documented event families, but its exposed stream surface did not supply the injected lifecycle/heartbeat/reconnect controls required for deterministic stale/reconnect tests, so the adapter keeps the raw WebSocket integration inside `packages/polymarket`. |
| Discovery | Gamma documents keyset/paged markets and active/closed metadata. | Bounded pagination, supported IDs, market state normalization, and fail-closed payload parsing. |
| Order book | CLOB book carries bid/ask price and size, tick size, min order size, last trade, and market identity/version fields. | Decimal strings remain canonical; numeric inputs are rejected when unsafe or malformed. |
| Market stream | `wss://ws-subscriptions-clob.polymarket.com/ws/market`; subscribe with `{assets_ids, type:"market"}`; send text `PING` every 10 seconds; documented market events include book, price change, last trade and tick-size change. | Explicit injected clock/scheduler/socket, state machine, bounded reconnect/backoff, snapshot resync, and stale state. |
| Errors/rate limits | SDK documents action-specific rate-limit handling; public API guidance exposes HTTP/rate-limit failures. | Normalize HTTP/provider errors and preserve fail-closed handling; timeout/4xx/5xx/rate-limit behavior is deterministic-test covered. |

Official sources:
- https://docs.polymarket.com/getting-started/typescript
- https://docs.polymarket.com/market-data/discover-markets
- https://docs.polymarket.com/market-data/prices-order-books
- https://docs.polymarket.com/market-data/realtime-data

Registry snapshot: `npm view @polymarket/client version engines --json` => version `0.12.0`, engine `>=24`; repository runtime range is `>=22 <27`. This means Node 22/23 compatibility of the selected provider SDK is not claimed; current Docker/CI runtime is Node 24.

Exact direct dependency choices in the package: `@polymarket/client@0.12.0`, `ws@8.22.0`, `zod@4.6.5`, `@types/ws@8.18.1`. `ws@8.22.0` is above fixes listed by the previously reviewed upstream advisories; `npm audit --audit-level=high` reports 0 current dependency findings. Lockfile is authoritative for transitive resolutions.
