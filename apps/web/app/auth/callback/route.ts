import { NextResponse, type NextRequest } from "next/server";
import { appUrlFor } from "@/identity/app-origin";
import { sanitizeReturnTo } from "@/identity/open-redirect";
import { createWebIdentityService } from "@/identity/session-service";

/**
 * OAuth/PKCE callback. Supabase exchanges `code` for a session and writes the
 * auth cookies through the adapter's server client. After the exchange the
 * internal identity is resolved idempotently; the redirect target is sanitized
 * against open redirect (same-origin relative paths only).
 *
 * Every redirect target is built from the centrally configured trusted app
 * origin (`appUrlFor`). No redirect is ever built from a hard-coded localhost
 * literal nor derived from the request Host / X-Forwarded-Host header (CR-04).
 *
 * When Supabase is not configured the route fails closed with a redirect to a
 * non-existent session state, never fabricating a session.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));

  if (oauthError !== null) {
    // Provider-reported denial: no session, no user fabrication.
    return NextResponse.redirect(appUrlFor("/?auth=denied"), { status: 303 });
  }

  if (code === null || code.length === 0 || code.length > 4096) {
    return NextResponse.redirect(appUrlFor("/?auth=invalid"), { status: 303 });
  }

  const session = await exchangeCodeAndResolve(code);
  if (!session.ok) {
    return NextResponse.redirect(appUrlFor("/?auth=failed"), { status: 303 });
  }

  return NextResponse.redirect(appUrlFor(returnTo), { status: 303 });
}

async function exchangeCodeAndResolve(code: string): Promise<{ ok: boolean }> {
  const { createSupabaseServerClient, isSupabaseConfigured } = await import(
    "@/identity/supabase-adapter"
  );
  if (!isSupabaseConfigured()) {
    return { ok: false };
  }
  const client = createSupabaseServerClient();
  if (!client) {
    return { ok: false };
  }

  try {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false };
    }

    // Idempotent internal provisioning (also warms the identity link for the
    // session service). Duplicate callbacks never duplicate users.
    const identity = createWebIdentityService();
    const resolved = await identity.resolveSession();
    if (resolved.kind !== "authenticated") {
      return { ok: false };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
