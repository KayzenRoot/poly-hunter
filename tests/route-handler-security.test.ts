import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleSelectTenant,
  type SelectTenantDependencies,
  type SelectTenantResolution,
  type SelectTenantService,
} from "@web/handlers/select-tenant";
import { handleLogout, type LogoutDependencies } from "@web/handlers/logout";
import type { IdentityPort } from "@polyhunter/domain";

/**
 * PH-M01-WO-002 CR-02 / CR-03 / CR-04 Route Handler adversarial coverage.
 *
 * Invariants under test:
 * - `POST /api/auth/select-tenant` and `POST /api/auth/logout` enforce an
 *   explicit same-origin check and reject every cross-origin / missing-Origin
 *   request BEFORE any state is touched;
 * - a valid selection AWAITS the `ph-active-tenant` cookie write before the
 *   response is produced;
 * - the cookie is httpOnly, SameSite=Lax, path=/, and Secure in production;
 * - invalid, foreign and suspended tenant selections never write the cookie;
 * - logout redirects to the configured trusted origin, never to a hard-coded
 *   localhost, and clears provider session + active tenant selection.
 */

const TRUSTED_PROD = "https://app.example.test";
const TRUSTED_LOCAL = "http://localhost:3000";
const TENANT_A = "22222222-2222-4222-8222-222222222222";
const TENANT_B = "33333333-3333-4333-8333-333333333333";
const USER_ID = "11111111-1111-4111-8111-111111111111";

const RESOLVED: SelectTenantResolution = {
  kind: "resolved",
  tenantId: TENANT_A,
  role: "owner",
};

function fakeRequest(
  headers: Record<string, string>,
  body?: unknown,
): Parameters<typeof handleSelectTenant>[0] {
  return {
    headers: {
      get(name: string): string | null {
        const found = Object.entries(headers).find(
          ([key]) => key.toLowerCase() === name.toLowerCase(),
        );
        return found ? found[1] : null;
      },
    },
    async json(): Promise<unknown> {
      if (body === undefined) {
        throw new SyntaxError("Unexpected end of JSON input");
      }
      return body;
    },
  } as unknown as Parameters<typeof handleSelectTenant>[0];
}

function service(
  selectTenant: SelectTenantService["selectTenant"],
  overrides: Partial<SelectTenantService> = {},
): SelectTenantService {
  return {
    resolveSession: async () => ({
      kind: "authenticated",
      userId: USER_ID,
      platformAdmin: false,
    }),
    selectTenant,
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<SelectTenantDependencies> = {},
): SelectTenantDependencies {
  return {
    providerConfigured: true,
    service: service(async () => RESOLVED),
    writeSelection: async () => undefined,
    ...overrides,
  };
}

function logoutAdapter(): IdentityPort {
  return {
    verifyIdentity: async () => ({
      kind: "unverified",
      reason: "unauthenticated",
    }),
    startLogin: async () => ({
      kind: "unavailable",
      reason: "provider_not_configured",
    }),
    signOut: async () => undefined,
  };
}

function logoutDependencies(
  overrides: Partial<LogoutDependencies> = {},
): LogoutDependencies {
  return {
    adapter: logoutAdapter(),
    clearSelection: async () => undefined,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_PROD);
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CR-02 select-tenant rejects cross-origin requests before any state change", () => {
  const hostile: ReadonlyArray<readonly [string, Record<string, string>]> = [
    ["a foreign origin", { origin: "https://evil.example" }],
    ["a sibling subdomain", { origin: "https://evil.app.example.test" }],
    [
      "a parent-domain lookalike",
      { origin: "https://app.example.test.evil.example" },
    ],
    ["a different protocol", { origin: "http://app.example.test" }],
    ["a different port", { origin: "https://app.example.test:8443" }],
    ["a malformed origin", { origin: "not-an-origin" }],
    ["the opaque origin", { origin: "null" }],
    ["a missing origin", {}],
    ["a Host spoof without an Origin", { host: TRUSTED_PROD }],
    [
      "an X-Forwarded-Host spoof without an Origin",
      { "x-forwarded-host": TRUSTED_PROD, "x-forwarded-proto": "https" },
    ],
  ];

  it.each(hostile)(
    "returns 403 and never touches the cookie on %s",
    async (_label, headers) => {
      const writeSelection = vi.fn(async () => undefined);
      const resolveSession = vi.fn(async () => ({
        kind: "authenticated" as const,
        userId: USER_ID,
        platformAdmin: false,
      }));

      const response = await handleSelectTenant(
        fakeRequest(headers, { tenantId: TENANT_A }),
        dependencies({
          writeSelection,
          service: service(async () => RESOLVED, { resolveSession }),
        }),
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "cross_origin_rejected",
      });
      expect(writeSelection).not.toHaveBeenCalled();
      expect(resolveSession).not.toHaveBeenCalled();
    },
  );

  it("accepts the trusted origin and proceeds", async () => {
    const response = await handleSelectTenant(
      fakeRequest({ origin: TRUSTED_PROD }, { tenantId: TENANT_A }),
      dependencies(),
    );
    expect(response.status).toBe(200);
  });

  it("accepts the trusted origin on the local http development origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_LOCAL);
    vi.stubEnv("NODE_ENV", "development");
    const response = await handleSelectTenant(
      fakeRequest({ origin: TRUSTED_LOCAL }, { tenantId: TENANT_A }),
      dependencies(),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tenantId: TENANT_A,
      role: "owner",
    });
  });

  it("fails closed when the production origin configuration is invalid", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "http://app.example.test");
    vi.stubEnv("NODE_ENV", "production");
    const writeSelection = vi.fn(async () => undefined);
    const response = await handleSelectTenant(
      fakeRequest(
        { origin: "http://app.example.test" },
        { tenantId: TENANT_A },
      ),
      dependencies({ writeSelection }),
    );
    expect(response.status).toBe(403);
    expect(writeSelection).not.toHaveBeenCalled();
  });
});

