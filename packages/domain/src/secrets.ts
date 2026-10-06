/**
 * PH-M01-WO-003 — tenant secret vault, provider-neutral domain rules.
 *
 * This module is pure: no database, no filesystem, no clock, no randomness and
 * no cryptographic primitive. It owns the vocabulary that the persistence
 * layer, the HTTP boundary and the audit evidence all share:
 *
 * - the envelope protocol label and its canonical AAD field order;
 * - the frozen cryptographic parameter sizes;
 * - the sanitized error vocabulary clients may ever observe;
 * - the canonical input rules for `purpose` and `keyVersion`;
 * - the purpose-scoped `SecretHandle` and the non-sensitive metadata shape.
 *
 * The plaintext byte-length bound is declared here but ENFORCED in the
 * server-only envelope module: `Buffer` is a Node global, and this package
 * deliberately depends on nothing at runtime, so it stays platform-neutral.
 *
 * It deliberately contains NO `getPlaintextSecret(): string` accessor. Plaintext
 * only ever exists as a Buffer inside a caller-supplied callback, bounded by
 * that callback's duration (SEC-004, SEC-023).
 */

/**
 * Envelope protocol label. Changing this string changes every AAD byte and
 * therefore makes every existing envelope unauthenticatable — it is part of the
 * on-disk protocol, not a display string.
 */
export const secretProtocolLabel = "polyhunter-secret-envelope-v1";

/** AES-256 key size in bytes (256 bits). */
export const secretKeyBytes = 32;
/** GCM IV/nonce size in bytes (96 bits) — NIST SP 800-38D §5.2.1.1 recommended length. */
export const secretNonceBytes = 12;
/** GCM authentication tag size in bytes (128 bits) — NIST SP 800-38D §5.2.1.2 first permitted value `t`. */
export const secretAuthTagBytes = 16;
/** Maximum accepted secret plaintext, in bytes of UTF-8 (64 KiB). */
export const secretPlaintextMaxBytes = 65_536;
/** Envelope algorithm label. Fixed for the life of the protocol. */
export const secretAlgorithm = "aes-256-gcm";

/**
 * Every error a client may observe. Nothing outside this list is ever
 * serialized to HTTP, and each maps to a fixed generic message so that no
 * Node/OpenSSL text, key, envelope byte or plaintext can leak through an error
 * path (SEC-015, SEC-024).
 */
export const secretErrorCodes = [
  "VAULT_UNAVAILABLE",
  "SECRET_NOT_FOUND",
  "SECRET_FORBIDDEN",
  "SECRET_INTEGRITY_FAILURE",
  "KEY_VERSION_UNAVAILABLE",
  "NONCE_COLLISION",
  "INVALID_SECRET_INPUT",
] as const;

export type SecretErrorCode = (typeof secretErrorCodes)[number];

const secretErrorMessages: Readonly<Record<SecretErrorCode, string>> =
  Object.freeze({
    VAULT_UNAVAILABLE: "The secret vault is not available.",
    SECRET_NOT_FOUND: "The requested secret does not exist.",
    SECRET_FORBIDDEN:
      "The caller is not authorized for this tenant secret operation.",
    SECRET_INTEGRITY_FAILURE:
      "The stored secret failed authentication and was rejected.",
    KEY_VERSION_UNAVAILABLE:
      "The key version required by this secret is unavailable.",
    NONCE_COLLISION: "Secret encryption could not obtain a unique nonce.",
    INVALID_SECRET_INPUT: "The secret input was rejected as invalid.",
  });

/**
 * The only error type the vault throws across a boundary. `message` is always
 * the frozen generic string for `code`; `cause` is deliberately not carried,
 * because a wrapped Node/OpenSSL failure is exactly the raw text the redaction
 * policy forbids from leaving the process.
 */
export class SecretVaultError extends Error {
  readonly code: SecretErrorCode;

  constructor(code: SecretErrorCode) {
    super(secretErrorMessages[code]);
    this.name = "SecretVaultError";
    this.code = code;
  }
}

export function isSecretErrorCode(value: unknown): value is SecretErrorCode {
  return (
    typeof value === "string" &&
    (secretErrorCodes as readonly string[]).includes(value)
  );
}

/** Generic, safe message for a code. Exposed so HTTP layers need not duplicate it. */
export function secretErrorMessage(code: SecretErrorCode): string {
  return secretErrorMessages[code];
}

/** HTTP status for each sanitized code. Contract (API-CONTRACTS): stable code + safe message only. */
export const secretErrorHttpStatus: Readonly<Record<SecretErrorCode, number>> =
  Object.freeze({
    VAULT_UNAVAILABLE: 503,
    SECRET_NOT_FOUND: 404,
    SECRET_FORBIDDEN: 403,
    SECRET_INTEGRITY_FAILURE: 500,
    KEY_VERSION_UNAVAILABLE: 503,
    NONCE_COLLISION: 503,
    INVALID_SECRET_INPUT: 400,
  });

