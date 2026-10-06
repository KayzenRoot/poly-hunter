/**
 * Identity shape validation for the web identity boundary. Only the
 * authoritative `sub` claim is read; every other payload field (notably
 * `user_metadata`, roles and tenant ids) is structurally ignored — provider
 * metadata is never authorization input (SEC-019/SEC-021).
 */

import type { IdentityProvider, VerifiedIdentity } from "@polyhunter/domain";

const PROVIDER_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

export type IdentityShapeOutcome =
  | { readonly kind: "verified"; readonly identity: VerifiedIdentity }
  | { readonly kind: "unverified"; readonly reason: "invalid_subject" };

export function verifySanitizedIdentityShape(
  provider: IdentityProvider,
  subject: unknown,
  // The full claims payload is accepted and deliberately ignored beyond `sub`:
  // user_metadata / roles / tenant ids in the token have no authorization
  // meaning anywhere in PolyHunter.
  _fullPayload?: unknown,
): IdentityShapeOutcome {
  if (!PROVIDER_PATTERN.test(provider)) {
    return { kind: "unverified", reason: "invalid_subject" };
  }
  if (typeof subject !== "string") {
    return { kind: "unverified", reason: "invalid_subject" };
  }
  const trimmed = subject.trim();
  if (trimmed.length === 0 || trimmed.length > 255 || trimmed !== subject) {
    return { kind: "unverified", reason: "invalid_subject" };
  }
  return {
    kind: "verified",
    identity: Object.freeze({ provider, subject: trimmed }),
  };
}
