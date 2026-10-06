#!/usr/bin/env node
/**
 * PH-M01-WO-004 — clean-environment Docker acceptance probe (runs INSIDE the
 * web container; copied in with `docker cp`, because the container bind-mounts
 * only apps/ and packages/*).
 *
 * Two halves:
 *   1. WITHOUT a keyring (compose defaults are empty): the vault must be
 *      unavailable and EVERY operation must fail closed with VAULT_UNAVAILABLE.
 *   2. WITH an ephemeral, TEST-ONLY keyring generated in this process: seed a
 *      throwaway tenant + user + membership through SQL, exercise the admitted
 *      Vault path (create -> decrypt via withDecryptedSecret -> rotate ->
 *      listMetadata -> remove), attempt a cross-tenant handle (must be refused),
 *      then remove every row this probe created.
 *
 * The keys exist only in this process's memory and are never printed, written
 * or placed in the environment.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createSecretVault } from "@polyhunter/db/server/vault";

const connectionString = process.env.DATABASE_URL ?? "";
if (!connectionString) {
  console.error("DATABASE_URL missing");
  process.exit(2);
}

const { Pool } = await import("pg");
const pool = new Pool({ connectionString });

const failures = [];
function check(label, condition, detail = "") {
  const status = condition ? "OK  " : "FAIL";
  if (!condition) failures.push(label);
  console.log(`${status} ${label}${detail ? ` — ${detail}` : ""}`);
}

try {
  // ---- 1. without a keyring: fail closed -----------------------------------
  const unconfigured = createSecretVault({
    connectionString,
    keyring: {
      activeKeyVersion: process.env.POLYHUNTER_SECRET_ACTIVE_KEY_VERSION ?? "",
      keyringJson: process.env.POLYHUNTER_SECRET_KEYRING_JSON ?? "",
    },
  });
  check(
    "no-keyring: isConfigured() is false",
    (await unconfigured.isConfigured()) === false,
  );
  const fakeContext = Object.freeze({
    userId: randomUUID(),
    tenantId: randomUUID(),
    role: "owner",
  });
  let denyCode = "NONE";
  try {
    await unconfigured.listMetadata(fakeContext);
  } catch (error) {
    denyCode = error?.code ?? "UNKNOWN";
  }
  check(
    "no-keyring: every operation fails closed with VAULT_UNAVAILABLE",
    denyCode === "VAULT_UNAVAILABLE",
    `code=${denyCode}`,
  );
  await unconfigured.close();

  // ---- 2. ephemeral, test-only keyring -------------------------------------
  const v1 = randomBytes(32);
  const v2 = randomBytes(32);
  const keyring = {
    activeKeyVersion: "v2",
    keyringJson: JSON.stringify({
      v1: v1.toString("base64"),
      v2: v2.toString("base64"),
    }),
  };
  const vault = createSecretVault({ connectionString, keyring });

  const tenantId = randomUUID();
  const userId = randomUUID();
  const otherTenantId = randomUUID();
  await pool.query(
    "INSERT INTO tenants (id, name, slug, status) VALUES ($1,$2,$3,'active')",
    [tenantId, `accept-probe-${tenantId.slice(0, 8)}`, `ap-${tenantId.slice(0, 8)}`],
  );
  await pool.query("INSERT INTO users (id, status) VALUES ($1,'active')", [
    userId,
  ]);
  await pool.query(
    "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'owner','active')",
    [tenantId, userId],
  );
  const context = Object.freeze({ userId, tenantId, role: "owner" });

  try {
    check("ephemeral keyring: isConfigured() is true", await vault.isConfigured());

    const canary = randomBytes(24).toString("base64url");
    const created = await vault.create(context, {
      purpose: "accept.probe",
      secret: canary,
    });
    check("create", Boolean(created.id), `purpose=${created.purpose}`);

    const roundTrip = await vault.withDecryptedSecret(
      context,
      { id: created.id, tenantId, purpose: "accept.probe" },
      (plaintext) => Buffer.from(plaintext).toString("utf8"),
    );
    check("withDecryptedSecret returns the canary", roundTrip === canary);

    const rotated = await vault.rotate(context, created.id);
    check(
      "rotate",
      rotated.status === "already_current" || rotated.status === "rotated",
      `status=${rotated.status}`,
    );

    const listed = await vault.listMetadata(context);
    check("listMetadata sees the record", listed.length === 1);

    const foreignContext = Object.freeze({
      userId,
      tenantId: otherTenantId,
      role: "owner",
    });
    let crossCode = "NONE";
    try {
      await vault.withDecryptedSecret(
        foreignContext,
        { id: created.id, tenantId: otherTenantId, purpose: "accept.probe" },
        () => "never",
      );
    } catch (error) {
      crossCode = error?.code ?? "UNKNOWN";
    }
    check(
      "cross-tenant handle refused",
      crossCode === "SECRET_FORBIDDEN",
      `code=${crossCode}`,
    );

    await vault.remove(context, created.id);
    const remaining = await vault.listMetadata(context);
    check("remove leaves no record", remaining.length === 0);
  } finally {
    await vault.close();
    await pool.query("DELETE FROM encrypted_secrets WHERE tenant_id = $1", [
      tenantId,
    ]);
    await pool.query("DELETE FROM tenant_memberships WHERE tenant_id = $1", [
      tenantId,
    ]);
    await pool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    console.log("cleanup: probe rows removed; keys were never persisted");
  }
} finally {
  await pool.end();
}

if (failures.length > 0) {
  console.error(`docker probe FAILED: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("docker probe: all checks passed");
