import { NextResponse, type NextRequest } from "next/server";
import { sanitizeReturnTo } from "@/identity/open-redirect";
import { createWebIdentityService } from "@/identity/session-service";

/**
 * OAuth/PKCE callback. Supabase exchanges `code` for a session and writes the
 * auth cookies through the adapter's server client. After the exchange the
 * internal identity is resolved idempotently; the redirect target is sanitized
 * against open redirect (same-origin relative paths only).
 *
 * When Supabase is not configured the route fails closed with 503 and no
 * redirect, never fabricating a session.
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
    return NextResponse.redirect(new URL("/?auth=denied", "http://localhost"), {
      status: 303,
    });
  }

  if (code === null || code.length === 0 || code.length > 4096) {
    return NextResponse.redirect(
      new URL("/?auth=invalid", "http://localhost"),
      { status: 303 },
    );
  }

  // The adapter presence check happens inside the exchange helper via
  // isSupabaseConfigured; no unused locals are kept here. The
  // code exchange is performed by the SSR server client bound to this request's
  // cookies (exchangeCodeForSession needs setAll access, which adapter-internal
  // cookieOptions already wire to this request through Next cookies()).
  const session = await exchangeCodeAndResolve(code);
  if (!session.ok) {
    return NextResponse.redirect(new URL("/?auth=failed", "http://localhost"), {
      status: 303,
    });
  }

  return NextResponse.redirect(new URL(returnTo, "http://localhost"), {
    status: 303,
  });
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
