import { forkEnvironmentConfig, createPublicClient } from "@polymarket/client";
import {
  type AssetId,
  type ConditionId,
  type DecimalString,
  type DiscoveryPage,
  type MarketDetail,
  type MarketFeeMetadata,
  type MarketId,
  type MarketLifecycleStatus,
  type MarketSummary,
  type OutcomeAsset,
  type PolymarketBook,
  type PolymarketDiscovery,
  type BestPrices,
  type OrderBookSnapshot,
  type BookLevel,
  PolymarketProviderError,
} from "./contracts.ts";
import {
  isPlainObject,
  normalizeProviderCall,
  normalizeProviderError,
} from "./errors.ts";
import {
  normalizeNonNegativeDecimal,
  normalizePositiveDecimal,
  compareDecimal as compareDecimalExact,
} from "./decimal.ts";

/**
 * Read-only REST provider backed by the OFFICIAL unified SDK
 * (`@polymarket/client`, locked at 0.12.0). Only this file may touch the SDK:
 * every result is re-serialized into the provider-neutral contracts and every
 * failure is normalized before crossing the boundary.
 *
 * The SDK is used WITHOUT any credentials: `createPublicClient` takes no signer
 * and the public surfaces used here are documented as credential-free.
 */

const DEFAULT_MAX_PAGES = 5;
const DEFAULT_PAGE_SIZE = 100;
const MAX_DISCOVERY_PAGES = 20;
const MAX_DISCOVERY_PAGE_SIZE = 100;

export type RestProviderOptions = Readonly<{
  /** Override the Gamma REST base (tests point this at a local server). */
  gammaRestUrl?: string;
  /** Override the CLOB REST base (tests point this at a local server). */
  clobRestUrl?: string;
}>;

function buildClient(options: RestProviderOptions) {
  const environment =
    options.gammaRestUrl === undefined && options.clobRestUrl === undefined
      ? undefined
      : forkEnvironmentConfig({
          name: "polyhunter-read-only",
          ...(options.gammaRestUrl === undefined
            ? {}
            : { gamma: { rest: options.gammaRestUrl } }),
          ...(options.clobRestUrl === undefined
            ? {}
            : { clob: { rest: options.clobRestUrl } }),
        });
  // No credential option of any kind is passed: this client is read-only.
  return createPublicClient(environment === undefined ? {} : { environment });
}

type SdkMarket = {
  id: string;
  conditionId: string | null;
  question: string | null;
  slug: string | null;
  description?: string | null;
  state: {
    active?: boolean | null;
    closed?: boolean | null;
    archived?: boolean | null;
    endDate?: string | null;
    negRisk?: boolean | null;
  };
  metrics: { liquidity?: string | null };
  resolution: { umaResolutionStatus?: string | null };
  version?: "v1" | "v2" | null;
  outcomes: {
    yes: {
      label: string;
      tokenId: string | null;
      positionId: string | null;
      price: string | null;
    };
    no: {
      label: string;
      tokenId: string | null;
      positionId: string | null;
      price: string | null;
    };
  };
  trading: {
    minimumOrderSize?: string | null;
    minimumTickSize?: string | number | null;
    feesEnabled?: boolean | null;
    feeType?: string | null;
  };
};

