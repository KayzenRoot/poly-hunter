# PH-M02 — Polymarket Integration

Status: ADMITTED / MODULE PLAN FROZEN FOR INCREMENTAL EXECUTION.
Base: `main@a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c`
Entering checkpoint: `M01_IMPLEMENTATION_COMPLETE / STOP_AFTER_PH_M01_WO_004 / completedThroughModule=PH-M01 / AWAIT_OWNER_DIRECTION`
`liveTradingAuthorized=false`.

## PURPOSE

Build the official-provider boundary between PolyHunter and Polymarket without allowing provider details, credentials or geographic assumptions to leak into domain logic.

PH-M02 owns:
- public market discovery/metadata;
- public CLOB price/order-book access;
- public market stream integration;
- geographic eligibility preflight;
- supported trading-authorization capability modeling;
- authenticated order/user provider adapter;
- provider-specific error/retry/rate-limit normalization.

PH-M02 does NOT own:
- market scanning/ranking (PH-M03);
- strategy (PH-M04);
- risk decisions (PH-M05);
- execution/reconciliation/journal authority (PH-M06);
- replay/paper acceptance (PH-M07);
- LIVE acceptance (PH-M12).

## CURRENT OFFICIAL SOURCE CHECK — 2026-10-06

Official Polymarket documentation revalidated immediately before admission.

Current documented integration surfaces:
- Gamma API: `https://gamma-api.polymarket.com` for events/markets/metadata.
- CLOB API: `https://clob.polymarket.com` for prices/order books and order management.
- CLOB Market WebSocket: `wss://ws-subscriptions-clob.polymarket.com/ws/market`.
- CLOB User WebSocket: `wss://ws-subscriptions-clob.polymarket.com/ws/user`.
- Public market data is documented as available without credentials.
- CLOB authentication has L1 wallet/EIP-712 and L2 API-credential/HMAC layers.
- Order placement requires L2 request authentication plus wallet authorization.
- Session Keys are documented as beta, scoped/time-limited signers for Deposit Wallets; they cannot withdraw funds.
- Session Keys currently work only with Deposit Wallets, use up to 180-day expiration, and require Builder API authorization for the documented management flow.
- Official geoblock preflight: `GET https://polymarket.com/api/geoblock`; `blocked=true` means order placement is unavailable.
- The official TypeScript unified client is documented as `@polymarket/client`; exact package version/capabilities must be resolved and locked at execution time rather than assumed from this plan.

Official references:
- https://docs.polymarket.com/getting-started/api
- https://docs.polymarket.com/market-data/realtime-data
- https://docs.polymarket.com/trading/session-keys
- https://docs.polymarket.com/api-reference/geoblock
- https://docs.polymarket.com/trading/place-orders
- https://docs.polymarket.com/trading/manage-orders
- https://docs.polymarket.com/trading/real-time-order-updates

External provider facts must be revalidated again at the Work Order that first depends on them.

## ARCHITECTURAL BOUNDARY

Create `packages/polymarket` as the only package allowed to depend directly on Polymarket SDK/provider wire types.

Provider-neutral contracts belong in `packages/contracts` and/or `packages/domain`.

Forbidden:
- importing `@polymarket/client` from domain/db/web business logic;
- returning provider SDK objects across package boundaries;
- treating provider HTTP/WebSocket error text as a domain contract;
- putting signing/credential material into browser/client bundles;
- allowing public market-data code to acquire credential dependencies.

The adapter maps official provider shapes into compact PolyHunter-owned models.

## MODULE SEQUENCE

### PH-M02-WO-001 — Public Polymarket Provider Foundation

Read-only only.

Deliver:
- `packages/polymarket`;
- current official SDK/API capability probe;
- provider-neutral public market/asset/book models;
- discovery/metadata adapter;
- public CLOB book/price adapter;
- public market WebSocket adapter;
- reconnect/heartbeat/staleness state;
- deterministic simulator/fixtures;
- normalized public-provider errors;
- optional live read-only smoke evidence.

No credentials, Session Keys, Builder keys, user stream, signing or order mutations.

### PH-M02-WO-002 — Geographic Eligibility Gate

HIGH_ASSURANCE eligibility boundary.

Deliver:
- official geoblock adapter;
- `ELIGIBLE / BLOCKED / UNKNOWN` style fail-closed result;
- timeout/unreachable/malformed response => not eligible for LIVE;
- bounded cache/expiry semantics;
- revalidation hook before future live execution;
- no VPN/proxy/bypass logic;
- evidence against official current endpoint contract.

