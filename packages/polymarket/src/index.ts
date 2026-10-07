export type {
  AssetId,
  BestPrices,
  BookLevel,
  ConditionId,
  ConnectionState,
  DecimalString,
  DiscoveryPage,
  MarketDetail,
  MarketId,
  MarketStreamEvent,
  MarketStreamHandle,
  MarketStreamOptions,
  MarketSummary,
  MarketFeeMetadata,
  OutcomeAsset,
  PolymarketBook,
  PolymarketDiscovery,
  PriceChangeItem,
  ProviderErrorCategory,
  ProviderErrorCode,
  ProviderOrderSide,
  StreamScheduler,
  StreamSocket,
  StreamSocketFactory,
  StreamSocketHandler,
  StreamState,
} from "@polyhunter/contracts";
export { PolymarketProviderError } from "@polyhunter/contracts";
export { normalizeWireMarketEvent } from "./wire.ts";
export {
  compareDecimal,
  isDecimalString,
  normalizeDecimal,
} from "./decimal.ts";
export { createPolymarketBook, createPolymarketDiscovery } from "./rest.ts";
export { createPolymarketMarketStream } from "./stream.ts";

/**
 * PH-M02-WO-001 public surface — READ-ONLY by construction:
 *
 * - discovery: list/fetch markets (Gamma, credential-free);
 * - book/price: fetch order book, best prices, midpoint, tick size, last trade
 *   (CLOB public endpoints, credential-free);
 * - stream: public market WebSocket with deterministic connection state.
 *
 * Deliberately ABSENT from this surface (and from the package internals):
 * order create/cancel, signing, any credential/session-key/builder API, the
 * user WebSocket, and every official-SDK type. SDK types must not escape this
 * package (enforced by tests/polymarket-boundary.test.ts).
 */
