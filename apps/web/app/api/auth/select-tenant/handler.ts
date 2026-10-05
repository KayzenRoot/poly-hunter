import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin } from "@/identity/csrf-guard";

/**
 * Structural shapes injected into the handler. They are declared here (rather
 * than imported from the concrete session service) so the handler depends on a
 * contract, not on the Supabase/database graph — which also keeps it unit
 * testable without a provider or a database.
 */
export type SelectTenantResolution =
  | {
      readonly kind: "resolved";
      readonly tenantId: string;
      readonly role: string;
    }
  | { readonly kind: "unresolved"; readonly reason: string };

export type SelectTenantService = Readonly<{
  resolveSession: () => Promise<
    | {
        readonly kind: "authenticated";
        readonly userId: string;
        readonly platformAdmin: boolean;
      }
    | { readonly kind: "unauthenticated"; readonly reason: string }
  >;
  selectTenant: (
    authenticatedUserId: string,
    requestedTenantId: string,
  ) => Promise<SelectTenantResolution>;
}>;

export type SelectTenantDependencies = Readonly<{
  service: SelectTenantService;
  providerConfigured: boolean;
  writeSelection: (tenantId: string) => Promise<void>;
}>;

/**
 * Explicit tenant selection handler (state-changing POST).
 *
 * Next.js Route Handlers do NOT receive automatic Origin verification; that
 * protection belongs to Server Actions. This handler therefore performs the
 * CSRF check explicitly and fails closed (PH-M01-WO-002 CR-02).
 *
 * Order of operations:
 * 1. CSRF: same-origin guard against the configured trusted origin (fail
 *    closed on cross-origin, malformed or missing Origin).
 * 2. Provider availability: explicit 503 when the identity provider is not
 *    configured.
 * 3. Session: fail closed 401 unless the identity is verified server-side.
 * 4. Selection: the requested tenant id is a SELECTOR; the authoritative
 *    membership row is re-read and the context issued only from that row
 *    (403 on absent/suspended/foreign membership or inactive tenant).
 * 5. Cookie: `ph-active-tenant` is written and AWAITED before the response is
 *    produced, so the outgoing Set-Cookie is committed. The cookie is never
 *    authorization by itself (CR-03).
 */
export async function handleSelectTenant(
  request: NextRequest,
  dependencies: SelectTenantDependencies,
): Promise<NextResponse> {
  const guard = assertSameOrigin(request);
  if (guard.kind === "rejected") {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  if (!dependencies.providerConfigured) {
    return NextResponse.json(
      {
        error: "identity_provider_unavailable",
        reason: "provider_not_configured",
      },
      { status: 503 },
    );
  }

  let requestedTenantId: string | null = null;
  try {
    const body = (await request.json()) as { tenantId?: unknown };
    if (typeof body.tenantId === "string") {
      requestedTenantId = body.tenantId;
    }
  } catch {
    requestedTenantId = null;
  }

  if (requestedTenantId === null || requestedTenantId.length === 0) {
    return NextResponse.json({ error: "invalid_selector" }, { status: 400 });
  }

  const session = await dependencies.service.resolveSession();
  if (session.kind === "unauthenticated") {
    return NextResponse.json(
      { error: "unauthenticated", reason: session.reason },
      { status: 401 },
    );
  }

  const resolution = await dependencies.service.selectTenant(
    session.userId,
    requestedTenantId,
  );
  if (resolution.kind === "unresolved") {
    return NextResponse.json(
      { error: "tenant_selection_rejected", reason: resolution.reason },
      { status: 403 },
    );
  }

  // CR-03: the cookie write is awaited BEFORE the response is produced, so the
  // handler never answers 200 while the selection is still in flight.
  await dependencies.writeSelection(resolution.tenantId);

  const response = NextResponse.json(
    { tenantId: resolution.tenantId, role: resolution.role },
    { status: 200 },
  );
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  return response;
}