No order placement.

### PH-M02-WO-003 — Trading Authorization Capability

HIGH_ASSURANCE credential/signing boundary.

Deliver:
- capability model for supported account/wallet paths;
- least-authority preference;
- Session Key support only when current official requirements are satisfied;
- explicit handling for unsupported wallet/account types;
- tenant trading secret handles via the PH-M01 Vault;
- Builder/platform credential boundary if required;
- no secret exposure to browser/logs/JEV;
- revocation/expiry/capability tests;
- fail closed if authorization mode is ambiguous.

No live order placement.

### PH-M02-WO-004 — Authenticated Provider + Order Adapter

HIGH_ASSURANCE adapter implementation.

Deliver:
- authenticated user/order query boundary;
- authenticated user stream;
- create/cancel/query provider operations behind a hard mutation gate;
- request/idempotency identity support where provider contract allows;
- provider rejection/timeout/rate-limit normalization;
- simulator cases for accept/reject/timeout/duplicate/partial fill/cancel race/reconnect.

Critical rule:
`liveTradingAuthorized=false` remains a hard deny. No real order-create/cancel network mutation may be exercised before PH-M12.

The adapter may be structurally complete and simulator-proven while its real-money mutation gate remains closed.

### PH-M02-WO-005 — M02 Security Acceptance

Integrated acceptance covering:
- public market-data correctness;
- reconnect/stale behavior;
- eligibility fail-closed;
- auth capability/expiry/revocation;
- no secret leakage;
- user-stream isolation;
- order mutation hard deny while LIVE unauthorized;
- provider simulator fault matrix;
- exact-artifact dependency/container/security scans;
- VEX chain if HIGH/CRITICAL rows exist;
- final M02 checkpoint proposal.

## SECURITY INVARIANTS

- SEC-M02-001 No provider secret enters browser/client bundles.
- SEC-M02-002 Public-data code cannot require or retrieve trading secrets.
- SEC-M02-003 Provider types/errors do not become domain authority.
- SEC-M02-004 Unknown/stale provider state never becomes an allow signal.
- SEC-M02-005 Geographic eligibility is fail-closed and has no bypass path.
- SEC-M02-006 Unsupported/ambiguous authorization mode blocks future LIVE.
- SEC-M02-007 Session-key support is capability-detected; beta assumptions are never hardcoded as permanent facts.
- SEC-M02-008 Session/private signing material uses Vault-backed handles and never plaintext persistence.
- SEC-M02-009 Builder/platform credentials, if required, are platform-only secrets and never tenant/browser-visible.
- SEC-M02-010 No provider mutation can execute while `liveTradingAuthorized=false`.
- SEC-M02-011 Retries/backoff cannot duplicate order mutations.
- SEC-M02-012 Provider disconnect/staleness is observable to downstream modules.

## JEV MCP

Every PH-M02 Work Order MUST use the actual locally installed JEV MCP under:
`.engineering/policies/JEV-PROMPT-POLICY.md`.

Good PH-M02 JEV uses:
- compare provider docs/current SDK surface against frozen adapter requirements;
- classify provider/API changes;
- rerank minimal relevant docs/files;
- verify bounded contract claims;
- pre-review diffs;
- triage provider error fixtures.

Never send:
- private keys;
- API secrets/passphrases;
- session keys;
- Builder credentials;
- auth tokens;
- tenant secret plaintext.

JEV does not approve signing/security/VEX/LIVE gates.

## MODULE COMPLETION PROPOSAL

Only after WO-005 independent audit + required owner approvals + separate checkpoint/merge approval may PH-M02 propose:

```json
{
  "status": "SOURCE_PACK_FROZEN",
  "phase": "M02_IMPLEMENTATION_COMPLETE",
  "stopState": "STOP_AFTER_PH_M02_WO_005",
  "completedThroughModule": "PH-M02",
  "activeWorkOrder": "NONE",
  "preparedWorkOrder": "NONE",
  "nextLegalStage": "AWAIT_OWNER_DIRECTION",
  "liveTradingAuthorized": false
}
```

## STOP

Execute one Work Order at a time.

Do not start PH-M03 until PH-M02-WO-005 is promoted.

Only PH-M12 may eventually set a LIVE acceptance state.
