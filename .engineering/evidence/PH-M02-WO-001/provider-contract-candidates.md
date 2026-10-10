# PH-M02-WO-001 — Provider Contract Revalidation

Date: 2026-10-07
Scope: CR-01 through CR-06 only; public/read-only Polymarket boundary.

## Authoritative provider sources

- TypeScript SDK: <https://docs.polymarket.com/getting-started/typescript>
  identifies the official package as `@polymarket/client`, documents the
  public client surfaces, and names `UserInputError`, `TransportError`,
  `UnexpectedResponseError`, `RateLimitError`, and `TimeoutError`.
- Market details: <https://docs.polymarket.com/market-data/market-details>
  distinguishes numeric Gamma Market ID from the EVM Condition ID. Its
  documented fetch-by-market identity is the Gamma market ID.
- Real-time data: <https://docs.polymarket.com/market-data/realtime-data>
  documents the standard market-channel subscription used by this adapter.
  Optional `best_bid_ask`, `new_market`, and `market_resolved` events require
  `customFeatureEnabled: true`; the current adapter does not send that option.

Sources were checked on 2026-10-07. No credential material was sent to JEV.

## Stable dependency/runtime decision

`npm view @polymarket/client version engines dist-tags --json` returned stable
`0.12.0` as the current supported release with Node engine `>=24`; the project
lock already pins `0.12.0`. No alternate SDK candidate was needed or selected.
The package and root project now both declare Node `>=24 <27`, aligning the
manifest with the SDK while retaining the existing Node 24 CI and Docker base.

## Bounded correction decisions

| Review item | Candidate chosen | Reason |
| --- | --- | --- |
| CR-01 | Fetch detail with numeric `MarketId`; verify returned market ID and independently validate `ConditionId` | The provider documents these as distinct identifiers; the SDK detail path takes the market identity. |
| CR-02 | Explicitly normalize all five documented SDK error names | Stable public error contract with permanent/transient/malformed/rate-limited categories. |
| CR-03 | Remove unsupported optional event variants for this subscription | Keep the exact standard `{ assets_ids, type: "market" }` frame and fail closed on optional events not enabled by the subscription. |
| CR-04 | Move neutral types, ports, error code/category, and neutral error class into `@polyhunter/contracts` | The provider SDK adapter remains an implementation package; domain-facing shapes are PolyHunter-owned. |
| CR-05 | Root and provider package Node range `>=24 <27` | Matches the official SDK engine and existing Node 24 CI/container runtime. |
| CR-06 | Add provider manifest to Docker install inputs and mount the source only in worker | The worker is the intended server consumer; web is not configured to consume the provider. |

This receipt records candidate selection only. Final acceptance depends on the
tests, clean image rebuild, exact-image security scan, and exact-head CI in the
Evidence Bundle.
