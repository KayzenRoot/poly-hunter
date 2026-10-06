import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  assertSecretPurpose,
  isSecretHandle,
  isSecretUuid,
  SecretVaultError,
  tenantRoleHasCapability,
  type SecretCapability,
  type SecretHandle,
  type SecretMetadata,
  type TenantContext,
} from "@polyhunter/domain";
import { encryptedSecrets } from "../../schema/index.js";
import {
  activeTenantMembershipPredicate,
  activeTenantMembershipProbe,
} from "../authorization.js";
import {
  assertSecretPlaintextBytes,
  openSecret,
  randomNonceSource,
  sealSecret,
  type NonceSource,
} from "./envelope.js";
import {
  parseVaultKeyring,
  type KeyringConfiguration,
  type VaultKeyring,
} from "./keyring.js";

if (typeof window !== "undefined") {
  throw new TypeError(
    "@polyhunter/db/server/vault cannot be imported by a browser bundle.",
  );
}

/**
 * The envelope and keyring contracts are re-exported here so there is exactly
 * ONE importable server entry point for the vault. Nothing outside this module
 * needs to know that `./envelope.ts` and `./keyring.ts` exist, and the web
 * boundary cannot reach past the guarded entry to an unguarded sub-path.
 */
export {
  openSecret,
  randomNonceSource,
  sealSecret,
  secretEnvelopeAad,
  type NonceSource,
  type SealedEnvelope,
} from "./envelope.js";
export {
  ACTIVE_KEY_VERSION_ENV,
  KEYRING_JSON_ENV,
  isVaultKeyringConfigured,
  keyringEnvironmentVariables,
  readVaultKeyringFromEnvironment,
  type VaultKeyring,
} from "./keyring.js";

/**
 * PH-M01-WO-003 — tenant secret vault.
 *
 * Persistence, authorization, nonce-collision handling and rotation live here.
 * The cryptographic primitive lives in `./envelope.ts`; key material handling
 * lives in `./keyring.ts`. Nothing in this module ever returns, logs or stores
 * plaintext outside `withDecryptedSecret`'s callback.
 *
 * Invariants this module is responsible for:
 *
 * 1. TENANT SCOPE. Every statement filters on `context.tenantId`. No path
 *    accepts a tenant id from the caller and no path reads a secret without one.
 * 2. AUTHORITATIVE MEMBERSHIP. Every operation re-reads membership + user +
 *    tenant status, so a suspension or removal takes effect on the next
 *    authoritative request (SEC-022).
 * 3. CAPABILITY. Each operation declares the capability it needs. `member`
 *    holds none of the four `secret:*` capabilities and is denied all of them.
 * 4. NO PLAINTEXT ESCAPE. Plaintext exists only as a Buffer inside a callback,
 *    best-effort zeroed in a `finally`. There is no `getPlaintextSecret()`.
 * 5. NO MIXED ENVELOPE. Rotation and replacement rewrite ciphertext, nonce, tag
 *    and key version in ONE statement under a row lock, so no concurrent
 *    operation can leave one envelope's material beside another's metadata.
 * 6. FAIL CLOSED. Missing keyring, unknown key version, authentication failure
 *    and nonce-retry exhaustion all raise a sanitized code; none degrades,
 *    falls back to another key, or overwrites the stored row.
 */

const NONCE_UNIQUE_CONSTRAINT = "encrypted_secrets_key_version_nonce_unique";
const UNIQUE_VIOLATION = "23505";

/**
 * Small, fixed retry budget for a nonce collision. The probability is ~2^-96
 * per pair, so this exists to prove the database barrier actually holds and to
 * define a terminal state — not because collision is expected. Exhaustion is
 * NONCE_COLLISION and fails closed; the collided envelope is rolled back,
 * discarded and never persisted.
 */
const MAX_NONCE_ATTEMPTS = 3;

const TENANT_ROLES = ["owner", "admin", "member"] as const;

export type SecretVaultOptions = Readonly<{
  connectionString?: string;
  /**
   * Server-only keyring configuration. Tests inject deterministic 32-byte keys;
   * production passes the two environment variables read by
   * `readVaultKeyringFromEnvironment`.
   */
  keyring: KeyringConfiguration;
  /** Overridable nonce source. Production is `randomNonceSource`. */
  nonceSource?: NonceSource;
  maxConnections?: number;
}>;

export type RotateOutcome = Readonly<{
  status: "rotated" | "already_current";
  metadata: SecretMetadata;
}>;

