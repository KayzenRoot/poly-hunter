/**
 * Deterministic wire fixtures for the public market channel, exactly as
 * documented (snake_case wire shapes) and as needed for fault scenarios. These
 * are TEST FIXTURES: no value here is live provider state.
 */

export const FIXTURE_ASSET_ID_UP = "8231647913264700360128330186904222996491";
export const FIXTURE_ASSET_ID_DOWN = "9402123472284574731689299019469203961978";
export const FIXTURE_CONDITION_ID =
  "0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809";

export function bookSnapshotWire(
  overrides: {
    bids?: Array<{ price: string; size: string }>;
    asks?: Array<{ price: string; size: string }>;
    timestamp?: number | string;
  } = {},
): string {
  return JSON.stringify({
    event_type: "book",
    asset_id: FIXTURE_ASSET_ID_UP,
    market: FIXTURE_CONDITION_ID,
    bids: overrides.bids ?? [
      { price: "0.44", size: "200" },
      { price: "0.45", size: "100" },
    ],
    asks: overrides.asks ?? [
      { price: "0.46", size: "150" },
      { price: "0.47", size: "250" },
    ],
    timestamp: overrides.timestamp ?? "1700000000000",
    hash: "a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4",
    min_order_size: "5",
    tick_size: "0.01",
    neg_risk: false,
    last_trade_price: "0.45",
  });
}

export function priceChangeWire(
  changes: Array<
    Partial<{ price: string; size: string; side: string; asset_id: string }>
  > = [{ price: "0.46", size: "40", side: "BUY" }],
): string {
  return JSON.stringify({
    event_type: "price_change",
    market: FIXTURE_CONDITION_ID,
    timestamp: "1700000000500",
    price_changes: changes.map((change) => ({
      asset_id: change.asset_id ?? FIXTURE_ASSET_ID_UP,
      price: change.price ?? "0.46",
      size: change.size ?? "40",
      side: change.side ?? "BUY",
      hash: "b2c3d4e5f6071801a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718",
      best_bid: "0.46",
      best_ask: "0.47",
    })),
  });
}

export function tickSizeChangeWire(newTickSize = "0.001"): string {
  return JSON.stringify({
    event_type: "tick_size_change",
    asset_id: FIXTURE_ASSET_ID_UP,
    market: FIXTURE_CONDITION_ID,
    old_tick_size: "0.01",
    new_tick_size: newTickSize,
    timestamp: "1700000001000",
  });
}

export function lastTradePriceWire(): string {
  return JSON.stringify({
    event_type: "last_trade_price",
    asset_id: FIXTURE_ASSET_ID_UP,
    market: FIXTURE_CONDITION_ID,
    price: "0.47",
    side: "SELL",
    size: "12",
    fee_rate_bps: "0",
    timestamp: "1700000001500",
    transaction_hash: "0xtrade",
  });
}

export function malformedWire(): string {
  return JSON.stringify({
    event_type: "mystery_event",
    nonsense: true,
  });
}

export function brokenJsonWire(): string {
  return '{"event_type": "book", asset_id: NOT-JSON';
}
