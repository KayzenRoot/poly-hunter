import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  AUTH_NO_STORE_HEADERS,
  AUTH_NO_STORE_CACHE_CONTROL,
  applyAuthNoStoreHeaders,
} from "@web/identity/auth-cache-headers";
import { handleLogin } from "@web/handlers/login";
import { handleAuthCallback } from "@web/handlers/callback";
import { handleLogout } from "@web/handlers/logout";

/**
 * PH-M01-WO-002 CR-07 auth-cookie cache-header coverage.
 *
 * The `@supabase/ssr` 0.12.7 server contract is
 * `setAll(cookiesToSet, cacheHeaders)`: whenever auth cookies are written the
 * library delivers `Cache-Control: private, no-cache, no-store,
 * must-revalidate, max-age=0`, `Expires: 0` and `Pragma: no-cache`, and those
 * headers must accompany every response that may mutate auth cookies —
 * otherwise a CDN or reverse proxy could serve one user's session to another.
 *
 * Invariants under test:
 * - login (PKCE initiation, success and unavailable paths) answers carry the
 *   full centralized policy;
 * - auth callback success AND denial / invalid / failure redirects carry the
 *   full policy (a failed exchange can still clear or rotate cookies);
 * - logout carries the full triple (previously `Cache-Control` only);
 * - `applyAuthNoStoreHeaders` overwrites weaker pre-existing values;
 * - the adapter's `setAll` no longer ignores the library's second argument:
 *   matching deliveries are accepted, a drifted delivery throws, and empty
 *   storage-only deliveries keep the centralized policy.
 */

const TRUSTED_PROD = "https://app.example.test";

const EXPECTED_CACHE_CONTROL = "private, no-cache, no-store, must-revalidate";
const EXPECTED_MAX_AGE = "max-age=0";

function policyOf(response: NextResponse): {
  cacheControl: string | null;
  expires: string | null;
  pragma: string | null;
} {
  return {
    cacheControl: response.headers.get("cache-control"),
    expires: response.headers.get("expires"),
    pragma: response.headers.get("pragma"),
  };
}

function expectFullPolicy(response: NextResponse): void {
  const { cacheControl, expires, pragma } = policyOf(response);
  expect(cacheControl).not.toBeNull();
  for (const token of [
    "private",
    "no-cache",
    "no-store",
    "must-revalidate",
    EXPECTED_MAX_AGE,
  ]) {
    expect(cacheControl as string).toContain(token);
  }
  // The exact centralized value, not merely a superset: a weaker-but-present
  // Cache-Control (e.g. missing no-store) would be a session-leak vector.
  expect(cacheControl).toBe(AUTH_NO_STORE_CACHE_CONTROL);
  expect(expires).toBe("0");
  expect(pragma).toBe("no-cache");
}

function fakeGetRequest(url: string): Parameters<typeof handleLogin>[0] {
  return { url } as unknown as Parameters<typeof handleLogin>[0];
}

