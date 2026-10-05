import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseIdentityAdapter } from "@/identity/supabase-adapter";
import { sanitizeReturnTo } from "@/identity/open-redirect";
import { appUrlFor } from "@/identity/app-origin";

/**
 * Starts the provider login flow (PKCE-compatible SSR). The returnTo target is
 * sanitized against open redirect before use. When Supabase is not configured
 * the endpoint answers 503 with an explicit unavailable reason and never
 * fabricates a redirect or a user.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));

  const adapter = createSupabaseIdentityAdapter();
  const login = await adapter.startLogin(returnTo);

  if (login.kind === "unavailable") {
    return NextResponse.json(
      {
        error: "identity_provider_unavailable",
        reason: login.reason,
      },
      { status: 503 },
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
      return NextResponse.json(
        {
          error: "identity_provider_unavailable",
          reason: "provider_unavailable",
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.redirect(login.location, { status: 302 });
}