/**
 * Canonical purpose form: lower-case identifier, segments separated by a
 * single `.`, `_` or `-`, no leading/trailing or doubled separator, bounded to
 * `SECRET_PURPOSE_MAX_LENGTH`. Deliberately narrower than the free-form text a
 * caller might supply, so the value is safe to bind into AAD and to constrain
 * in the database with the identical expression.
 *
 * The pattern uses plain capturing groups (not `(?:...)`) so the exact same
 * string can be used as a POSIX/ARE column CHECK in PostgreSQL.
 */
export const secretPurposeMaxLength = 64;
export const secretPurposePatternString = "^[a-z][a-z0-9]*([._-][a-z0-9]+)*$";
const SECRET_PURPOSE_PATTERN = new RegExp(secretPurposePatternString);

/** Canonical key-version form and bound. Same POSIX-safe pattern shape as purpose. */
export const secretKeyVersionMaxLength = 32;
export const secretKeyVersionPatternString = "^[a-z0-9][a-z0-9_-]{0,31}$";
const SECRET_KEY_VERSION_PATTERN = new RegExp(secretKeyVersionPatternString);

export function isCanonicalSecretPurpose(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 2 &&
    value.length <= secretPurposeMaxLength &&
    SECRET_PURPOSE_PATTERN.test(value)
  );
}

export function isCanonicalSecretKeyVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= secretKeyVersionMaxLength &&
    SECRET_KEY_VERSION_PATTERN.test(value)
  );
}

/**
 * Validate a purpose, returning the canonical value or throwing the sanitized
 * INVALID_SECRET_INPUT error. Callers use this BEFORE encryption so malformed
 * input never reaches the cipher.
 */
export function assertSecretPurpose(value: unknown): string {
  if (!isCanonicalSecretPurpose(value)) {
    throw new SecretVaultError("INVALID_SECRET_INPUT");
  }
  return value;
}

export function assertSecretKeyVersion(value: unknown): string {
  if (!isCanonicalSecretKeyVersion(value)) {
    throw new SecretVaultError("INVALID_SECRET_INPUT");
  }
  return value;
}

/** UUID v1-v8 form accepted for tenant and secret identifiers. */
export const secretUuidPatternString =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
const SECRET_UUID_PATTERN = new RegExp(secretUuidPatternString, "i");

export function isSecretUuid(value: unknown): value is string {
  return typeof value === "string" && SECRET_UUID_PATTERN.test(value);
}

/**
 * The binding an envelope is cryptographically tied to. Every field is bound,
 * in this exact order, by the AAD — so a ciphertext transplanted to another
 * record, tenant, purpose or key version cannot authenticate.
 */
export type SecretBinding = Readonly<{
  id: string;
  tenantId: string;
  purpose: string;
  keyVersion: string;
}>;

/**
 * Purpose-scoped handle. It carries only routing metadata, never a key and
 * never a secret; it is the sole argument an internal caller passes to
 * `withDecryptedSecret` together with its tenant context.
 */
export type SecretHandle = Readonly<{
  id: string;
  tenantId: string;
  purpose: string;
}>;

export function isSecretHandle(value: unknown): value is SecretHandle {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    isSecretUuid(candidate.id) &&
    isSecretUuid(candidate.tenantId) &&
    isCanonicalSecretPurpose(candidate.purpose)
  );
}

/**
 * Non-sensitive rotation status. Deliberately a boolean-shaped projection
 * rather than the raw `keyVersion`: revealing which key version protects a
 * record is metadata no caller of the HTTP API needs (API-CONTRACTS forbids
 * returning key version where unnecessary).
 */
export const secretRotationStates = ["current", "stale"] as const;
export type SecretRotationState = (typeof secretRotationStates)[number];

/**
 * The only secret shape that may cross the HTTP boundary. It contains no
 * plaintext, ciphertext, nonce, tag, key version, key material, length or
 * derived suffix — only identity, purpose, timestamps and rotation status.
 */
export type SecretMetadata = Readonly<{
  id: string;
  purpose: string;
  configured: true;
  createdAt: string;
  updatedAt: string;
  rotatedAt: string | null;
  rotation: SecretRotationState;
}>;

/** Tenant capabilities introduced by PH-M01-WO-003 for the vault surface. */
export const secretCapabilities = [
  "secret:metadata",
  "secret:write",
  "secret:delete",
  "secret:rotate",
] as const;

export type SecretCapability = (typeof secretCapabilities)[number];
