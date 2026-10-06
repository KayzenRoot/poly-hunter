import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin } from "@/identity/csrf-guard";
import {
  isSecretErrorCode,
  secretErrorHttpStatus,
  secretErrorMessage,
  type SecretErrorCode,
  type SecretMetadata,
  type TenantContext,
} from "@polyhunter/domain";

/**
 * PH-M01-WO-003 — tenant secret HTTP boundary.
 *
 * The service contract is declared structurally here rather than imported from
 * the concrete web secret service, so these handlers depend on a shape and not
 * on Supabase, PostgreSQL, drizzle or the keyring — which is what makes the
 * redaction, masking and authorization behaviour testable without any of them.
 *
 * Response rules enforced here (API-CONTRACTS + WO-003):
 * - a response body may contain ONLY id, purpose, configured, timestamps and a
 *   boolean-shaped rotation status. There is no code path that can serialize a
 *   ciphertext, nonce, tag, key version, key material or plaintext, because
 *   none of those values is ever handed to `NextResponse.json` — the only
 *   secret-bearing value the handlers see is `SecretMetadata`.
 * - there is NO plaintext read endpoint. Both GET routes (the collection and
 *   the single record) return metadata only, through the same allow-list.
 * - errors carry a stable sanitized code plus its frozen generic message. A
 *   raw Node/OpenSSL/PostgreSQL error string is never passed to a response.
 */

export type SecretServiceContract = Readonly<{
  resolveAccess: () => Promise<
    | { readonly ok: true; readonly context: TenantContext }
    | {
        readonly ok: false;
        readonly status: number;
        readonly error: string;
        readonly reason: string;
      }
  >;
  listMetadata: (context: TenantContext) => Promise<SecretMetadata[]>;
  /**
   * Metadata for ONE secret, or `null` when no row in the caller's own tenant
   * matches. `null` deliberately covers BOTH a genuinely absent id and another
   * tenant's id, so this layer cannot tell the two apart even in principle.
   */
  getMetadata: (
    context: TenantContext,
    secretId: string,
  ) => Promise<SecretMetadata | null>;
  create: (
    context: TenantContext,
    input: Readonly<{ purpose: string; secret: string }>,
  ) => Promise<SecretMetadata>;
  replace: (
    context: TenantContext,
    secretId: string,
    input: Readonly<{ secret: string }>,
  ) => Promise<SecretMetadata>;
  remove: (context: TenantContext, secretId: string) => Promise<void>;
  rotate: (
    context: TenantContext,
    secretId: string,
  ) => Promise<{
    status: "rotated" | "already_current";
    metadata: SecretMetadata;
  }>;
}>;

/**
 * Metadata is rebuilt field-by-field through an explicit projection. Even if a
 * future `SecretMetadata` grew an envelope field, this allow-list would keep
 * it out of the response instead of serializing it by accident.
 */
function masked(secret: SecretMetadata): Record<string, unknown> {
  return {
    id: secret.id,
    purpose: secret.purpose,
    configured: true,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
    rotatedAt: secret.rotatedAt,
    rotation: secret.rotation,
  };
}

/**
 * Audit CR-07 — every response, on every status, is uncacheable.
 *
 * This is a MANDATORY default, not a convention each call site opts into. Before
 * the correction only the success paths passed it explicitly and `errorResponse`
 * could emit a 400/401/403/404/500/503 with no cache directive at all, which left
 * the policy resting on whatever a framework or an intermediary happened to
 * default to. The header is applied inside the two response factories below, so
 * a new route or a new error path cannot forget it.
 */
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  // `no-store` alone is the control; Pragma/Expires are set so that an HTTP/1.0
  // intermediary or a legacy cache that predates RFC 9111 §5.2.2.5 cannot hold a
  // copy either. Neither value carries secret material.
  Pragma: "no-cache",
  Expires: "0",
} as const;

/**
 * Merge caller headers with the mandatory no-store set. The no-store keys are
 * applied LAST so a caller cannot downgrade the policy by passing its own
 * `Cache-Control`.
 */
function withNoStore(
  headers?: Readonly<Record<string, string>>,
): Record<string, string> {
  return { ...(headers ?? {}), ...NO_STORE_HEADERS };
}

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Readonly<Record<string, string>>,
): NextResponse {
  return NextResponse.json(body, { status, headers: withNoStore(headers) });
}

function errorResponse(
  code: SecretErrorCode,
  headers?: Readonly<Record<string, string>>,
): NextResponse {
  return jsonResponse(
    { error: code, message: secretErrorMessage(code) },
    secretErrorHttpStatus[code],
    headers,
  );
}

/**
 * Map any thrown value to a sanitized response.
 *
 * A `SecretVaultError` carries one of the frozen codes and is mapped directly.
 * Anything else — a driver error, an OpenSSL error, an unexpected throw — is
 * reported as VAULT_UNAVAILABLE with the same generic message. The original
 * value is dropped here and never reaches the response, the log or the
 * evidence bundle.
 */
function failureResponse(error: unknown): NextResponse {
  if (isSecretErrorCode((error as { code?: unknown } | null)?.code)) {
    return errorResponse((error as { code: SecretErrorCode }).code);
  }
  return errorResponse("VAULT_UNAVAILABLE");
}

async function readJsonBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // A malformed body is treated as an absent one and rejected by field
    // validation below, never echoed back.
  }
  return {};
}

/**
 * Resolve the authoritative tenant context for this request.
 *
 * Returns either the context or an already-built refusal response. The session
 * is verified server-side and the TenantContext comes from a fresh membership
 * read, so a client-supplied tenant selector is never involved.
 */
