/**
 * Centralized anti-cache policy for auth-mutating responses (server-only).
 *
 * Contract source: `@supabase/ssr` 0.12.7 server-side
 * `setAll(cookiesToSet, cacheHeaders)`. Whenever auth cookies are created,
 * updated or removed, the library delivers these exact headers so the
 * mutation response is never stored by a CDN or reverse proxy — one user's
 * session must never be served to another. `apps/web/proxy.ts` forwards the
 * delivered object directly.
 *
 * Route Handlers cannot rely on that delivery: the `next/headers` cookie
 * store used by the server adapter exposes no response handle, so the
 * headers delivered to the adapter's `setAll` cannot be written to the
 * outgoing response from inside that callback (boundary documented in
 * `supabase-adapter.ts`). Every Route Handler that may create, update or
 * remove Supabase auth cookies MUST therefore apply this policy to its own
 * response through `applyAuthNoStoreHeaders()` — currently login (PKCE
 * initiation), the auth callback and logout.
 *
 * Concurrency: this module holds no mutable state. The policy is a frozen
 * constant and `applyAuthNoStoreHeaders` touches only the response passed
 * to it, so concurrent requests cannot interfere through this module.
 *
 * Server-only by construction: it is imported only by Route Handlers, the
 * server adapter and their tests — never by client components. It performs
 * no I/O and reads no per-request globals.
 */

/** Exact `Cache-Control` value delivered by `@supabase/ssr` 0.12.7. */
export const AUTH_NO_STORE_CACHE_CONTROL =
  "private, no-cache, no-store, must-revalidate, max-age=0";

/**
 * The full anti-cache policy as a frozen record. Keys use the exact casing
 * the library delivers (`Cache-Control`, `Expires`, `Pragma`).
 */
export const AUTH_NO_STORE_HEADERS: Readonly<Record<string, string>> =
  Object.freeze({
    "Cache-Control": AUTH_NO_STORE_CACHE_CONTROL,
    Expires: "0",
    Pragma: "no-cache",
  });

/** Minimal structural shape: anything with settable headers (NextResponse). */
export type HeadersSink = {
  readonly headers: { set(name: string, value: string): void };
};

/**
 * Applies the auth anti-cache policy to an outgoing response. Returns the
 * same response for call-site chaining. Overwrites any existing values for
 * these three headers — an auth-mutating response must never be cacheable.
 */
export function applyAuthNoStoreHeaders<T extends HeadersSink>(response: T): T {
  for (const [name, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