function fakeLogoutRequest(
  headers: Record<string, string>,
): Parameters<typeof handleLogout>[0] {
  return {
    headers: {
      get(name: string): string | null {
        const found = Object.entries(headers).find(
          ([key]) => key.toLowerCase() === name.toLowerCase(),
        );
        return found ? found[1] : null;
      },
    },
  } as unknown as Parameters<typeof handleLogout>[0];
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("CR-07 centralized policy helper", () => {
  it("exposes exactly the library-delivered policy, frozen", () => {
    expect(AUTH_NO_STORE_CACHE_CONTROL).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    expect({ ...AUTH_NO_STORE_HEADERS }).toEqual({
      "Cache-Control":
        "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    });
    expect(Object.isFrozen(AUTH_NO_STORE_HEADERS)).toBe(true);
  });

  it("returns the same response for call-site chaining", () => {
    const response = NextResponse.json({ ok: true });
    expect(applyAuthNoStoreHeaders(response)).toBe(response);
    expectFullPolicy(response);
  });

  it("overwrites weaker pre-existing values instead of merging", () => {
    const response = NextResponse.json({ ok: true });
    response.headers.set("Cache-Control", "public, max-age=3600");
    response.headers.set("Expires", "tomorrow");
    applyAuthNoStoreHeaders(response);
    expectFullPolicy(response);
  });

  it("holds no mutable module state across concurrent applications", async () => {
    const responses = Array.from({ length: 8 }, () =>
      NextResponse.json({ ok: true }),
    );
    await Promise.all(
      responses.map(async (response) => {
        await new Promise((resolve) => setImmediate(resolve));
        applyAuthNoStoreHeaders(response);
      }),
    );
    for (const response of responses) {
      expectFullPolicy(response);
    }
  });
});

describe("CR-07 login responses carry the auth anti-cache policy", () => {
  it("applies the full policy to the 302 provider redirect (PKCE success)", async () => {
    const response = await handleLogin(
      fakeGetRequest("https://app.example.test/api/auth/login?returnTo=/"),
      {
        startLogin: async () => ({
          kind: "redirect",
          location:
            "https://provider.example/auth?redirect_to=https%3A%2F%2Fapp.example.test%2Fauth%2Fcallback%3FreturnTo%3D%252F",
        }),
      },
    );
    expect(response.status).toBe(302);
    expectFullPolicy(response);
  });

  it("applies the full policy to the 503 provider-unavailable answer", async () => {
    const response = await handleLogin(
      fakeGetRequest("https://app.example.test/api/auth/login"),
      {
        startLogin: async () => ({
          kind: "unavailable",
          reason: "provider_not_configured",
        }),
      },
    );
    expect(response.status).toBe(503);
    expectFullPolicy(response);
  });

  it("applies the full policy to the 503 provider-redirect mismatch answer", async () => {
    const response = await handleLogin(
      fakeGetRequest("https://app.example.test/api/auth/login?returnTo=/"),
      {
        startLogin: async () => ({
          kind: "redirect",
          // redirect_to points at an attacker origin: rejected, never followed.
          location:
            "https://provider.example/auth?redirect_to=https%3A%2F%2Fevil.example%2F",
        }),
      },
    );
    expect(response.status).toBe(503);
    expectFullPolicy(response);
  });
});

describe("CR-07 callback responses carry the auth anti-cache policy", () => {
  it("applies the full policy to the success redirect", async () => {
    const response = await handleAuthCallback(
      fakeGetRequest(
        "https://app.example.test/auth/callback?code=pkce-code&returnTo=%2F",
      ),
      { exchangeCodeAndResolve: async () => ({ ok: true }) },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${TRUSTED_PROD}/`);
    expectFullPolicy(response);
  });

  it("applies the full policy to the provider-denied redirect", async () => {
    const response = await handleAuthCallback(
      fakeGetRequest(
        "https://app.example.test/auth/callback?error=access_denied&error_description=denied",
      ),
      {
        exchangeCodeAndResolve: async () => {
          throw new Error("must not exchange on provider denial");
        },
      },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${TRUSTED_PROD}/?auth=denied`,
    );
    expectFullPolicy(response);
  });

  it("applies the full policy to the invalid-code redirect", async () => {
    const response = await handleAuthCallback(
      fakeGetRequest("https://app.example.test/auth/callback"),
      {
        exchangeCodeAndResolve: async () => {
          throw new Error("must not exchange without a code");
        },
      },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${TRUSTED_PROD}/?auth=invalid`,
    );
    expectFullPolicy(response);
  });

  it("applies the full policy to the failed-exchange redirect", async () => {
    const response = await handleAuthCallback(
      fakeGetRequest("https://app.example.test/auth/callback?code=stale-code"),
      { exchangeCodeAndResolve: async () => ({ ok: false }) },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${TRUSTED_PROD}/?auth=failed`,
    );
    expectFullPolicy(response);
  });

  it("preserves the exact CR-04 / open-redirect behavior alongside the policy", async () => {
    // Absolute returnTo collapses to "/" (no open redirect), policy intact.
    const response = await handleAuthCallback(
      fakeGetRequest(
        "https://app.example.test/auth/callback?code=pkce-code&returnTo=https%3A%2F%2Fevil.example%2F",
      ),
      { exchangeCodeAndResolve: async () => ({ ok: true }) },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${TRUSTED_PROD}/`);
    expectFullPolicy(response);
  });
});

describe("CR-07 logout carries the full triple (Cache-Control + Expires + Pragma)", () => {
  function logoutDeps() {
    return {
      adapter: {
        verifyIdentity: async () => ({
          kind: "unverified" as const,
          reason: "unauthenticated" as const,
        }),
        startLogin: async () => ({
          kind: "unavailable" as const,
          reason: "provider_not_configured" as const,
        }),
        signOut: async () => undefined,
      },
      clearSelection: async () => undefined,
    };
  }

  it("applies the full policy to the 303 sign-out redirect", async () => {
    const response = await handleLogout(
      fakeLogoutRequest({ origin: TRUSTED_PROD }),
      logoutDeps(),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${TRUSTED_PROD}/`);
    expectFullPolicy(response);
    expect(response.headers.get("cache-control")).toContain(
      EXPECTED_CACHE_CONTROL,
    );
    expect(response.headers.get("cache-control")).toContain(EXPECTED_MAX_AGE);
  });
});

describe("CR-07 adapter setAll honors the library second argument", () => {
  async function loadBridge(): Promise<
    typeof import("@web/identity/supabase-adapter")
  > {
    const store = {
      getAll: () => [],
      set: () => undefined,
    };
    vi.doMock("next/headers", () => ({ cookies: async () => store }));
    return import("@web/identity/supabase-adapter.js");
  }

  /**
   * The adapter module and the centralized constant are compared WITHIN one
   * module instance: `vi.resetModules()` gives the dynamically imported copy its
   * own evaluation of `AUTH_NO_STORE_HEADERS`, so identity against the
   * statically imported constant would compare two equal-but-distinct objects.
   */
  async function loadPolicyPair(): Promise<{
    recordAuthCookieMutation: (
      delivered: Record<string, string>,
    ) => Readonly<Record<string, string>>;
    centralized: Readonly<Record<string, string>>;
  }> {
    const [adapter, constants] = await Promise.all([
      import("@web/identity/supabase-adapter.js"),
      import("@web/identity/auth-cache-headers.js"),
    ]);
    return {
      recordAuthCookieMutation: adapter.recordAuthCookieMutation,
      centralized: constants.AUTH_NO_STORE_HEADERS,
    };
  }

  it("accepts the exact library-delivered policy", async () => {
    const { recordAuthCookieMutation, centralized } = await loadPolicyPair();
    expect(
      recordAuthCookieMutation({
        "Cache-Control":
          "private, no-cache, no-store, must-revalidate, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
      }),
    ).toBe(centralized);
  });

  it("throws on policy drift instead of silently serving weaker headers", async () => {
    const { recordAuthCookieMutation } = await loadBridge();
    // Missing no-store: a CDN could cache the session response.
    expect(() =>
      recordAuthCookieMutation({
        "Cache-Control": "private, no-cache, must-revalidate, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
      }),
    ).toThrow(/policy drift/);
    // Extra header: not the exact contracted policy.
    expect(() =>
      recordAuthCookieMutation({
        "Cache-Control":
          "private, no-cache, no-store, must-revalidate, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
        "X-Extra": "1",
      }),
    ).toThrow(/policy drift/);
  });

  it("keeps the centralized policy for empty storage-only deliveries", async () => {
    const { recordAuthCookieMutation, centralized } = await loadPolicyPair();
    expect(recordAuthCookieMutation({})).toBe(centralized);
  });
});
