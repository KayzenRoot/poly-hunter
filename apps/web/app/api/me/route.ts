import { NextResponse } from "next/server";
import { createWebIdentityService } from "@/identity/session-service";

/**
 * Sanitized identity endpoint. Returns only the internal user id, the
 * authoritative platform role flag and the resolved tenant selection state.
 * Never returns access/refresh tokens, provider metadata, session values or
 * any secret. Fails closed: without a verified session the answer is
 * `unauthenticated` with no identity detail beyond the refusal reason.
 */
export async function GET(): Promise<NextResponse> {
  const identity = createWebIdentityService();

  const session = await identity.resolveSession();
  if (session.kind === "unauthenticated") {
    return NextResponse.json(
      { authenticated: false, reason: session.reason },
      { status: 401 },
    );
  }

  const tenantResolution = await identity.resolveTenantContext(session.userId);

  const body: Record<string, unknown> = {
    authenticated: true,
    userId: session.userId,
    platformAdmin: session.platformAdmin,
    tenant:
      tenantResolution.kind === "resolved"
        ? { tenantId: tenantResolution.tenantId, role: tenantResolution.role }
        : {
            tenantId: null,
            role: null,
            reason: tenantResolution.reason,
          },
  };

  const response = NextResponse.json(body, { status: 200 });
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
