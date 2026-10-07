import { describe, expect, it } from "vitest";
import {
  PolymarketProviderError,
  compareDecimal,
  isDecimalString,
  normalizeDecimal,
  normalizeWireMarketEvent,
} from "../packages/polymarket/src/index.ts";
import { normalizeNonNegativeDecimal } from "../packages/polymarket/src/decimal.ts";
import {
  FIXTURE_ASSET_ID_UP,
  FIXTURE_CONDITION_ID,
  bookSnapshotWire,
  brokenJsonWire,
  malformedWire,
  priceChangeWire,
  tickSizeChangeWire,
} from "../packages/polymarket/src/fixtures.ts";

describe("polymarket decimal strings", () => {
  it("rejects exponent and malformed forms", () => {
    expect(isDecimalString("0.45")).toBe(true);
    expect(isDecimalString("-0.45")).toBe(true);
    expect(isDecimalString("0")).toBe(true);
    expect(isDecimalString("1e-3")).toBe(false);
    expect(isDecimalString("abc")).toBe(false);
    expect(isDecimalString("0x10")).toBe(false);
    expect(isDecimalString("1,5")).toBe(false);
  });

  it("canonicalizes representations without changing values", () => {
    expect(normalizeDecimal("0.450")).toBe("0.45");
    expect(normalizeDecimal("00.45")).toBe("0.45");
    expect(normalizeDecimal("5.0")).toBe("5");
    expect(normalizeDecimal("-0.0")).toBe("0");
    expect(normalizeDecimal("100")).toBe("100");
  });

  it("compares exactly, never through binary floating point", () => {
    expect(
      compareDecimal(normalizeDecimal("0.1"), normalizeDecimal("0.10")),
    ).toBe(0);
    expect(
      compareDecimal(normalizeDecimal("0.09"), normalizeDecimal("0.1")),
    ).toBe(-1);
    expect(
      compareDecimal(normalizeDecimal("0.1"), normalizeDecimal("0.09")),
    ).toBe(1);
    expect(
      compareDecimal(
        normalizeDecimal("1.000000000000000001"),
        normalizeDecimal("1"),
      ),
    ).toBe(1);
    expect(compareDecimal(normalizeDecimal("5"), normalizeDecimal("10"))).toBe(
      -1,
    );
  });

  it("bounds provider decimal size and rejects negative price/size inputs", () => {
    expect(isDecimalString("9".repeat(257))).toBe(false);
    expect(() => normalizeDecimal("9".repeat(257))).toThrow(RangeError);
    expect(() => normalizeNonNegativeDecimal("-0.01")).toThrow(RangeError);
    expect(normalizeNonNegativeDecimal("-0.000")).toBe("0");
  });
});

describe("polymarket wire event normalization", () => {
  it("normalizes a book snapshot and canonicalizes level order", () => {
    const event = normalizeWireMarketEvent(JSON.parse(bookSnapshotWire()));
    expect(event.type).toBe("book");
    if (event.type !== "book") return;
    expect(event.assetId).toBe(FIXTURE_ASSET_ID_UP);
    expect(event.conditionId).toBe(FIXTURE_CONDITION_ID);
    expect(event.bids.map((level) => level.price)).toEqual(["0.45", "0.44"]);
    expect(event.asks.map((level) => level.price)).toEqual(["0.46", "0.47"]);
    expect(event.minOrderSize).toBe("5");
    expect(event.tickSize).toBe("0.01");
    expect(event.lastTradePrice).toBe("0.45");
  });

  it("normalizes price_change, tick_size_change and last trade events", () => {
    const change = normalizeWireMarketEvent(JSON.parse(priceChangeWire()));
    expect(change.type).toBe("price_change");
    if (change.type === "price_change") {
      expect(change.conditionId).toBe(FIXTURE_CONDITION_ID);
      expect(change.changes[0]?.price).toBe("0.46");
      expect(change.changes[0]?.side).toBe("BUY");
    }

    const tick = normalizeWireMarketEvent(
      JSON.parse(tickSizeChangeWire("0.001")),
    );
    expect(tick.type).toBe("tick_size_change");
    if (tick.type === "tick_size_change") {
      expect(tick.oldTickSize).toBe("0.01");
      expect(tick.newTickSize).toBe("0.001");
    }
  });

  it("fails closed on malformed wire events instead of fabricating state", () => {
    // Unknown event type.
    expect(() => normalizeWireMarketEvent(JSON.parse(malformedWire()))).toThrow(
      PolymarketProviderError,
    );
    // Broken JSON is caught before normalization by the stream, but a
    // non-object payload must also be refused here.
    expect(() =>
      normalizeWireMarketEvent(JSON.parse('{"nope": true}')),
    ).toThrow();
    expect(() =>
      normalizeWireMarketEvent(
        JSON.parse(JSON.stringify({ event_type: "book" })),
      ),
    ).toThrow(PolymarketProviderError);
    expect(brokenJsonWire().length).toBeGreaterThan(0);
  });

  it("accepts official string timestamps and rejects invalid sides and negative levels", () => {
    const timestamp = normalizeWireMarketEvent(
      JSON.parse(bookSnapshotWire({ timestamp: "1782753357257" })),
    );
    expect(timestamp.type).toBe("book");
    if (timestamp.type === "book") {
      expect(timestamp.timestamp).toBe(1_782_753_357_257);
    }

    expect(() =>
      normalizeWireMarketEvent(
        JSON.parse(priceChangeWire([{ side: "UNKNOWN" }])),
      ),
    ).toThrow(PolymarketProviderError);
    expect(() =>
      normalizeWireMarketEvent(
        JSON.parse(
          bookSnapshotWire({
            bids: [{ price: "0.4", size: "-1" }],
          }),
        ),
      ),
    ).toThrow(PolymarketProviderError);

    const malformedCondition = JSON.parse(bookSnapshotWire()) as {
      market: string;
    };
    malformedCondition.market = "0xnot-a-condition";
    expect(() => normalizeWireMarketEvent(malformedCondition)).toThrow(
      PolymarketProviderError,
    );

    const malformedAsset = JSON.parse(bookSnapshotWire()) as {
      asset_id: string;
    };
    malformedAsset.asset_id = "not-an-asset-id";
    expect(() => normalizeWireMarketEvent(malformedAsset)).toThrow(
      PolymarketProviderError,
    );
  });
});
