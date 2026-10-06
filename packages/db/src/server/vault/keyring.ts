import { createSecretKey, type KeyObject } from "node:crypto";
import {
  isCanonicalSecretKeyVersion,
  secretKeyBytes,
  SecretVaultError,
} from "@polyhunter/domain";

if (typeof window !== "undefined") {
  throw new TypeError(
    "@polyhunter/db/server/vault/keyring cannot be imported by a browser bundle.",
  );
}

/**
 * PH-M01-WO-003 — server-only versioned keyring.
 *
 * Configuration is two environment variables and nothing else:
 *
 *   POLYHUNTER_SECRET_ACTIVE_KEY_VERSION   the canonical version now used for writes
 *   POLYHUNTER_SECRET_KEYRING_JSON         {"<version>": "<base64 raw 32-byte AES key>"}
 *
 * Both names are deliberately NOT `NEXT_PUBLIC_*`. Next.js inlines any
 * `NEXT_PUBLIC_*` variable into the browser bundle, so a secret key under that
 * prefix would ship to every client regardless of import graph discipline. The
 * names are also validated against the public prefix below, so a future rename
 * cannot silently move key material client-side.
 *
 * Everything here fails closed. A missing, blank, malformed, mis-encoded,
 * wrong-size or dangling configuration raises VAULT_UNAVAILABLE and never
 * degrades to a default, a generated key, or an unencrypted fallback.
 */

export const ACTIVE_KEY_VERSION_ENV = "POLYHUNTER_SECRET_ACTIVE_KEY_VERSION";
export const KEYRING_JSON_ENV = "POLYHUNTER_SECRET_KEYRING_JSON";

/** Every environment name this module reads. Nothing else is consulted. */
export const keyringEnvironmentVariables: readonly string[] = [
  ACTIVE_KEY_VERSION_ENV,
  KEYRING_JSON_ENV,
];

/** Next.js inlines any variable with this prefix into the browser bundle. */
const CLIENT_EXPOSED_PREFIX = "NEXT_PUBLIC_";

/**
 * Guard against a rename that would put key material on the client. This is a
 * runtime assertion as well as a test, because the cost of being wrong here is
 * a published master key.
 */
function assertServerOnlyName(name: string): void {
  if (name.startsWith(CLIENT_EXPOSED_PREFIX)) {
    throw new SecretVaultError("VAULT_UNAVAILABLE");
  }
}

export type VaultKeyring = Readonly<{
  /** Canonical version used for every new encryption and for rotation targets. */
  readonly activeKeyVersion: string;
  /** Canonical versions present in the keyring, sorted. Contains no key material. */
  readonly versions: readonly string[];
  /**
   * Resolve the KeyObject for a recorded version, or raise
   * KEY_VERSION_UNAVAILABLE. A KeyObject is built on demand from the
   * configuration; the decoded staging buffer is zeroed immediately after, so no
   * long-lived JavaScript buffer holds raw key bytes. The OpenSSL copy inside
   * the KeyObject cannot be zeroed from JavaScript — that limitation is stated
   * rather than papered over.
   */
  resolveKey: (keyVersion: string) => KeyObject;
}>;

/** Strict base64: Node's decoder is lenient, so decode-and-re-encode is required. */
const STRICT_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function decodeBase64Strict(value: string): Buffer | null {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !STRICT_BASE64.test(value)
  ) {
    return null;
  }
  const decoded = Buffer.from(value, "base64");
  // Reject any input Node "helpfully" tolerated (stray whitespace, missing
  // padding, non-alphabet characters): a round trip must be byte-identical.
  if (decoded.toString("base64") !== value) {
    decoded.fill(0);
    return null;
  }
  return decoded;
}

export type KeyringConfiguration = Readonly<{
  activeKeyVersion?: string | undefined;
  keyringJson?: string | undefined;
}>;

/**
 * Parse and validate the keyring configuration.
 *
 * Fails closed with VAULT_UNAVAILABLE on: absent/blank configuration, invalid
 * JSON, a non-object or empty keyring, a non-canonical key version, a non-string
 * or non-strict-base64 value, a decoded key of any length other than 32 bytes,
 * and an active version that is absent from the keyring.
 *
 * No value, key or keyring text is included in any error: every path raises the
 * frozen generic VAULT_UNAVAILABLE message.
 */
export function parseVaultKeyring(
  configuration: KeyringConfiguration,
): VaultKeyring {
  for (const name of keyringEnvironmentVariables) {
    assertServerOnlyName(name);
  }

  const activeKeyVersion = configuration.activeKeyVersion?.trim() ?? "";
  const keyringJson = configuration.keyringJson?.trim() ?? "";

  if (!isCanonicalSecretKeyVersion(activeKeyVersion) || keyringJson === "") {
    throw new SecretVaultError("VAULT_UNAVAILABLE");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(keyringJson);
  } catch {
    throw new SecretVaultError("VAULT_UNAVAILABLE");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SecretVaultError("VAULT_UNAVAILABLE");
  }

  const entries = parsed as Record<string, unknown>;
  const versions = Object.keys(entries).sort();
  if (versions.length === 0) {
    throw new SecretVaultError("VAULT_UNAVAILABLE");
  }

  const encodedKeys = new Map<string, string>();
  for (const version of versions) {
    const encoded = entries[version];
    if (!isCanonicalSecretKeyVersion(version) || typeof encoded !== "string") {
      throw new SecretVaultError("VAULT_UNAVAILABLE");
    }
    const decoded = decodeBase64Strict(encoded);
    if (decoded === null || decoded.length !== secretKeyBytes) {
      throw new SecretVaultError("VAULT_UNAVAILABLE");
    }
    // Zero the decoded staging buffer now; only the base64 text remains in the
    // map, and that text stays inside this closure and is never logged.
    decoded.fill(0);
    encodedKeys.set(version, encoded);
  }

  if (!encodedKeys.has(activeKeyVersion)) {
    throw new SecretVaultError("VAULT_UNAVAILABLE");
  }

  return {
    activeKeyVersion,
    versions,
    resolveKey: (keyVersion: string): KeyObject => {
      if (!isCanonicalSecretKeyVersion(keyVersion)) {
        throw new SecretVaultError("KEY_VERSION_UNAVAILABLE");
      }
      const encoded = encodedKeys.get(keyVersion);
      if (encoded === undefined) {
        // A row recorded under a version this process no longer holds. Fail
        // closed and never fall back to another key.
        throw new SecretVaultError("KEY_VERSION_UNAVAILABLE");
      }
      return createSecretKey(encoded, "base64");
    },
  };
}

/**
 * Read the keyring from the process environment. The only two names consulted
 * are the module constants above; a missing variable is a legitimate "vault not
 * configured" state and raises VAULT_UNAVAILABLE, which the HTTP boundary maps
 * to a sanitized 503.
 */
export function readVaultKeyringFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): VaultKeyring {
  return parseVaultKeyring({
    activeKeyVersion: environment[ACTIVE_KEY_VERSION_ENV],
    keyringJson: environment[KEYRING_JSON_ENV],
  });
}

/**
 * Non-throwing availability probe for callers that need to distinguish "vault
 * not configured" from "secret does not exist". It performs the same full
 * validation and returns no key material.
 */
export function isVaultKeyringConfigured(
  configuration: KeyringConfiguration,
): boolean {
  try {
    parseVaultKeyring(configuration);
    return true;
  } catch {
    return false;
  }
}
