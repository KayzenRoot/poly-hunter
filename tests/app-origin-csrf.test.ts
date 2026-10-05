import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appUrlFor,
  getAppOrigin,
  InvalidAppOriginError,
  originMatchesTrusted,
} from "@web/identity/app-origin";
import { assertSameOrigin } from "@web/identity/csrf-guard";
import { sanitizeReturnTo } from "../apps/web/src/identity/open-redirect.js";

/**
 * PH-M01-WO-002 CR-02 / CR-04 adversarial coverage for the trusted application
 * origin and the explicit Route Handler CSRF guard.
 *
 * Invariants under test:
 * - the trusted origin comes ONLY from NEXT_PUBLIC_APP_ORIGIN, never from the
 *   request Host / X-Forwarded-Host headers;
 * - `http` is tolerated only outside production; production requires `https`;
 * - invalid production configuration FAILS CLOSED (throws / rejects);
 * - every cross-origin, malformed, missing-Origin or spoofed-header request is
 *   rejected with 403;
 * - `appUrlFor` accepts relative paths only, so it can never become an open
 *   redirect even if a caller regresses.
 */

const TRUSTED_PROD = "https://app.example.test";
const TRUSTED_LOCAL = "http://localhost:3000";

function request(headers: Record<string, string>): {
  headers: { get(name: string): string | null };
} {
  const lowered = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    headers: {
      get(name: string): string | null {
        return lowered.get(name.toLowerCase()) ?? null;
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CR-04 trusted app origin configuration", () => {
  it("accepts an https origin in production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(getAppOrigin().origin).toBe(TRUSTED_PROD);
  });

  it("accepts a local http origin in development", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_LOCAL);
    vi.stubEnv("NODE_ENV", "development");
    expect(getAppOrigin().origin).toBe(TRUSTED_LOCAL);
  });

  it("defaults to the canonical local origin only outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(getAppOrigin().origin).toBe(TRUSTED_LOCAL);
  });

  it("FAILS CLOSED in production when the origin is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getAppOrigin()).toThrow(InvalidAppOriginError);
  });

  it("FAILS CLOSED in production when the origin is an http URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_LOCAL);
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getAppOrigin()).toThrow(/https in production/);
  });

  it.each([
    ["not-a-url"],
    ["/relative/only"],
    ["ftp://app.example.test"],
    ["javascript:alert(1)"],
    ["app.example.test"],
  ])("rejects the malformed/invalid origin %s", (value) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", value);
    vi.stubEnv("NODE_ENV", "development");
    expect(() => getAppOrigin()).toThrow(InvalidAppOriginError);
  });
});

describe("CR-04 redirects are built from the configured origin", () => {
  it("builds production redirects against the configured https origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(appUrlFor("/").toString()).toBe(`${TRUSTED_PROD}/`);
    expect(appUrlFor("/?auth=denied").toString()).toBe(
      `${TRUSTED_PROD}/?auth=denied`,
    );
    expect(appUrlFor("/?auth=invalid").toString()).toBe(
      `${TRUSTED_PROD}/?auth=invalid`,
    );
    expect(appUrlFor("/?auth=failed").toString()).toBe(
      `${TRUSTED_PROD}/?auth=failed`,
    );
    expect(appUrlFor("/dashboard?tab=risk#open").toString()).toBe(
      `${TRUSTED_PROD}/dashboard?tab=risk#open`,
    );
  });

  it("builds local development redirects against http://localhost:3000", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_LOCAL);
    vi.stubEnv("NODE_ENV", "development");
    expect(appUrlFor("/").toString()).toBe(`${TRUSTED_LOCAL}/`);
  });

  it.each([
    ["//evil.example/path"],
    ["https://evil.example/path"],
    ["http://localhost:3000.evil.example/"],
    ["/path\\to\\evil"],
  ])("refuses to build a redirect from the non-relative path %s", (value) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(() => appUrlFor(value)).toThrow(InvalidAppOriginError);
  });

  it("never produces a hard-coded localhost redirect once configured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(appUrlFor("/").hostname).not.toBe("localhost");
    expect(appUrlFor("/").protocol).toBe("https:");
  });
});

