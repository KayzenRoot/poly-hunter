/**
 * Open-redirect guard for auth flows (login/callback). Only same-origin
 * relative paths are allowed; absolute URLs, protocol-relative URLs and
 * encoded slash/backslash escapes collapse to "/".
 *
 * This module is deliberately independent of the configured app origin: it only
 * classifies a candidate as "same-origin relative path or not". Turning the
 * accepted relative path into an absolute URL is the job of `appUrlFor`.
 */

/**
 * Sentinel base used ONLY to resolve a relative candidate during validation.
 * `.invalid` is reserved by RFC 2606 and can never be a real deployment target.
 */
const VALIDATION_SENTINEL = "https://relative-path-validation.invalid";

/** Open-redirect guard: only same-origin relative paths are allowed. Absolute
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
    const parsed = new URL(candidate, VALIDATION_SENTINEL);
    if (parsed.origin !== VALIDATION_SENTINEL) {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}
