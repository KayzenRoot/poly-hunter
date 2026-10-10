import WebSocket from "ws";
import {
  type ConnectionState,
  type MarketStreamEvent,
  type MarketStreamHandle,
  type MarketStreamOptions,
  type ProviderErrorCode,
  type StreamSocket,
  type StreamSocketFactory,
  type StreamScheduler,
  type StreamState,
  PolymarketProviderError,
} from "@polyhunter/contracts";
import { normalizeWireMarketEvent } from "./wire.ts";

/**
 * Public market WebSocket adapter (audit CR-03 of WO-003 lineage: read-only).
 *
 * WHY A DIRECT WEBSOCKET INSTEAD OF THE SDK: the official SDK 0.12.0 exposes
 * `subscribe()` returning only a minimal `SubscriptionHandle` (a `close()`)
 * with no connection-state surface, no heartbeat control and no deterministic
 * reconnect hook — exactly what this Work Order requires to be explicit and
 * testable (CONNECTING/SYNCING/LIVE/STALE/DISCONNECTED, injected staleness and
 * deterministic backoff). The market channel itself is documented as
 * credential-free, so the direct implementation stays read-only by
 * construction: it can only SEND the subscribe frame and `PING`.
 *
 * Everything is injectable: socket factory, scheduler, staleness threshold,
 * connect timeout and the deterministic reconnect delay table. No default is
 * hidden inside business logic.
 */

const OFFICIAL_MARKET_WS_URL =
  "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const DEFAULT_PING_INTERVAL_MS = 10_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_RECONNECT_DELAYS_MS: readonly number[] = [
  1_000, 2_000, 4_000, 8_000, 16_000, 30_000,
];
const LAST_DELAY_MS = 30_000;

interface InternalState {
  state: ConnectionState;
  generation: number;
  lastDataAt: number | null;
}

function freshState(): InternalState {
  return { state: "DISCONNECTED", generation: 0, lastDataAt: null };
}