describe("CR-04 open-redirect rejection feeds only relative paths", () => {
  it.each([
    ["https://evil.example/steal"],
    ["//evil.example/steal"],
    ["/\\evil.example"],
    ["%2f%2fevil.example"],
    ["javascript:alert(1)"],
  ])("collapses the hostile returnTo %s to '/'", (value) => {
    expect(sanitizeReturnTo(value)).toBe("/");
  });

  it("keeps an ordinary relative returnTo intact", () => {
    expect(sanitizeReturnTo("/markets?sort=volume")).toBe(
      "/markets?sort=volume",
    );
  });

  it("cannot be turned into an external redirect by appUrlFor", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    const hostile = sanitizeReturnTo("https://evil.example/steal");
    expect(appUrlFor(hostile).origin).toBe(TRUSTED_PROD);
  });
});

describe("CR-02 explicit same-origin guard", () => {
  it("allows a request whose Origin is exactly the trusted origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(assertSameOrigin(request({ origin: TRUSTED_PROD }))).toEqual({
      kind: "allowed",
    });
  });

  it.each([
    ["a foreign origin", "https://evil.example"],
    ["a sibling subdomain", "https://evil.app.example.test"],
    ["a parent-domain lookalike", "https://app.example.test.evil.example"],
    ["a subdomain of the trusted host", "https://app.app.example.test"],
    [
      "a different protocol (http for an https origin)",
      "http://app.example.test",
    ],
    ["a different port", "https://app.example.test:8443"],
    ["the opaque origin", "null"],
    ["a malformed origin", "app.example.test"],
    ["a garbage origin", "://///"],
    ["a whitespace origin", "   "],
  ])("rejects %s", (_label, origin) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    const outcome = assertSameOrigin(request({ origin }));
    expect(outcome).toEqual({
      kind: "rejected",
      status: 403,
      error: "cross_origin_rejected",
    });
  });

  it("rejects a missing Origin header (documented fail-closed policy)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(assertSameOrigin(request({}))).toEqual({
      kind: "rejected",
      status: 403,
      error: "cross_origin_rejected",
    });
  });

  it("does not trust the Host header when the Origin is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(
      assertSameOrigin(request({ host: TRUSTED_PROD, "user-agent": "curl" })),
    ).toMatchObject({ kind: "rejected" });
  });

  it("does not trust X-Forwarded-Host to establish the origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(
      assertSameOrigin(
        request({
          "x-forwarded-host": TRUSTED_PROD,
          "x-forwarded-proto": "https",
          forwarded: `host=${TRUSTED_PROD};proto=https`,
        }),
      ),
    ).toMatchObject({ kind: "rejected" });
  });

  it("ignores a spoofed Host header when the Origin is trusted", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    // Origin is the single authority; Host never participates in the decision.
    expect(
      assertSameOrigin(request({ origin: TRUSTED_PROD, host: "evil.example" })),
    ).toEqual({ kind: "allowed" });
  });

  it("fails closed when production origin configuration is invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "http://app.example.test");
    vi.stubEnv("NODE_ENV", "production");
    expect(
      assertSameOrigin(request({ origin: "http://app.example.test" })),
    ).toEqual({
      kind: "rejected",
      status: 403,
      error: "cross_origin_rejected",
    });
  });

  it("rejects a localhost origin once a production origin is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(
      assertSameOrigin(request({ origin: "http://localhost:3000" })),
    ).toMatchObject({ kind: "rejected" });
  });
});

describe("originMatchesTrusted primitives", () => {
  it("is false for empty and absent inputs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(originMatchesTrusted(null)).toBe(false);
    expect(originMatchesTrusted(undefined)).toBe(false);
    expect(originMatchesTrusted("")).toBe(false);
  });

  it("ignores a trailing path on an otherwise matching origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
    vi.stubEnv("NODE_ENV", "production");
    expect(originMatchesTrusted(`${TRUSTED_PROD}/anything`)).toBe(true);
  });
});
