import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createPolymarketBook,
  createPolymarketDiscovery,
  type AssetId,
  type ConditionId,
} from "../packages/polymarket/src/index.ts";
import { GAMMA_KEYSET_PAGE_1 } from "../packages/polymarket/src/fixtures/gamma-keyset.ts";
import {
  FIXTURE_ASSET_ID_UP,
  bookSnapshotWire,
} from "../packages/polymarket/src/fixtures.ts";

/**
 * PH-M02-WO-001 REST acceptance — the OFFICIAL SDK is driven against a local
 * deterministic HTTP server through the SDK's own environment fork, so the
 * provider contract (paths, params, response shapes, failure modes) is proven
 * end-to-end without the network and without credentials.
 */

let paginationHasThirdPage = false;

const keysetPage = (afterCursor: string | null) => {
  if (afterCursor === null) {
    return JSON.stringify({
      markets: GAMMA_KEYSET_PAGE_1.markets,
      next_cursor: "cursor-page-2",
    });
  }
  const secondPage = GAMMA_KEYSET_PAGE_1.markets[1];
  return JSON.stringify(
    paginationHasThirdPage
      ? {
          markets: secondPage === undefined ? [] : [secondPage],
          next_cursor: "cursor-page-3",
        }
      : { markets: secondPage === undefined ? [] : [secondPage] },
  );
};

const marketDetail = JSON.stringify(GAMMA_KEYSET_PAGE_1.markets[0]);

let server: Server | undefined;
let gammaUrl = "";
let clobUrl = "";
const seenRequests: string[] = [];
let malformedGamma = false;
let marketDetailOverride: Record<string, unknown> | null = null;

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1`);
    seenRequests.push(`${request.method} ${url.pathname}${url.search}`);
    const respond = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    // Failure injection: any request whose token_id starts with "failXXX"
    // receives the matching status, so every endpoint's failure modes are
    // exercisable through the SDK's own request path.
    const tokenId = url.searchParams.get("token_id") ?? "";
    if (tokenId.startsWith("400000000000")) {
      respond(400, { error: "Invalid token id" });
      return;
    }
    if (tokenId.startsWith("404000000000")) {
      respond(404, { error: "No orderbook exists for the requested token id" });
      return;
    }
    if (tokenId.startsWith("429000000000")) {
      respond(429, { error: "Too many requests" });
      return;
    }
    if (tokenId.startsWith("500000000000")) {
      respond(500, { error: "Internal server error" });
      return;
    }
    if (tokenId.startsWith("900000000000")) {
      // 200 OK with an unusable body: the boundary must classify it as
      // PROVIDER_MALFORMED, not as a transport failure.
      respond(200, "<not-json>");
      return;
    }
    if (url.pathname === "/markets/keyset") {
      const cursor = url.searchParams.get("after_cursor");
      if (malformedGamma) {
        const invalidPage = JSON.parse(keysetPage(null)) as {
          markets: Array<Record<string, unknown>>;
        };
        invalidPage.markets = [
          {
            ...(invalidPage.markets[0] ?? {}),
            active: false,
            closed: false,
            archived: false,
          },
        ];
        respond(200, invalidPage);
        return;
      }
      respond(200, keysetPage(cursor));
      return;
    }
    if (url.pathname.startsWith("/markets/")) {
      // detail by condition id
      respond(200, marketDetailOverride ?? marketDetail);
      return;
    }
    if (url.pathname === "/book") {
      respond(200, JSON.parse(bookSnapshotWire()));
      return;
    }
    if (url.pathname === "/price") {
      const side = url.searchParams.get("side");
      respond(200, { price: side === "BUY" ? "0.45" : "0.47" });
      return;
    }
    if (url.pathname === "/midpoint") {
      respond(200, { mid: "0.46" });
      return;
    }
    if (url.pathname.startsWith("/tick-size")) {
      respond(200, { minimum_tick_size: "0.01" });
      return;
    }
    if (url.pathname === "/last-trade-price") {
      respond(200, { price: "0.47", side: "SELL" });
      return;
    }
    respond(404, { error: "not found" });
  });
  await new Promise<void>((resolveListen) => {
    server?.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address() as AddressInfo;
  gammaUrl = `http://127.0.0.1:${address.port}`;
  clobUrl = gammaUrl;
});

