import {
  createCipheriv,
  createDecipheriv,
  type KeyObject,
  randomBytes,
} from "node:crypto";
import {
  secretAlgorithm,
  secretAuthTagBytes,
  secretNonceBytes,
  secretPlaintextMaxBytes,
  secretProtocolLabel,
  SecretVaultError,
  type SecretBinding,
} from "@polyhunter/domain";

if (typeof window !== "undefined") {
  throw new TypeError(
    "@polyhunter/db/server/vault/envelope cannot be imported by a browser bundle.",
  );
}

/**
 * Validate secret plaintext into its UTF-8 bytes.
 *
 * Bounded and non-empty, and deliberately NOT trimmed or normalized: the exact
 * bytes submitted are the exact bytes encrypted, because a provider credential
 * is whitespace-significant and silently trimming one would corrupt it.
 *
 * This lives here rather than in `@polyhunter/domain` because `Buffer` is a
 * Node global and the domain package deliberately depends on nothing at
 * runtime; the bound itself stays declared there as a protocol constant.
 *
 * Rejection happens BEFORE any cipher is created, so malformed input never
 * reaches the cryptographic primitive.
 */
export function assertSecretPlaintextBytes(value: unknown): Buffer {
  if (typeof value !== "string" || value.length === 0) {
    throw new SecretVaultError("INVALID_SECRET_INPUT");
  }
  const encoded = Buffer.from(value, "utf8");
  if (encoded.length === 0 || encoded.length > secretPlaintextMaxBytes) {
    encoded.fill(0);
    throw new SecretVaultError("INVALID_SECRET_INPUT");
  }
  return encoded;
}

/**
 * PH-M01-WO-003 — envelope protocol `polyhunter-secret-envelope-v1`.
 *
 * AES-256-GCM through Node's built-in `node:crypto` only. There is no custom
 * primitive here and no dependency could substitute for one: the module's whole
 * job is to call OpenSSL's GCM with the sizes the protocol fixes.
 *
 * NIST SP 800-38D anchors for the parameters below:
 * - §5.2.1.1 recommends restricting IV support to 96 bits — the 12-byte nonce.
 * - §5.2.1.2 lists t ∈ {128,120,112,104,96} and requires a single fixed t per
 *   key — this protocol fixes t = 128 bits (16 bytes).
 * - §8.2.2 requires the RBG-based construction's random field to be at least
 *   96 bits with an empty free field — exactly `randomBytes(12)`.
 * - §8.2 requires IV uniqueness for a given key; that invariant is backed by
 *   the `UNIQUE (key_version, nonce)` database index, not by this module alone.
 */

/** Source of 12-byte nonces. Production uses `randomNonceSource`; tests inject. */
export type NonceSource = () => Uint8Array;

/**
 * The production nonce source. CSPRNG output from Node's built-in crypto; the
 * nonce is NEVER derived from tenant, purpose, timestamp, counter or record id.
 * Any such derivation would be catastrophic for GCM and is prohibited by the
 * Work Order.
 */
export const randomNonceSource: NonceSource = () =>
  randomBytes(secretNonceBytes);

/**
 * Canonical AAD bytes for an envelope.
 *
 * The representation is a JSON array of the five bound values in a fixed order
 * with no optional members. Every element is a canonical identifier (or a
 * UUID) validated before it reaches this function, so the encoding is
 * unambiguous: there is exactly one byte string per (record, tenant, purpose,
 * key version) tuple, and it is recomputed identically at seal and open time.
 *
 * Because all five values are authenticated, a ciphertext that is moved to a
 * different secret id, tenant, purpose or key version fails `decipher.final()`
 * with the generic integrity error rather than decrypting.
 */
export function secretEnvelopeAad(binding: SecretBinding): Buffer {
  return Buffer.from(
    JSON.stringify([
      secretProtocolLabel,
      binding.id,
      binding.tenantId,
      binding.purpose,
      binding.keyVersion,
    ]),
    "utf8",
  );
}

export type SealedEnvelope = Readonly<{
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
}>;

/** Assert a nonce is exactly the protocol length; a short/long nonce never seals. */
export function assertProtocolNonce(nonce: Uint8Array): Buffer {
  if (nonce.length !== secretNonceBytes) {
    throw new SecretVaultError("INVALID_SECRET_INPUT");
  }
  return Buffer.from(nonce);
}

/**
 * Encrypt `plaintext` under `key`, binding it to `binding`.
 *
 * Order matters and follows the Work Order: `setAAD` is called before any
 * `update`/`final`, and `authTagLength: 16` is passed explicitly rather than
 * relying on the 128-bit GCM default, so the negotiated tag length cannot drift
 * with a Node or OpenSSL default change.
 */
export function sealSecret(
  params: Readonly<{
    key: KeyObject;
    binding: SecretBinding;
    plaintext: Uint8Array;
    nonce: Uint8Array;
  }>,
): SealedEnvelope {
  const nonce = assertProtocolNonce(params.nonce);
  const cipher = createCipheriv(secretAlgorithm, params.key, nonce, {
    authTagLength: secretAuthTagBytes,
  });
  cipher.setAAD(secretEnvelopeAad(params.binding));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(params.plaintext)),
    cipher.final(),
  ]);
  return { ciphertext, nonce, authTag: cipher.getAuthTag() };
}

/**
 * Authenticated decryption.
 *
 * `setAuthTag` is called before `final()`, and every failure mode — wrong key,
 * tampered ciphertext, tampered tag, tampered nonce, AAD that does not match
 * the row's recorded binding — surfaces as the sanitized
 * SECRET_INTEGRITY_FAILURE. The underlying OpenSSL error object is deliberately
 * discarded here: it is never logged, never attached and never rethrown, so no
 * raw cryptographic text can escape this boundary.
 *
 * The returned Buffer is freshly allocated and owned by the caller, which is
 * responsible for best-effort zeroing it in a `finally`. JavaScript cannot
 * guarantee total heap erasure and no claim of that is made anywhere.
 */
export function openSecret(
  params: Readonly<{
    key: KeyObject;
    binding: SecretBinding;
    ciphertext: Uint8Array;
    nonce: Uint8Array;
    authTag: Uint8Array;
  }>,
): Buffer {
  if (
    params.nonce.length !== secretNonceBytes ||
    params.authTag.length !== secretAuthTagBytes
  ) {
    throw new SecretVaultError("SECRET_INTEGRITY_FAILURE");
  }

  const decipher = createDecipheriv(
    secretAlgorithm,
    params.key,
    Buffer.from(params.nonce),
    { authTagLength: secretAuthTagBytes },
  );
  decipher.setAAD(secretEnvelopeAad(params.binding));
  decipher.setAuthTag(Buffer.from(params.authTag));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(params.ciphertext)),
      decipher.final(),
    ]);
  } catch {
    // Deliberately opaque: never rethrow the Node/OpenSSL error, and never
    // zero the caller's buffers here — the caller owns their lifetime.
    throw new SecretVaultError("SECRET_INTEGRITY_FAILURE");
  }
}
