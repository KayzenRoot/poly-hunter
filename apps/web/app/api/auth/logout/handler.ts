import { NextResponse, type NextRequest } from "next/server";
import { appUrlFor } from "@/identity/app-origin";
import { applyAuthNoStoreHeaders } from "@/identity/auth-cache-headers";
import { assertSameOrigin } from "@/identity/csrf-guard";
import type { IdentityPort } from "@polyhunter/domain";

export type LogoutDependencies = Readonly<{
  adapter: IdentityPort;
  clearSelection: () => Promise<void>;
}>;

/**
 * Logout (state-changing POST).
 *
 * Next.js Route Handlers do not receive automatic Origin verification, so the
 * same-origin guard is applied explicitly and fails closed (CR-02).
 *
 * The redirect target is derived from the centrally configured trusted app
 * origin through `appUrlFor`, never from a hard-coded localhost literal and
 * never from the request Host / X-Forwarded-Host header (CR-04). Sign-out is
 * idempotent: the provider session and the local active tenant selection are
 * cleared on every call.
 *
 * CR-07: `signOut` removes the provider auth cookies, so the redirect MUST
 * carry the centralized auth anti-cache policy (`applyAuthNoStoreHeaders`) —
 * the full triple, not only `Cache-Control`.
 */
export async function handleLogout(
  request: NextRequest,
  dependencies: LogoutDependencies,
): Promise<NextResponse> {
  const guard = assertSameOrigin(request);
  if (guard.kind === "rejected") {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  await dependencies.adapter.signOut();
  await dependencies.clearSelection();

  const response = applyAuthNoStoreHeaders(
    NextResponse.redirect(appUrlFor("/"), { status: 303 }),
  );
  return response;
}
