import { createSecretKey, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isCanonicalSecretKeyVersion,
  isCanonicalSecretPurpose,
  secretAuthTagBytes,
  secretErrorCodes,
  secretErrorMessage,
  secretKeyBytes,
  secretNonceBytes,
  secretProtocolLabel,
  type SecretBinding,
  SecretVaultError,
} from "@polyhunter/domain";
import {
  assertSecretPlaintextBytes,
  openSecret,
  randomNonceSource,
  sealSecret,
  secretEnvelopeAad,
} from "@polyhunter/db/server/vault/envelope";
import {
  keyringEnvironmentVariables,
  parseVaultKeyring,
  readVaultKeyringFromEnvironment,
} from "@polyhunter/db/server/vault/keyring";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const TEST_KEY_A = createSecretKey(Buffer.alloc(32, 0xa1));
const TEST_KEY_B = createSecretKey(Buffer.alloc(32, 0xb2));

// Typed as the domain binding, not `as const`: the AAD-swap tests must be able
// to override any field, and a literal-narrowed type would forbid exactly the
// substitution those tests exist to make.
const BASE_BINDING: SecretBinding = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  purpose: "polymarket.api_key",
  keyVersion: "k1",
};

const OTHER_TENANT_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_SECRET_ID = "44444444-4444-4444-8444-444444444444";

function seal(
  key = TEST_KEY_A,
  binding = BASE_BINDING,
  plaintext = "correct horse",
) {
  return sealSecret({
    key,
    binding,
    plaintext: Buffer.from(plaintext, "utf8"),
    nonce: randomBytes(12),
  });
}

function open(
  sealed: ReturnType<typeof seal>,
  key = TEST_KEY_A,
  binding = BASE_BINDING,
) {
  return openSecret({ key, binding, ...sealed });
}

