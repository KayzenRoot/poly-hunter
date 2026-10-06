#!/usr/bin/env node
/**
 * PH-M01-WO-004 — recovery / rotation drill vault steps.
 *
 * Runs INSIDE the web container (`docker compose exec -T web node <this> <phase>`).
 * Reads a JSON payload from STDIN in every phase that needs key material:
 *
 *   { "keyring": {"activeKeyVersion": "k…", "keyringJson": "{…}"},
 *     "canary": "…", "k2Only": "…" }      // fields used per phase
 *
 * KEY DISCIPLINE: the payload (ephemeral test keys + canary) travels over the
 * exec stdin pipe only. It is never written to a file, never placed in argv,
 * never placed in the environment, and never echoed. Every printed line is
 * metadata (ids, hashes, status words) or a fixed status sentence.
 *
 * Node 24 in the container strips TypeScript types, so the admitted source
 * entry points load directly — the same modules the application imports.
 *
 * Phases:
 *   seed <dbName>            seed tenant A (with the canary secret) and tenant B
 *                            (own secret) through the vault; prove isolation and
 *                            print ids + A's envelope hash.
 *   verify-restored <dbName> <tenantA> <userA> <secretA> after backup/restore:
 *                            migration count, metadata, foreign-context silence,
 *                            authorized decrypt == canary, envelope hash.
 *   missing-key <dbName> <tenantA> <userA> <secretA>  keyring WITHOUT k1:
 *                            decrypt must fail closed with
 *                            KEY_VERSION_UNAVAILABLE and the row must be intact.
 *   rotate <dbName> <tenantA> <userA> <secretA> <expectedHashBefore>
 *                            active k2 with k1 present: rotate; envelope hash
 *                            must change; identity metadata must not; a k2-ONLY
 *                            keyring must decrypt afterwards == canary.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createSecretVault } from "@polyhunter/db/server/vault";

const [, , phase, ...rest] = process.argv;

function readPayload() {
  return JSON.parse(readFileSync(0, "utf8"));
}

function databaseUrlFor(databaseName) {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function envelopeFacts(connectionString, secretId) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(
      "SELECT ciphertext, nonce, auth_tag, key_version, purpose, tenant_id, created_at FROM encrypted_secrets WHERE id = $1",
      [secretId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      hash: createHash("sha256")
        .update(
          Buffer.concat([
            row.ciphertext,
            row.nonce,
            row.auth_tag,
            Buffer.from(row.key_version),
          ]),
        )
        .digest("hex"),
      identity: {
        purpose: row.purpose,
        tenantId: row.tenant_id,
        createdAt: String(row.created_at),
      },
    };
  } finally {
    await pool.end();
  }
}

async function withVault(connectionString, keyring, action) {
  const vault = createSecretVault({ connectionString, keyring });
  try {
    return await action(vault);
  } finally {
    await vault.close();
  }
}

async function seed() {
  const [dbName] = rest;
  const payload = readPayload();
  const connectionString = databaseUrlFor(dbName);
  const { Pool } = await import("pg");
  const { randomUUID } = await import("node:crypto");
  const pool = new Pool({ connectionString });
  try {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const userA = randomUUID();
    const userB = randomUUID();
    await pool.query(
      "INSERT INTO tenants (id, name, slug, status) VALUES ($1,$2,$3,'active'),($4,$5,$6,'active')",
      [
        tenantA,
        `drill-a-${tenantA.slice(0, 8)}`,
        `dr-${tenantA.slice(0, 8)}`,
        tenantB,
        `drill-b-${tenantB.slice(0, 8)}`,
        `dr-${tenantB.slice(0, 8)}`,
      ],
    );
    await pool.query(
      "INSERT INTO users (id, status) VALUES ($1,'active'),($2,'active')",
      [userA, userB],
    );
    await pool.query(
      "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'owner','active'),($3,$4,'owner','active')",
      [tenantA, userA, tenantB, userB],
    );

    await withVault(connectionString, payload.keyring, async (vault) => {
      const ctxA = Object.freeze({
        userId: userA,
        tenantId: tenantA,
        role: "owner",
      });
      const ctxB = Object.freeze({
        userId: userB,
        tenantId: tenantB,
        role: "owner",
      });
      const secretA = await vault.create(ctxA, {
        purpose: "drill.secret.a",
        secret: payload.canary,
      });
      const secretB = await vault.create(ctxB, {
        purpose: "drill.secret.b",
        secret: "tenant-b-drill-value",
      });
      console.log(`seed: tenantA=${tenantA} userA=${userA} secretA=${secretA.id}`);
      console.log(`seed: tenantB=${tenantB} userB=${userB} secretB=${secretB.id}`);

      const foreign = await vault.getMetadata(ctxA, secretB.id);
      if (foreign !== null) throw new Error("tenant A saw tenant B metadata");
      const own = await vault.getMetadata(ctxA, secretA.id);
      if (own === null) throw new Error("tenant A lost its own metadata");
      const decrypted = await vault.withDecryptedSecret(
        ctxA,
        { id: secretA.id, tenantId: tenantA, purpose: "drill.secret.a" },
        (plaintext) => Buffer.from(plaintext).toString("utf8"),
      );
      if (decrypted !== payload.canary) {
        throw new Error("canary mismatch in seed");
      }
      console.log("seed: isolation + authorized decrypt OK");
      const facts = await envelopeFacts(connectionString, secretA.id);
      console.log(`seed: envelopeHashA=${facts?.hash ?? "ABSENT"}`);
    });
  } finally {
    await pool.end();
  }
}

async function verifyRestored() {
  const [dbName, tenantA, userA, secretAId, tenantB, userB] = rest;
  const payload = readPayload();
  const connectionString = databaseUrlFor(dbName);
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });
  try {
    const migrations = await pool.query(
      "SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations",
    );
    console.log(`verify: applied migrations=${migrations.rows[0]?.n}`);

    await withVault(connectionString, payload.keyring, async (vault) => {
      const ctxA = Object.freeze({
        userId: userA,
        tenantId: tenantA,
        role: "owner",
      });
      const metadata = await vault.getMetadata(ctxA, secretAId);
      if (metadata === null) throw new Error("metadata missing after restore");
      console.log(
        `verify: metadata id=${metadata.id} purpose=${metadata.purpose} rotation=${metadata.rotation}`,
      );
      if (metadata.purpose !== "drill.secret.a") {
        throw new Error("metadata purpose changed across restore");
      }

      // Cross-tenant after restore: B is a real, authorized owner in its own
      // tenant — yet A's record is invisible to B (null, not an oracle).
      const ctxB = Object.freeze({
        userId: userB,
        tenantId: tenantB,
        role: "owner",
      });
      const foreign = await vault.getMetadata(ctxB, secretAId);
      if (foreign !== null) {
        throw new Error("tenant B saw tenant A metadata after restore");
      }
      console.log("verify: tenant B sees nothing of tenant A (null, no oracle)");

      // A context with no membership at all is refused before any read.
      const { randomUUID } = await import("node:crypto");
      const unmapped = Object.freeze({
        userId: randomUUID(),
        tenantId: randomUUID(),
        role: "owner",
      });
      let unmappedCode = "NONE";
      try {
        await vault.getMetadata(unmapped, secretAId);
      } catch (error) {
        unmappedCode = error?.code ?? "UNKNOWN";
      }
      if (unmappedCode !== "SECRET_FORBIDDEN") {
        throw new Error(`expected SECRET_FORBIDDEN for an unmapped context, got ${unmappedCode}`);
      }
      console.log("verify: unmapped context refused (SECRET_FORBIDDEN)");

      const decrypted = await vault.withDecryptedSecret(
        ctxA,
        { id: secretAId, tenantId: tenantA, purpose: "drill.secret.a" },
        (plaintext) => Buffer.from(plaintext).toString("utf8"),
      );
      if (decrypted !== payload.canary) {
        throw new Error("authorized decrypt after restore is not the canary");
      }
      console.log("verify: authorized decrypt with ephemeral v1 returns the canary");
      const facts = await envelopeFacts(connectionString, secretAId);
      console.log(`verify: envelopeHashA=${facts?.hash ?? "ABSENT"}`);
    });
  } finally {
    await pool.end();
  }
}

async function missingKey() {
  const [dbName, tenantA, userA, secretAId] = rest;
  const payload = readPayload();
  const connectionString = databaseUrlFor(dbName);
  await withVault(connectionString, payload.keyring, async (vault) => {
    const ctxA = Object.freeze({
      userId: userA,
      tenantId: tenantA,
      role: "owner",
    });
    let code = "NONE";
    try {
      await vault.withDecryptedSecret(
        ctxA,
        { id: secretAId, tenantId: tenantA, purpose: "drill.secret.a" },
        () => "never",
      );
    } catch (error) {
      code = error?.code ?? "UNKNOWN";
    }
    if (code !== "KEY_VERSION_UNAVAILABLE") {
      throw new Error(`expected KEY_VERSION_UNAVAILABLE, got ${code}`);
    }
    console.log("missing-key: decrypt fails closed with KEY_VERSION_UNAVAILABLE");
    const facts = await envelopeFacts(connectionString, secretAId);
    console.log(`missing-key: envelopeHashA=${facts?.hash ?? "ABSENT"} (row intact)`);
  });
}

async function rotate() {
  const [dbName, tenantA, userA, secretAId, expectedHashBefore] = rest;
  const payload = readPayload();
  const connectionString = databaseUrlFor(dbName);

  const before = await envelopeFacts(connectionString, secretAId);
  if (before === null) throw new Error("row absent before rotation");
  if (expectedHashBefore && before.hash !== expectedHashBefore) {
    throw new Error("envelope hash drifted before rotation even started");
  }

  await withVault(connectionString, payload.keyring, async (vault) => {
    const ctxA = Object.freeze({
      userId: userA,
      tenantId: tenantA,
      role: "owner",
    });
    const outcome = await vault.rotate(ctxA, secretAId);
    console.log(
      `rotate: status=${outcome.status} rotationNow=${outcome.metadata.rotation}`,
    );
    if (outcome.status !== "rotated") {
      throw new Error("expected a real rotation to the active key");
    }
  });

  const after = await envelopeFacts(connectionString, secretAId);
  if (after === null) throw new Error("row absent after rotation");
  if (after.hash === before.hash) {
    throw new Error("envelope hash did not change across rotation");
  }
  if (
    after.identity.purpose !== before.identity.purpose ||
    after.identity.tenantId !== before.identity.tenantId ||
    after.identity.createdAt !== before.identity.createdAt
  ) {
    throw new Error("identity metadata changed across rotation");
  }
  console.log(`rotate: envelopeHashA=${after.hash} (changed, identity stable)`);

  await withVault(
    connectionString,
    {
      activeKeyVersion: "k2",
      keyringJson: JSON.stringify({ k2: payload.k2Only }),
    },
    async (k2Only) => {
      const ctxA = Object.freeze({
        userId: userA,
        tenantId: tenantA,
        role: "owner",
      });
      const decrypted = await k2Only.withDecryptedSecret(
        ctxA,
        { id: secretAId, tenantId: tenantA, purpose: "drill.secret.a" },
        (plaintext) => Buffer.from(plaintext).toString("utf8"),
      );
      if (decrypted !== payload.canary) {
        throw new Error("k2-only decrypt after rotation is not the canary");
      }
      console.log("rotate: k2-only keyring decrypts the rotated envelope");
      const metadata = await k2Only.getMetadata(ctxA, secretAId);
      console.log(`rotate: metadata rotation=${metadata?.rotation}`);
    },
  );
}

const phases = {
  seed,
  "verify-restored": verifyRestored,
  "missing-key": missingKey,
  rotate,
};

const handler = phases[phase];
if (!handler) {
  console.error(`unknown phase: ${phase}`);
  process.exit(2);
}
await handler();
console.log(`phase ${phase}: OK`);
