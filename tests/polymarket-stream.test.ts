import { describe, expect, it } from "vitest";
import {
  type ConnectionState,
  type MarketStreamEvent,
  type StreamSocket,
  createPolymarketMarketStream,
} from "../packages/polymarket/src/index.ts";
import {
  FIXTURE_ASSET_ID_UP,
  bookSnapshotWire,
  brokenJsonWire,
  lastTradePriceWire,
  malformedWire,
  priceChangeWire,
  tickSizeChangeWire,
} from "../packages/polymarket/src/fixtures.ts";

/**
 * Deterministic stream acceptance: a fake socket + manual scheduler drive the
 * adapter through every documented scenario. No sleep decides ordering; the
 * scheduler is advanced by hand.
 */

class ManualScheduler {
  private timerId = 0;
  readonly timers = new Map<number, { fn: () => void; at: number }>();
  private currentTime = 1_700_000_000_000;

  now(): number {
    return this.currentTime;
  }

  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.timerId;
    this.timers.set(id, { fn, at: this.currentTime + ms });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  /** Runs every due timer in order; returns how many fired. */
  advance(ms: number): number {
    let fired = 0;
    const target = this.currentTime + ms;
    for (;;) {
      let bestId: number | null = null;
      let bestAt = Number.POSITIVE_INFINITY;
      for (const [id, timer] of this.timers) {
        if (timer.at <= target && timer.at < bestAt) {
          bestAt = timer.at;
          bestId = id;
        }
      }
      if (bestId === null) break;
      const timer = this.timers.get(bestId);
      this.timers.delete(bestId);
      this.currentTime = Math.max(this.currentTime, bestAt);
      timer?.fn();
      fired += 1;
    }
    this.currentTime = target;
    return fired;
  }
}

class FakeSocket implements StreamSocket {
  readonly sent: string[] = [];
  closed = false;
  openHandler: (() => void) | null = null;
  messageHandler: ((data: string) => void) | null = null;
  closeHandler: ((code: number, reason: string) => void) | null = null;
  errorHandler: ((error: Error) => void) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.closeHandler?.(1000, "closed");
  }

  /* driver-side helpers (the fake plays the provider role) */
  open(): void {
    this.openHandler?.();
  }
  message(data: string): void {
    this.messageHandler?.(data);
  }
  drop(code = 1006): void {
    this.closeHandler?.(code, "connection reset");
  }
  fail(error: Error): void {
    this.errorHandler?.(error);
  }
}

function setup(optionsOverride: Record<string, unknown> = {}) {
  const scheduler = new ManualScheduler();
  const sockets: FakeSocket[] = [];
  const events: MarketStreamEvent[] = [];
  const states: Array<{ state: ConnectionState; generation: number }> = [];
  const handle = createPolymarketMarketStream({
    assetIds: [FIXTURE_ASSET_ID_UP],
    stalenessThresholdMs: 5_000,
    pingIntervalMs: 1_000,
    connectTimeoutMs: 2_000,
    scheduler,
    socketFactory: (url, handler) => {
      expect(url).toBe("wss://ws-subscriptions-clob.polymarket.com/ws/market");
      const socket = new FakeSocket();
      socket.openHandler = handler.onOpen;
      socket.messageHandler = handler.onMessage;
      socket.closeHandler = handler.onClose;
      socket.errorHandler = handler.onError;
      sockets.push(socket);
      return socket;
    },
    ...(optionsOverride as object),
  });
  handle.subscribe((event) => events.push(event));
  handle.onStateChange((state) =>
    states.push({ state: state.state, generation: state.generation }),
  );
  return { scheduler, sockets, events, states, handle };
}

