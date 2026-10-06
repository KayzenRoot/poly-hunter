/**
 * Explicit CSRF/same-origin guard for state-changing custom Route Handlers.
 *
 * Next.js automatic Origin/Host CSRF checks cover Server Actions; custom
 * Route Handlers must enforce their own policy (official Next.js security
 * guidance). This guard:
 *
 * - trusts ONLY the configured application origin (`NEXT_PUBLIC_APP_ORIGIN`,
 *   resolved through app-origin.ts) — never the request Host,
 *   X-Forwarded-Host or any other client/proxy-supplied header;
 * - requires an `Origin` header on every state-changing request and compares
 *   it (scheme + host + port) against the trusted origin. A missing Origin is
 *   a FAIL-CLOSED rejection (policy choice: browsers always attach Origin to
 *   POSTs made by the PolyHunter app; non-browser callers must send it too);
 * - reverse-proxy policy: the proxy must forward the request preserving the
 *   public origin; forwarded headers are deliberately ignored for security
 *   decisions;
 * - cross-origin / malformed / spoofed requests FAIL CLOSED with 403.
 *
 * SameSite cookies remain defense-in-depth only.
 */

import { InvalidAppOriginError, originMatchesTrusted } from "./app-origin";

export type CsrfGuardOutcome =
  | { readonly kind: "allowed" }
  | {
      readonly kind: "rejected";
      readonly status: 403;
      readonly error: "cross_origin_rejected";
    };

export function assertSameOrigin(request: {
  headers: { get(name: string): string | null };
}): CsrfGuardOutcome {
  try {
    const origin = request.headers.get("origin");
    if (originMatchesTrusted(origin)) {
      return { kind: "allowed" };
    }
  } catch (error) {
    // Invalid production origin configuration: fail closed rather than
    // accidentally accepting a default/unknown origin.
    if (!(error instanceof InvalidAppOriginError)) {
      throw error;
    }
  }
  return {
    kind: "rejected",
    status: 403,
    error: "cross_origin_rejected",
  };
}