export type SecretVault = Readonly<{
  /** Non-sensitive availability probe. Never returns key material. */
  isConfigured: () => boolean;
  listMetadata: (context: TenantContext) => Promise<SecretMetadata[]>;
  getMetadata: (
    context: TenantContext,
    secretId: string,
  ) => Promise<SecretMetadata | null>;
  create: (
    context: TenantContext,
    input: Readonly<{ purpose: string; secret: string }>,
  ) => Promise<SecretMetadata>;
  replace: (
    context: TenantContext,
    secretId: string,
    input: Readonly<{ secret: string }>,
  ) => Promise<SecretMetadata>;
  remove: (context: TenantContext, secretId: string) => Promise<void>;
  rotate: (context: TenantContext, secretId: string) => Promise<RotateOutcome>;
  /**
   * Purpose-scoped internal consumption. The callback receives a Buffer and
   * nothing else; the buffer is best-effort zeroed when the callback settles.
   */
  withDecryptedSecret: <TValue>(
    context: TenantContext,
    handle: SecretHandle,
    callback: (plaintext: Buffer) => TValue | Promise<TValue>,
  ) => Promise<TValue>;
  close: () => Promise<void>;
}>;

type EnvelopeRow = Readonly<{
  id: string;
  tenantId: string;
  purpose: string;
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  keyVersion: string;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt: Date | null;
}>;

const envelopeColumns = {
  id: encryptedSecrets.id,
  tenantId: encryptedSecrets.tenantId,
  purpose: encryptedSecrets.purpose,
  ciphertext: encryptedSecrets.ciphertext,
  nonce: encryptedSecrets.nonce,
  authTag: encryptedSecrets.authTag,
  keyVersion: encryptedSecrets.keyVersion,
  createdAt: encryptedSecrets.createdAt,
  updatedAt: encryptedSecrets.updatedAt,
  rotatedAt: encryptedSecrets.rotatedAt,
};

/**
 * Recognize the database's second nonce barrier.
 *
 * The driver error is WRAPPED: drizzle raises a `DrizzleQueryError` whose own
 * `code`/`constraint` are absent and whose `cause` is the real `pg` error. A
 * detector that inspected only the thrown error would miss every genuine
 * collision and surface it to the caller as an unhandled failure instead of
 * retrying. The chain is walked to a bounded depth for that reason.
 *
 * The constraint NAME is matched, not just the SQLSTATE: `23505` alone would
 * also catch the primary key and every other unique index, and retrying on
 * those would be a silent infinite loop rather than a nonce retry.
 */
