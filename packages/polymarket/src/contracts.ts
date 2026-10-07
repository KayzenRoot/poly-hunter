/**
 * PH-M02-WO-001 — provider-neutral Polymarket contracts.
 *
 * These types are the ONLY shapes that cross the package boundary. Official
 * SDK/provider wire types (classes, branded primitives, schemas) are confined
 * to the adapter internals and are re-serialized into the models below, so no
 * official SDK type can ever escape `packages/polymarket`.
 *
 * Price/size are ALWAYS canonical decimal strings — binary floating point is
 * never the authority for provider price/size state.
 */

/** Polymarket Gamma market identifier (positive integer string). */
export type MarketId = string & { readonly __marketId: unique symbol };
/** EVM condition identifier (0x + 64 hex chars). */
export type ConditionId = string & { readonly __conditionId: unique symbol };
/** CLOB outcome/asset identifier for one side of one condition. */
export type AssetId = string & { readonly __assetId: unique symbol };

/** Canonical decimal string: `-?(0|[1-9]\d*)(\.\d+)?` with no exponent. */
export type DecimalString = string & { readonly __decimal: unique symbol };

/** Lifecycle derived from the provider's active/closed/archived flags. */
export type MarketLifecycleStatus =
  | "active"
  | "closed"
  | "resolved"
  | "archived";

/** One tradable outcome of one condition, with its CLOB asset id when known. */
export type OutcomeAsset = Readonly<{
  label: string;
  assetId: AssetId | null;
  /** Current outcome price, when the provider exposes one. */
  price: DecimalString | null;
}>;

/** Compact, provider-neutral market summary for discovery listings. */
export type MarketSummary = Readonly<{
  marketId: MarketId;
  conditionId: ConditionId | null;
  question: string | null;
  slug: string | null;
  status: MarketLifecycleStatus;
  endDate: string | null;
  liquidity: DecimalString | null;
}>;

/** Fee metadata the provider publicly exposes for one market. */
export type MarketFeeMetadata = Readonly<{
  feesEnabled: boolean | null;
  feeType: string | null;
}>;

/** Full provider-neutral market detail. */
export type MarketDetail = Readonly<{
  marketId: MarketId;
  conditionId: ConditionId | null;
  question: string | null;
  slug: string | null;
  status: MarketLifecycleStatus;
  endDate: string | null;
  description: string | null;
  outcomes: readonly OutcomeAsset[];
  minOrderSize: DecimalString | null;
  tickSize: DecimalString | null;
  negRisk: boolean | null;
  fees: MarketFeeMetadata;
}>;

/** One price level of one side of a book. */
export type BookLevel = Readonly<{ price: DecimalString; size: DecimalString }>;

/**
 * Full public order-book snapshot. `bids` are ordered descending (best first),
 * `asks` ascending (best first); the adapter canonicalizes the order so the
 * provider's layout can never leak into downstream decisions.
 */
export type OrderBookSnapshot = Readonly<{
  assetId: AssetId;
  conditionId: ConditionId;
  bids: readonly BookLevel[];
  asks: readonly BookLevel[];
  timestamp: number | null;
  hash: string | null;
  minOrderSize: DecimalString | null;
  tickSize: DecimalString | null;
  negRisk: boolean | null;
  lastTradePrice: DecimalString | null;
}>;

/** Best bid/ask pair for one asset. */
export type BestPrices = Readonly<{
  assetId: AssetId;
  bestBid: DecimalString | null;
  bestAsk: DecimalString | null;
}>;

/** Side of a book level or trade, exactly as the provider names it. */
export type ProviderOrderSide = "BUY" | "SELL";

/** One normalized inside a `price_change` event. */
export type PriceChangeItem = Readonly<{
  assetId: AssetId;
  price: DecimalString;
  size: DecimalString;
  side: ProviderOrderSide;
  hash: string | null;
  bestBid: DecimalString | null;
  bestAsk: DecimalString | null;
}>;

