import type { IdentityPort, VerifiedIdentity } from "@polyhunter/domain";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { buildAbsoluteCallbackUrl, sanitizeReturnTo } from "./open-redirect";

/**
 * Supabase Auth adapter for the web identity boundary.
 *
 * Isolation contract (module spec / ADR-0004): every `@supabase/*` import of
 * this Work Order lives here or in `proxy.ts`; domain/DB contracts never see
 * Supabase types. Verification uses signature-checked claims only —
 * `getClaims()` (primary) or `getUser()` (fresh provider user record).
 * `getSession()` is NEVER used for authorization (SEC-019; Supabase docs
 * explicitly warn the session cookie is client-forgeable).
 *
 * Environment contract: only the project URL and the PUBLISHABLE key are read
 * (NEXT_PUBLIC_*). No service-role/secret key exists anywhere in this adapter.
 * When configuration is absent the adapter fails closed with an explicit
 * `provider_not_configured` reason — it never fabricates a user.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function isSupabaseConfigured(): boolean {
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

export function createSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        // Next.js 16: cookies() is async; @supabase/ssr getAll supports sync
        // shape here because createServerClient accepts a store wrapper. Use
        // the promise-tolerant pattern instead.
        return cookies().then((store) => store.getAll());
      },
      async setAll(cookiesToSet) {
        try {
          const store = await cookies();
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies; proxy.ts owns refresh.
        }
      },
    },
    cookieOptions: { name: "ph-auth-token" },
  });
}

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { name: "ph-auth-token" },
  });
}

type ClaimsLike = { sub?: string };

function verifiedFromSubject(
  provider: "supabase",
  sub: unknown,
): VerifiedIdentity | null {
  if (typeof sub !== "string") {
    return null;
  }
  const subject = sub.trim();
  if (subject.length === 0 || subject.length > 255) {
    return null;
  }
  return Object.freeze({ provider, subject });
}

/**
 * Server-side identity verification. Primary path: `getClaims()` (signature
 * verified per call). Fallback: `getUser()` for a fresh provider user record
 * when claims are not yet available (e.g. key rotation). Ambiguity, errors and
 * absent configuration all fail closed — no identity is ever synthesized.
 */
export async function verifyServerIdentity(): Promise<
  | { readonly kind: "verified"; readonly identity: VerifiedIdentity }
  | {
      readonly kind: "unverified";
      readonly reason:
        | "provider_not_configured"
        | "unauthenticated"
        | "invalid_session"
        | "provider_unavailable";
    }
> {
  if (!isSupabaseConfigured()) {
    return { kind: "unverified", reason: "provider_not_configured" };
  }

  const client = createSupabaseServerClient();
  if (!client) {
    return { kind: "unverified", reason: "provider_not_configured" };
  }

  try {
    // getClaims verifies the JWT signature against the provider's keys on
    // every call (official recommended server-verification path).
    const result = await client.auth.getClaims();
    if (result.data && !result.error) {
      const subject = (result.data.claims as ClaimsLike | null)?.sub;
      const identity = verifiedFromSubject("supabase", subject);
      if (identity) {
        return { kind: "verified", identity };
      }
    }
  } catch {
    // fall through to getUser() — provider/network ambiguity stays unverified
  }

  try {
    const user = await client.auth.getUser();
    if (user.error) {
      return {
        kind: "unverified",
        reason:
          user.error.message === "Auth session missing!"
            ? "unauthenticated"
            : "invalid_session",
      };
    }
    const identity = verifiedFromSubject("supabase", user.data?.user?.id);
    if (identity) {
      return { kind: "verified", identity };
    }
    return { kind: "unverified", reason: "invalid_session" };
  } catch {
    return { kind: "unverified", reason: "provider_unavailable" };
  }
}

/** Build the provider-neutral IdentityPort bound to the Supabase adapter. */
export function createSupabaseIdentityAdapter(): IdentityPort {
  return {
    verifyIdentity: verifyServerIdentity,
    async startLogin(returnTo) {
      if (!isSupabaseConfigured()) {
        return { kind: "unavailable", reason: "provider_not_configured" };
      }
      const client = createSupabaseServerClient();
      if (!client) {
        return { kind: "unavailable", reason: "provider_not_configured" };
      }
      const safeReturnTo = sanitizeReturnTo(returnTo);
      const callbackUrl = new URL("/auth/callback", "http://localhost");
      callbackUrl.searchParams.set("returnTo", safeReturnTo);
      // OAuth/PKCE SSR flow per @supabase/ssr docs; redirectTo is an absolute
      // URL derived from configured app origin at call time.
      // @supabase/ssr server clients use the PKCE-compatible SSR flow by
      // default; the code verifier is stored in the auth cookie store.
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildAbsoluteCallbackUrl(safeReturnTo),
        },
      });
      if (error || !data?.url) {
        return { kind: "unavailable", reason: "provider_unavailable" };
      }
      void callbackUrl;
      return { kind: "redirect", location: data.url };
    },
    async signOut() {
      const client = createSupabaseServerClient();
      await client?.auth.signOut();
    },
  };
}
