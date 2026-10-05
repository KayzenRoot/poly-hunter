import { NextResponse } from "next/server";
import { createSupabaseIdentityAdapter } from "@/identity/supabase-adapter";
import { clearActiveTenantSelection } from "@/identity/session-service";

/**
 * Logout: clears the provider session (auth cookies) and the local active
 * tenant selection. Idempotent; always ends with a plain redirect to the home
 * page. No tokens or session values are echoed anywhere.
 */
export async function POST(): Promise<NextResponse> {
  const adapter = createSupabaseIdentityAdapter();
  await adapter.signOut();
  await clearActiveTenantSelection();

  const response = NextResponse.redirect(new URL("/", "http://localhost"), {
    status: 303,
  });
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  return response;
}
