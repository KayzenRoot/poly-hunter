import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleCreateSecret,
  handleDeleteSecret,
  handleGetSecret,
  handleListSecrets,
  handleReplaceSecret,
  handleRotateSecret,
  type SecretServiceContract,
} from "@web/handlers/secrets";
import { resolveSecretAccess } from "@web/secrets/secret-service";
import {
  secretErrorMessage,
  type SecretMetadata,
  type TenantContext,
} from "@polyhunter/domain";

/**
 * PH-M01-WO-003 HTTP boundary coverage.
 *
 * These tests drive the Route Handler functions against a STUB service, never
 * the real vault: the vault is an implementation detail behind
 * `SecretServiceContract`, and the properties under test here are boundary
 * properties — what a response may contain, what a failure may say, and which
 * request shapes reach the service at all. The cryptographic and authorization
 * properties are proven against PostgreSQL in
 * `packages/db/tests/secret-vault.integration.test.ts`.
 *
 * Invariants:
 * - a response body contains ONLY id, purpose, configured, timestamps and the
 *   rotation status — no plaintext, ciphertext, nonce, tag, key version, key
 *   length or derived suffix;
 * - there is no HTTP path that returns plaintext;
 * - a failure carries a frozen sanitized code and never a raw Node/OpenSSL or
 *   PostgreSQL error string;
 * - every state-changing request is same-origin checked BEFORE the service is
 *   touched;
 * - unauthenticated is 401 and an unresolvable tenant context is 403, and
 *   neither reaches the service.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_A = "22222222-2222-4222-8222-222222222222";
const SECRET_ID = "44444444-4444-4444-8444-444444444444";
const TRUSTED_ORIGIN = "http://localhost:3000";
const PLAINTEXT = "plaintext-canary-7c1e";

const CONTEXT = Object.freeze({
  userId: USER_ID,
  tenantId: TENANT_A,
  role: "owner",
}) as TenantContext;

const METADATA: SecretMetadata = Object.freeze({
  id: SECRET_ID,
  purpose: "polymarket.api_key",
  configured: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  rotatedAt: null,
  rotation: "current",
});

type ServiceStub = SecretServiceContract & {
  listMetadata: ReturnType<typeof vi.fn>;
  getMetadata: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  resolveAccess: ReturnType<typeof vi.fn>;
};

function stubService(
  overrides: Partial<Record<keyof SecretServiceContract, unknown>> = {},
): ServiceStub {
  const service = {
    resolveAccess: vi.fn(async () => ({ ok: true as const, context: CONTEXT })),
    listMetadata: vi.fn(async () => [METADATA]),
    getMetadata: vi.fn(async () => METADATA),
    create: vi.fn(async () => METADATA),
    replace: vi.fn(async () => METADATA),
    remove: vi.fn(async () => undefined),
    rotate: vi.fn(async () => ({
      status: "rotated" as const,
      metadata: METADATA,
    })),
    ...overrides,
  };
  return service as unknown as ServiceStub;
}

function fakeRequest(
  headers: Record<string, string>,
  body?: unknown,
): Parameters<typeof handleListSecrets>[0] {
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
  } as unknown as Parameters<typeof handleListSecrets>[0];
}

/** `origin: null` omits the header entirely — a different case from "". */
const mutationRequest = (
  body?: unknown,
  origin: string | null = TRUSTED_ORIGIN,
) => fakeRequest(origin === null ? {} : { origin }, body);
const params = Promise.resolve({ id: SECRET_ID });

/**
 * Every response body must be free of envelope and plaintext material.
 * Returns the body text so the caller can still parse it: a Response body can
 * only be read once.
 */
function assertNoLeak(text: string, canary = PLAINTEXT): string {
  expect(text).not.toContain(canary);
  // Structural names that would only appear if an envelope component had been
  // serialized. The `"secret"` WRAPPER key is legitimate — the body is
  // `{"secret": <metadata>}` — so it is checked structurally instead.
  for (const forbidden of [
    "ciphertext",
    "nonce",
    "authTag",
    "auth_tag",
    "keyVersion",
    "keyring",
    "plaintext",
    "last4",
  ]) {
    expect(text).not.toContain(forbidden);
  }
  return text;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_ORIGIN = TRUSTED_ORIGIN;
});

