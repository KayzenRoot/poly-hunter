import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleCreateSecret,
  handleDeleteSecret,
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
});