afterAll(async () => {
  await new Promise<void>((resolveClose) => {
    server?.close(() => resolveClose());
  });
});

describe("polymarket discovery over the official SDK", () => {
  it("lists active markets with bounded pagination and reports the limit", async () => {
    const discovery = createPolymarketDiscovery({ gammaRestUrl: gammaUrl });
    try {
      paginationHasThirdPage = true;
      const result = await discovery.listActiveMarkets({
        maxPages: 2,
        pageSize: 2,
      });
      expect(result.pagesFetched).toBe(2);
      // Page 1: 2 items; page 2: 1 item (the fixture's own second market).
      expect(result.markets.length).toBe(3);
      expect(result.limitReached).toBe(true);
      const first = result.markets[0];
      expect(first?.status).toBe("active");
      expect(first?.conditionId).toBe(
        GAMMA_KEYSET_PAGE_1.markets[0]?.conditionId,
      );
    } finally {
      paginationHasThirdPage = false;
      await discovery.close();
    }
  });

  it("stops cleanly when the provider stops offering a cursor", async () => {
    const discovery = createPolymarketDiscovery({ gammaRestUrl: gammaUrl });
    try {
      const result = await discovery.listActiveMarkets({
        maxPages: 5,
        pageSize: 2,
      });
      expect(result.limitReached).toBe(false);
      expect(result.pagesFetched).toBe(2);
    } finally {
      await discovery.close();
    }
  });

  it("rejects malformed market state and pagination options fail-closed", async () => {
    const discovery = createPolymarketDiscovery({ gammaRestUrl: gammaUrl });
    try {
      malformedGamma = true;
      await expect(discovery.listActiveMarkets()).rejects.toMatchObject({
        code: "PROVIDER_MALFORMED",
      });
      malformedGamma = false;
      await expect(
        discovery.listActiveMarkets({ maxPages: 21 }),
      ).rejects.toMatchObject({ code: "PROVIDER_BAD_REQUEST" });
      await expect(
        discovery.listActiveMarkets({ pageSize: 101 }),
      ).rejects.toMatchObject({ code: "PROVIDER_BAD_REQUEST" });
    } finally {
      malformedGamma = false;
      await discovery.close();
    }
  });

  it("fetches market detail with outcome/asset mapping and fee metadata", async () => {
    const discovery = createPolymarketDiscovery({ gammaRestUrl: gammaUrl });
    try {
      const detail = await discovery.fetchMarketDetail(
        GAMMA_KEYSET_PAGE_1.markets[0]?.conditionId as ConditionId,
      );
      expect(detail.marketId).toBe("559001");
      expect(detail.status).toBe("active");
      expect(detail.outcomes.length).toBe(2);
      expect(detail.fees.feesEnabled).toBe(true);
      await expect(
        discovery.fetchMarketDetail(
          "0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809" as ConditionId,
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_MALFORMED" });
    } finally {
      await discovery.close();
    }
  });

  it("maps v2 position ids and a resolved lifecycle from the official keyset shape", async () => {
    const discovery = createPolymarketDiscovery({ gammaRestUrl: gammaUrl });
    const market = GAMMA_KEYSET_PAGE_1.markets[0];
    expect(market).toBeDefined();
    const positionIds = [
      "1234567890123456789012345678901234567890",
      "2234567890123456789012345678901234567890",
    ];
    marketDetailOverride = {
      ...market,
      version: "v2",
      positionIds,
      umaResolutionStatus: "resolved",
      umaResolutionStatuses: "resolved",
    };
    try {
      const detail = await discovery.fetchMarketDetail(
        GAMMA_KEYSET_PAGE_1.markets[0]?.conditionId as ConditionId,
      );
      expect(detail.status).toBe("resolved");
      expect(detail.outcomes.map((outcome) => outcome.assetId)).toEqual(
        positionIds,
      );
    } finally {
      marketDetailOverride = null;
      await discovery.close();
    }
  });
});

describe("polymarket book/price over the official SDK", () => {
  it("fetches a canonical order book snapshot", async () => {
    const book = createPolymarketBook({ clobRestUrl: clobUrl });
    try {
      const snapshot = await book.fetchOrderBook(
        FIXTURE_ASSET_ID_UP as AssetId,
      );
      expect(snapshot.assetId).toBe(FIXTURE_ASSET_ID_UP);
      expect(snapshot.bids.map((level) => level.price)).toEqual([
        "0.45",
        "0.44",
      ]);
      expect(snapshot.asks.map((level) => level.price)).toEqual([
        "0.46",
        "0.47",
      ]);
      expect(snapshot.tickSize).toBe("0.01");
      expect(snapshot.minOrderSize).toBe("5");
      expect(snapshot.negRisk).toBe(false);
      expect(snapshot.lastTradePrice).toBe("0.45");
    } finally {
      await book.close();
    }
  });

  it("fetches best prices, midpoint and tick size as decimal strings", async () => {
    const book = createPolymarketBook({ clobRestUrl: clobUrl });
    try {
      const best = await book.fetchBestPrices(FIXTURE_ASSET_ID_UP as AssetId);
      expect(best.bestBid).toBe("0.45");
      expect(best.bestAsk).toBe("0.46");
      expect(await book.fetchMidpoint(FIXTURE_ASSET_ID_UP as AssetId)).toBe(
        "0.46",
      );
      expect(await book.fetchTickSize(FIXTURE_ASSET_ID_UP as AssetId)).toBe(
        "0.01",
      );
      const last = await book.fetchLastTradePrice(
        FIXTURE_ASSET_ID_UP as AssetId,
      );
      expect(last).toBe("0.47");
    } finally {
      await book.close();
    }
  });

  it("normalizes provider failures into the frozen error codes", async () => {
    const book = createPolymarketBook({ clobRestUrl: clobUrl });
    const failureAssets = {
      badRequest: "4000000000000000000000000000000000001",
      notFound: "4040000000000000000000000000000000002",
      rateLimited: "4290000000000000000000000000000000003",
      unavailable: "5000000000000000000000000000000000004",
      malformed: "9000000000000000000000000000000000005",
    } as const;
    try {
      await expect(
        book.fetchOrderBook("invalid-id" as AssetId),
      ).rejects.toMatchObject({ code: "PROVIDER_BAD_REQUEST" });
      await expect(
        book.fetchOrderBook(failureAssets.badRequest as AssetId),
      ).rejects.toMatchObject({ code: "PROVIDER_BAD_REQUEST" });
      await expect(
        book.fetchOrderBook(failureAssets.notFound as AssetId),
      ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
      await expect(
        book.fetchOrderBook(failureAssets.rateLimited as AssetId),
      ).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMITED" });
      await expect(
        book.fetchOrderBook(failureAssets.unavailable as AssetId),
      ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
      await expect(
        book.fetchOrderBook(failureAssets.malformed as AssetId),
      ).rejects.toMatchObject({ code: "PROVIDER_MALFORMED" });
    } finally {
      await book.close();
    }
  });

  it("reports a missing last trade as null instead of an error", async () => {
    const book = createPolymarketBook({ clobRestUrl: clobUrl });
    try {
      // The 404 route mirrors "no orderbook exists" semantics for an asset
      // that never traded; the port contract says null, not an error.
      const last = await book.fetchLastTradePrice(
        "4040000000000000000000000000000000002" as AssetId,
      );
      expect(last).toBeNull();
    } finally {
      await book.close();
    }
  });

  it("normalizes SDK error names without importing SDK types across tests", async () => {
    // Duck-typed classification is part of the boundary contract: these plain
    // fakes replicate the SDK error shapes by name only.
    const fake = Object.assign(new Error("too many"), {
      name: "RateLimitError",
    });
    const { normalizeProviderError } = await import(
      "../packages/polymarket/src/errors.ts"
    );
    expect(normalizeProviderError(fake).code).toBe("PROVIDER_RATE_LIMITED");
    const timeout = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });
    expect(normalizeProviderError(timeout).code).toBe("PROVIDER_TIMEOUT");
  });
});
