import { NextResponse, type NextRequest } from "next/server";
import { createWebIdentityService } from "@/identity/session-service";
import { isSupabaseConfigured } from "@/identity/supabase-adapter";

/**
 * Explicit tenant selection. The requested tenant id is a SELECTOR only: the
 * authoritative membership row is re-read server-side and the context is
 * issued solely from that row (fail closed on absent/suspended/foreign
 * membership). A tampered cookie or a foreign tenant id never authorizes.
 *
 * CSRF posture: this is a same-origin POST guarded by Next.js origin checks;
 * the resulting cookie is httpOnly and never authorization by itself — every
 * authoritative operation revalidates server-side anyway.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
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

  const identity = createWebIdentityService();
  const session = await identity.resolveSession();
  if (session.kind === "unauthenticated") {
    return NextResponse.json(
      { error: "unauthenticated", reason: session.reason },
      { status: 401 },
    );
  }

  const resolution = await identity.selectTenant(
    session.userId,
    requestedTenantId,
  );
  if (resolution.kind === "unresolved") {
    return NextResponse.json(
      { error: "tenant_selection_rejected", reason: resolution.reason },
      { status: 403 },
    );
  }

  const response = NextResponse.json(
    {
      tenantId: resolution.tenantId,
      role: resolution.role,
    },
    { status: 200 },
  );
  // The cookie is set server-side after successful authoritative resolution.
  const { writeActiveTenantSelection } = await import(
    "@/identity/session-service"
  );
  writeActiveTenantSelection(resolution.tenantId);
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  return response;
}
