import type { NextResponse, NextRequest } from "next/server";
import { handleAuthCallback } from "./handler";

/**
 * OAuth/PKCE callback. Supabase exchanges `code` for a session and writes the
 * auth cookies through the adapter's server client. After the exchange the
 * internal identity is resolved idempotently; the redirect target is sanitized
 * against open redirect (same-origin relative paths only).
 *
 * CR-07: every response of this handler carries the centralized auth
 * anti-cache policy — see `handleAuthCallback` in `./handler`.
 *
 * When Supabase is not configured the route fails closed with a redirect to a
 * non-existent session state, never fabricating a session.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleAuthCallback(request, { exchangeCodeAndResolve });
}

async function exchangeCodeAndResolve(code: string): Promise<{ ok: boolean }> {
  const { createSupabaseServerClient, isSupabaseConfigured } = await import(
    "@/identity/supabase-adapter"
  );
  const { createWebIdentityService } = await import(
    "@/identity/session-service"
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