describe("PH-M01-WO-003 envelope protocol", () => {
  it("fixes the protocol parameters to AES-256-GCM / 32 / 12 / 16", () => {
    expect(secretKeyBytes).toBe(32);
    expect(secretNonceBytes).toBe(12);
    expect(secretAuthTagBytes).toBe(16);
    expect(secretProtocolLabel).toBe("polyhunter-secret-envelope-v1");
  });

  it("round-trips a secret and emits exactly a 12-byte nonce and a 16-byte tag", () => {
    const sealed = seal();
    expect(sealed.nonce).toHaveLength(12);
    expect(sealed.authTag).toHaveLength(16);
    expect(sealed.ciphertext.length).toBeGreaterThan(0);
    expect(open(sealed).toString("utf8")).toBe("correct horse");
  });

  it("produces a different nonce AND ciphertext for the same plaintext", () => {
    const first = seal();
    const second = seal();
    expect(first.nonce.equals(second.nonce)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
    expect(first.authTag.equals(second.authTag)).toBe(false);
  });

  it("draws production nonces from the CSPRNG at exactly 12 bytes", () => {
    const drawn = new Set<string>();
    for (let index = 0; index < 64; index += 1) {
      const nonce = randomNonceSource();
      expect(nonce).toHaveLength(12);
      drawn.add(Buffer.from(nonce).toString("hex"));
    }
    // 64 draws from a 96-bit space colliding would mean the source is not random.
    expect(drawn.size).toBe(64);
  });

  it("binds the AAD to protocol, id, tenant, purpose and key version in a fixed order", () => {
    expect(secretEnvelopeAad(BASE_BINDING).toString("utf8")).toBe(
      '["polyhunter-secret-envelope-v1","11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222","polymarket.api_key","k1"]',
    );
  });

  it("rejects a tampered ciphertext, auth tag and nonce", () => {
    // Flip the low bit of the first byte. Written as a helper because `x ?? 0 ^ 0xff`
    // parses as `x ?? (0 ^ 0xff)`, which would leave the buffer untouched.
    const flipFirstByte = (value: Buffer): Buffer =>
      Buffer.concat([Buffer.from([(value[0] ?? 0) ^ 0x01]), value.subarray(1)]);

    const ciphertext = seal();
    expect(() =>
      open({ ...ciphertext, ciphertext: flipFirstByte(ciphertext.ciphertext) }),
    ).toThrow(/failed authentication/i);

    const tag = seal();
    expect(() => open({ ...tag, authTag: flipFirstByte(tag.authTag) })).toThrow(
      /failed authentication/i,
    );

    const nonce = seal();
    expect(() => open({ ...nonce, nonce: flipFirstByte(nonce.nonce) })).toThrow(
      /failed authentication/i,
    );
  });

  it("fails when the AAD tenant, purpose, secret id or key version is swapped", () => {
    const sealed = seal();

    // Cross-tenant ciphertext transplant.
    expect(() =>
      open(sealed, TEST_KEY_A, { ...BASE_BINDING, tenantId: OTHER_TENANT_ID }),
    ).toThrow(/failed authentication/i);
    // Purpose swap.
    expect(() =>
      open(sealed, TEST_KEY_A, {
        ...BASE_BINDING,
        purpose: "polymarket.api_secret",
      }),
    ).toThrow(/failed authentication/i);
    // Record-id swap.
    expect(() =>
      open(sealed, TEST_KEY_A, { ...BASE_BINDING, id: OTHER_SECRET_ID }),
    ).toThrow(/failed authentication/i);
    // Key-version swap: the ciphertext is presented as if written under k2.
    expect(() =>
      open(sealed, TEST_KEY_A, { ...BASE_BINDING, keyVersion: "k2" }),
    ).toThrow(/failed authentication/i);
  });

  it("fails under the wrong key and under a key of the wrong size", () => {
    const sealed = seal();
    expect(() => open(sealed, TEST_KEY_B)).toThrow(/failed authentication/i);
    expect(() =>
      sealSecret({
        key: createSecretKey(Buffer.alloc(16, 1)),
        binding: BASE_BINDING,
        plaintext: Buffer.from("x"),
        nonce: randomBytes(12),
      }),
    ).toThrow();
  });

  it("rejects an envelope whose nonce or tag is not the protocol length", () => {
    const sealed = seal();
    expect(() =>
      openSecret({
        key: TEST_KEY_A,
        binding: BASE_BINDING,
        ...sealed,
        nonce: Buffer.alloc(11),
      }),
    ).toThrow(/failed authentication/i);
    expect(() =>
      openSecret({
        key: TEST_KEY_A,
        binding: BASE_BINDING,
        ...sealed,
        authTag: Buffer.alloc(15),
      }),
    ).toThrow(/failed authentication/i);
  });

  it("never surfaces the underlying OpenSSL error text", () => {
    const sealed = seal();
    try {
      open(sealed, TEST_KEY_B);
      throw new Error("expected a decryption failure");
    } catch (error) {
      expect(error).toBeInstanceOf(SecretVaultError);
      expect((error as SecretVaultError).code).toBe("SECRET_INTEGRITY_FAILURE");
      const text = `${(error as Error).name} ${(error as Error).message} ${String(
        (error as { stack?: string }).stack,
      )}`;
      expect(text).not.toMatch(
        /authenticate|unsupported|OPENSSL|EVP_|openssl/i,
      );
      // No envelope byte may appear in the error surface either.
      expect(text).not.toContain(sealed.ciphertext.toString("hex"));
      expect(text).not.toContain(sealed.authTag.toString("hex"));
    }
  });
});

describe("PH-M01-WO-003 plaintext input rules", () => {
  it("accepts a bounded non-empty value and preserves it byte for byte", () => {
    const padded = "  leading and trailing whitespace is significant  ";
    expect(assertSecretPlaintextBytes(padded).toString("utf8")).toBe(padded);
  });

  it("rejects empty, non-string and oversized input before encryption", () => {
    for (const input of ["", 42, null, undefined, {}, "x".repeat(65_537)]) {
      expect(() => assertSecretPlaintextBytes(input)).toThrow(
        /rejected as invalid/i,
      );
    }
  });

  it("accepts a 64 KiB payload and rejects one byte more", () => {
    expect(assertSecretPlaintextBytes("a".repeat(65_536))).toHaveLength(65_536);
    expect(() => assertSecretPlaintextBytes("a".repeat(65_537))).toThrow(
      /rejected as invalid/i,
    );
  });
});

describe("PH-M01-WO-003 keyring configuration", () => {
  const keyA = Buffer.alloc(32, 0x11).toString("base64");
  const keyB = Buffer.alloc(32, 0x22).toString("base64");

  function configuration(overrides: Record<string, string | undefined> = {}) {
    return {
      activeKeyVersion: "k2",
      keyringJson: JSON.stringify({ k1: keyA, k2: keyB }),
      ...overrides,
    };
  }

  it("accepts a valid keyring and resolves keys by version", () => {
    const ring = parseVaultKeyring(configuration());
    expect(ring.activeKeyVersion).toBe("k2");
    expect(ring.versions).toEqual(["k1", "k2"]);
    const key = ring.resolveKey("k1");
    // A resolvable key must actually seal and open.
    const sealed = sealSecret({
      key,
      binding: { ...BASE_BINDING, keyVersion: "k1" },
      plaintext: Buffer.from("k1 payload"),
      nonce: randomBytes(12),
    });
    expect(
      openSecret({
        key,
        binding: { ...BASE_BINDING, keyVersion: "k1" },
        ...sealed,
      }).toString("utf8"),
    ).toBe("k1 payload");
  });

  it("fails closed on missing, blank or malformed configuration", () => {
    const cases = [
      configuration({ activeKeyVersion: undefined }),
      configuration({ activeKeyVersion: "" }),
      configuration({ keyringJson: undefined }),
      configuration({ keyringJson: "" }),
      configuration({ keyringJson: "not json" }),
      configuration({ keyringJson: "[]" }),
      configuration({ keyringJson: "null" }),
      configuration({ keyringJson: JSON.stringify({}) }),
      configuration({ keyringJson: JSON.stringify({ K1: keyA }) }),
      configuration({ keyringJson: JSON.stringify({ k1: 12345 }) }),
    ];
    for (const input of cases) {
      expect(() => parseVaultKeyring(input)).toThrow(/not available/i);
    }
  });

  it("fails closed when the active version is absent from the keyring", () => {
    expect(() =>
      parseVaultKeyring(configuration({ activeKeyVersion: "k9" })),
    ).toThrow(/not available/i);
  });

  it("fails closed on a key of any size other than exactly 32 bytes", () => {
    for (const bytes of [16, 24, 31, 33, 64]) {
      const encoded = Buffer.alloc(bytes, 0x33).toString("base64");
      expect(() =>
        parseVaultKeyring(
          configuration({
            keyringJson: JSON.stringify({ k1: encoded, k2: keyB }),
          }),
        ),
      ).toThrow(/not available/i);
    }
  });

  it("rejects base64 that Node would otherwise decode leniently", () => {
    const padded = `${keyB}\n`;
    const unpadded = keyB.replace(/=+$/, "");
    for (const value of [padded, unpadded, keyB.replace(/^./, "*")]) {
      expect(() =>
        parseVaultKeyring(
          configuration({ keyringJson: JSON.stringify({ k2: value }) }),
        ),
      ).toThrow(/not available/i);
    }
  });

  it("reports an unknown recorded key version as KEY_VERSION_UNAVAILABLE", () => {
    const ring = parseVaultKeyring(configuration());
    expect(() => ring.resolveKey("k7")).toThrow(/unavailable/i);
    try {
      ring.resolveKey("k7");
    } catch (error) {
      expect((error as SecretVaultError).code).toBe("KEY_VERSION_UNAVAILABLE");
    }
  });

  it("reads exactly two server-only variables, neither of them NEXT_PUBLIC_", () => {
    expect([...keyringEnvironmentVariables]).toEqual([
      "POLYHUNTER_SECRET_ACTIVE_KEY_VERSION",
      "POLYHUNTER_SECRET_KEYRING_JSON",
    ]);
    for (const name of keyringEnvironmentVariables) {
      expect(name.startsWith("NEXT_PUBLIC_")).toBe(false);
    }
    expect(
      readVaultKeyringFromEnvironment({
        POLYHUNTER_SECRET_ACTIVE_KEY_VERSION: "k2",
        POLYHUNTER_SECRET_KEYRING_JSON: JSON.stringify({ k2: keyB }),
      }).activeKeyVersion,
    ).toBe("k2");
  });

  it("treats an entirely absent environment as unavailable, not as an empty keyring", () => {
    expect(() => readVaultKeyringFromEnvironment({})).toThrow(/not available/i);
  });
});

describe("PH-M01-WO-003 canonical input rules and error vocabulary", () => {
  it("accepts only canonical purpose identifiers", () => {
    for (const value of ["ab", "polymarket.api_key", "a-b_c.d", "x1"]) {
      expect(isCanonicalSecretPurpose(value)).toBe(true);
    }
    for (const value of [
      "",
      "a",
      "A",
      "Polymarket",
      "poly market",
      "poly..market",
      ".poly",
      "poly.",
      "-poly",
      "poly-",
      "poly_market!",
      "a".repeat(65),
    ]) {
      expect(isCanonicalSecretPurpose(value)).toBe(false);
    }
  });

  it("accepts only canonical key versions", () => {
    for (const value of ["k", "k1", "2026-01", "v_2", "0"]) {
      expect(isCanonicalSecretKeyVersion(value)).toBe(true);
    }
    for (const value of ["", "K1", "-k1", "k 1", "a".repeat(33)]) {
      expect(isCanonicalSecretKeyVersion(value)).toBe(false);
    }
  });

  it("publishes exactly the frozen sanitized error vocabulary", () => {
    expect([...secretErrorCodes].sort()).toEqual([
      "INVALID_SECRET_INPUT",
      "KEY_VERSION_UNAVAILABLE",
      "NONCE_COLLISION",
      "SECRET_FORBIDDEN",
      "SECRET_INTEGRITY_FAILURE",
      "SECRET_NOT_FOUND",
      "VAULT_UNAVAILABLE",
    ]);
    for (const code of secretErrorCodes) {
      expect(secretErrorMessage(code)).not.toMatch(/[A-Za-z0-9+/]{20,}={0,2}/);
    }
  });
});

describe("PH-M01-WO-003 schema constraint constants do not drift from the domain", () => {
  it("uses the same purpose pattern, key version pattern and byte sizes in both layers", async () => {
    const schema = await readFile(
      resolve(repositoryRoot, "packages/db/src/schema/index.ts"),
      "utf8",
    );

    // The schema inlines these because drizzle-kit cannot evaluate cross-package
    // imports; this assertion is what stops the two copies from diverging.
    expect(schema).toContain(`"^[a-z][a-z0-9]*([._-][a-z0-9]+)*$"`);
    expect(schema).toContain(`"^[a-z0-9][a-z0-9_-]{0,31}$"`);
    expect(schema).toContain("ENCRYPTED_SECRET_NONCE_BYTES = 12");
    expect(schema).toContain("ENCRYPTED_SECRET_AUTH_TAG_BYTES = 16");
    expect(schema).toContain("ENCRYPTED_SECRET_PURPOSE_MAX_LENGTH = 64");
    expect(schema).not.toContain("secretPurposePatternString");
  });

  it("uses the same patterns for the Postgres CHECK constraints in the migration", async () => {
    const migration = await readFile(
      resolve(repositoryRoot, "packages/db/drizzle/0002_encrypted_secrets.sql"),
      "utf8",
    );
    expect(migration).toContain("^[a-z][a-z0-9]*([._-][a-z0-9]+)*$");
    expect(migration).toContain("^[a-z0-9][a-z0-9_-]{0,31}$");
    expect(migration).toContain(
      'octet_length("encrypted_secrets"."nonce") = 12',
    );
    expect(migration).toContain(
      'octet_length("encrypted_secrets"."auth_tag") = 16',
    );
    expect(migration).toContain(
      'octet_length("encrypted_secrets"."ciphertext") > 0',
    );
    expect(migration).toContain("encrypted_secrets_key_version_nonce_unique");
    expect(migration).toContain("ON DELETE cascade ON UPDATE cascade");
    // A parametrized placeholder would have created a literal '$1' CHECK.
    expect(migration).not.toContain("$1");
  });
});