/** Normalized public market stream event union. */
export type MarketStreamEvent =
  | Readonly<{
      type: "book";
      assetId: AssetId;
      conditionId: ConditionId;
      bids: readonly BookLevel[];
      asks: readonly BookLevel[];
      timestamp: number | null;
      hash: string | null;
      minOrderSize: DecimalString | null;
      tickSize: DecimalString | null;
      negRisk: boolean | null;
      lastTradePrice: DecimalString | null;
    }>
  | Readonly<{
      type: "price_change";
      conditionId: ConditionId;
      changes: readonly PriceChangeItem[];
      timestamp: number | null;
    }>
  | Readonly<{
      type: "last_trade_price";
      assetId: AssetId;
      conditionId: ConditionId;
      price: DecimalString;
      side: ProviderOrderSide | null;
      size: DecimalString | null;
      feeRateBps: DecimalString | null;
      timestamp: number | null;
    }>
  | Readonly<{
      type: "tick_size_change";
      assetId: AssetId;
      conditionId: ConditionId;
      oldTickSize: DecimalString | null;
      newTickSize: DecimalString;
      timestamp: number | null;
    }>
  | Readonly<{
      type: "best_bid_ask";
      assetId: AssetId;
      conditionId: ConditionId;
      bestBid: DecimalString | null;
      bestAsk: DecimalString | null;
      spread: DecimalString | null;
      timestamp: number | null;
    }>
  | Readonly<{
      type: "market_resolved";
      conditionId: ConditionId;
      winningAssetId: AssetId | null;
      winningOutcome: string | null;
      timestamp: number | null;
    }>
  | Readonly<{
      type: "stream_error";
      code: ProviderErrorCode;
      message: string;
      /** True when the connection itself is still usable after this error. */
      recoverable: boolean;
    }>;

/**
 * Deterministic stream connection state.
 *
 * - `CONNECTING` — a connection attempt is in flight.
 * - `SYNCING` — the socket is open and the subscription was sent, but no book
 *   snapshot has been (re)received yet; the book state is NOT trustworthy.
 * - `LIVE` — data is flowing and fresher than the staleness threshold.
 * - `STALE` — the connection may be alive but no data arrived within the
 *   threshold; downstream must treat book state as unknown.
 * - `DISCONNECTED` — the socket is down (reconnect may be scheduled).
 */
export type ConnectionState =
  | "CONNECTING"
  | "SYNCING"
  | "LIVE"
  | "STALE"
  | "DISCONNECTED";

/** Normalized provider error codes for the public read-only surface. */
export type ProviderErrorCode =
  | "PROVIDER_BAD_REQUEST"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_MALFORMED"
  | "PROVIDER_STREAM_MALFORMED"
  | "PROVIDER_REJECTED";

/** Error category for retry/policy decisions downstream. */
export type ProviderErrorCategory =
  | "transient"
  | "permanent"
  | "malformed"
  | "rate_limited";

/**
 * The single error type the provider boundary throws or emits. The original
 * provider/SDK error is never re-thrown across the boundary; only its
 * normalized classification and a bounded message are carried.
 */
export class PolymarketProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly category: ProviderErrorCategory;
  readonly status: number | null;

  constructor(
    code: ProviderErrorCode,
    message: string,
    options: Readonly<{
      category?: ProviderErrorCategory;
      status?: number | null;
    }> = {},
  ) {
    super(`[${code}] ${message}`);
    this.name = "PolymarketProviderError";
    this.code = code;
    this.category = options.category ?? defaultCategory(code);
    this.status = options.status ?? null;
  }
}

function defaultCategory(code: ProviderErrorCode): ProviderErrorCategory {
  switch (code) {
    case "PROVIDER_RATE_LIMITED":
      return "rate_limited";
    case "PROVIDER_TIMEOUT":
    case "PROVIDER_UNAVAILABLE":
      return "transient";
    case "PROVIDER_MALFORMED":
    case "PROVIDER_STREAM_MALFORMED":
      return "malformed";
    case "PROVIDER_BAD_REQUEST":
    case "PROVIDER_NOT_FOUND":
    case "PROVIDER_REJECTED":
      return "permanent";
  }
}

