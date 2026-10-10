/**
 * Wire → neutral normalization for the public market channel.
 *
 * The wire shapes are the officially documented snake_case payloads; every
 * event is validated fail-closed here and mapped into the neutral union. A
 * malformed event NEVER fabricates book state — the stream turns the throw
 * into a stream_error.
 */
import { z } from "zod";
import {
  type AssetId,
  type BookLevel,
  type ConditionId,
  type DecimalString,
  type MarketStreamEvent,
  type ProviderOrderSide,
  PolymarketProviderError,
} from "@polyhunter/contracts";
import {
  compareDecimal,
  normalizeNonNegativeDecimal,
  normalizePositiveDecimal,
} from "./decimal.ts";

const WireLevel = z.object({ price: z.string(), size: z.string() });
const WirePriceChange = z.object({
  asset_id: z.string(),
  price: z.string(),
  size: z.string(),
  side: z.string(),
  hash: z.string().nullish(),
  best_bid: z.string().nullish(),
  best_ask: z.string().nullish(),
});
const WireEvent = z.object({ event_type: z.string() }).passthrough();

/**
 * Every wire parse is wrapped: a schema violation is a PROVIDER_MALFORMED
 * provider error, never a raw ZodError crossing the boundary.
 */
function parseWire<TSchema extends z.ZodType>(
  schema: TSchema,
  raw: unknown,
): z.output<TSchema> {
  try {
    return schema.parse(raw);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new PolymarketProviderError(
        "PROVIDER_MALFORMED",
        "wire event failed schema validation",
        { category: "malformed" },
      );
    }
    throw error;
  }
}