function assertMarketShape(value: unknown): SdkMarket {
  if (!isPlainObject(value)) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market payload is not an object",
    );
  }
  if (typeof value.id !== "string" || !/^[1-9]\d*$/.test(value.id)) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market payload has no id",
    );
  }
  if (!isPlainObject(value.state) || !isPlainObject(value.outcomes)) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market payload has no state/outcomes",
    );
  }
  const state = value.state;
  for (const key of ["active", "closed", "archived"] as const) {
    if (
      state[key] !== undefined &&
      state[key] !== null &&
      typeof state[key] !== "boolean"
    ) {
      throw new PolymarketProviderError(
        "PROVIDER_MALFORMED",
        `market lifecycle flag ${key} is invalid`,
      );
    }
  }
  if (
    state.endDate !== undefined &&
    state.endDate !== null &&
    typeof state.endDate !== "string"
  ) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market end date is invalid",
    );
  }
  if (
    value.version !== undefined &&
    value.version !== null &&
    value.version !== "v1" &&
    value.version !== "v2"
  ) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market protocol version is invalid",
    );
  }
  if (!isPlainObject(value.metrics) || !isPlainObject(value.resolution)) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market payload has no metrics/resolution metadata",
    );
  }
  const liquidity = value.metrics.liquidity;
  if (
    liquidity !== undefined &&
    liquidity !== null &&
    typeof liquidity !== "string"
  ) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market liquidity is invalid",
    );
  }
  const resolutionStatus = value.resolution.umaResolutionStatus;
  if (
    resolutionStatus !== undefined &&
    resolutionStatus !== null &&
    typeof resolutionStatus !== "string"
  ) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market resolution status is invalid",
    );
  }
  if (!isPlainObject(value.outcomes.yes) || !isPlainObject(value.outcomes.no)) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market payload is missing binary outcome metadata",
    );
  }
  for (const [name, outcome] of Object.entries(value.outcomes)) {
    if (!isPlainObject(outcome) || typeof outcome.label !== "string") {
      throw new PolymarketProviderError(
        "PROVIDER_MALFORMED",
        `market outcome ${name} is invalid`,
      );
    }
    if (outcome.label.trim().length === 0) {
      throw new PolymarketProviderError(
        "PROVIDER_MALFORMED",
        `market outcome ${name} has an empty label`,
      );
    }
    for (const key of ["tokenId", "positionId", "price"] as const) {
      const field = outcome[key];
      if (
        field !== undefined &&
        field !== null &&
        (typeof field !== "string" || (key !== "price" && !validAssetId(field)))
      ) {
        throw new PolymarketProviderError(
          "PROVIDER_MALFORMED",
          `market outcome ${name}.${key} is invalid`,
        );
      }
    }
  }
  if (!isPlainObject(value.trading)) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market payload has no trading metadata",
    );
  }
  for (const key of [
    "minimumOrderSize",
    "minimumTickSize",
    "feeType",
  ] as const) {
    const field = value.trading[key];
    if (
      field !== undefined &&
      field !== null &&
      typeof field !== "string" &&
      !(
        key === "minimumTickSize" &&
        typeof field === "number" &&
        Number.isFinite(field)
      )
    ) {
      throw new PolymarketProviderError(
        "PROVIDER_MALFORMED",
        `market trading field ${key} is invalid`,
      );
    }
  }
  if (
    value.trading.feesEnabled !== undefined &&
    value.trading.feesEnabled !== null &&
    typeof value.trading.feesEnabled !== "boolean"
  ) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market feesEnabled flag is invalid",
    );
  }
  for (const key of ["question", "slug", "description"] as const) {
    const field = value[key];
    if (field !== undefined && field !== null && typeof field !== "string") {
      throw new PolymarketProviderError(
        "PROVIDER_MALFORMED",
        `market field ${key} is invalid`,
      );
    }
  }
  if (
    value.conditionId !== undefined &&
    value.conditionId !== null &&
    (typeof value.conditionId !== "string" ||
      !validConditionId(value.conditionId))
  ) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "market condition id is invalid",
    );
  }
  return value as SdkMarket;
}

function lifecycleOf(
  state: SdkMarket["state"],
  resolution: SdkMarket["resolution"],
): MarketLifecycleStatus {
  if (state.archived === true) return "archived";
  const resolutionStatus = resolution.umaResolutionStatus?.toLowerCase();
  if (resolutionStatus === "resolved" || resolutionStatus === "settled") {
    return "resolved";
  }
  if (state.closed === true) return "closed";
  if (state.active === true) return "active";
  throw new PolymarketProviderError(
    "PROVIDER_MALFORMED",
    "market lifecycle state is unknown",
  );
}

function validConditionId(value: string): boolean {
  return /^0x[a-f0-9]{64}$/i.test(value);
}

function validAssetId(value: string): boolean {
  return /^(?:0x[a-f0-9]{64}|\d{1,78})$/i.test(value);
}

function requireConditionId(value: string): ConditionId {
  if (!validConditionId(value)) {
    throw new PolymarketProviderError(
      "PROVIDER_BAD_REQUEST",
      "market condition id is invalid",
    );
  }
  return value as ConditionId;
}

function requireAssetId(value: string): AssetId {
  if (!validAssetId(value)) {
    throw new PolymarketProviderError(
      "PROVIDER_BAD_REQUEST",
      "market asset id is invalid",
    );
  }
  return value as AssetId;
}

function nullableDecimal(value: unknown): DecimalString | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "provider decimal field is not a string",
    );
  }
  return normalizeNonNegativeDecimal(value);
}

function nullableTickSize(value: unknown): DecimalString | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "provider tick size is invalid",
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new PolymarketProviderError(
      "PROVIDER_MALFORMED",
      "provider tick size is not finite",
    );
  }
  return normalizePositiveDecimal(String(value));
}

function boundedOption(
  value: number | undefined,
  fallback: number,
  maximum: number,
  name: string,
): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > maximum) {
    throw new PolymarketProviderError(
      "PROVIDER_BAD_REQUEST",
      `${name} must be an integer between 1 and ${maximum}`,
    );
  }
  return selected;
}