async function withAccess(
  service: SecretServiceContract,
): Promise<
  | { readonly ok: true; readonly context: TenantContext }
  | { readonly ok: false; readonly response: NextResponse }
> {
  const access = await service.resolveAccess();
  if (!access.ok) {
    return {
      ok: false,
      response: jsonResponse(
        { error: access.error, reason: access.reason },
        access.status,
      ),
    };
  }
  return { ok: true, context: access.context };
}

/** GET /api/secrets — metadata only. There is no plaintext read endpoint. */
export async function handleListSecrets(
  _request: NextRequest,
  service: SecretServiceContract,
): Promise<NextResponse> {
  const access = await withAccess(service);
  if (!access.ok) return access.response;

  try {
    const secrets = await service.listMetadata(access.context);
    return jsonResponse({ secrets: secrets.map(masked) }, 200);
  } catch (error) {
    return failureResponse(error);
  }
}

/**
 * GET /api/secrets/:id — metadata for one secret, and nothing else.
 *
 * Added by audit CR-03. Three properties are load-bearing and all three are
 * enforced here rather than left to the caller:
 *
 * - METADATA ONLY. The body is the same seven-field allow-list `masked`
 *   produces for every other secret response. There is no branch anywhere in
 *   this file that could serialize plaintext, ciphertext, nonce, auth tag, key
 *   version, key material, plaintext length or a last-4 suffix, because the
 *   only secret-bearing value these handlers ever see is `SecretMetadata`.
 * - NO EXISTENCE ORACLE ACROSS TENANTS. A `null` lookup — an id that does not
 *   exist, and an id belonging to a different tenant, are indistinguishable
 *   here — is reported as the same sanitized SECRET_NOT_FOUND the rest of the
 *   surface already uses. No body, status or header distinguishes them.
 * - AUTHORIZATION IS THE VAULT'S. `member` and a `platform_admin` with no
 *   owner/admin membership are refused by the vault with SECRET_FORBIDDEN
 *   before this handler ever shapes a body; this layer only maps that code.
 */
export async function handleGetSecret(
  _request: NextRequest,
  service: SecretServiceContract,
  context: { readonly params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const access = await withAccess(service);
  if (!access.ok) return access.response;

  const { id } = await context.params;
  try {
    const metadata = await service.getMetadata(access.context, id);
    if (metadata === null) {
      // Same code, same message and same status an absent secret produces.
      return errorResponse("SECRET_NOT_FOUND");
    }
    return jsonResponse({ secret: masked(metadata) }, 200);
  } catch (error) {
    return failureResponse(error);
  }
}

/** POST /api/secrets — create. Same-origin CSRF guard, then masked response. */
export async function handleCreateSecret(
  request: NextRequest,
  service: SecretServiceContract,
): Promise<NextResponse> {
  const guard = assertSameOrigin(request);
  if (guard.kind === "rejected") {
    return jsonResponse({ error: guard.error }, guard.status);
  }

  const access = await withAccess(service);
  if (!access.ok) return access.response;

  const body = await readJsonBody(request);
  if (typeof body.purpose !== "string" || typeof body.secret !== "string") {
    return errorResponse("INVALID_SECRET_INPUT");
  }

  try {
    const created = await service.create(access.context, {
      purpose: body.purpose,
      secret: body.secret,
    });
    // 201 with the metadata projection only. The submitted secret is not
    // echoed, not echoed in an error, and not logged anywhere.
    return jsonResponse({ secret: masked(created) }, 201);
  } catch (error) {
    return failureResponse(error);
  }
}

/** PUT /api/secrets/:id — replace the stored value in place. */
export async function handleReplaceSecret(
  request: NextRequest,
  service: SecretServiceContract,
  context: { readonly params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = assertSameOrigin(request);
  if (guard.kind === "rejected") {
    return jsonResponse({ error: guard.error }, guard.status);
  }

  const access = await withAccess(service);
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const body = await readJsonBody(request);
  if (typeof body.secret !== "string") {
    return errorResponse("INVALID_SECRET_INPUT");
  }

  try {
    const replaced = await service.replace(access.context, id, {
      secret: body.secret,
    });
    return jsonResponse({ secret: masked(replaced) }, 200);
  } catch (error) {
    return failureResponse(error);
  }
}

/** DELETE /api/secrets/:id */
export async function handleDeleteSecret(
  request: NextRequest,
  service: SecretServiceContract,
  context: { readonly params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = assertSameOrigin(request);
  if (guard.kind === "rejected") {
    return jsonResponse({ error: guard.error }, guard.status);
  }

  const access = await withAccess(service);
  if (!access.ok) return access.response;

  const { id } = await context.params;
  try {
    await service.remove(access.context, id);
    return jsonResponse({ deleted: true }, 200);
  } catch (error) {
    return failureResponse(error);
  }
}

/** POST /api/secrets/:id/rotate — re-encrypt to the active key version. */
export async function handleRotateSecret(
  request: NextRequest,
  service: SecretServiceContract,
  context: { readonly params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = assertSameOrigin(request);
  if (guard.kind === "rejected") {
    return jsonResponse({ error: guard.error }, guard.status);
  }

  const access = await withAccess(service);
  if (!access.ok) return access.response;

  const { id } = await context.params;
  try {
    const outcome = await service.rotate(access.context, id);
    return jsonResponse(
      { rotation: outcome.status, secret: masked(outcome.metadata) },
      200,
    );
  } catch (error) {
    return failureResponse(error);
  }
}
