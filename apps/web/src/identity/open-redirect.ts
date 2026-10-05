/**
 * Open-redirect guard for auth flows (login/callback). Only same-origin
 * relative paths are allowed; absolute URLs, protocol-relative URLs and
 * encoded slash/backslash escapes collapse to "/".
 */

/**
 * Open-redirect guard: only same-origin relative paths are allowed. Absolute
 * URLs, protocol-relative URLs and encoded escapes are rejected to "/".
 */
export function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (typeof returnTo !== "string" || returnTo.length === 0) {
    return "/";
  }
  const candidate = returnTo.trim();
  if (candidate.length > 512) {
    return "/";
  }
  if (!candidate.startsWith("/")) {
    return "/";
  }
  if (candidate.startsWith("//")) {
    return "/";
  }
  if (
    candidate.includes("\\") ||
    /%2f/i.test(candidate) ||
    /%5c/i.test(candidate)
  ) {
    return "/";
  }
  try {
    const parsed = new URL(candidate, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function buildAbsoluteCallbackUrl(safeReturnTo: string): string {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  try {
    const base = new URL(configuredOrigin);
    base.pathname = "/auth/callback";
    base.searchParams.set("returnTo", safeReturnTo);
    return base.toString();
  } catch {
    return `http://localhost:3000/auth/callback?returnTo=${encodeURIComponent(safeReturnTo)}`;
  }
}