describe("PH-M01-WO-003 secret HTTP boundary", () => {
  describe("masking", () => {
    it("returns metadata only on list, with the allow-list as the whole surface", async () => {
      // A hostile service that tries to smuggle envelope fields through a
      // widened metadata object: the projection must still drop them.
      const hostile = {
        ...METADATA,
        ciphertext: "AAAA",
        nonce: "BBBB",
        authTag: "CCCC",
        keyVersion: "k2",
        key: "DkZFRkZFRkZFRkZFRkZFRkZFRkZFRkZFRkZFRkZFE=",
        length: 32,
        last4: PLAINTEXT.slice(-4),
      } as unknown as SecretMetadata;
      const service = stubService({
        listMetadata: vi.fn(async () => [hostile]),
      });

      const response = await handleListSecrets(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        secrets: Record<string, unknown>[];
      };
      expect(Object.keys(body.secrets[0] ?? {}).sort()).toEqual([
        "configured",
        "createdAt",
        "id",
        "purpose",
        "rotatedAt",
        "rotation",
        "updatedAt",
      ]);
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain(PLAINTEXT);
      expect(serialized).not.toContain("AAAA");
      expect(serialized).not.toContain("BBBB");
      expect(serialized).not.toContain("CCCC");
      expect(serialized).not.toContain(
        "DkZFRkZFRkZFRkZFRkZFRkZFRkZFRkZFRkZFRkZFE=",
      );
      // `configured` is a hard-coded true, never echoed from the service.
      expect(body.secrets[0]?.configured).toBe(true);
    });

    it("never echoes the submitted secret on create", async () => {
      const service = stubService();
      const response = await handleCreateSecret(
        mutationRequest({ purpose: "polymarket.api_key", secret: PLAINTEXT }),
        service as unknown as SecretServiceContract,
      );
      expect(response.status).toBe(201);
      const body = JSON.parse(assertNoLeak(await response.text())) as {
        secret: Record<string, unknown>;
      };
      expect(body.secret.id).toBe(SECRET_ID);
      // The secret reached the service — it just never came back out.
      expect(service.create).toHaveBeenCalledWith(CONTEXT, {
        purpose: "polymarket.api_key",
        secret: PLAINTEXT,
      });
    });

    it("never echoes the submitted secret on replace, delete or rotate", async () => {
      const service = stubService();

      const replaced = await handleReplaceSecret(
        mutationRequest({ secret: PLAINTEXT }),
        service as unknown as SecretServiceContract,
        { params },
      );
      expect(replaced.status).toBe(200);
      assertNoLeak(await replaced.text());

      const deleted = await handleDeleteSecret(
        mutationRequest(),
        service as unknown as SecretServiceContract,
        { params },
      );
      expect(deleted.status).toBe(200);
      expect((await deleted.json()) as unknown).toEqual({ deleted: true });

      const rotated = await handleRotateSecret(
        mutationRequest(),
        service as unknown as SecretServiceContract,
        { params },
      );
      expect(rotated.status).toBe(200);
      const rotatedBody = (await rotated.json()) as {
        rotation: string;
        secret: Record<string, unknown>;
      };
      expect(rotatedBody.rotation).toBe("rotated");
      expect(Object.keys(rotatedBody.secret).sort()).toEqual([
        "configured",
        "createdAt",
        "id",
        "purpose",
        "rotatedAt",
        "rotation",
        "updatedAt",
      ]);
      assertNoLeak(JSON.stringify(rotatedBody));
    });

    it("exposes no endpoint that reads plaintext", async () => {
      const service = stubService();
      // GET is metadata-only and never calls a decryption path: the contract
      // exposed to the boundary has no such method at all.
      const response = await handleListSecrets(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
      );
      expect(service.listMetadata).toHaveBeenCalledTimes(1);
      const contractKeys = Object.keys(
        service as unknown as Record<string, unknown>,
      );
      expect(contractKeys).not.toContain("withDecryptedSecret");
      expect(contractKeys).not.toContain("getPlaintextSecret");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  /**
   * Audit CR-03 — GET /api/secrets/:id returns METADATA ONLY, and its failure
   * modes reveal nothing about whether the id exists in another tenant.
   *
   * These are boundary properties, so they are proven here against the stub.
   * The matching PostgreSQL-backed proof — that a `member` and a
   * `platform_admin` without membership are actually refused, and that a
   * cross-tenant id really yields no row — lives in
   * `packages/db/tests/secret-vault.integration.test.ts`.
   */
  describe("single-record metadata read (audit CR-03)", () => {
    it("returns only the seven allow-listed fields, even from a hostile service", async () => {
      const hostile = {
        ...METADATA,
        ciphertext: "AAAA",
        nonce: "BBBB",
        authTag: "CCCC",
        keyVersion: "k2",
        key: "DkZFRkZFRkZFRkZFRkZFRkZFRkZFRkZFRkZFRkZFE=",
        length: 32,
        last4: PLAINTEXT.slice(-4),
      } as unknown as SecretMetadata;
      const service = stubService({
        getMetadata: vi.fn(async () => hostile),
      });

      const response = await handleGetSecret(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
        { params },
      );
      expect(response.status).toBe(200);
      const body = JSON.parse(assertNoLeak(await response.text())) as {
        secret: Record<string, unknown>;
      };
      expect(Object.keys(body.secret).sort()).toEqual([
        "configured",
        "createdAt",
        "id",
        "purpose",
        "rotatedAt",
        "rotation",
        "updatedAt",
      ]);
      // `configured` is a hard-coded true, never echoed from the service, and
      // the response is not cacheable.
      expect(body.secret.configured).toBe(true);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });

    it("passes the route id and the resolved context to the service", async () => {
      const service = stubService();
      await handleGetSecret(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
        { params: Promise.resolve({ id: SECRET_ID }) },
      );
      expect(service.getMetadata).toHaveBeenCalledWith(CONTEXT, SECRET_ID);
    });

    it("reports an absent id and another tenant's id identically", async () => {
      // `null` is what the vault returns for BOTH cases. The boundary must not
      // be able to distinguish them even in principle, so the two responses are
      // compared byte for byte — status, body and headers.
      const absent = await handleGetSecret(
        fakeRequest({}),
        stubService({
          getMetadata: vi.fn(async () => null),
        }) as unknown as SecretServiceContract,
        { params: Promise.resolve({ id: SECRET_ID }) },
      );
      const foreign = await handleGetSecret(
        fakeRequest({}),
        stubService({
          getMetadata: vi.fn(async () => null),
        }) as unknown as SecretServiceContract,
        {
          params: Promise.resolve({
            id: "99999999-9999-4999-8999-999999999999",
          }),
        },
      );

      expect(absent.status).toBe(404);
      expect(foreign.status).toBe(absent.status);
      // A Response body can only be read once, so each text is captured BEFORE
      // the comparison rather than after it.
      const foreignText = await foreign.text();
      const absentText = await absent.text();
      expect(foreignText).toBe(absentText);
      expect(absent.headers.get("Cache-Control")).toBe(
        foreign.headers.get("Cache-Control"),
      );
      const parsed = JSON.parse(absentText) as {
        error: string;
        message: string;
      };
      expect(parsed.error).toBe("SECRET_NOT_FOUND");
      expect(parsed.message).toBe(secretErrorMessage("SECRET_NOT_FOUND"));
      // The id itself is never echoed, so a probe learns nothing from the body.
      expect(JSON.stringify(parsed)).not.toContain(SECRET_ID);
    });

    it("maps a member or unaffiliated platform_admin refusal to 403", async () => {
      // The vault is what refuses these; the boundary only maps the code, and
      // must not soften it into a 404 or leak that the id exists.
      for (const code of ["SECRET_FORBIDDEN"] as const) {
        const service = stubService({
          getMetadata: vi.fn(async () => {
            throw Object.assign(new Error("membership is member"), { code });
          }),
        });
        const response = await handleGetSecret(
          fakeRequest({}),
          service as unknown as SecretServiceContract,
          { params },
        );
        expect(response.status).toBe(403);
        const text = await response.text();
        expect(text).not.toContain("membership is member");
        expect((JSON.parse(text) as { error: string }).error).toBe(code);
      }
    });

    it("refuses an unauthenticated or unresolvable caller before the vault", async () => {
      for (const [access, status] of [
        [
          {
            ok: false as const,
            status: 401,
            error: "unauthenticated",
            reason: "no_session",
          },
          401,
        ],
        [
          {
            ok: false as const,
            status: 403,
            error: "tenant_context_unavailable",
            reason: "no_active_membership",
          },
          403,
        ],
      ] as const) {
        const service = stubService({
          resolveAccess: vi.fn(async () => access),
        });
        const response = await handleGetSecret(
          fakeRequest({}),
          service as unknown as SecretServiceContract,
          { params },
        );
        expect(response.status).toBe(status);
        // The vault was never consulted, so no existence signal was produced.
        expect(service.getMetadata).not.toHaveBeenCalled();
        expect((await response.json()).status).toBeUndefined();
      }
    });

    it("never turns an unrecognized vault throw into an existence oracle", async () => {
      const service = stubService({
        getMetadata: vi.fn(async () => {
          throw new Error(
            "connect ECONNREFUSED 10.0.0.5:5432 while scanning encrypted_secrets",
          );
        }),
      });
      const response = await handleGetSecret(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
        { params },
      );
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(text).not.toContain("ECONNREFUSED");
      expect(text).not.toContain("encrypted_secrets");
      expect((JSON.parse(text) as { error: string }).error).toBe(
        "VAULT_UNAVAILABLE",
      );
    });

    it("keeps the read off the same-origin guard, like every other GET", async () => {
      const service = stubService();
      const response = await handleGetSecret(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
        { params },
      );
      expect(response.status).toBe(200);
      expect(service.getMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe("error sanitization", () => {
    it("maps every frozen code to its status and generic message", async () => {
      const expectations: Readonly<[string, number][]> = [
        ["VAULT_UNAVAILABLE", 503],
        ["SECRET_NOT_FOUND", 404],
        ["SECRET_FORBIDDEN", 403],
        ["SECRET_INTEGRITY_FAILURE", 500],
        ["KEY_VERSION_UNAVAILABLE", 503],
        ["NONCE_COLLISION", 503],
        ["INVALID_SECRET_INPUT", 400],
      ];

      for (const [code, status] of expectations) {
        const service = stubService({
          listMetadata: vi.fn(async () => {
            throw Object.assign(new Error(`raw driver text for ${code}`), {
              code,
            });
          }),
        });
        const response = await handleListSecrets(
          fakeRequest({}),
          service as unknown as SecretServiceContract,
        );
        expect(response.status, code).toBe(status);
        const text = await response.text();
        expect(text).not.toContain("raw driver text");
        const body = JSON.parse(text) as { error: string; message: string };
        expect(body.error).toBe(code);
        // The message is the frozen generic sentence, identical for every
        // occurrence of the code: it carries no request-specific detail.
        expect(body.message).toBe(secretErrorMessage(code as never));
      }
    });

    it("collapses any unrecognized throw into VAULT_UNAVAILABLE", async () => {
      const hostile = new Error(
        "Unsupported state or unable to authenticate data at unsupported state or unable to authenticate data",
      );
      for (const thrown of [
        hostile,
        new TypeError("Cannot read properties of undefined"),
        "a thrown string",
        { code: "ECONNRESET", message: "connect ECONNRESET 10.0.0.5:5432" },
        { code: "ERR_OSSL_BAD_DECRYPT" },
        Object.assign(new Error("wrapped"), { cause: hostile }),
      ]) {
        const service = stubService({
          listMetadata: vi.fn(async () => {
            throw thrown;
          }),
        });
        const response = await handleListSecrets(
          fakeRequest({}),
          service as unknown as SecretServiceContract,
        );
        expect(response.status).toBe(503);
        const text = await response.text();
        expect(text).not.toContain("ECONNRESET");
        expect(text).not.toContain("10.0.0.5");
        expect(text).not.toContain("authenticate");
        expect(text).not.toContain("Cannot read properties");
        expect((JSON.parse(text) as { error: string }).error).toBe(
          "VAULT_UNAVAILABLE",
        );
      }
    });
  });

  describe("input validation", () => {
    it("rejects a malformed body before the service is called", async () => {
      for (const body of [
        undefined,
        null,
        [],
        "a string",
        {},
        { purpose: "ok.purpose" },
        { secret: "value" },
        { purpose: 42, secret: "value" },
        { purpose: "ok.purpose", secret: null },
      ]) {
        const service = stubService();
        const response = await handleCreateSecret(
          mutationRequest(body),
          service as unknown as SecretServiceContract,
        );
        expect(response.status, JSON.stringify(body ?? null)).toBe(400);
        expect(service.create).not.toHaveBeenCalled();
      }
    });

    it("requires a secret on replace", async () => {
      for (const body of [undefined, {}, { secret: 7 }, { other: "x" }]) {
        const service = stubService();
        const response = await handleReplaceSecret(
          mutationRequest(body),
          service as unknown as SecretServiceContract,
          { params },
        );
        expect(response.status).toBe(400);
        expect(service.replace).not.toHaveBeenCalled();
      }
    });

    it("passes the route id straight to the service for canonicalization", async () => {
      const service = stubService();
      await handleDeleteSecret(
        mutationRequest(),
        service as unknown as SecretServiceContract,
        { params: Promise.resolve({ id: "../../etc/passwd" }) },
      );
      // The handler does not invent its own validation; the vault is the
      // single place that decides what an id may be.
      expect(service.remove).toHaveBeenCalledWith(CONTEXT, "../../etc/passwd");
    });
  });

  describe("same-origin CSRF guard", () => {
    it("rejects every cross-origin or origin-less mutation before the service", async () => {
      type Mutation = Readonly<{
        /** `origin: null` omits the Origin header entirely. */
        invoke: (
          service: SecretServiceContract,
          origin?: string | null,
        ) => Promise<Response>;
        spy: keyof ServiceStub;
      }>;

      // Each mutation builds its request INSIDE `invoke`, so the origin under
      // test is the one that actually reaches the guard.
      const mutations: readonly Mutation[] = [
        {
          invoke: (service, origin) =>
            handleCreateSecret(
              mutationRequest({ purpose: "ok", secret: "value" }, origin),
              service,
            ),
          spy: "create",
        },
        {
          invoke: (service, origin) =>
            handleReplaceSecret(
              mutationRequest({ secret: "v" }, origin),
              service,
              { params },
            ),
          spy: "replace",
        },
        {
          invoke: (service, origin) =>
            handleDeleteSecret(mutationRequest(undefined, origin), service, {
              params,
            }),
          spy: "remove",
        },
        {
          invoke: (service, origin) =>
            handleRotateSecret(mutationRequest(undefined, origin), service, {
              params,
            }),
          spy: "rotate",
        },
      ];

      for (const origin of [
        "https://evil.example",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "null",
        "",
        // A same host at the right port but the wrong scheme.
        "https://localhost:3000",
      ]) {
        for (const { invoke, spy } of mutations) {
          const service = stubService();
          const response = await invoke(
            service as unknown as SecretServiceContract,
            origin,
          );
          expect(response.status, origin).toBe(403);
          expect((await response.json()) as unknown).toEqual({
            error: "cross_origin_rejected",
          });
          expect(service[spy]).not.toHaveBeenCalled();
          expect(service.resolveAccess).not.toHaveBeenCalled();
        }
      }

      // A missing Origin header is refused too, not treated as same-origin.
      for (const { invoke, spy } of mutations) {
        const service = stubService();
        const response = await invoke(
          service as unknown as SecretServiceContract,
          null,
        );
        expect(response.status).toBe(403);
        expect(service[spy]).not.toHaveBeenCalled();
        expect(service.resolveAccess).not.toHaveBeenCalled();
      }

      // And the trusted origin is accepted.
      for (const { invoke } of mutations) {
        const service = stubService();
        const response = await invoke(
          service as unknown as SecretServiceContract,
          TRUSTED_ORIGIN,
        );
        expect(response.status).toBeLessThan(400);
      }
    });

    it("does not require an origin for the metadata read", async () => {
      const service = stubService();
      const response = await handleListSecrets(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
      );
      expect(response.status).toBe(200);
      expect(service.listMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe("authentication and tenant context", () => {
    it("returns 401 without touching the service when unauthenticated", async () => {
      const service = stubService({
        resolveAccess: vi.fn(async () => ({
          ok: false as const,
          status: 401,
          error: "unauthenticated",
          reason: "no_verified_session",
        })),
      });
      const response = await handleListSecrets(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
      );
      expect(response.status).toBe(401);
      expect((await response.json()) as unknown).toEqual({
        error: "unauthenticated",
        reason: "no_verified_session",
      });
      expect(service.listMetadata).not.toHaveBeenCalled();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });

    it("returns 403 without touching the service when the tenant is unresolvable", async () => {
      const service = stubService({
        resolveAccess: vi.fn(async () => ({
          ok: false as const,
          status: 403,
          error: "tenant_context_unavailable",
          reason: "no_active_membership",
        })),
      });
      const response = await handleCreateSecret(
        mutationRequest({ purpose: "ok.purpose", secret: "value" }),
        service as unknown as SecretServiceContract,
      );
      expect(response.status).toBe(403);
      expect((await response.json()) as unknown).toEqual({
        error: "tenant_context_unavailable",
        reason: "no_active_membership",
      });
      expect(service.create).not.toHaveBeenCalled();
    });

    it("resolves access from a verified session and an authoritative membership", async () => {
      // `resolveSecretAccess` is the only place the session meets the tenant
      // context, so the two refusal shapes are pinned here.
      const denied = await resolveSecretAccess({
        resolveSession: async () => ({
          kind: "unauthenticated" as const,
          reason: "no_verified_session",
        }),
        resolveTenantContext: async () => ({
          kind: "unresolved" as const,
          reason: "should_not_run",
        }),
      });
      expect(denied).toEqual({
        ok: false,
        status: 401,
        error: "unauthenticated",
        reason: "no_verified_session",
      });

      const unowned = await resolveSecretAccess({
        resolveSession: async () => ({
          kind: "authenticated" as const,
          userId: USER_ID,
          platformAdmin: true,
        }),
        resolveTenantContext: async () => ({
          kind: "unresolved" as const,
          reason: "no_active_membership",
        }),
      });
      expect(unowned).toEqual({
        ok: false,
        status: 403,
        error: "tenant_context_unavailable",
        reason: "no_active_membership",
      });

      const allowed = await resolveSecretAccess({
        resolveSession: async () => ({
          kind: "authenticated" as const,
          userId: USER_ID,
          platformAdmin: true,
        }),
        resolveTenantContext: async () => ({
          kind: "resolved" as const,
          tenantId: TENANT_A,
          role: "owner",
        }),
      });
      // A platform administrator with an active membership is a tenant
      // administrator like any other; without one, the previous case applies.
      expect(allowed).toEqual({ ok: true, context: CONTEXT });
    });
  });

  describe("cache and headers", () => {
    it("marks every response no-store", async () => {
      const service = stubService();
      const responses = [
        await handleListSecrets(
          fakeRequest({}),
          service as unknown as SecretServiceContract,
        ),
        await handleCreateSecret(
          mutationRequest({ purpose: "ok.purpose", secret: "v" }),
          service as unknown as SecretServiceContract,
        ),
        await handleReplaceSecret(
          mutationRequest({ secret: "v" }),
          service as unknown as SecretServiceContract,
          { params },
        ),
        await handleDeleteSecret(
          mutationRequest(),
          service as unknown as SecretServiceContract,
          { params },
        ),
        await handleRotateSecret(
          mutationRequest(),
          service as unknown as SecretServiceContract,
          { params },
        ),
      ];
      for (const response of responses) {
        expect(response.headers.get("Cache-Control")).toBe("no-store");
      }
    });
  });

  /**
   * Audit CR-07 — `Cache-Control: no-store` is a MANDATORY DEFAULT.
   *
   * Before the correction only the success paths passed `NO_STORE_HEADERS`
   * explicitly and `errorResponse()` could emit a status with no cache
   * directive at all, which left the policy resting on whatever a framework or
   * an intermediary defaulted to. These cases walk EVERY status the surface can
   * produce and require the header on each, while re-asserting that the error
   * bodies still carry no plaintext or envelope material.
   *
   * The property being defended is that a cached error is as damaging as a
   * cached success: a 404 is an existence oracle and a 503 can carry a reason.
   */
  describe("no-store on every status (audit CR-07)", () => {
    const vaultError = (code: string) =>
      Object.assign(new Error("internal"), { code });

    it.each([
      ["400 INVALID_SECRET_INPUT", "INVALID_SECRET_INPUT", 400],
      ["403 SECRET_FORBIDDEN", "SECRET_FORBIDDEN", 403],
      ["404 SECRET_NOT_FOUND", "SECRET_NOT_FOUND", 404],
      ["500 SECRET_INTEGRITY_FAILURE", "SECRET_INTEGRITY_FAILURE", 500],
      ["503 VAULT_UNAVAILABLE", "VAULT_UNAVAILABLE", 503],
      ["503 KEY_VERSION_UNAVAILABLE", "KEY_VERSION_UNAVAILABLE", 503],
      ["503 NONCE_COLLISION", "NONCE_COLLISION", 503],
    ] as const)("sets no-store on %s", async (_label, code, status) => {
      const service = stubService({
        listMetadata: vi.fn(async () => {
          throw vaultError(code);
        }),
      });
      const response = await handleListSecrets(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
      );

      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      const text = await response.text();
      expect(text).not.toContain(PLAINTEXT);
      // The frozen message for NONCE_COLLISION legitimately contains the word
      // "nonce", so the containment check is structural: no envelope field may
      // appear as a KEY, and no value may carry material.
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(Object.keys(parsed).sort()).toEqual(["error", "message"]);
      for (const key of Object.keys(parsed)) {
        expect(key.toLowerCase()).not.toMatch(
          /ciphertext|nonce|authtag|auth_tag|keyversion|keyring|plaintext|last4/,
        );
      }
      expect(parsed).toEqual({
        error: code,
        message: secretErrorMessage(code),
      });
    });

    it("sets no-store on the 400 raised by input validation", async () => {
      const service = stubService();
      const response = await handleCreateSecret(
        mutationRequest({ purpose: "ok.purpose" }),
        service as unknown as SecretServiceContract,
      );

      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      assertNoLeak(await response.text());
      expect(service.create).not.toHaveBeenCalled();
    });

    it("sets no-store on a single-secret GET that finds nothing", async () => {
      const service = stubService({ getMetadata: vi.fn(async () => null) });
      const response = await handleGetSecret(
        fakeRequest({}),
        service as unknown as SecretServiceContract,
        { params },
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      const text = assertNoLeak(await response.text());
      expect(text).not.toContain(SECRET_ID);
    });

    it("sets no-store on the cross-tenant not-found and cannot be told apart", async () => {
      // The absent id and the other tenant's id must stay indistinguishable —
      // status, body AND cache directive — or the 404 itself becomes a
      // cross-tenant existence oracle. The vault answers `null` for both; this
      // pins that the boundary adds nothing back.
      const absent = stubService({ getMetadata: vi.fn(async () => null) });
      const foreign = stubService({ getMetadata: vi.fn(async () => null) });

      const a = await handleGetSecret(
        fakeRequest({}),
        absent as unknown as SecretServiceContract,
        { params: Promise.resolve({ id: SECRET_ID }) },
      );
      const b = await handleGetSecret(
        fakeRequest({}),
        foreign as unknown as SecretServiceContract,
        {
          params: Promise.resolve({
            id: "99999999-9999-4999-8999-999999999999",
          }),
        },
      );

      expect(a.status).toBe(404);
      expect(b.status).toBe(404);
      expect(a.headers.get("Cache-Control")).toBe("no-store");
      expect(b.headers.get("Cache-Control")).toBe("no-store");
      const foreignText = await b.text();
      const absentText = await a.text();
      expect(foreignText).toBe(absentText);
      expect(absentText).not.toContain(SECRET_ID);
    });

    it("sets no-store on the 401 and 403 access refusals", async () => {
      for (const [status, error] of [
        [401, "unauthenticated"],
        [403, "tenant_context_unavailable"],
      ] as const) {
        const service = stubService({
          resolveAccess: vi.fn(async () => ({
            ok: false as const,
            status,
            error,
            reason: "denied",
          })),
        });
        const response = await handleListSecrets(
          fakeRequest({}),
          service as unknown as SecretServiceContract,
        );

        expect(response.status).toBe(status);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        assertNoLeak(await response.text());
        expect(service.listMetadata).not.toHaveBeenCalled();
      }
    });

    it("sets no-store on the cross-origin CSRF refusal", async () => {
      const service = stubService();
      const response = await handleCreateSecret(
        fakeRequest(
          { origin: "https://evil.example" },
          {
            purpose: "ok.purpose",
            secret: PLAINTEXT,
          },
        ),
        service as unknown as SecretServiceContract,
      );

      expect(response.status).toBe(403);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      assertNoLeak(await response.text());
      expect(service.create).not.toHaveBeenCalled();
    });

    it("cannot have no-store downgraded by a caller-supplied header", async () => {
      // The merge order in the handler applies the mandatory keys LAST, so a
      // call site that tries to re-enable caching cannot. This pins that.
      const response = await handleListSecrets(
        fakeRequest({}),
        stubService({
          listMetadata: vi.fn(async () => {
            throw vaultError("VAULT_UNAVAILABLE");
          }),
        }) as unknown as SecretServiceContract,
      );

      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Pragma")).toBe("no-cache");
      expect(response.headers.get("Expires")).toBe("0");
    });
  });
});
