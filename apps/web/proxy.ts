import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 proxy (formerly middleware): refreshes the Supabase session
 * cookies on edge/request time via getClaims(), forwarding refreshed cookies
 * both to Server Components and back to the browser.
 *
 * This proxy performs NO authorization decisions: it only refreshes session
 * state. Authorization always re-verifies identity and membership server-side.
 * When Supabase environment configuration is absent the proxy is a no-op
 * passthrough, so the local Docker stack boots without real credentials.
 *
 * Isolation contract: this is one of the only two files allowed to import
 * `@supabase/*` (the other is src/identity/supabase-adapter.ts).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function isSupabaseConfigured(): boolean {
  try {
    const url = new URL(SUPABASE_URL);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      SUPABASE_PUBLISHABLE_KEY.length > 0
    );
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        // Forward refreshed cookies to Server Components...
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // ...and back to the browser.
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Auth-cookie responses must never be cacheable (session-leak guard
        // from the official @supabase/ssr guidance).
        for (const [header, value] of Object.entries(cacheHeaders)) {
          response.headers.set(header, value);
        }
      },
    },
    cookieOptions: { name: "ph-auth-token" },
  });

  try {
    // Signature-checked refresh path per official Supabase guidance.
    // The claims result is intentionally unused: this proxy never authorizes.
    await supabase.auth.getClaims();
  } catch {
    // Provider/network errors must not break page rendering; authoritative
    // server routes fail closed independently of this refresh.
  }

  return response;
}

export const config = {
  matcher: [
    // Refresh session cookies for app pages and auth/API routes only.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