describe("polymarket market stream", () => {
  it("walks CONNECTING -> SYNCING -> LIVE and emits a normalized book", () => {
    const { sockets, events, states, handle } = setup();
    expect(states[0]?.state).toBe("CONNECTING");
    sockets[0]?.open();
    expect(states.at(-1)?.state).toBe("SYNCING");
    // The subscribe frame is the FIRST thing ever sent on the socket.
    expect(sockets[0]?.sent[0]).toBe(
      JSON.stringify({ assets_ids: [FIXTURE_ASSET_ID_UP], type: "market" }),
    );
    sockets[0]?.message(bookSnapshotWire());
    expect(states.at(-1)?.state).toBe("LIVE");
    const book = events[0];
    expect(book?.type).toBe("book");
    if (book?.type === "book") {
      expect(book.bids.map((level) => level.price)).toEqual(["0.45", "0.44"]);
      expect(book.minOrderSize).toBe("5");
    }
    handle.close();
  });

  it("emits price_change, tick_size_change and last_trade_price events", () => {
    const { sockets, events, handle } = setup();
    sockets[0]?.open();
    sockets[0]?.message(priceChangeWire());
    sockets[0]?.message(tickSizeChangeWire("0.001"));
    sockets[0]?.message(lastTradePriceWire());
    expect(events.map((event) => event.type)).toEqual([
      "price_change",
      "tick_size_change",
      "last_trade_price",
    ]);
    handle.close();
  });

  it("sends PING on the documented interval and ignores the PONG reply", () => {
    const { scheduler, sockets, events, handle } = setup();
    sockets[0]?.open();
    scheduler.advance(1_000);
    scheduler.advance(1_000);
    const pings =
      sockets[0]?.sent.filter((frame) => frame === "PING").length ?? 0;
    expect(pings).toBeGreaterThanOrEqual(2);
    sockets[0]?.message("PONG");
    expect(events).toHaveLength(0);
    handle.close();
  });

  it("surfaces malformed frames as stream_error without fabricating book state", () => {
    const { sockets, events, handle } = setup();
    sockets[0]?.open();
    sockets[0]?.message(bookSnapshotWire());
    expect(handle.getState().state).toBe("LIVE");
    sockets[0]?.message(brokenJsonWire());
    sockets[0]?.message(malformedWire());
    const errors = events.filter((event) => event.type === "stream_error");
    expect(errors.length).toBe(2);
    expect(
      errors.every(
        (error) => error.type === "stream_error" && error.recoverable,
      ),
    ).toBe(true);
    // A dropped/invalid event invalidates the previously trusted snapshot.
    expect(handle.getState().state).toBe("STALE");
    handle.close();
  });

  it("marks the stream STALE once the injected threshold passes without data", () => {
    const { scheduler, sockets, states, handle } = setup();
    sockets[0]?.open();
    sockets[0]?.message(bookSnapshotWire());
    expect(handle.getState().state).toBe("LIVE");
    scheduler.advance(5_001);
    expect(states.at(-1)?.state).toBe("STALE");
    // New data returns the stream to LIVE (staleness is not sticky).
    sockets[0]?.message(priceChangeWire());
    expect(handle.getState().state).toBe("STALE");
    sockets[0]?.message(bookSnapshotWire());
    expect(handle.getState().state).toBe("LIVE");
    handle.close();
  });

  it("disconnects, reconnects with the deterministic backoff, resubscribes and refuses to fake LIVE", () => {
    const { scheduler, sockets, events, states, handle } = setup({
      reconnectDelaysMs: [500, 500],
    });
    sockets[0]?.open();
    sockets[0]?.message(bookSnapshotWire());
    expect(handle.getState().state).toBe("LIVE");

    sockets[0]?.drop(1006);
    expect(states.at(-1)?.state).toBe("DISCONNECTED");
    // A stream_error was surfaced for the drop.
    expect(
      events.some(
        (event) =>
          event.type === "stream_error" &&
          event.code === "PROVIDER_UNAVAILABLE",
      ),
    ).toBe(true);

    // Backoff delay 500ms: advancing fires the reconnect.
    scheduler.advance(500);
    expect(sockets.length).toBe(2);
    expect(states.at(-1)?.state).toBe("CONNECTING");
    sockets[1]?.open();
    // SYNCING — NOT LIVE — until a fresh book arrives; the old book is not
    // silently resurrected as current.
    expect(states.at(-1)?.state).toBe("SYNCING");
    expect(handle.getState().state).toBe("SYNCING");
    sockets[1]?.message(priceChangeWire());
    expect(handle.getState().state).toBe("SYNCING");
    sockets[1]?.message(bookSnapshotWire());
    expect(handle.getState().state).toBe("LIVE");
    // Resubscribe happened on the NEW socket.
    expect(sockets[1]?.sent[0]).toBe(
      JSON.stringify({ assets_ids: [FIXTURE_ASSET_ID_UP], type: "market" }),
    );
    handle.close();
  });

  it("times out a socket that never opens and retries within the delay table", () => {
    const { scheduler, sockets, events, handle } = setup({
      reconnectDelaysMs: [250],
    });
    // Never call open(): the connect timeout must fire.
    scheduler.advance(2_001);
    expect(sockets[0]?.closed).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "stream_error" && event.code === "PROVIDER_TIMEOUT",
      ),
    ).toBe(true);
    scheduler.advance(250);
    expect(sockets.length).toBe(2);
    expect(sockets[0]?.closed).toBe(true);
    handle.close();
  });

  it("requires a fresh snapshot after initial connection and rejects invalid timer options", () => {
    const { sockets, scheduler, handle } = setup();
    sockets[0]?.open();
    sockets[0]?.message(priceChangeWire());
    expect(handle.getState().state).toBe("SYNCING");
    scheduler.advance(5_001);
    expect(handle.getState().state).toBe("STALE");
    sockets[0]?.message(bookSnapshotWire());
    expect(handle.getState().state).toBe("LIVE");
    handle.close();

    expect(() =>
      createPolymarketMarketStream({
        assetIds: [FIXTURE_ASSET_ID_UP],
        stalenessThresholdMs: 1_000,
        reconnectDelaysMs: [0],
      }),
    ).toThrow(/reconnectDelaysMs/);
  });

  it("ignores callbacks from a socket after it has been superseded", () => {
    const { scheduler, sockets, handle } = setup({
      reconnectDelaysMs: [100],
    });
    sockets[0]?.open();
    sockets[0]?.message(bookSnapshotWire());
    sockets[0]?.drop();
    scheduler.advance(100);
    sockets[1]?.open();
    expect(handle.getState().state).toBe("SYNCING");
    sockets[0]?.message(bookSnapshotWire());
    expect(handle.getState().state).toBe("SYNCING");
    sockets[1]?.message(bookSnapshotWire());
    expect(handle.getState().state).toBe("LIVE");
    handle.close();
  });

  it("reports socket-level errors as recoverable PROVIDER_UNAVAILABLE", () => {
    const { sockets, events, handle } = setup();
    sockets[0]?.fail(new Error("ECONNRESET"));
    const error = events.find(
      (event) =>
        event.type === "stream_error" && event.code === "PROVIDER_UNAVAILABLE",
    );
    expect(error).toBeDefined();
    handle.close();
  });

  it("refuses an empty asset list and closes idempotently", () => {
    expect(() =>
      createPolymarketMarketStream({
        assetIds: [],
        stalenessThresholdMs: 1_000,
      }),
    ).toThrow(/asset id/);
    const { sockets, handle } = setup();
    sockets[0]?.open();
    handle.close();
    handle.close();
    expect(sockets[0]?.closed).toBe(true);

    expect(() =>
      createPolymarketMarketStream({
        assetIds: ["invalid-id"],
        stalenessThresholdMs: 1_000,
      }),
    ).toThrow(/invalid asset id/);
  });
});
