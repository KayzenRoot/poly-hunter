import type { NextResponse, NextRequest } from "next/server";
import { createSupabaseIdentityAdapter } from "@/identity/supabase-adapter";
import { handleLogin } from "./handler";

/**
 * Starts the provider login flow (PKCE-compatible SSR). The returnTo target is
 * sanitized against open redirect before use. When Supabase is not configured
 * the endpoint answers 503 with an explicit unavailable reason and never
 * fabricates a redirect or a user.
 *
 * CR-07: the PKCE cookie write makes the outgoing response auth-mutating, so
 * the response always carries the centralized anti-cache policy — see
 * `handleLogin` in `./handler`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const adapter = createSupabaseIdentityAdapter();
  return handleLogin(request, { startLogin: adapter.startLogin });
}
