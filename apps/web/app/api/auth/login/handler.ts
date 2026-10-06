import { NextResponse, type NextRequest } from "next/server";
import { appUrlFor } from "@/identity/app-origin";
import { applyAuthNoStoreHeaders } from "@/identity/auth-cache-headers";
import { sanitizeReturnTo } from "@/identity/open-redirect";
import type { IdentityPort } from "@polyhunter/domain";

export type LoginDependencies = Readonly<{
  startLogin: IdentityPort["startLogin"];
}>;

/**
 * Starts the provider login flow (PKCE-compatible SSR). The returnTo target is
 * sanitized against open redirect before use. When Supabase is not configured
 * the endpoint answers 503 with an explicit unavailable reason and never
 * fabricates a redirect or a user.
 *
 * CR-07: `signInWithOAuth` stores the PKCE code verifier in the auth cookie
 * store, so the outgoing response carries `Set-Cookie` and MUST carry the
 * centralized auth anti-cache policy (`applyAuthNoStoreHeaders`). The policy
 * is applied unconditionally to every response of this handler — auth
 * endpoints are never cacheable, and the PKCE cookie is written before the
 * provider-redirect validation below, so even the mismatch 503 carries it.
 */
export async function handleLogin(
  request: NextRequest,
  dependencies: LoginDependencies,
): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));

  const login = await dependencies.startLogin(returnTo);

  if (login.kind === "unavailable") {
    return applyAuthNoStoreHeaders(
      NextResponse.json(
        {
          error: "identity_provider_unavailable",
          reason: login.reason,
        },
        { status: 503 },
      ),
    );
  }

  // The provider redirect target comes from the Supabase Auth server itself;
  // returnTo travels only inside the callback URL allowlisted to /auth/callback.
  const providerUrl = new URL(login.location);
  const redirectTo = providerUrl.searchParams.get("redirect_to");
  if (redirectTo !== null) {
    const allowed = appUrlFor(
      `/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
    );
    const redirectToUrl = new URL(redirectTo);
    if (
      redirectToUrl.origin !== allowed.origin ||
      redirectToUrl.pathname !== allowed.pathname
    ) {
      return applyAuthNoStoreHeaders(
        NextResponse.json(
          {
            error: "identity_provider_unavailable",
            reason: "provider_unavailable",
          },
          { status: 503 },
        ),
      );
    }
  }

  return applyAuthNoStoreHeaders(
    NextResponse.redirect(login.location, { status: 302 }),
  );
}