function toSummary(market: SdkMarket): MarketSummary {
  return {
    marketId: market.id as MarketId,
    conditionId:
      typeof market.conditionId === "string" && market.conditionId.length > 0
        ? (market.conditionId as ConditionId)
        : null,
    question: market.question ?? null,
    slug: market.slug ?? null,
    status: lifecycleOf(market.state, market.resolution),
    endDate: market.state.endDate ?? null,
    liquidity: nullableDecimal(market.metrics.liquidity),
  };
}

/** Read-only discovery over the official Gamma-backed SDK surface. */
export function createPolymarketDiscovery(
  options: RestProviderOptions = {},
): PolymarketDiscovery {
  const client = buildClient(options);

  return {
    async listActiveMarkets(listOptions = {}) {
      const maxPages = boundedOption(
        listOptions.maxPages,
        DEFAULT_MAX_PAGES,
        MAX_DISCOVERY_PAGES,
        "maxPages",
      );
      const pageSize = boundedOption(
        listOptions.pageSize,
        DEFAULT_PAGE_SIZE,
        MAX_DISCOVERY_PAGE_SIZE,
        "pageSize",
      );
      return normalizeProviderCall(async () => {
        const paginated = client.listMarkets({
          closed: false,
          pageSize,
        });
        const markets: MarketSummary[] = [];
        let pagesFetched = 0;
        let limitReached = false;
        let page = await paginated.firstPage();
        for (;;) {
          if (!Array.isArray(page.items) || typeof page.hasMore !== "boolean") {
            throw new PolymarketProviderError(
              "PROVIDER_MALFORMED",
              "market page has an invalid shape",
            );
          }
          pagesFetched += 1;
          for (const item of page.items) {
            const summary = toSummary(assertMarketShape(item));
            if (summary.status === "active") markets.push(summary);
          }
          if (page.limitReached === true) {
            limitReached = true;
            break;
          }
          if (!page.hasMore || pagesFetched >= maxPages) {
            if (page.hasMore && pagesFetched >= maxPages) limitReached = true;
            break;
          }
          const cursor = page.nextCursor;
          if (typeof cursor !== "string" || cursor.length === 0) {
            throw new PolymarketProviderError(
              "PROVIDER_MALFORMED",
              "market page indicates more results without a cursor",
            );
          }
          page = await paginated.from(cursor).firstPage();
        }
        const result: DiscoveryPage = { markets, pagesFetched, limitReached };
        return result;
      });
    },

    async fetchMarketDetail(conditionId) {
      return normalizeProviderCall(async () => {
        const requestedConditionId = requireConditionId(conditionId);
        const market = assertMarketShape(
          await client.fetchMarket({ id: requestedConditionId }),
        );
        if (market.conditionId !== requestedConditionId) {
          throw new PolymarketProviderError(
            "PROVIDER_MALFORMED",
            "market detail response does not match the requested condition id",
          );
        }
        const outcomes: OutcomeAsset[] = [
          market.outcomes.yes,
          market.outcomes.no,
        ].map((outcome) => ({
          label: outcome.label,
          assetId:
            market.version === "v2"
              ? outcome.positionId == null
                ? null
                : (outcome.positionId as AssetId)
              : outcome.tokenId == null
                ? null
                : (outcome.tokenId as AssetId),
          price: nullableDecimal(outcome.price),
        }));
        const fees: MarketFeeMetadata = {
          feesEnabled: market.trading.feesEnabled ?? null,
          feeType: market.trading.feeType ?? null,
        };
        const detail: MarketDetail = {
          marketId: market.id as MarketId,
          conditionId:
            typeof market.conditionId === "string"
              ? (market.conditionId as ConditionId)
              : null,
          question: market.question ?? null,
          slug: market.slug ?? null,
          status: lifecycleOf(market.state, market.resolution),
          endDate: market.state.endDate ?? null,
          description: market.description ?? null,
          outcomes,
          minOrderSize: nullableDecimal(market.trading.minimumOrderSize),
          tickSize: nullableTickSize(market.trading.minimumTickSize),
          negRisk: market.state.negRisk ?? null,
          fees,
        };
        return detail;
      });
    },

    async close() {
      // The public client holds no credentials and no persistent sockets; if a
      // teardown hook exists on the client, use it.
      const teardown = (client as { close?: () => Promise<void> | void }).close;
      if (typeof teardown === "function") {
        await teardown.call(client);
      }
    },
  };
}