describe("CR-03 active tenant cookie write is awaited", () => {
  it("does not produce a response before the cookie write settles", async () => {
    const order: string[] = [];
    const gate: { release: (() => void) | null } = { release: null };
    const writeSelection = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          order.push("write:start");
          gate.release = () => {
            order.push("write:done");
            resolve();
          };
        }),
    );

    const pending = handleSelectTenant(
      fakeRequest({ origin: TRUSTED_PROD }, { tenantId: TENANT_A }),
      dependencies({ writeSelection }),
    );

    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(order).toEqual(["write:start"]);

    (gate.release as () => void)();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(order).toEqual(["write:start", "write:done"]);
  });

  it("writes the tenant authorized by the authoritative membership row", async () => {
    const writeSelection = vi.fn(async () => undefined);
    await handleSelectTenant(
      fakeRequest({ origin: TRUSTED_PROD }, { tenantId: TENANT_A }),
      dependencies({ writeSelection }),
    );
    expect(writeSelection).toHaveBeenCalledTimes(1);
    expect(writeSelection).toHaveBeenCalledWith(TENANT_A);
  });

  it("never writes the client-suggested tenant when membership is absent (foreign)", async () => {
    const writeSelection = vi.fn(async () => undefined);
    const response = await handleSelectTenant(
      fakeRequest({ origin: TRUSTED_PROD }, { tenantId: TENANT_B }),
      dependencies({
        writeSelection,
        service: service(async () => ({
          kind: "unresolved",
          reason: "no_active_membership",
        })),
      }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "tenant_selection_rejected",
      reason: "no_active_membership",
    });
    expect(writeSelection).not.toHaveBeenCalled();
  });

  it("never writes the cookie when the membership is suspended", async () => {
    const writeSelection = vi.fn(async () => undefined);
    const selectTenant = vi.fn(async () => ({
      kind: "unresolved" as const,
      reason: "no_active_membership",
    }));
    const response = await handleSelectTenant(
      fakeRequest({ origin: TRUSTED_PROD }, { tenantId: TENANT_A }),
      dependencies({ writeSelection, service: service(selectTenant) }),
    );
    expect(response.status).toBe(403);
    expect(selectTenant).toHaveBeenCalledWith(USER_ID, TENANT_A);
    expect(writeSelection).not.toHaveBeenCalled();
  });

  it("never writes the cookie when the tenant itself is not active", async () => {
    const writeSelection = vi.fn(async () => undefined);
    const response = await handleSelectTenant(
      fakeRequest({ origin: TRUSTED_PROD }, { tenantId: TENANT_A }),
      dependencies({
        writeSelection,
        service: service(async () => ({
          kind: "unresolved",
          reason: "tenant_not_active",
        })),
      }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "tenant_selection_rejected",
      reason: "tenant_not_active",
    });
    expect(writeSelection).not.toHaveBeenCalled();
  });

  it("never writes the cookie for a malformed or absent selector", async () => {
    const writeSelection = vi.fn(async () => undefined);
    const bodies: ReadonlyArray<unknown> = [
      {},
      { tenantId: "" },
      { tenantId: 42 },
      { tenantId: null },
      undefined,
    ];
    for (const body of bodies) {
      const response = await handleSelectTenant(
        fakeRequest({ origin: TRUSTED_PROD }, body),
        dependencies({ writeSelection }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "invalid_selector",
      });
    }
    expect(writeSelection).not.toHaveBeenCalled();
  });

  it("never writes the cookie for an unauthenticated session", async () => {
    const writeSelection = vi.fn(async () => undefined);
    const response = await handleSelectTenant(
      fakeRequest({ origin: TRUSTED_PROD }, { tenantId: TENANT_A }),
      dependencies({
        writeSelection,
        service: service(async () => RESOLVED, {
          resolveSession: async () => ({
            kind: "unauthenticated",
            reason: "unauthenticated",
          }),
        }),
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthenticated",
      reason: "unauthenticated",
    });
    expect(writeSelection).not.toHaveBeenCalled();
  });

  it("answers 503 without touching the cookie when the provider is unconfigured", async () => {
    const writeSelection = vi.fn(async () => undefined);
    const response = await handleSelectTenant(
      fakeRequest({ origin: TRUSTED_PROD }, { tenantId: TENANT_A }),
      dependencies({ providerConfigured: false, writeSelection }),
    );
    expect(response.status).toBe(503);
    expect(writeSelection).not.toHaveBeenCalled();
  });
});