function isNonceCollisionViolation(error: unknown): boolean {
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 4 && current !== null && current !== undefined;
    depth += 1
  ) {
    if (typeof current === "object") {
      const candidate = current as { code?: unknown; constraint?: unknown };
      if (
        candidate.code === UNIQUE_VIOLATION &&
        candidate.constraint === NONCE_UNIQUE_CONSTRAINT
      ) {
        return true;
      }
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function createSecretVault(options: SecretVaultOptions): SecretVault {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for the server-side secret vault.",
    );
  }

  const pool = new Pool({
    connectionString,
    max: options.maxConnections ?? 10,
    application_name: "polyhunter-secret-vault",
  });
  const db = drizzle(pool, { schema: { encryptedSecrets } });
  const nonceSource = options.nonceSource ?? randomNonceSource;

  /**
   * The keyring is re-parsed per operation rather than memoized. A keyring is a
   * handful of base64 strings; re-reading it means no JavaScript-side copy of
   * key material can outlive a single call — there is no key cache to leak, and
   * a rotated configuration is picked up without a restart.
   */
  function keyring(): VaultKeyring {
    return parseVaultKeyring(options.keyring);
  }

  /**
   * Context validation.
   *
   * The vault deliberately does NOT reuse the per-instance WeakSet branding from
   * `packages/db/src/server/index.ts`: that set is private to the instance that
   * issues a context, so reusing it would either force a cross-module shared
   * registry (a refactor of audited WO-001/WO-002 code) or make the vault reject
   * legitimate contexts. Instead the claim is validated STRUCTURALLY and then
   * PROVEN against the database on every operation. A forged object gains
   * nothing: it cannot widen scope, because every statement filters on the
   * context's own `tenantId` and requires an active membership row for exactly
   * that (tenantId, userId) pair.
   */
  function assertUsableContext(context: TenantContext): void {
    if (
      !context ||
      typeof context !== "object" ||
      !isSecretUuid(context.userId) ||
      !isSecretUuid(context.tenantId) ||
      !(TENANT_ROLES as readonly string[]).includes(context.role)
    ) {
      throw new SecretVaultError("SECRET_FORBIDDEN");
    }
  }

  /**
   * Capability policy plus the authoritative membership read. Both must pass.
   * `member` fails the capability test; a suspended user, suspended membership
   * or suspended tenant fails the probe.
   */
  async function authorize(
    context: TenantContext,
    capability: SecretCapability,
  ): Promise<void> {
    assertUsableContext(context);
    if (!tenantRoleHasCapability(context.role, capability)) {
      throw new SecretVaultError("SECRET_FORBIDDEN");
    }
    const probe = await db.execute(activeTenantMembershipProbe(context));
    if (probe.rows.length === 0) {
      throw new SecretVaultError("SECRET_FORBIDDEN");
    }
  }

  /** Tenant-scoped, membership-guarded predicate for a secret statement. */
  function scoped(context: TenantContext, ...rest: ReturnType<typeof eq>[]) {
    return and(
      eq(encryptedSecrets.tenantId, context.tenantId),
      activeTenantMembershipPredicate(context),
      ...rest,
    );
  }

  function projectMetadata(
    row: EnvelopeRow,
    activeKeyVersion: string,
  ): SecretMetadata {
    return Object.freeze({
      id: row.id,
      purpose: row.purpose,
      configured: true as const,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      rotatedAt: row.rotatedAt === null ? null : row.rotatedAt.toISOString(),
      rotation:
        row.keyVersion === activeKeyVersion
          ? ("current" as const)
          : ("stale" as const),
    });
  }

  /**
   * Run `operation` in a complete transaction, retrying ONLY on the nonce
   * unique violation. Each attempt draws a fresh nonce and rolls the previous
   * attempt back in full, so the collided envelope is never persisted and
   * never reused. No other error is retried.
   */
  async function withNonceRetry<TValue>(
    operation: (attemptNonce: Buffer) => Promise<TValue>,
  ): Promise<TValue> {
    for (let attempt = 1; attempt <= MAX_NONCE_ATTEMPTS; attempt += 1) {
      const nonce = Buffer.from(nonceSource());
      try {
        return await operation(nonce);
      } catch (error) {
        if (!isNonceCollisionViolation(error)) {
          throw error;
        }
        if (attempt === MAX_NONCE_ATTEMPTS) {
          throw new SecretVaultError("NONCE_COLLISION");
        }
      }
    }
    throw new SecretVaultError("NONCE_COLLISION");
  }

  async function listMetadata(
    context: TenantContext,
  ): Promise<SecretMetadata[]> {
    const ring = keyring();
    await authorize(context, "secret:metadata");

    const rows = await db
      .select(envelopeColumns)
      .from(encryptedSecrets)
      .where(scoped(context))
      .orderBy(encryptedSecrets.createdAt, encryptedSecrets.id);

    return rows.map((row) => projectMetadata(row, ring.activeKeyVersion));
  }

  async function getMetadata(
    context: TenantContext,
    secretId: string,
  ): Promise<SecretMetadata | null> {
    const ring = keyring();
    await authorize(context, "secret:metadata");
    if (!isSecretUuid(secretId)) {
      throw new SecretVaultError("INVALID_SECRET_INPUT");
    }

    const [row] = await db
      .select(envelopeColumns)
      .from(encryptedSecrets)
      .where(scoped(context, eq(encryptedSecrets.id, secretId)))
      .limit(1);

    return row ? projectMetadata(row, ring.activeKeyVersion) : null;
  }

  async function create(
    context: TenantContext,
    input: Readonly<{ purpose: string; secret: string }>,
  ): Promise<SecretMetadata> {
    const ring = keyring();
    await authorize(context, "secret:write");

    // Malformed input fails BEFORE encryption.
    const purpose = assertSecretPurpose(input.purpose);
    const plaintext = assertSecretPlaintextBytes(input.secret);
    const key = ring.resolveKey(ring.activeKeyVersion);

    try {
      const row = await withNonceRetry(async (nonce) => {
        // The id is minted here so the AAD binds the id that will actually be
        // persisted. There is no second, unauthenticated record identity.
        const id = randomUUID();
        const sealed = sealSecret({
          key,
          binding: {
            id,
            tenantId: context.tenantId,
            purpose,
            keyVersion: ring.activeKeyVersion,
          },
          plaintext,
          nonce,
        });

        return await db.transaction(async (transaction) => {
          // Re-prove authority inside the transaction: a membership suspended
          // between `authorize` and here must still block the write.
          const probe = await transaction.execute(
            activeTenantMembershipProbe(context),
          );
          if (probe.rows.length === 0) {
            throw new SecretVaultError("SECRET_FORBIDDEN");
          }

          const inserted = await transaction
            .insert(encryptedSecrets)
            .values({
              id,
              tenantId: context.tenantId,
              purpose,
              ciphertext: sealed.ciphertext,
              nonce: sealed.nonce,
              authTag: sealed.authTag,
              keyVersion: ring.activeKeyVersion,
            })
            .returning(envelopeColumns);
          const created = inserted[0];
          if (!created) {
            throw new SecretVaultError("SECRET_INTEGRITY_FAILURE");
          }
          return created;
        });
      });

      return projectMetadata(row, ring.activeKeyVersion);
    } finally {
      plaintext.fill(0);
    }
  }

  async function replace(
    context: TenantContext,
    secretId: string,
    input: Readonly<{ secret: string }>,
  ): Promise<SecretMetadata> {
    const ring = keyring();
    await authorize(context, "secret:write");
    if (!isSecretUuid(secretId)) {
      throw new SecretVaultError("INVALID_SECRET_INPUT");
    }
    const plaintext = assertSecretPlaintextBytes(input.secret);

    try {
      const row = await withNonceRetry(async (nonce) =>
        db.transaction(async (transaction) => {
          const [existing] = await transaction
            .select(envelopeColumns)
            .from(encryptedSecrets)
            .where(scoped(context, eq(encryptedSecrets.id, secretId)))
            .limit(1)
            .for("update");
          if (!existing) {
            throw new SecretVaultError("SECRET_NOT_FOUND");
          }

          const sealed = sealSecret({
            key: ring.resolveKey(ring.activeKeyVersion),
            binding: {
              id: existing.id,
              tenantId: context.tenantId,
              purpose: existing.purpose,
              keyVersion: ring.activeKeyVersion,
            },
            plaintext,
            nonce,
          });

          // Ciphertext, nonce, tag and key version move in ONE statement, so no
          // concurrent reader can observe a mixture of two envelopes.
          const [updated] = await transaction
            .update(encryptedSecrets)
            .set({
              ciphertext: sealed.ciphertext,
              nonce: sealed.nonce,
              authTag: sealed.authTag,
              keyVersion: ring.activeKeyVersion,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(encryptedSecrets.id, secretId),
                eq(encryptedSecrets.tenantId, context.tenantId),
              ),
            )
            .returning(envelopeColumns);
          if (!updated) {
            throw new SecretVaultError("SECRET_NOT_FOUND");
          }
          return updated;
        }),
      );

      return projectMetadata(row, ring.activeKeyVersion);
    } finally {
      plaintext.fill(0);
    }
  }

  async function remove(
    context: TenantContext,
    secretId: string,
  ): Promise<void> {
    // Deleting needs no key material, but the keyring is still consulted so
    // that an unconfigured vault fails closed for EVERY operation. A delete
    // that succeeded while the rest of the vault reported unavailable would be
    // a confusing and misleading partial outage.
    keyring();
    await authorize(context, "secret:delete");
    if (!isSecretUuid(secretId)) {
      throw new SecretVaultError("INVALID_SECRET_INPUT");
    }

    await db.transaction(async (transaction) => {
      // Row lock first, so a concurrent rotation either wins outright or is
      // serialized behind this delete and then finds no row. Rotation never
      // inserts, so a deleted secret cannot be resurrected.
      const [existing] = await transaction
        .select({ id: encryptedSecrets.id })
        .from(encryptedSecrets)
        .where(scoped(context, eq(encryptedSecrets.id, secretId)))
        .limit(1)
        .for("update");
      if (!existing) {
        throw new SecretVaultError("SECRET_NOT_FOUND");
      }
      await transaction
        .delete(encryptedSecrets)
        .where(
          and(
            eq(encryptedSecrets.id, secretId),
            eq(encryptedSecrets.tenantId, context.tenantId),
          ),
        );
    });
  }

  async function rotate(
    context: TenantContext,
    secretId: string,
  ): Promise<RotateOutcome> {
    const ring = keyring();
    await authorize(context, "secret:rotate");
    if (!isSecretUuid(secretId)) {
      throw new SecretVaultError("INVALID_SECRET_INPUT");
    }

    const outcome = await withNonceRetry(async (nonce) =>
      db.transaction(async (transaction) => {
        // Row lock FIRST. Two concurrent rotations serialize here; the loser
        // re-reads the winner's row and reports already_current.
        const [existing] = await transaction
          .select(envelopeColumns)
          .from(encryptedSecrets)
          .where(scoped(context, eq(encryptedSecrets.id, secretId)))
          .limit(1)
          .for("update");
        if (!existing) {
          throw new SecretVaultError("SECRET_NOT_FOUND");
        }

        if (existing.keyVersion === ring.activeKeyVersion) {
          // No plaintext is materialized for an already-current record.
          return { status: "already_current" as const, row: existing };
        }

        // A missing old key fails closed BEFORE any mutation, leaving the row
        // byte-for-byte intact.
        const oldKey = ring.resolveKey(existing.keyVersion);
        const plaintext = openSecret({
          key: oldKey,
          binding: {
            id: existing.id,
            tenantId: existing.tenantId,
            purpose: existing.purpose,
            keyVersion: existing.keyVersion,
          },
          ciphertext: existing.ciphertext,
          nonce: existing.nonce,
          authTag: existing.authTag,
        });

        try {
          const sealed = sealSecret({
            key: ring.resolveKey(ring.activeKeyVersion),
            binding: {
              id: existing.id,
              tenantId: existing.tenantId,
              purpose: existing.purpose,
              keyVersion: ring.activeKeyVersion,
            },
            plaintext,
            nonce,
          });

          const rotatedAt = new Date();
          const [updated] = await transaction
            .update(encryptedSecrets)
            .set({
              ciphertext: sealed.ciphertext,
              nonce: sealed.nonce,
              authTag: sealed.authTag,
              keyVersion: ring.activeKeyVersion,
              updatedAt: rotatedAt,
              rotatedAt,
            })
            .where(
              and(
                eq(encryptedSecrets.id, secretId),
                eq(encryptedSecrets.tenantId, context.tenantId),
              ),
            )
            .returning(envelopeColumns);
          if (!updated) {
            throw new SecretVaultError("SECRET_NOT_FOUND");
          }
          return { status: "rotated" as const, row: updated };
        } finally {
          // Best effort only. JavaScript cannot guarantee total heap erasure and
          // this module makes no claim that it does.
          plaintext.fill(0);
        }
      }),
    );

    return {
      status: outcome.status,
      metadata: projectMetadata(outcome.row, ring.activeKeyVersion),
    };
  }

  async function withDecryptedSecret<TValue>(
    context: TenantContext,
    handle: SecretHandle,
    callback: (plaintext: Buffer) => TValue | Promise<TValue>,
  ): Promise<TValue> {
    if (!isSecretHandle(handle)) {
      throw new SecretVaultError("INVALID_SECRET_INPUT");
    }
    // Administrative vault authority is required even for internal consumption:
    // in M01 no non-administrative role may cause a secret value to be read.
    await authorize(context, "secret:metadata");
    if (handle.tenantId !== context.tenantId) {
      throw new SecretVaultError("SECRET_FORBIDDEN");
    }

    const [row] = await db
      .select(envelopeColumns)
      .from(encryptedSecrets)
      .where(
        and(
          eq(encryptedSecrets.id, handle.id),
          eq(encryptedSecrets.tenantId, context.tenantId),
          activeTenantMembershipPredicate(context),
        ),
      )
      .limit(1);

    if (!row) {
      throw new SecretVaultError("SECRET_NOT_FOUND");
    }
    if (row.purpose !== handle.purpose) {
      // Purpose is bound by the AAD; a mismatch here is a caller mistake, never
      // a cross-tenant probe.
      throw new SecretVaultError("SECRET_NOT_FOUND");
    }

    const plaintext = openSecret({
      key: keyring().resolveKey(row.keyVersion),
      binding: {
        id: row.id,
        tenantId: row.tenantId,
        purpose: row.purpose,
        keyVersion: row.keyVersion,
      },
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      authTag: row.authTag,
    });

    try {
      return await callback(plaintext);
    } finally {
      plaintext.fill(0);
    }
  }

  return {
    isConfigured: () => {
      try {
        keyring();
        return true;
      } catch {
        return false;
      }
    },
    listMetadata,
    getMetadata,
    create,
    replace,
    remove,
    rotate,
    withDecryptedSecret,
    close: () => pool.end(),
  };
}