export function createPolymarketMarketStream(
  options: MarketStreamOptions,
): MarketStreamHandle {
  const assetIds = [...options.assetIds];
  if (assetIds.length === 0) {
    throw new PolymarketProviderError(
      "PROVIDER_BAD_REQUEST",
      "the market stream requires at least one asset id",
    );
  }
  if (
    assetIds.some((assetId) => !/^(?:0x[a-f0-9]{64}|\d{1,78})$/i.test(assetId))
  ) {
    throw new PolymarketProviderError(
      "PROVIDER_BAD_REQUEST",
      "market stream contains an invalid asset id",
    );
  }
  const stalenessThresholdMs = options.stalenessThresholdMs;
  const pingIntervalMs = options.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;
  const connectTimeoutMs =
    options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const reconnectDelays =
    options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS_MS;
  const wsUrl = options.wsUrl ?? OFFICIAL_MARKET_WS_URL;
  const scheduler: StreamScheduler =
    options.scheduler ??
    ({
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (handle) =>
        clearTimeout(handle as ReturnType<typeof setTimeout>),
      now: () => Date.now(),
    } satisfies StreamScheduler);
  const openSocket: StreamSocketFactory =
    options.socketFactory ??
    ((url, handler) => {
      // Production socket: the official `ws` driver, locked at 8.18.3. Tests
      // inject a deterministic fake through `socketFactory` instead.
      const socket = new WebSocket(url) as unknown as StreamSocket & {
        on: (event: string, listener: (...args: unknown[]) => void) => void;
      };
      socket.on("open", () => handler.onOpen());
      socket.on("message", (data: unknown) =>
        handler.onMessage(typeof data === "string" ? data : String(data)),
      );
      socket.on("close", (code: unknown, reason: unknown) =>
        handler.onClose(Number(code ?? 0), String(reason ?? "")),
      );
      socket.on("error", (error: unknown) =>
        handler.onError(
          error instanceof Error ? error : new Error(String(error)),
        ),
      );
      return socket;
    });

  let internal = freshState();
  let socket: StreamSocket | null = null;
  let closedByConsumer = false;
  let activeGeneration = 0;
  let connectTimer: unknown = null;
  let pingTimer: unknown = null;
  let staleTimer: unknown = null;
  let reconnectTimer: unknown = null;
  let reconnectAttempt = 0;

  const eventListeners = new Set<(event: MarketStreamEvent) => void>();
  const stateListeners = new Set<(state: StreamState) => void>();

  function snapshot(): StreamState {
    return {
      state: internal.state,
      generation: internal.generation,
      lastDataAt: internal.lastDataAt,
    };
  }

  function transition(next: ConnectionState): void {
    if (internal.state === next) return;
    internal = { ...internal, state: next };
    const state = snapshot();
    for (const listener of stateListeners) listener(state);
  }

  function emit(event: MarketStreamEvent): void {
    for (const listener of eventListeners) listener(event);
  }

  function emitError(
    code: ProviderErrorCode,
    message: string,
    recoverable: boolean,
  ): void {
    emit({
      type: "stream_error",
      code,
      message: message.slice(0, 300),
      recoverable,
    });
  }

  function clearTimers(): void {
    for (const timer of [connectTimer, pingTimer, staleTimer]) {
      if (timer !== null) scheduler.clearTimeout(timer);
    }
    connectTimer = null;
    pingTimer = null;
    staleTimer = null;
  }

  function armStaleness(generation: number): void {
    if (staleTimer !== null) scheduler.clearTimeout(staleTimer);
    staleTimer = scheduler.setTimeout(() => {
      if (
        generation === activeGeneration &&
        !closedByConsumer &&
        (internal.state === "LIVE" || internal.state === "SYNCING")
      ) {
        // No recent data or fresh snapshot: downstream book state is UNKNOWN.
        transition("STALE");
      }
    }, stalenessThresholdMs);
  }

  function noteData(event: MarketStreamEvent, generation: number): void {
    if (generation !== activeGeneration || closedByConsumer) return;
    internal = { ...internal, lastDataAt: scheduler.now() };
    if (event.type === "book") {
      reconnectAttempt = 0;
      transition("LIVE");
    }
    armStaleness(generation);
  }

  function scheduleReconnect(): void {
    if (closedByConsumer || reconnectTimer !== null) return;
    const delay =
      reconnectAttempt < reconnectDelays.length
        ? (reconnectDelays[reconnectAttempt] ?? LAST_DELAY_MS)
        : (reconnectDelays[reconnectDelays.length - 1] ?? LAST_DELAY_MS);
    reconnectAttempt += 1;
    reconnectTimer = scheduler.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function handleOpen(generation: number): void {
    if (generation !== activeGeneration || closedByConsumer) return;
    if (connectTimer !== null) {
      scheduler.clearTimeout(connectTimer);
      connectTimer = null;
    }
    // Subscription frame per the official wire contract. Nothing else is ever
    // sent: the adapter cannot place orders, cancel them or authenticate.
    try {
      socket?.send(JSON.stringify({ assets_ids: assetIds, type: "market" }));
    } catch (error: unknown) {
      handleSocketError(
        error instanceof Error ? error : new Error(String(error)),
        generation,
      );
      return;
    }
    internal = { ...internal, lastDataAt: null };
    transition("SYNCING");
    pingTimer = scheduler.setTimeout(function tick() {
      if (generation !== activeGeneration || closedByConsumer) return;
      try {
        socket?.send("PING");
      } catch (error: unknown) {
        handleSocketError(
          error instanceof Error ? error : new Error(String(error)),
          generation,
        );
        return;
      }
      pingTimer = scheduler.setTimeout(tick, pingIntervalMs);
    }, pingIntervalMs);
    armStaleness(generation);
  }

  function markUntrusted(): void {
    if (internal.state === "LIVE" || internal.state === "SYNCING") {
      transition("STALE");
    }
  }

  function handleMessage(data: string, generation: number): void {
    if (generation !== activeGeneration || closedByConsumer) return;
    if (data === "PONG") return; // heartbeat reply, not market data
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      markUntrusted();
      emitError(
        "PROVIDER_STREAM_MALFORMED",
        "websocket frame is not JSON",
        true,
      );
      return;
    }
    const events = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of events) {
      try {
        const event = normalizeWireMarketEvent(candidate);
        noteData(event, generation);
        emit(event);
      } catch (error: unknown) {
        markUntrusted();
        const code: ProviderErrorCode =
          error instanceof PolymarketProviderError
            ? error.code
            : "PROVIDER_STREAM_MALFORMED";
        emitError(
          code,
          error instanceof Error ? error.message : String(error),
          true,
        );
      }
    }
  }

  function handleClose(code: number, reason: string, generation: number): void {
    if (generation !== activeGeneration) return;
    clearTimers();
    socket = null;
    activeGeneration = 0;
    internal = { ...internal, lastDataAt: null };
    transition("DISCONNECTED");
    if (closedByConsumer) return;
    emitError(
      "PROVIDER_UNAVAILABLE",
      `websocket closed (code ${code}) ${reason}`.trim(),
      true,
    );
    scheduleReconnect();
  }

  function handleSocketError(error: Error, generation: number): void {
    if (generation !== activeGeneration || closedByConsumer) return;
    emitError("PROVIDER_UNAVAILABLE", error.message, true);
    const failedSocket = socket;
    socket = null;
    activeGeneration = 0;
    internal = { ...internal, lastDataAt: null };
    clearTimers();
    transition("DISCONNECTED");
    failedSocket?.close();
    scheduleReconnect();
  }

  function connect(): void {
    if (closedByConsumer) return;
    internal = {
      ...internal,
      generation: internal.generation + 1,
      lastDataAt: null,
    };
    activeGeneration = internal.generation;
    const generation = activeGeneration;
    transition("CONNECTING");
    const handler = {
      onOpen: () => handleOpen(generation),
      onMessage: (data: string) => handleMessage(data, generation),
      onClose: (code: number, reason: string) =>
        handleClose(code, reason, generation),
      onError: (error: Error) => handleSocketError(error, generation),
    };
    try {
      socket = openSocket(wsUrl, handler);
    } catch (error: unknown) {
      transition("DISCONNECTED");
      emitError(
        "PROVIDER_UNAVAILABLE",
        error instanceof Error ? error.message : String(error),
        true,
      );
      scheduleReconnect();
      return;
    }
    connectTimer = scheduler.setTimeout(() => {
      // The connect/subscribe window elapsed: force a deterministic retry.
      if (generation !== activeGeneration || closedByConsumer) return;
      const timedOutSocket = socket;
      // Clear the active socket before close() because drivers may deliver the
      // close callback synchronously; one timeout must schedule one retry.
      socket = null;
      activeGeneration = 0;
      clearTimers();
      timedOutSocket?.close();
      transition("DISCONNECTED");
      if (!closedByConsumer) {
        emitError("PROVIDER_TIMEOUT", "connect/subscribe window elapsed", true);
        scheduleReconnect();
      }
    }, connectTimeoutMs);
  }

  function close(): void {
    if (closedByConsumer) return;
    closedByConsumer = true;
    activeGeneration = 0;
    if (reconnectTimer !== null) {
      scheduler.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    clearTimers();
    socket?.close();
    socket = null;
    transition("DISCONNECTED");
  }

  const handle: MarketStreamHandle = {
    subscribe(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },
    onStateChange(listener) {
      stateListeners.add(listener);
      listener(snapshot());
      return () => {
        stateListeners.delete(listener);
      };
    },
    getState: snapshot,
    close,
  };

  // Fail fast on a deterministically invalid option rather than at runtime.
  if (!Number.isFinite(stalenessThresholdMs) || stalenessThresholdMs <= 0) {
    throw new PolymarketProviderError(
      "PROVIDER_BAD_REQUEST",
      "stalenessThresholdMs must be a positive number",
    );
  }
  if (!Number.isFinite(pingIntervalMs) || pingIntervalMs <= 0) {
    throw new PolymarketProviderError(
      "PROVIDER_BAD_REQUEST",
      "pingIntervalMs must be a positive number",
    );
  }
  if (!Number.isFinite(connectTimeoutMs) || connectTimeoutMs <= 0) {
    throw new PolymarketProviderError(
      "PROVIDER_BAD_REQUEST",
      "connectTimeoutMs must be a positive number",
    );
  }
  if (
    !Array.isArray(reconnectDelays) ||
    reconnectDelays.length === 0 ||
    reconnectDelays.some(
      (delay) => !Number.isSafeInteger(delay) || delay <= 0 || delay > 300_000,
    )
  ) {
    throw new PolymarketProviderError(
      "PROVIDER_BAD_REQUEST",
      "reconnectDelaysMs must contain positive integer delays up to 300000ms",
    );
  }

  connect();
  return handle;
}