describe("CR-03 active tenant cookie attributes", () => {
  type Recorded = {
    name: string;
    value: string;
    options: Record<string, unknown>;
  };

  async function captureWrite(): Promise<Recorded> {
    const recorded: Recorded[] = [];
    const store = {
      get: () => undefined,
      set(name: string, value: string, options: Record<string, unknown>) {
        recorded.push({ name, value, options });
      },
      delete: () => undefined,
    };
    vi.resetModules();
    vi.doMock("next/headers", () => ({ cookies: async () => store }));
    vi.doMock("@polyhunter/db/server/identity", () => ({
      createIdentityDataAccess: () => {
        throw new Error("not used in this test");
      },
    }));
    vi.doMock("@polyhunter/db/server", () => ({
      createTenantDataAccess: () => {
        throw new Error("not used in this test");
      },
    }));
    const module = await import("../apps/web/src/identity/session-service.js");
    await module.writeActiveTenantSelection(TENANT_A);
    vi.doUnmock("next/headers");
    vi.resetModules();
    return recorded[0] as Recorded;
  }

  it("sets httpOnly, SameSite=Lax, path=/ and Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const recorded = await captureWrite();
    expect(recorded.name).toBe("ph-active-tenant");
    expect(recorded.value).toBe(TENANT_A);
    expect(recorded.options.httpOnly).toBe(true);
    expect(recorded.options.sameSite).toBe("lax");
    expect(recorded.options.path).toBe("/");
    expect(recorded.options.secure).toBe(true);
  });

  it("keeps httpOnly and SameSite but drops Secure outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const recorded = await captureWrite();
    expect(recorded.options.httpOnly).toBe(true);
    expect(recorded.options.sameSite).toBe("lax");
    expect(recorded.options.path).toBe("/");
    expect(recorded.options.secure).toBe(false);
  });
});

describe("CR-02 / CR-04 logout", () => {
  const hostile: ReadonlyArray<readonly [string, Record<string, string>]> = [
    ["a foreign origin", { origin: "https://evil.example" }],
    ["a sibling subdomain", { origin: "https://evil.app.example.test" }],
    ["a different protocol", { origin: "http://app.example.test" }],
    ["a malformed origin", { origin: ":///" }],
    ["a missing origin", {}],
    ["a Host spoof", { host: TRUSTED_PROD }],
    [
      "an X-Forwarded-Host spoof",
      { "x-forwarded-host": TRUSTED_PROD, "x-forwarded-proto": "https" },
    ],
  ];

  it.each(hostile)(
    "returns 403 and signs nobody out on %s",
    async (_label, headers) => {
      const adapter = {
        ...logoutAdapter(),
        signOut: vi.fn(async () => undefined),
      };
      const clearSelection = vi.fn(async () => undefined);
      const response = await handleLogout(
        fakeRequest(headers) as Parameters<typeof handleLogout>[0],
        logoutDependencies({ adapter, clearSelection }),
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "cross_origin_rejected",
      });
      expect(adapter.signOut).not.toHaveBeenCalled();
      expect(clearSelection).not.toHaveBeenCalled();
    },
  );

  it("redirects to the configured production origin and clears both states", async () => {
    const adapter = {
      ...logoutAdapter(),
      signOut: vi.fn(async () => undefined),
    };
    const clearSelection = vi.fn(async () => undefined);
    const response = await handleLogout(
      fakeRequest({ origin: TRUSTED_PROD }) as Parameters<
        typeof handleLogout
      >[0],
      logoutDependencies({ adapter, clearSelection }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${TRUSTED_PROD}/`);
    expect(adapter.signOut).toHaveBeenCalledTimes(1);
    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("redirects to the local development origin when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", TRUSTED_LOCAL);
    vi.stubEnv("NODE_ENV", "development");
    const response = await handleLogout(
      fakeRequest({ origin: TRUSTED_LOCAL }) as Parameters<
        typeof handleLogout
      >[0],
      logoutDependencies(),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${TRUSTED_LOCAL}/`);
  });

  it("never redirects to a hard-coded localhost under production configuration", async () => {
    const response = await handleLogout(
      fakeRequest({ origin: TRUSTED_PROD }) as Parameters<
        typeof handleLogout
      >[0],
      logoutDependencies(),
    );
    expect(response.headers.get("location")).not.toContain("localhost");
  });
});
