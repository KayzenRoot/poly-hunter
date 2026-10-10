# Official provider capability snapshot

Revalidated on 2026-10-07 from official Polymarket documentation and npm registry metadata. No credentials or private data were sent to Jev.

| Capability | Current official contract | Implementation decision |
|---|---|---|
| SDK | The official TypeScript package is @polymarket/client. Version 0.12.0 is stable and declares Node >=24. | Lock exact version 0.12.0. Root and provider package now declare Node >=24 <27; CI and Docker use Node 24. |
| Market identity | Gamma Market ID is distinct from the EVM Condition ID. The detail lookup by SDK market ID uses the numeric Gamma market identity; the returned conditionId is a separate identity field. | fetchMarketDetail accepts a positive integer MarketId, calls fetchMarket({id: marketId}), verifies the returned market id and validates conditionId independently. Test fixture uses market id 559001 and rejects condition-id input before network access. |
| Discovery | Gamma documents keyset pagination and active/closed market metadata. | Bounded pagination, identity checks, normalized market status and fail-closed parsing. |
| Order book | CLOB books carry decimal price/size values, tick and minimum order metadata, last trade, and market identity/version fields. | Decimal strings remain canonical; malformed or unsafe numeric inputs fail closed. |
| Market stream | Standard market subscription is {assets_ids, type: "market"} and sends text PING every 10 seconds. Optional best_bid_ask, new_market and market_resolved events require customFeatureEnabled: true. | The adapter uses only the standard subscription; unsupported optional variants were removed and unknown events fail closed. Exact frame and reconnect frame are asserted. |
| SDK errors | SDK documents UserInputError, TransportError, UnexpectedResponseError, RateLimitError and TimeoutError. | UserInputError becomes permanent bad request; Transport/Timeout remain transient; UnexpectedResponse becomes malformed; RateLimit remains rate_limited; HTTP status paths remain normalized. |

Official sources:
- https://docs.polymarket.com/getting-started/typescript
- https://docs.polymarket.com/market-data/market-details
- https://docs.polymarket.com/market-data/discover-markets
- https://docs.polymarket.com/market-data/prices-order-books
- https://docs.polymarket.com/market-data/realtime-data

Registry snapshot: npm view @polymarket/client version engines --json returned version 0.12.0 and engine >=24. Repository host validation used Node v26.4.0, which is within the declared range; the final Docker runtime and CI use Node 24.21.0.

Direct provider dependencies remain @polymarket/client@0.12.0, ws@8.22.0, zod@4.6.5, and @types/ws@8.18.1. npm audit --audit-level=high reports zero dependency findings. Exact lockfile resolutions are authoritative.
