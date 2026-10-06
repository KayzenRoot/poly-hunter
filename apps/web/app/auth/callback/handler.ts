import { NextResponse, type NextRequest } from "next/server";
import { appUrlFor } from "@/identity/app-origin";
import { applyAuthNoStoreHeaders } from "@/identity/auth-cache-headers";
import { sanitizeReturnTo } from "@/identity/open-redirect";

export type CallbackExchange = Readonly<{
  exchangeCodeAndResolve: (code: string) => Promise<{ ok: boolean }>;
}>;

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
 * CR-07: the success path writes fresh auth cookies, so its redirect MUST
 * carry the centralized auth anti-cache policy. The denial / invalid /
 * failure redirects carry the same policy unconditionally: a failed exchange
 * can still clear or rotate auth cookies, and the adapter's `setAll` is
 * invoked through the library's own flow before the outcome is known — a
 * selective policy would risk serving a cookie-clearing redirect from cache.
 *
 * When Supabase is not configured the route fails closed with a redirect to a
 * non-existent session state, never fabricating a session.
 */
export async function handleAuthCallback(
  request: NextRequest,
  dependencies: CallbackExchange,
): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));

  if (oauthError !== null) {
    // Provider-reported denial: no session, no user fabrication.
    return applyAuthNoStoreHeaders(
      NextResponse.redirect(appUrlFor("/?auth=denied"), { status: 303 }),
    );
  }

  if (code === null || code.length === 0 || code.length > 4096) {
    return applyAuthNoStoreHeaders(
      NextResponse.redirect(appUrlFor("/?auth=invalid"), { status: 303 }),
    );
  }

  const session = await dependencies.exchangeCodeAndResolve(code);
  if (!session.ok) {
    return applyAuthNoStoreHeaders(
      NextResponse.redirect(appUrlFor("/?auth=failed"), { status: 303 }),
    );
  }

  return applyAuthNoStoreHeaders(
    NextResponse.redirect(appUrlFor(returnTo), { status: 303 }),
  );
}
