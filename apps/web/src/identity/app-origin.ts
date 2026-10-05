/**
 * Trusted application origin resolution (server-only).
 *
 * The security origin is taken EXCLUSIVELY from `NEXT_PUBLIC_APP_ORIGIN`
 * configuration — never from the request Host, X-Forwarded-Host or any other
 * client/proxy-supplied header. Reverse-proxy policy: the proxy must preserve
 * the public scheme/host of the configured origin; forwarded headers are
 * ignored for security decisions by design.
 *
 * Validation:
 * - must be an absolute, valid URL;
 * - `http` is accepted only outside production (local development);
 * - production requires `https`;
 * - invalid configuration in production FAILS CLOSED (throws) instead of
 *   silently falling back to localhost.
 */

const DEFAULT_LOCAL_ORIGIN = "http://localhost:3000";

export type AppOriginValidationError = {
  readonly kind: "invalid_url" | "insecure_production_origin";
};

export class InvalidAppOriginError extends Error {
  constructor(public readonly reason: AppOriginValidationError["kind"]) {
    super(
      reason === "insecure_production_origin"
        ? "NEXT_PUBLIC_APP_ORIGIN must use https in production."
        : "NEXT_PUBLIC_APP_ORIGIN must be a valid absolute URL.",
    );
    this.name = "InvalidAppOriginError";
  }
}

function validate(originString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(originString);
  } catch {
    throw new InvalidAppOriginError("invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidAppOriginError("invalid_url");
  }
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && parsed.protocol !== "https:") {
    throw new InvalidAppOriginError("insecure_production_origin");
  }
  return parsed;
}

/**
 * Returns the trusted application origin as a normalised URL
 * (scheme://host[:port], no trailing slash/path).
 */
export function getAppOrigin(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN;

  if (configured === undefined || configured === "") {
    // Absent configuration is only tolerable outside production; local
    // development defaults to the canonical Compose web origin.
    if (process.env.NODE_ENV === "production") {
      throw new InvalidAppOriginError("invalid_url");
    }
    return new URL(DEFAULT_LOCAL_ORIGIN);
  }

  return validate(configured);
}

/** Whether a parsed Origin matches the trusted app origin (scheme+host+port). */
export function originMatchesTrusted(
  originHeader: string | null | undefined,
): boolean {
  if (
    originHeader === null ||
    originHeader === undefined ||
    originHeader === ""
  ) {
    return false;
  }
  let candidate: URL;
  try {
    candidate = new URL(originHeader);
  } catch {
    return false;
  }
  const trusted = getAppOrigin();
  return (
    candidate.protocol === trusted.protocol &&
    candidate.hostname === trusted.hostname &&
    candidate.port === trusted.port
  );
}

/**
 * Absolute URL for a sanitized same-origin relative path.
 *
 * Defence in depth: the argument MUST be a relative path. An absolute or
 * protocol-relative argument would make `new URL` discard the trusted origin
 * and turn this into an open redirect, so it is rejected outright. Callers are
 * still expected to pass the output of `sanitizeReturnTo`.
 */
export function appUrlFor(relativePath: string): URL {
  const origin = getAppOrigin();
  if (
    !relativePath.startsWith("/") ||
    relativePath.startsWith("//") ||
    relativePath.includes("\\")
  ) {
    throw new InvalidAppOriginError("invalid_url");
  }
  const resolved = new URL(relativePath, origin);
  if (resolved.origin !== origin.origin) {
    throw new InvalidAppOriginError("invalid_url");
  }
  return resolved;
}
