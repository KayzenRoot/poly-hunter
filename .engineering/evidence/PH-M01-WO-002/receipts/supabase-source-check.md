# PH-M01-WO-002 — Official Supabase source check

Date: 2026-10-05. Sources consulted (official Supabase docs/changelog + npm registry):

## Versions verified via npm registry (`npm view`)

| Package | Exact version pinned | Notes |
|---|---|---|
| `@supabase/supabase-js` | `2.117.2` | current `latest`; no breaking change affecting our usage |
| `@supabase/ssr` | `0.12.7` | current `latest`; peerDependency `@supabase/supabase-js ^2.114.0` (satisfied); deps `cookie ^1.0.2`; published 2026-09-08 |
| `@supabase/ssr` dist-tags | latest=0.12.7, rc=0.12.7-rc.162, patched=0.4.1 | beta/unstable status confirmed (0.x) → adapter isolation required by WO |

## Official guidance verified

1. **Client creation** (supabase.com/docs/guides/auth/server-side/creating-a-client + /nextjs):
   - Browser: `createBrowserClient(url, key)` from `@supabase/ssr` (singleton); only in browser code.
   - Server: `createServerClient(url, key, { cookies: { getAll, setAll } })` per request; `getAll`/`setAll` is the current cookie API (the older `get`/`set`/`remove` triplet is deprecated at v1.0.0).
   - `parseCookieHeader` / `serializeCookieHeader` helpers from `@supabase/ssr`.
2. **Identity verification** (supabase.com/docs/guides/auth/server-side/nextjs):
   - `supabase.auth.getClaims()` — RECOMMENDED for protecting pages/data; verifies token signature on every call (asymmetric keys default for new projects); refreshes session when near expiry.
   - `supabase.auth.getUser()` — network call to Auth server; use for freshest provider user record.
   - `supabase.auth.getSession()` — "Never trust `supabase.auth.getSession()` inside server code such as Proxy. It reads the session out of the cookie without revalidating it." Used ONLY for forwarding raw tokens if ever needed; NEVER for authorization. Our IdentityPort forbids authorization from it.
3. **Next.js 16**: `proxy.ts` replaces `middleware.ts` ("On Next.js 15 and earlier, a `proxy.ts` file is never called"). Proxy calls `getClaims()` to refresh, forwards refreshed cookies via `request.cookies.set` + `response.cookies.set`, and must apply the `setAll` cache headers (`Cache-Control`, `Expires`, `Pragma`) to prevent CDN session leakage.
4. **Browser key policy**: only project URL + publishable key (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); secret/service-role keys never in client bundles.
5. **Flow**: PKCE-compatible SSR flow (`signInWithOAuth` with PKCE is the default SSR pattern in @supabase/ssr).
6. **Changelog** (supabase.com/changelog?types=breaking-change, checked 2026-10-05): no breaking change affecting `getUser()`/`getSession()`; `@supabase/ssr` remains 0.x (roadmap note: current API to be deprecated at v1.0.0 — reinforces adapter isolation); supabase-js requires Node 22+ (repo uses Node 24 — OK) and TS 5.0 from 2027-01-31 (repo uses TS 6.0.3 — OK); `@supabase/middleware` 1.0 (2026-09-30) is a separate optional package — NOT adopted (out of WO scope; @supabase/ssr remains the documented SSR path).
7. Repo verification: Next.js `16.3.8`, React `19.3.0`, Node `24.21.0` (runtime), TS `6.0.3` — all compatible with the pinned Supabase packages.

Environment variables (per docs convention):
- `NEXT_PUBLIC_SUPABASE_URL` — publishable-safe project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key ONLY.
- No service-role/secret key variable is introduced anywhere in this Work Order.