/**
 * Result of a bounded discovery listing. `limitReached` is true when the page
 * budget or the provider's own depth limit stopped the listing, so a caller
 * knows completeness could not be established.
 */
export type DiscoveryPage = Readonly<{
  markets: readonly MarketSummary[];
  pagesFetched: number;
  limitReached: boolean;
}>;

/** Port for public, read-only market discovery. */
export interface PolymarketDiscovery {
  /** Lists active markets with a hard page budget. */
  readonly listActiveMarkets: (options?: {
    readonly maxPages?: number;
    readonly pageSize?: number;
  }) => Promise<DiscoveryPage>;
  /** Fetches one market's detail by condition id. */
  readonly fetchMarketDetail: (
    conditionId: ConditionId,
  ) => Promise<MarketDetail>;
  readonly close: () => Promise<void>;
}

/** Port for public, read-only book/price data. */
export interface PolymarketBook {
  readonly fetchOrderBook: (assetId: AssetId) => Promise<OrderBookSnapshot>;
  readonly fetchBestPrices: (assetId: AssetId) => Promise<BestPrices>;
  readonly fetchMidpoint: (assetId: AssetId) => Promise<DecimalString>;
  readonly fetchTickSize: (assetId: AssetId) => Promise<DecimalString>;
  /**
   * Last trade price when available; `null` when the provider reports that no
   * trade exists for the asset.
   */
  readonly fetchLastTradePrice: (
    assetId: AssetId,
  ) => Promise<DecimalString | null>;
  readonly close: () => Promise<void>;
}

/** Deterministic connection-state snapshot exposed by the stream. */
export type StreamState = Readonly<{
  state: ConnectionState;
  /** Generation counter: increments on every (re)connection attempt. */
  generation: number;
  /** Monotonic provider clock of the last data-bearing event. */
  lastDataAt: number | null;
}>;

/** Minimal socket contract the stream adapter drives (real or simulated). */
export interface StreamSocket {
  send: (data: string) => void;
  close: (code?: number) => void;
}

/** Handler the stream adapter registers on the socket. */
export interface StreamSocketHandler {
  onOpen: () => void;
  onMessage: (data: string) => void;
  onClose: (code: number, reason: string) => void;
  onError: (error: Error) => void;
}

export type StreamSocketFactory = (
  url: string,
  handler: StreamSocketHandler,
) => StreamSocket;

/** Injectable scheduler so every timer/clock read in the stream is deterministic. */
export interface StreamScheduler {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

/** Handle exposed to the consumer of the market stream. */
export interface MarketStreamHandle {
  readonly subscribe: (
    listener: (event: MarketStreamEvent) => void,
  ) => () => void;
  readonly onStateChange: (
    listener: (state: StreamState) => void,
  ) => () => void;
  readonly getState: () => StreamState;
  readonly close: () => void;
}

/** Options for {@link createPolymarketMarketStream}. */
export type MarketStreamOptions = Readonly<{
  /** Asset ids to subscribe to (the market channel takes asset ids). */
  assetIds: readonly string[];
  /** Explicit staleness threshold in ms. No hidden default. */
  stalenessThresholdMs: number;
  /** Heartbeat interval in ms (official docs: 10s). */
  pingIntervalMs?: number;
  /** Connect/subscribe timeout in ms. */
  connectTimeoutMs?: number;
  /** Deterministic reconnect delays in ms; the last value repeats forever. */
  reconnectDelaysMs?: readonly number[];
  /** Market channel endpoint. Default is the official market WebSocket. */
  wsUrl?: string;
  /** Socket factory (production wires `ws`; tests inject a deterministic fake). */
  socketFactory?: StreamSocketFactory;
  /** Injectable scheduler (tests inject a manual one). */
  scheduler?: StreamScheduler;
}>;