export function normalizeWireMarketEvent(raw: unknown): MarketStreamEvent {
  const parsed = parseWire(WireEvent, raw);
  const eventType = parsed.event_type;
  const malformed = (message: string): never => {
    throw new PolymarketProviderError("PROVIDER_MALFORMED", message, {
      category: "malformed",
    });
  };
  const asCondition = (value: string): ConditionId => {
    if (!/^0x[a-f0-9]{64}$/i.test(value)) {
      return malformed("market condition id is invalid");
    }
    return value as ConditionId;
  };
  const asAsset = (value: string): AssetId => {
    if (!/^(?:0x[a-f0-9]{64}|\d{1,78})$/i.test(value)) {
      return malformed("market asset id is invalid");
    }
    return value as AssetId;
  };
  const asDecimal = (value: string): DecimalString => {
    try {
      return normalizeNonNegativeDecimal(value);
    } catch (error: unknown) {
      if (error instanceof RangeError)
        return malformed("decimal value is invalid");
      throw error;
    }
  };
  const nullableDecimal = (
    value: string | null | undefined,
  ): DecimalString | null => {
    if (value == null) return null;
    return asDecimal(value);
  };
  const nullablePositiveDecimal = (
    value: string | null | undefined,
  ): DecimalString | null => {
    if (value == null) return null;
    try {
      return normalizePositiveDecimal(value);
    } catch (error: unknown) {
      if (error instanceof RangeError) return malformed("tick size is invalid");
      throw error;
    }
  };
  const requiredPositiveDecimal = (value: string): DecimalString => {
    try {
      return normalizePositiveDecimal(value);
    } catch (error: unknown) {
      if (error instanceof RangeError) return malformed("tick size is invalid");
      throw error;
    }
  };
  const asTimestamp = (
    value: number | string | null | undefined,
  ): number | null => {
    if (value == null) return null;
    if (typeof value === "string" && !/^\d{1,16}$/.test(value)) {
      return malformed("timestamp is not an epoch-millisecond integer");
    }
    const timestamp = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
      return malformed("timestamp is outside the safe epoch-millisecond range");
    }
    return timestamp;
  };
  const asSide = (value: string): ProviderOrderSide => {
    if (value === "BUY" || value === "SELL") return value;
    return malformed("market event side is invalid");
  };

  switch (eventType) {
    case "book": {
      const book = parseWire(
        z.object({
          asset_id: z.string(),
          market: z.string(),
          bids: z.array(WireLevel),
          asks: z.array(WireLevel),
          timestamp: z.union([z.number(), z.string()]).nullish(),
          hash: z.string().nullish(),
          min_order_size: z.string().nullish(),
          tick_size: z.string().nullish(),
          neg_risk: z.boolean().nullish(),
          last_trade_price: z.string().nullish(),
        }),
        raw,
      );
      const bids = book.bids.map((level) => ({
        price: asDecimal(level.price),
        size: asDecimal(level.size),
      }));
      const asks = book.asks.map((level) => ({
        price: asDecimal(level.price),
        size: asDecimal(level.size),
      }));
      return {
        type: "book",
        assetId: asAsset(book.asset_id),
        conditionId: asCondition(book.market),
        bids: sortLevelsDescending(bids),
        asks: sortLevelsAscending(asks),
        timestamp: asTimestamp(book.timestamp),
        hash: book.hash ?? null,
        minOrderSize: nullableDecimal(book.min_order_size),
        tickSize: nullablePositiveDecimal(book.tick_size),
        negRisk: book.neg_risk ?? null,
        lastTradePrice: nullableDecimal(book.last_trade_price),
      };
    }
    case "price_change": {
      const change = parseWire(
        z.object({
          market: z.string(),
          price_changes: z.array(WirePriceChange).min(1),
          timestamp: z.union([z.number(), z.string()]).nullish(),
        }),
        raw,
      );
      return {
        type: "price_change",
        conditionId: asCondition(change.market),
        changes: change.price_changes.map((item) => ({
          assetId: asAsset(item.asset_id),
          price: asDecimal(item.price),
          size: asDecimal(item.size),
          side: asSide(item.side),
          hash: item.hash ?? null,
          bestBid: nullableDecimal(item.best_bid),
          bestAsk: nullableDecimal(item.best_ask),
        })),
        timestamp: asTimestamp(change.timestamp),
      };
    }
    case "last_trade_price": {
      const trade = parseWire(
        z.object({
          asset_id: z.string(),
          market: z.string(),
          price: z.string(),
          side: z.string().nullish(),
          size: z.string().nullish(),
          fee_rate_bps: z.string().nullish(),
          timestamp: z.union([z.number(), z.string()]).nullish(),
        }),
        raw,
      );
      return {
        type: "last_trade_price",
        assetId: asAsset(trade.asset_id),
        conditionId: asCondition(trade.market),
        price: asDecimal(trade.price),
        side: trade.side == null ? null : asSide(trade.side),
        size: nullableDecimal(trade.size),
        feeRateBps: nullableDecimal(trade.fee_rate_bps),
        timestamp: asTimestamp(trade.timestamp),
      };
    }
    case "tick_size_change": {
      const tick = parseWire(
        z.object({
          asset_id: z.string(),
          market: z.string(),
          old_tick_size: z.string().nullish(),
          new_tick_size: z.string(),
          timestamp: z.union([z.number(), z.string()]).nullish(),
        }),
        raw,
      );
      return {
        type: "tick_size_change",
        assetId: asAsset(tick.asset_id),
        conditionId: asCondition(tick.market),
        oldTickSize: nullablePositiveDecimal(tick.old_tick_size),
        newTickSize: requiredPositiveDecimal(tick.new_tick_size),
        timestamp: asTimestamp(tick.timestamp),
      };
    }
    default:
      throw new PolymarketProviderError(
        "PROVIDER_STREAM_MALFORMED",
        `unknown market event_type: ${String(eventType)}`,
        { category: "malformed" },
      );
  }
}

function sortLevelsDescending(levels: readonly BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => -compareDecimal(a.price, b.price));
}

function sortLevelsAscending(levels: readonly BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => compareDecimal(a.price, b.price));
}