/** Read-only book/price access over the official CLOB-backed SDK surface. */
export function createPolymarketBook(
  options: RestProviderOptions = {},
): PolymarketBook {
  const client = buildClient(options);
  const asAssetId = (assetId: AssetId) => requireAssetId(assetId);

  function toSnapshot(
    raw: unknown,
    expectedAssetId: AssetId,
  ): OrderBookSnapshot {
    if (!isPlainObject(raw)) {
      throw new PolymarketProviderError(
        "PROVIDER_MALFORMED",
        "book payload is not an object",
      );
    }
    if (
      !Array.isArray(raw.bids) ||
      !Array.isArray(raw.asks) ||
      typeof raw.assetId !== "string" ||
      typeof raw.conditionId !== "string" ||
      raw.assetId !== expectedAssetId ||
      !validConditionId(raw.conditionId)
    ) {
      throw new PolymarketProviderError(
        "PROVIDER_MALFORMED",
        "book payload has no bids/asks/assetId/conditionId",
      );
    }
    const level = (value: unknown): BookLevel => {
      if (
        !isPlainObject(value) ||
        typeof value.price !== "string" ||
        typeof value.size !== "string"
      ) {
        throw new PolymarketProviderError(
          "PROVIDER_MALFORMED",
          "book level is not a decimal pair",
        );
      }
      return {
        price: normalizeNonNegativeDecimal(value.price),
        size: normalizeNonNegativeDecimal(value.size),
      };
    };
    const bids = (raw.bids as unknown[])
      .map(level)
      .sort((a, b) => -compareLevels(a, b));
    const asks = (raw.asks as unknown[]).map(level).sort(compareLevels);
    const tick = nullableTickSize(raw.tickSize);
    const min = nullableDecimal(raw.minOrderSize);
    const last = nullableDecimal(raw.lastTradePrice);
    const rawTimestamp = raw.timestamp;
    const timestamp = rawTimestamp == null ? null : rawTimestamp;
    if (
      timestamp !== null &&
      (typeof timestamp !== "number" ||
        !Number.isSafeInteger(timestamp) ||
        timestamp < 0)
    ) {
      throw new PolymarketProviderError(
        "PROVIDER_MALFORMED",
        "order book timestamp is invalid",
      );
    }
    const snapshot: OrderBookSnapshot = {
      assetId: raw.assetId as AssetId,
      conditionId: raw.conditionId as ConditionId,
      bids,
      asks,
      timestamp,
      hash: typeof raw.hash === "string" ? raw.hash : null,
      minOrderSize: min,
      tickSize: tick,
      negRisk: typeof raw.negRisk === "boolean" ? raw.negRisk : null,
      lastTradePrice: last,
    };
    return snapshot;
  }

  function compareLevels(a: BookLevel, b: BookLevel): number {
    return compareDecimalExact(a.price, b.price);
  }

  return {
    async fetchOrderBook(assetId) {
      return normalizeProviderCall(async () =>
        toSnapshot(
          await client.fetchOrderBook({ assetId: asAssetId(assetId) }),
          assetId,
        ),
      );
    },

    async fetchBestPrices(assetId) {
      return normalizeProviderCall(async () => {
        const snapshot = toSnapshot(
          await client.fetchOrderBook({ assetId: asAssetId(assetId) }),
          assetId,
        );
        const bestPrices: BestPrices = {
          assetId,
          bestBid: snapshot.bids[0]?.price ?? null,
          bestAsk: snapshot.asks[0]?.price ?? null,
        };
        return bestPrices;
      });
    },

    async fetchMidpoint(assetId) {
      return normalizeProviderCall(async () =>
        normalizeNonNegativeDecimal(
          await client.fetchMidpoint({ assetId: asAssetId(assetId) }),
        ),
      );
    },

    async fetchTickSize(assetId) {
      return normalizeProviderCall(async () => {
        const snapshot = toSnapshot(
          await client.fetchOrderBook({ assetId: asAssetId(assetId) }),
          assetId,
        );
        if (snapshot.tickSize === null) {
          throw new PolymarketProviderError(
            "PROVIDER_MALFORMED",
            "order book omitted required tick size",
          );
        }
        return snapshot.tickSize;
      });
    },

    async fetchLastTradePrice(assetId) {
      return normalizeProviderCall(async () => {
        try {
          const raw = await client.fetchLastTradePrice({
            assetId: asAssetId(assetId),
          });
          return nullableDecimal(
            typeof raw === "string" ? raw : (raw as { price?: string }).price,
          );
        } catch (error: unknown) {
          const normalized = normalizeProviderError(error);
          if (normalized.code === "PROVIDER_NOT_FOUND") {
            // No trade has ever happened: "not available" is a normal outcome.
            return null;
          }
          throw normalized;
        }
      });
    },

    async close() {
      const teardown = (client as { close?: () => Promise<void> | void }).close;
      if (typeof teardown === "function") {
        await teardown.call(client);
      }
    },
  };
}
