import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SecretVaultError, type TenantContext } from "@polyhunter/domain";
import {
  createSecretVault,
  type SecretVault,
} from "../src/server/vault/index.js";
import {
  dropDisposableDatabase,
  preflightDropStaleDatabase,
  quoteGeneratedIdentifier,
} from "./support/postgres-disposable-databases.js";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const configuredDatabaseUrl = process.env.DATABASE_URL ?? "";

if (!configuredDatabaseUrl) {
  throw new Error(
    "DATABASE_URL must point to a disposable-capable PostgreSQL role for integration tests.",
  );
}

function databaseUrlFor(databaseName: string): string {
  const url = new URL(configuredDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

const KEY_V1_B64 = Buffer.alloc(32, 0x11).toString("base64");
const KEY_V2_B64 = Buffer.alloc(32, 0x22).toString("base64");

/** k1 + k2 present, k2 active: the rotation fixture. */
const FULL_KEYRING = {
  activeKeyVersion: "k2",
  keyringJson: JSON.stringify({ k1: KEY_V1_B64, k2: KEY_V2_B64 }),
};
/** Only k1: seeds rows that are stale with respect to the active key. */
const K1_ONLY_KEYRING = {
  activeKeyVersion: "k1",
  keyringJson: JSON.stringify({ k1: KEY_V1_B64 }),
};
/** k2 active but k1 absent: the key that protected an old row is gone. */
const KEYRING_WITHOUT_K1 = {
  activeKeyVersion: "k2",
  keyringJson: JSON.stringify({ k2: KEY_V2_B64 }),
};

/** The exact key set every secret metadata projection may carry. */
const METADATA_KEYS = [
  "configured",
  "createdAt",
  "id",
  "purpose",
  "rotatedAt",
  "rotation",
  "updatedAt",
];

async function expectCode(
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(SecretVaultError);
    expect((error as SecretVaultError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code} but the operation succeeded`);
}

/** The single row a lookup must have returned; absent means the test is wrong. */
function onlyRow<TValue>(rows: readonly TValue[], what: string): TValue {
  const row = rows[0];
  if (!row) throw new Error(`expected one row for ${what}, got ${rows.length}`);
  return row;
}

describe("PH-M01-WO-003 secret vault against PostgreSQL", () => {
  const databaseNames: [string, string] = [
    `phm01_${randomUUID().replaceAll("-", "")}`,
    `phm01_${randomUUID().replaceAll("-", "")}`,
  ];
  let adminPool: Pool | undefined;
  let testPool: Pool | undefined;
  let vault: SecretVault | undefined;

  /**
   * Every vault this suite opens is tracked and closed in teardown. An unclosed
   * pool keeps a backend attached, which the CR-05 helper would (correctly)
   * report as a resource leak rather than drop the database.
   */
  const ownedVaults: SecretVault[] = [];

  function openVault(
    keyring: Readonly<{ activeKeyVersion?: string; keyringJson?: string }>,
    nonceSource?: () => Uint8Array,
  ): SecretVault {
    const created = createSecretVault({
      connectionString: databaseUrlFor(databaseNames[0]),
      keyring,
      ...(nonceSource === undefined ? {} : { nonceSource }),
    });
    ownedVaults.push(created);
    return created;
  }

  function raw(): Pool {
    if (!testPool) throw new Error("integration fixtures not initialized");
    return testPool;
  }

  /** The shared default vault, assigned in `beforeAll`. */
  function currentVault(): SecretVault {
    if (!vault) throw new Error("integration fixtures not initialized");
    return vault;
  }

  async function closeOwnedVaults(): Promise<void> {
    while (ownedVaults.length > 0) {
      const owned = ownedVaults.pop();
      if (owned) await owned.close();
    }
  }

  type Suspension = Readonly<{
    label: string;
    table: "users" | "tenants" | "tenant_memberships";
    /** Key column the suspension UPDATE matches on. */
    whereColumn: "id" | "user_id";
  }>;

  const SUSPENSIONS: readonly Suspension[] = [
    { label: "suspended user", table: "users", whereColumn: "id" },
    {
      label: "suspended membership",
      table: "tenant_memberships",
      whereColumn: "user_id",
    },
    { label: "suspended tenant", table: "tenants", whereColumn: "id" },
  ];

  /** Mint a tenant, a user and a membership, and return its TenantContext. */
  async function seedTenant(
    role: "owner" | "admin" | "member",
    options: {
      tenantStatus?: "active" | "suspended";
      userStatus?: "active" | "suspended";
      membershipStatus?: "active" | "suspended" | "invited";
    } = {},
  ): Promise<TenantContext> {
    const tenantId = randomUUID();
    const userId = randomUUID();
    await raw().query(
      "INSERT INTO tenants (id, name, slug, status) VALUES ($1,$2,$3,$4)",
      [
        tenantId,
        `tenant-${tenantId.slice(0, 8)}`,
        `t-${tenantId.slice(0, 8)}`,
        options.tenantStatus ?? "active",
      ],
    );
    await raw().query("INSERT INTO users (id, status) VALUES ($1,$2)", [
      userId,
      options.userStatus ?? "active",
    ]);
    await raw().query(
      "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,$4)",
      [tenantId, userId, role, options.membershipStatus ?? "active"],
    );
    return Object.freeze({ userId, tenantId, role }) as TenantContext;
  }

  /** Seed a row whose envelope is protected by k1 while k2 is active. */
  async function seedStaleEnvelope(
    context: TenantContext,
    purpose: string,
    value: string,
  ) {
    return openVault(K1_ONLY_KEYRING).create(context, {
      purpose,
      secret: value,
    });
  }

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: configuredDatabaseUrl });
    testPool = new Pool({ connectionString: databaseUrlFor(databaseNames[0]) });

    const admin = adminPool;
    for (const name of databaseNames) {
      await preflightDropStaleDatabase(admin, name);
      await admin.query(`CREATE DATABASE ${quoteGeneratedIdentifier(name)}`);
    }

    // Migration on an EMPTY database, then the SAME migration a second time:
    // proves the empty-DB path and the repeat/disposable path in one fixture.
    const migrationsPool = new Pool({
      connectionString: databaseUrlFor(databaseNames[1]),
    });
    try {
      const migrationsDb = drizzle(migrationsPool);
      await migrate(migrationsDb, { migrationsFolder });
      await migrate(migrationsDb, { migrationsFolder });
    } finally {
      await migrationsPool.end();
    }

    await migrate(drizzle(testPool), { migrationsFolder });
    vault = openVault(FULL_KEYRING);
  });

  afterAll(async () => {
    await closeOwnedVaults();
    await testPool?.end();
    const admin = adminPool;
    if (admin) {
      for (const name of databaseNames) {
        await dropDisposableDatabase(admin, name);
      }
      await admin.end();
    }
  });

  describe("schema", () => {
    it("creates encrypted_secrets and no Polymarket credential schema", async () => {
      const columns = await raw().query<{
        column_name: string;
        data_type: string;
      }>(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'encrypted_secrets' ORDER BY column_name",
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual([
        "auth_tag",
        "ciphertext",
        "created_at",
        "id",
        "key_version",
        "nonce",
        "purpose",
        "rotated_at",
        "tenant_id",
        "updated_at",
      ]);
      const nullable = await raw().query<{ is_nullable: string }>(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'encrypted_secrets' AND column_name = 'rotated_at'",
      );
      expect(nullable.rows[0]?.is_nullable).toBe("YES");

      const tables = await raw().query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
      );
      expect(tables.rows.map((row) => row.tablename)).toEqual([
        "encrypted_secrets",
        "identity_links",
        "platform_roles",
        "tenant_memberships",
        "tenants",
        "users",
      ]);

      // PROIBIDO: trading_accounts and any provider credential column.
      expect(tables.rows.map((row) => row.tablename)).not.toContain(
        "trading_accounts",
      );
      const names = columns.rows.map((row) => row.column_name);
      for (const column of [
        "wallet_address",
        "private_key",
        "api_key",
        "api_secret",
        "access_token",
        "refresh_token",
        "passphrase",
      ]) {
        expect(names).not.toContain(column);
      }
    });

    it("enforces envelope sizes, canonical values and nonce uniqueness in the database", async () => {
      const context = await seedTenant("owner");
      const created = await currentVault().create(context, {
        purpose: "probe.values",
        secret: "seed-value",
      });

      const insert = (
        override: Readonly<{
          tenantId?: string;
          purpose?: string;
          ciphertext?: Buffer;
          nonce?: Buffer;
          authTag?: Buffer;
          keyVersion?: string;
        }>,
      ) =>
        raw().query(
          "INSERT INTO encrypted_secrets (tenant_id, purpose, ciphertext, nonce, auth_tag, key_version) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            override.tenantId ?? context.tenantId,
            override.purpose ?? "probe.values",
            override.ciphertext ?? Buffer.from([1, 2]),
            override.nonce ?? randomBytes(12),
            override.authTag ?? randomBytes(16),
            override.keyVersion ?? "k2",
          ],
        );

      const rejects = async (
        override: Parameters<typeof insert>[0],
        expectedConstraint: string,
      ) => {
        await expect(insert(override)).rejects.toThrow(expectedConstraint);
      };

      await rejects(
        { nonce: Buffer.alloc(11) },
        "encrypted_secrets_nonce_length",
      );
      await rejects(
        { nonce: Buffer.alloc(13) },
        "encrypted_secrets_nonce_length",
      );
      await rejects(
        { authTag: Buffer.alloc(15) },
        "encrypted_secrets_auth_tag_length",
      );
      await rejects(
        { authTag: Buffer.alloc(0) },
        "encrypted_secrets_auth_tag_length",
      );
      await rejects(
        { ciphertext: Buffer.alloc(0) },
        "encrypted_secrets_ciphertext_not_empty",
      );
      for (const purpose of [
        "Not Canonical",
        "a",
        "-leading",
        "trailing-",
        "double--dash",
        // 64 characters — exactly the column bound, so the CHECK is what rejects
        // it rather than the varchar length.
        `${"a".repeat(63)}!`,
      ]) {
        await rejects({ purpose }, "encrypted_secrets_purpose_canonical");
      }
      for (const keyVersion of ["NOT_CANON", "-k", `${"a".repeat(31)}!`]) {
        await rejects(
          { keyVersion },
          "encrypted_secrets_key_version_canonical",
        );
      }
      // Over the column bound the varchar width rejects first. Both guards are
      // real: the value is unwritable either way.
      await expect(insert({ purpose: "a".repeat(65) })).rejects.toThrow(
        /value too long for type character varying\(64\)/,
      );
      await expect(insert({ keyVersion: "a".repeat(33) })).rejects.toThrow(
        /value too long for type character varying\(32\)/,
      );
      await rejects(
        { tenantId: randomUUID() },
        "encrypted_secrets_tenant_id_tenants_id_fk",
      );

      // Second barrier: (key_version, nonce) can never persist twice.
      const stored = await raw().query<{ nonce: Buffer; key_version: string }>(
        "SELECT nonce, key_version FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      const storedNonce = stored.rows[0]?.nonce;
      const storedKey = stored.rows[0]?.key_version;
      if (!storedNonce || !storedKey) {
        throw new Error("the created envelope row was not readable");
      }
      await rejects(
        { nonce: storedNonce, keyVersion: storedKey },
        "encrypted_secrets_key_version_nonce_unique",
      );

      // The same nonce under a DIFFERENT key version is not a violation: the
      // uniqueness that matters for GCM is per key, not global.
      await expect(
        insert({
          nonce: storedNonce,
          keyVersion: "k1",
          purpose: "probe.other",
        }),
      ).resolves.toBeDefined();

      await raw().query("DELETE FROM encrypted_secrets WHERE tenant_id = $1", [
        context.tenantId,
      ]);
    });
  });

  describe("authorization", () => {
    it("lets owner and admin manage secrets", async () => {
      for (const role of ["owner", "admin"] as const) {
        const context = await seedTenant(role);
        const created = await currentVault().create(context, {
          purpose: `allowed.${role}`,
          secret: `value-for-${role}`,
        });
        expect(created.configured).toBe(true);
        expect(await currentVault().listMetadata(context)).toHaveLength(1);
        expect(
          await currentVault().getMetadata(context, created.id),
        ).not.toBeNull();
        expect(await currentVault().rotate(context, created.id)).toMatchObject({
          status: "already_current",
        });
        await currentVault().replace(context, created.id, {
          secret: `replaced-${role}`,
        });
        await currentVault().remove(context, created.id);
        expect(await currentVault().listMetadata(context)).toEqual([]);
      }
    });

    it("denies a member every vault operation", async () => {
      const context = await seedTenant("member");
      const owner = await seedTenant("owner");
      const seeded = await currentVault().create(owner, {
        purpose: "member.denial",
        secret: "owner-only",
      });

      await expectCode(
        () => currentVault().listMetadata(context),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () => currentVault().getMetadata(context, seeded.id),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () => currentVault().create(context, { purpose: "nope", secret: "x" }),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () => currentVault().replace(context, seeded.id, { secret: "x" }),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () => currentVault().remove(context, seeded.id),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () => currentVault().rotate(context, seeded.id),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            context,
            {
              id: seeded.id,
              tenantId: context.tenantId,
              purpose: "member.denial",
            },
            () => undefined,
          ),
        "SECRET_FORBIDDEN",
      );

      // The owner's record is untouched and never exposed to the member.
      expect(await currentVault().getMetadata(owner, seeded.id)).not.toBeNull();
      await currentVault().remove(owner, seeded.id);
    });

    it("never lets a platform_admin reach tenant secrets without a membership", async () => {
      const owner = await seedTenant("owner");
      const seeded = await currentVault().create(owner, {
        purpose: "platform.boundary",
        secret: "tenant-only",
      });

      // A platform administrator holds a PLATFORM role. It is not a tenant
      // membership, so it cannot name the tenant at all.
      const outsider = await seedTenant("member");
      await raw().query(
        "INSERT INTO platform_roles (user_id, role) VALUES ($1,'platform_admin')",
        [outsider.userId],
      );
      const granted = await raw().query<{ role: string }>(
        "SELECT role FROM platform_roles WHERE user_id = $1",
        [outsider.userId],
      );
      expect(granted.rows[0]?.role).toBe("platform_admin");
      expect(outsider.role).toBe("member");

      await expectCode(
        () => currentVault().listMetadata(outsider),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () => currentVault().getMetadata(outsider, seeded.id),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () => currentVault().rotate(outsider, seeded.id),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () => currentVault().remove(outsider, seeded.id),
        "SECRET_FORBIDDEN",
      );

      // Forging a context is refused structurally, before any statement runs.
      for (const forged of [
        Object.freeze({
          userId: outsider.userId,
          tenantId: owner.tenantId,
          role: "platform_admin",
        }) as unknown as TenantContext,
        Object.freeze({
          userId: outsider.userId,
          tenantId: owner.tenantId,
          role: "owner",
        }) as unknown as TenantContext,
        {} as unknown as TenantContext,
        null as unknown as TenantContext,
      ]) {
        await expectCode(
          () => currentVault().listMetadata(forged),
          "SECRET_FORBIDDEN",
        );
      }

      await currentVault().remove(owner, seeded.id);
    });

    it("isolates tenant A from tenant B completely", async () => {
      const tenantA = await seedTenant("owner");
      const tenantB = await seedTenant("owner");
      const secretA = await currentVault().create(tenantA, {
        purpose: "isolation.a",
        secret: "tenant-a-value",
      });

      expect(await currentVault().listMetadata(tenantB)).toEqual([]);
      expect(await currentVault().getMetadata(tenantB, secretA.id)).toBeNull();
      await expectCode(
        () => currentVault().rotate(tenantB, secretA.id),
        "SECRET_NOT_FOUND",
      );
      await expectCode(
        () => currentVault().remove(tenantB, secretA.id),
        "SECRET_NOT_FOUND",
      );
      await expectCode(
        () =>
          currentVault().replace(tenantB, secretA.id, { secret: "overwrite" }),
        "SECRET_NOT_FOUND",
      );
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            tenantB,
            {
              id: secretA.id,
              tenantId: tenantB.tenantId,
              purpose: "isolation.a",
            },
            () => "leaked",
          ),
        "SECRET_NOT_FOUND",
      );

      // Tenant A's value is intact.
      const read = await currentVault().withDecryptedSecret(
        tenantA,
        { id: secretA.id, tenantId: tenantA.tenantId, purpose: "isolation.a" },
        (plaintext) => plaintext.toString("utf8"),
      );
      expect(read).toBe("tenant-a-value");
      await currentVault().remove(tenantA, secretA.id);
    });

    it("revokes access on the next authoritative request after any suspension", async () => {
      for (const suspension of SUSPENSIONS) {
        const context = await seedTenant("owner");
        const purpose = `suspension.${suspension.table}`;
        const created = await currentVault().create(context, {
          purpose,
          secret: "still-here",
        });
        // Authorized before the suspension.
        expect(await currentVault().listMetadata(context)).toHaveLength(1);

        // `users` and `tenants` are keyed by their own id column; the membership row
        // is keyed by user_id. Both resolve to the same user for the membership case.
        const target =
          suspension.table === "tenants" ? context.tenantId : context.userId;
        const suspendStatement = `UPDATE ${suspension.table} SET status = 'suspended' WHERE ${suspension.whereColumn} = $1`;
        const restoreStatement = `UPDATE ${suspension.table} SET status = 'active' WHERE ${suspension.whereColumn} = $1`;
        const suspended = await raw().query(suspendStatement, [target]);
        expect(suspended.rowCount, suspension.label).toBe(1);

        await expectCode(
          () => currentVault().listMetadata(context),
          "SECRET_FORBIDDEN",
        );
        await expectCode(
          () => currentVault().getMetadata(context, created.id),
          "SECRET_FORBIDDEN",
        );
        await expectCode(
          () =>
            currentVault().create(context, {
              purpose: "after.suspend",
              secret: "x",
            }),
          "SECRET_FORBIDDEN",
        );
        await expectCode(
          () => currentVault().replace(context, created.id, { secret: "x" }),
          "SECRET_FORBIDDEN",
        );
        await expectCode(
          () => currentVault().rotate(context, created.id),
          "SECRET_FORBIDDEN",
        );
        await expectCode(
          () => currentVault().remove(context, created.id),
          "SECRET_FORBIDDEN",
        );
        await expectCode(
          () =>
            currentVault().withDecryptedSecret(
              context,
              { id: created.id, tenantId: context.tenantId, purpose },
              () => "leaked",
            ),
          "SECRET_FORBIDDEN",
        );

        // Authority is re-read per operation, never cached: lifting the
        // suspension restores access without any re-issuance.
        await raw().query(restoreStatement, [target]);
        expect(await currentVault().listMetadata(context)).toHaveLength(1);
        await raw().query(
          "DELETE FROM encrypted_secrets WHERE tenant_id = $1",
          [context.tenantId],
        );
      }
    });

    it("treats an invited or missing membership as no membership", async () => {
      const invited = await seedTenant("owner", {
        membershipStatus: "invited",
      });
      await expectCode(
        () => currentVault().listMetadata(invited),
        "SECRET_FORBIDDEN",
      );

      const deleted = await seedTenant("owner");
      await raw().query("DELETE FROM tenant_memberships WHERE user_id = $1", [
        deleted.userId,
      ]);
      await expectCode(
        () => currentVault().listMetadata(deleted),
        "SECRET_FORBIDDEN",
      );
    });
  });

  /**
   * Audit CR-02 — the role that decides a capability must be the CURRENT
   * `tenant_memberships.role`, read inside PostgreSQL, not a value that
   * arrived on the request-shaped context.
   *
   * Every test here builds a context the vault cannot distinguish from one a
   * server would issue (correct uuids, a role string, no brand of its own) and
   * then changes ONLY the database row. If any of these succeeded, the vault
   * would be trusting `context.role`, which is precisely the finding.
   */
  describe("authoritative role (audit CR-02)", () => {
    /** A context forged to claim `role` over a membership that is really `member`. */
    function forgedRole(
      membership: TenantContext,
      role: string,
    ): TenantContext {
      return Object.freeze({
        userId: membership.userId,
        tenantId: membership.tenantId,
        role,
      }) as unknown as TenantContext;
    }

    /** Change only the membership role, leaving status and every id untouched. */
    async function setMembershipRole(
      membership: TenantContext,
      role: "owner" | "admin" | "member",
    ): Promise<void> {
      const updated = await raw().query(
        "UPDATE tenant_memberships SET role = $1 WHERE tenant_id = $2 AND user_id = $3",
        [role, membership.tenantId, membership.userId],
      );
      expect(updated.rowCount).toBe(1);
    }

    /** Every operation the vault exposes, as a table of named thunks. */
    function everyOperation(
      context: TenantContext,
      secretId: string,
      purpose: string,
    ): readonly (readonly [string, () => Promise<unknown>])[] {
      return [
        ["listMetadata", () => currentVault().listMetadata(context)],
        ["getMetadata", () => currentVault().getMetadata(context, secretId)],
        [
          "create",
          () =>
            currentVault().create(context, {
              purpose: "cr02.create",
              secret: "value",
            }),
        ],
        [
          "replace",
          () => currentVault().replace(context, secretId, { secret: "value" }),
        ],
        ["remove", () => currentVault().remove(context, secretId)],
        ["rotate", () => currentVault().rotate(context, secretId)],
        [
          "withDecryptedSecret",
          () =>
            currentVault().withDecryptedSecret(
              context,
              { id: secretId, tenantId: context.tenantId, purpose },
              () => "leaked",
            ),
        ],
      ];
    }

    it("refuses a forged owner context over a real member membership", async () => {
      // A record that genuinely exists in tenant A, and a membership in tenant
      // A that genuinely says `member`. The forged context keeps the same two
      // uuids and only claims a bigger role, so it is indistinguishable in
      // shape from one a server could have issued.
      const membership = await seedTenant("owner");
      const seeded = await currentVault().create(membership, {
        purpose: "cr02.forged",
        secret: "administrative",
      });
      await setMembershipRole(membership, "member");

      const forged = forgedRole(membership, "owner");
      expect(forged.userId).toBe(membership.userId);
      expect(forged.tenantId).toBe(membership.tenantId);

      for (const [name, operation] of everyOperation(
        forged,
        seeded.id,
        "cr02.forged",
      )) {
        await expectCode(operation, "SECRET_FORBIDDEN");
        expect(name).not.toBe("");
      }

      // The honest member context is refused too: the forgery was never a
      // widening, it was refused in both directions.
      await expectCode(
        () => currentVault().listMetadata(forgedRole(membership, "member")),
        "SECRET_FORBIDDEN",
      );

      await raw().query("DELETE FROM encrypted_secrets WHERE tenant_id = $1", [
        membership.tenantId,
      ]);
    });

    it("refuses a forged admin context over a real member membership", async () => {
      const membership = await seedTenant("member");
      const forged = forgedRole(membership, "admin");

      for (const [, operation] of everyOperation(
        forged,
        randomUUID(),
        "cr02.forged.admin",
      )) {
        await expectCode(operation, "SECRET_FORBIDDEN");
      }
    });

    it("honours a downgrade that lands after the context was resolved", async () => {
      // Resolved while the membership really was an owner/admin: every
      // operation below the downgrade must work.
      for (const role of ["owner", "admin"] as const) {
        const context = await seedTenant(role);
        const created = await currentVault().create(context, {
          purpose: "cr02.downgrade",
          secret: "before-downgrade",
        });
        expect(await currentVault().listMetadata(context)).toHaveLength(1);

        // The membership is demoted in the database AFTER the context existed
        // and is never re-issued. The stored context still claims the old role.
        await setMembershipRole(context, "member");

        for (const [, operation] of everyOperation(
          context,
          created.id,
          "cr02.downgrade",
        )) {
          await expectCode(operation, "SECRET_FORBIDDEN");
        }

        // The record survives untouched, and a re-issued context that honestly
        // reports the NEW role is denied by the capability policy as well.
        const downgraded = forgedRole(context, "member");
        expect(await currentVault().isConfigured()).toBe(true);
        await expectCode(
          () => currentVault().listMetadata(downgraded),
          "SECRET_FORBIDDEN",
        );

        // Restoring the role restores access without any re-issuance, which
        // proves nothing was cached and nothing was permanently revoked.
        await setMembershipRole(context, role);
        expect(await currentVault().listMetadata(context)).toHaveLength(1);
        await currentVault().remove(context, created.id);
      }
    });

    it("never widens a member context to the stored role or to the claimed one", async () => {
      // Two opposite mismatches, both of which must fail closed rather than
      // pick the more permissive of the two answers.
      const realMember = await seedTenant("member");
      const claimsOwner = forgedRole(realMember, "owner");
      await expectCode(
        () => currentVault().listMetadata(claimsOwner),
        "SECRET_FORBIDDEN",
      );

      const realOwner = await seedTenant("owner");
      const claimsMember = forgedRole(realOwner, "member");
      await expectCode(
        () => currentVault().listMetadata(claimsMember),
        "SECRET_FORBIDDEN",
      );

      // The honest owner context still works, so the rule above is a policy
      // about divergence and not a blanket denial.
      expect(await currentVault().listMetadata(realOwner)).toEqual([]);
    });

    it("never treats a platform role as tenant authority", async () => {
      const owner = await seedTenant("owner");
      const seeded = await currentVault().create(owner, {
        purpose: "cr02.platform",
        secret: "owner-only",
      });
      const outsider = await seedTenant("member");
      await raw().query(
        "INSERT INTO platform_roles (user_id, role) VALUES ($1,'platform_admin')",
        [outsider.userId],
      );

      // A platform administrator naming the owner's tenant, with an owner role
      // claim, and carrying the ACTIVE platform role for that user.
      const forged = forgedRole(
        Object.freeze({
          userId: outsider.userId,
          tenantId: owner.tenantId,
          role: "owner",
        }) as TenantContext,
        "owner",
      );
      await expectCode(
        () => currentVault().listMetadata(forged),
        "SECRET_FORBIDDEN",
      );
      await expectCode(
        () => currentVault().getMetadata(forged, seeded.id),
        "SECRET_FORBIDDEN",
      );

      // And with the membership genuinely elevated to owner, the platform role
      // adds nothing: authority comes from the membership row alone.
      await setMembershipRole(outsider, "owner");
      const elevated = forgedRole(outsider, "owner");
      const listed = await currentVault().listMetadata(elevated);
      expect(listed).toEqual([]);

      // The owner role string itself is not a tenant role and is refused
      // structurally, before any statement runs.
      await expectCode(
        () =>
          currentVault().listMetadata(
            forgedRole(
              Object.freeze({
                userId: outsider.userId,
                tenantId: owner.tenantId,
                role: "platform_admin",
              }) as unknown as TenantContext,
              "platform_admin",
            ),
          ),
        "SECRET_FORBIDDEN",
      );

      await currentVault().remove(owner, seeded.id);
    });
  });

  describe("write, read and mask", () => {
    it("stores an envelope and returns metadata only", async () => {
      const context = await seedTenant("owner");
      const plaintext = "polymarket-secret-value-abc";
      const created = await currentVault().create(context, {
        purpose: "polymarket.api_key",
        secret: plaintext,
      });

      expect(Object.keys(created).sort()).toEqual(METADATA_KEYS);
      expect(JSON.stringify(created)).not.toContain(plaintext);
      expect(created.rotation).toBe("current");
      expect(created.rotatedAt).toBeNull();

      const stored = await raw().query<{
        ciphertext: Buffer;
        nonce: Buffer;
        auth_tag: Buffer;
        key_version: string;
      }>(
        "SELECT ciphertext, nonce, auth_tag, key_version FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      const row = stored.rows[0];
      expect(row?.nonce).toHaveLength(12);
      expect(row?.auth_tag).toHaveLength(16);
      expect(row?.key_version).toBe("k2");
      expect(row?.ciphertext.toString("utf8")).not.toContain(plaintext);

      // Same plaintext twice: different nonce AND different ciphertext.
      const second = await currentVault().create(context, {
        purpose: "polymarket.api_key",
        secret: plaintext,
      });
      const storedSecond = await raw().query<{
        nonce: Buffer;
        ciphertext: Buffer;
      }>("SELECT nonce, ciphertext FROM encrypted_secrets WHERE id = $1", [
        second.id,
      ]);
      expect(storedSecond.rows[0]?.nonce.equals(row?.nonce as Buffer)).toBe(
        false,
      );
      expect(
        storedSecond.rows[0]?.ciphertext.equals(row?.ciphertext as Buffer),
      ).toBe(false);

      await currentVault().remove(context, created.id);
      await currentVault().remove(context, second.id);
    });

    it("rejects malformed purpose and secret input before encryption", async () => {
      const context = await seedTenant("owner");
      const before = await raw().query<{ n: number }>(
        "SELECT count(*)::int AS n FROM encrypted_secrets",
      );

      for (const purpose of [
        "",
        "A",
        "Bad Purpose",
        "a".repeat(65),
        "-leading",
        "trailing-",
        "double--dash",
      ]) {
        await expectCode(
          () => currentVault().create(context, { purpose, secret: "value" }),
          "INVALID_SECRET_INPUT",
        );
      }
      await expectCode(
        () =>
          currentVault().create(context, { purpose: "ok.purpose", secret: "" }),
        "INVALID_SECRET_INPUT",
      );
      await expectCode(
        () =>
          currentVault().create(context, {
            purpose: "ok.purpose",
            secret: "x".repeat(65_537),
          }),
        "INVALID_SECRET_INPUT",
      );
      for (const id of ["not-a-uuid", "", "../../etc/passwd"]) {
        await expectCode(
          () => currentVault().replace(context, id, { secret: "value" }),
          "INVALID_SECRET_INPUT",
        );
        await expectCode(
          () => currentVault().remove(context, id),
          "INVALID_SECRET_INPUT",
        );
        await expectCode(
          () => currentVault().rotate(context, id),
          "INVALID_SECRET_INPUT",
        );
        await expectCode(
          () => currentVault().getMetadata(context, id),
          "INVALID_SECRET_INPUT",
        );
      }

      const after = await raw().query<{ n: number }>(
        "SELECT count(*)::int AS n FROM encrypted_secrets",
      );
      expect(after.rows[0]?.n).toBe(before.rows[0]?.n);
    });

    it("replaces the value in place, preserving id, tenant, purpose and created_at", async () => {
      const context = await seedTenant("owner");
      const created = await currentVault().create(context, {
        purpose: "replace.value",
        secret: "first-value",
      });
      const before = await raw().query<{ nonce: Buffer; auth_tag: Buffer }>(
        "SELECT nonce, auth_tag FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      const replaced = await currentVault().replace(context, created.id, {
        secret: "second-value",
      });

      expect(replaced.id).toBe(created.id);
      expect(replaced.purpose).toBe(created.purpose);
      expect(replaced.createdAt).toBe(created.createdAt);
      // A replacement is not a rotation: rotated_at stays null.
      expect(replaced.rotatedAt).toBeNull();

      const after = await raw().query<{ nonce: Buffer; auth_tag: Buffer }>(
        "SELECT nonce, auth_tag FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      expect(after.rows[0]?.nonce.equals(before.rows[0]?.nonce as Buffer)).toBe(
        false,
      );
      expect(
        after.rows[0]?.auth_tag.equals(before.rows[0]?.auth_tag as Buffer),
      ).toBe(false);

      const value = await currentVault().withDecryptedSecret(
        context,
        {
          id: created.id,
          tenantId: context.tenantId,
          purpose: "replace.value",
        },
        (plaintext) => plaintext.toString("utf8"),
      );
      expect(value).toBe("second-value");
      await currentVault().remove(context, created.id);
    });

    it("scopes internal consumption by handle purpose and zeroes the buffer", async () => {
      const context = await seedTenant("owner");
      const created = await currentVault().create(context, {
        purpose: "scoped.purpose",
        secret: "scoped-value",
      });
      const handle = {
        id: created.id,
        tenantId: context.tenantId,
        purpose: "scoped.purpose",
      };

      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            context,
            { ...handle, purpose: "other.purpose" },
            () => "leaked",
          ),
        "SECRET_NOT_FOUND",
      );
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            context,
            { ...handle, id: "not-a-uuid" },
            () => "leaked",
          ),
        "INVALID_SECRET_INPUT",
      );
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            context,
            { ...handle, purpose: "Bad Purpose" },
            () => "leaked",
          ),
        "INVALID_SECRET_INPUT",
      );
      // A handle naming another tenant is a refusal, not a lookup miss.
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            context,
            { ...handle, tenantId: randomUUID() },
            () => "leaked",
          ),
        "SECRET_FORBIDDEN",
      );

      let captured: Buffer | undefined;
      const returned = await currentVault().withDecryptedSecret(
        context,
        handle,
        (plaintext) => {
          captured = plaintext;
          return "callback-result";
        },
      );
      expect(returned).toBe("callback-result");
      expect(Buffer.isBuffer(captured)).toBe(true);
      expect(captured?.every((byte) => byte === 0)).toBe(true);

      let failed: Buffer | undefined;
      await expect(
        currentVault().withDecryptedSecret(context, handle, (plaintext) => {
          failed = plaintext;
          throw new Error("consumer failed");
        }),
      ).rejects.toThrow("consumer failed");
      expect(failed?.every((byte) => byte === 0)).toBe(true);

      await currentVault().remove(context, created.id);
    });
  });

  describe("keyring availability", () => {
    it("fails every operation closed when the keyring is absent or malformed", async () => {
      const context = await seedTenant("owner");

      const configurations: Readonly<{
        label: string;
        keyring: { activeKeyVersion?: string; keyringJson?: string };
      }>[] = [
        { label: "absent", keyring: {} },
        {
          label: "blank values",
          keyring: { activeKeyVersion: "", keyringJson: "" },
        },
        {
          label: "invalid json",
          keyring: { activeKeyVersion: "k2", keyringJson: "not json" },
        },
        {
          label: "json array",
          keyring: { activeKeyVersion: "k2", keyringJson: "[]" },
        },
        {
          label: "empty keyring object",
          keyring: { activeKeyVersion: "k2", keyringJson: "{}" },
        },
        {
          label: "missing active version",
          keyring: {
            activeKeyVersion: "k2",
            keyringJson: JSON.stringify({ k1: KEY_V1_B64 }),
          },
        },
        {
          label: "non-canonical active version",
          keyring: {
            activeKeyVersion: "K2",
            keyringJson: JSON.stringify({ k2: KEY_V2_B64 }),
          },
        },
        {
          label: "16-byte key",
          keyring: {
            activeKeyVersion: "k2",
            keyringJson: JSON.stringify({
              k2: Buffer.alloc(16, 7).toString("base64"),
            }),
          },
        },
        {
          label: "33-byte key",
          keyring: {
            activeKeyVersion: "k2",
            keyringJson: JSON.stringify({
              k2: Buffer.alloc(33, 7).toString("base64"),
            }),
          },
        },
        {
          label: "non-base64 value",
          keyring: {
            activeKeyVersion: "k2",
            keyringJson: JSON.stringify({ k2: "!!!" }),
          },
        },
        {
          label: "non-string value",
          keyring: {
            activeKeyVersion: "k2",
            keyringJson: JSON.stringify({ k2: 42 }),
          },
        },
        {
          label: "non-canonical version name",
          keyring: {
            activeKeyVersion: "K2",
            keyringJson: JSON.stringify({ K2: KEY_V2_B64 }),
          },
        },
      ];

      for (const { label, keyring } of configurations) {
        const broken = openVault(keyring);
        expect(broken.isConfigured(), label).toBe(false);
        await expectCode(
          () => broken.listMetadata(context),
          "VAULT_UNAVAILABLE",
        );
        await expectCode(
          () => broken.getMetadata(context, randomUUID()),
          "VAULT_UNAVAILABLE",
        );
        await expectCode(
          () => broken.create(context, { purpose: "vault.down", secret: "x" }),
          "VAULT_UNAVAILABLE",
        );
        await expectCode(
          () => broken.replace(context, randomUUID(), { secret: "x" }),
          "VAULT_UNAVAILABLE",
        );
        await expectCode(
          () => broken.rotate(context, randomUUID()),
          "VAULT_UNAVAILABLE",
        );
        // A delete needs no key material, yet the vault still fails closed.
        await expectCode(
          () => broken.remove(context, randomUUID()),
          "VAULT_UNAVAILABLE",
        );
        // `withDecryptedSecret` authorizes BEFORE touching the table, so a
        // caller with authority but a bogus id gets a plain lookup miss.
        await expectCode(
          () =>
            broken.withDecryptedSecret(
              context,
              {
                id: randomUUID(),
                tenantId: context.tenantId,
                purpose: "vault.down",
              },
              () => "leaked",
            ),
          "SECRET_NOT_FOUND",
        );
      }

      // Nothing was written by any of those attempts.
      const rows = await raw().query(
        "SELECT 1 FROM encrypted_secrets WHERE purpose = 'vault.down'",
      );
      expect(rows.rowCount).toBe(0);
      expect(currentVault().isConfigured()).toBe(true);
    });

    it("raises KEY_VERSION_UNAVAILABLE when a recorded version is not in the keyring", async () => {
      const context = await seedTenant("owner");
      const created = await currentVault().create(context, {
        purpose: "keyring.version",
        secret: "versioned",
      });
      // The row is stored under k2; a keyring that only knows k1 cannot open it.
      const wrongRing = openVault(K1_ONLY_KEYRING);
      await expectCode(
        () =>
          wrongRing.withDecryptedSecret(
            context,
            {
              id: created.id,
              tenantId: context.tenantId,
              purpose: "keyring.version",
            },
            () => "leaked",
          ),
        "KEY_VERSION_UNAVAILABLE",
      );
      await currentVault().remove(context, created.id);
    });
  });

  describe("nonce collision", () => {
    it("retries with a fresh nonce and succeeds after one collision", async () => {
      const context = await seedTenant("owner");
      const seed = await currentVault().create(context, {
        purpose: "nonce.seed",
        secret: "occupant",
      });
      const occupied = randomBytes(12);
      // Point the existing row at a known nonce under the ACTIVE key, so the
      // first attempt's draw genuinely collides and the database barrier is
      // exercised for real rather than simulated.
      await raw().query(
        "UPDATE encrypted_secrets SET nonce = $1 WHERE id = $2",
        [occupied, seed.id],
      );

      let draws = 0;
      const colliding = openVault(FULL_KEYRING, () => {
        draws += 1;
        return draws === 1 ? occupied : randomBytes(12);
      });
      const created = await colliding.create(context, {
        purpose: "nonce.retry",
        secret: "retry-value",
      });
      expect(draws).toBe(2);

      // Exactly one row holds the collided nonce: the pre-existing one. The
      // retried envelope rolled its failed attempt back in full.
      const holders = await raw().query<{ id: string }>(
        "SELECT id FROM encrypted_secrets WHERE key_version = 'k2' AND nonce = $1",
        [occupied],
      );
      expect(holders.rows.map((row) => row.id)).toEqual([seed.id]);

      const value = await currentVault().withDecryptedSecret(
        context,
        { id: created.id, tenantId: context.tenantId, purpose: "nonce.retry" },
        (plaintext) => plaintext.toString("utf8"),
      );
      expect(value).toBe("retry-value");

      await raw().query("DELETE FROM encrypted_secrets WHERE tenant_id = $1", [
        context.tenantId,
      ]);
    });

    it("fails closed with NONCE_COLLISION once the retry budget is exhausted", async () => {
      const context = await seedTenant("owner");
      const seed = await currentVault().create(context, {
        purpose: "nonce.exhaust.seed",
        secret: "occupant",
      });
      const occupied = randomBytes(12);
      await raw().query(
        "UPDATE encrypted_secrets SET nonce = $1 WHERE id = $2",
        [occupied, seed.id],
      );

      let draws = 0;
      const stuck = openVault(FULL_KEYRING, () => {
        draws += 1;
        return occupied;
      });
      await expectCode(
        () =>
          stuck.create(context, {
            purpose: "nonce.exhausted",
            secret: "never-stored",
          }),
        "NONCE_COLLISION",
      );
      // Bounded: exactly the budget, then a hard stop.
      expect(draws).toBe(3);

      const stored = await raw().query<{ purpose: string }>(
        "SELECT purpose FROM encrypted_secrets WHERE tenant_id = $1",
        [context.tenantId],
      );
      expect(stored.rows.map((row) => row.purpose)).toEqual([
        "nonce.exhaust.seed",
      ]);
      await raw().query("DELETE FROM encrypted_secrets WHERE tenant_id = $1", [
        context.tenantId,
      ]);
    });

    it("never persists a reused nonce even when the application retry is bypassed", async () => {
      const context = await seedTenant("owner");
      const first = await currentVault().create(context, {
        purpose: "nonce.barrier",
        secret: "first",
      });
      const row = await raw().query<{ nonce: Buffer; key_version: string }>(
        "SELECT nonce, key_version FROM encrypted_secrets WHERE id = $1",
        [first.id],
      );
      const nonce = row.rows[0]?.nonce;
      const keyVersion = row.rows[0]?.key_version;
      expect(nonce).toBeDefined();
      await expect(
        raw().query(
          "INSERT INTO encrypted_secrets (tenant_id, purpose, ciphertext, nonce, auth_tag, key_version) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            context.tenantId,
            "nonce.barrier",
            Buffer.from([9]),
            nonce,
            randomBytes(16),
            keyVersion,
          ],
        ),
      ).rejects.toThrow("encrypted_secrets_key_version_nonce_unique");
      await currentVault().remove(context, first.id);
    });
  });

  describe("rotation", () => {
    it("re-encrypts to the active key atomically and preserves record identity", async () => {
      const context = await seedTenant("owner");
      const created = await seedStaleEnvelope(
        context,
        "rotate.basic",
        "rotate-me",
      );
      const before = await raw().query<{
        ciphertext: Buffer;
        nonce: Buffer;
        auth_tag: Buffer;
        key_version: string;
        created_at: Date;
      }>(
        "SELECT ciphertext, nonce, auth_tag, key_version, created_at FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      const beforeRow = before.rows[0];
      expect(beforeRow?.key_version).toBe("k1");

      const outcome = await currentVault().rotate(context, created.id);
      expect(outcome.status).toBe("rotated");
      expect(outcome.metadata.rotation).toBe("current");
      expect(outcome.metadata.rotatedAt).not.toBeNull();
      expect(outcome.metadata.id).toBe(created.id);
      expect(outcome.metadata.purpose).toBe("rotate.basic");
      expect(outcome.metadata.createdAt).toBe(created.createdAt);

      const after = await raw().query<{
        ciphertext: Buffer;
        nonce: Buffer;
        auth_tag: Buffer;
        key_version: string;
        created_at: Date;
        tenant_id: string;
        purpose: string;
      }>(
        "SELECT ciphertext, nonce, auth_tag, key_version, created_at, tenant_id, purpose FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      const afterRow = after.rows[0];
      expect(afterRow?.nonce.equals(beforeRow?.nonce as Buffer)).toBe(false);
      expect(afterRow?.auth_tag.equals(beforeRow?.auth_tag as Buffer)).toBe(
        false,
      );
      expect(afterRow?.ciphertext.equals(beforeRow?.ciphertext as Buffer)).toBe(
        false,
      );
      expect(afterRow?.key_version).toBe("k2");
      expect(afterRow?.tenant_id).toBe(context.tenantId);
      expect(afterRow?.purpose).toBe("rotate.basic");
      expect(
        onlyRow(after.rows, "rotation after").created_at.toISOString(),
      ).toBe(onlyRow(before.rows, "rotation before").created_at.toISOString());
      expect(afterRow?.nonce).toHaveLength(12);
      expect(afterRow?.auth_tag).toHaveLength(16);

      const value = await currentVault().withDecryptedSecret(
        context,
        { id: created.id, tenantId: context.tenantId, purpose: "rotate.basic" },
        (plaintext) => plaintext.toString("utf8"),
      );
      expect(value).toBe("rotate-me");
      await currentVault().remove(context, created.id);
    });

    it("reports already_current without materializing plaintext", async () => {
      const context = await seedTenant("owner");
      const created = await currentVault().create(context, {
        purpose: "rotate.current",
        secret: "already-here",
      });
      const before = await raw().query<{
        nonce: Buffer;
        auth_tag: Buffer;
        rotated_at: Date | null;
        updated_at: Date;
      }>(
        "SELECT nonce, auth_tag, rotated_at, updated_at FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      const outcome = await currentVault().rotate(context, created.id);
      expect(outcome.status).toBe("already_current");
      const after = await raw().query<{
        nonce: Buffer;
        auth_tag: Buffer;
        rotated_at: Date | null;
        updated_at: Date;
      }>(
        "SELECT nonce, auth_tag, rotated_at, updated_at FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      // Untouched down to the byte and to both timestamps.
      expect(after.rows[0]?.nonce.equals(before.rows[0]?.nonce as Buffer)).toBe(
        true,
      );
      expect(
        after.rows[0]?.auth_tag.equals(before.rows[0]?.auth_tag as Buffer),
      ).toBe(true);
      expect(after.rows[0]?.rotated_at).toBeNull();
      expect(
        onlyRow(after.rows, "already_current after").updated_at.toISOString(),
      ).toBe(
        onlyRow(before.rows, "already_current before").updated_at.toISOString(),
      );

      // Idempotent: a second call is still already_current.
      expect((await currentVault().rotate(context, created.id)).status).toBe(
        "already_current",
      );
      await currentVault().remove(context, created.id);
    });

    it("fails closed without mutating the row when the old key is missing", async () => {
      const context = await seedTenant("owner");
      const created = await seedStaleEnvelope(
        context,
        "rotate.missing",
        "unreachable",
      );
      const snapshot = async () => {
        const result = await raw().query<{
          ciphertext: Buffer;
          nonce: Buffer;
          auth_tag: Buffer;
          key_version: string;
          rotated_at: Date | null;
        }>(
          "SELECT ciphertext, nonce, auth_tag, key_version, rotated_at FROM encrypted_secrets WHERE id = $1",
          [created.id],
        );
        return result.rows[0];
      };
      const before = await snapshot();

      await expectCode(
        () => openVault(KEYRING_WITHOUT_K1).rotate(context, created.id),
        "KEY_VERSION_UNAVAILABLE",
      );
      const after = await snapshot();
      // Byte-for-byte identical: the evidence was not overwritten.
      expect(after?.key_version).toBe(before?.key_version);
      expect(after?.nonce.equals(before?.nonce as Buffer)).toBe(true);
      expect(after?.auth_tag.equals(before?.auth_tag as Buffer)).toBe(true);
      expect(after?.ciphertext.equals(before?.ciphertext as Buffer)).toBe(true);
      expect(after?.rotated_at).toBeNull();

      await currentVault().remove(context, created.id);
    });

    it("fails closed without mutating the row when the envelope is corrupted", async () => {
      for (const corruption of ["ciphertext", "auth_tag", "nonce"] as const) {
        const context = await seedTenant("owner");
        const created = await seedStaleEnvelope(
          context,
          `rotate.corrupt.${corruption}`,
          "tampered-source",
        );
        await raw().query(
          `UPDATE encrypted_secrets SET ${corruption} = set_byte(${corruption}, 0, (get_byte(${corruption}, 0) + 1) % 256) WHERE id = $1`,
          [created.id],
        );
        const snapshot = await raw().query<{
          ciphertext: Buffer;
          key_version: string;
        }>(
          "SELECT ciphertext, key_version FROM encrypted_secrets WHERE id = $1",
          [created.id],
        );
        await expectCode(
          () => currentVault().rotate(context, created.id),
          "SECRET_INTEGRITY_FAILURE",
        );
        const after = await raw().query<{
          ciphertext: Buffer;
          key_version: string;
        }>(
          "SELECT ciphertext, key_version FROM encrypted_secrets WHERE id = $1",
          [created.id],
        );
        expect(
          after.rows[0]?.ciphertext.equals(
            snapshot.rows[0]?.ciphertext as Buffer,
          ),
        ).toBe(true);
        expect(after.rows[0]?.key_version).toBe("k1");
        await raw().query(
          "DELETE FROM encrypted_secrets WHERE tenant_id = $1",
          [context.tenantId],
        );
      }
    });

    it("fails closed when a stored row's tenant binding no longer matches its envelope", async () => {
      const context = await seedTenant("owner");
      const created = await seedStaleEnvelope(
        context,
        "rotate.aad",
        "aad-source",
      );
      const other = await seedTenant("owner");
      // Re-point the row at a different tenant: the AAD no longer matches.
      await raw().query(
        "UPDATE encrypted_secrets SET tenant_id = $1 WHERE id = $2",
        [other.tenantId, created.id],
      );
      await expectCode(
        () => currentVault().rotate(other, created.id),
        "SECRET_INTEGRITY_FAILURE",
      );
      await raw().query("DELETE FROM encrypted_secrets WHERE id = $1", [
        created.id,
      ]);
    });
  });

  describe("concurrency", () => {
    it("serializes two rotations and never mixes envelope metadata", async () => {
      const context = await seedTenant("owner");
      const created = await seedStaleEnvelope(
        context,
        "race.rotate",
        "racing-value",
      );

      const [first, second] = await Promise.all([
        currentVault().rotate(context, created.id),
        currentVault().rotate(context, created.id),
      ]);
      // Exactly one performs the rotation; the other observes the winner.
      expect([first.status, second.status].sort()).toEqual([
        "already_current",
        "rotated",
      ]);

      const row = await raw().query<{
        key_version: string;
        nonce: Buffer;
        auth_tag: Buffer;
        ciphertext: Buffer;
        rotated_at: Date | null;
      }>(
        "SELECT key_version, nonce, auth_tag, ciphertext, rotated_at FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      const final = row.rows[0];
      expect(final?.key_version).toBe("k2");
      expect(final?.nonce).toHaveLength(12);
      expect(final?.auth_tag).toHaveLength(16);
      expect(final?.rotated_at).not.toBeNull();

      // A mixed envelope would not authenticate as a whole under k2.
      const value = await currentVault().withDecryptedSecret(
        context,
        { id: created.id, tenantId: context.tenantId, purpose: "race.rotate" },
        (plaintext) => plaintext.toString("utf8"),
      );
      expect(value).toBe("racing-value");
      await currentVault().remove(context, created.id);
    });

    it("keeps update and rotate consistent under concurrency", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const context = await seedTenant("owner");
        const purpose = `race.update.${attempt}`;
        const created = await currentVault().create(context, {
          purpose,
          secret: `before-update-${attempt}`,
        });

        const results = await Promise.allSettled([
          currentVault().replace(context, created.id, {
            secret: `after-update-${attempt}`,
          }),
          currentVault().rotate(context, created.id),
        ]);
        for (const result of results) {
          if (result.status === "rejected") {
            expect(["SECRET_NOT_FOUND", "NONCE_COLLISION"]).toContain(
              (result.reason as SecretVaultError).code,
            );
          }
        }

        // Whatever the interleaving, the row is ONE coherent envelope.
        const row = await raw().query<{
          key_version: string;
          nonce: Buffer;
          auth_tag: Buffer;
        }>(
          "SELECT key_version, nonce, auth_tag FROM encrypted_secrets WHERE id = $1",
          [created.id],
        );
        expect(row.rows[0]?.key_version).toBe("k2");
        expect(row.rows[0]?.nonce).toHaveLength(12);
        expect(row.rows[0]?.auth_tag).toHaveLength(16);

        const value = await currentVault().withDecryptedSecret(
          context,
          { id: created.id, tenantId: context.tenantId, purpose },
          (plaintext) => plaintext.toString("utf8"),
        );
        expect([
          `before-update-${attempt}`,
          `after-update-${attempt}`,
        ]).toContain(value);
        await raw().query(
          "DELETE FROM encrypted_secrets WHERE tenant_id = $1",
          [context.tenantId],
        );
      }
    });

    it("resolves delete against rotate deterministically without resurrecting", async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const context = await seedTenant("owner");
        const purpose = `race.delete.${attempt}`;
        const created = await currentVault().create(context, {
          purpose,
          secret: "doomed",
        });

        const results = await Promise.allSettled([
          currentVault().remove(context, created.id),
          currentVault().rotate(context, created.id),
        ]);
        for (const result of results) {
          if (result.status === "rejected") {
            expect((result.reason as SecretVaultError).code).toBe(
              "SECRET_NOT_FOUND",
            );
          }
        }
        // Rotation never inserts, so a deleted secret cannot come back under
        // either interleaving.
        const remaining = await raw().query<{ id: string }>(
          "SELECT id FROM encrypted_secrets WHERE id = $1",
          [created.id],
        );
        if (results[0]?.status === "fulfilled") {
          expect(remaining.rows).toEqual([]);
        }
        if (remaining.rows.length === 1) {
          // The delete lost; the surviving row must still authenticate.
          const value = await currentVault().withDecryptedSecret(
            context,
            { id: created.id, tenantId: context.tenantId, purpose },
            (plaintext) => plaintext.toString("utf8"),
          );
          expect(value).toBe("doomed");
        }
      }
    });

    it("never lets concurrent writes reuse a nonce under the active key", async () => {
      const context = await seedTenant("owner");
      const created = await Promise.all(
        Array.from({ length: 8 }, (_unused, index) =>
          currentVault().create(context, {
            purpose: `race.parallel.${index}`,
            secret: `parallel-${index}`,
          }),
        ),
      );
      expect(created).toHaveLength(8);

      const rows = await raw().query<{ nonce: string }>(
        "SELECT encode(nonce,'hex') AS nonce FROM encrypted_secrets WHERE tenant_id = $1 AND key_version = 'k2'",
        [context.tenantId],
      );
      expect(rows.rows).toHaveLength(8);
      expect(new Set(rows.rows.map((row) => row.nonce)).size).toBe(8);

      for (const [index, secret] of created.entries()) {
        const value = await currentVault().withDecryptedSecret(
          context,
          {
            id: secret.id,
            tenantId: context.tenantId,
            purpose: `race.parallel.${index}`,
          },
          (plaintext) => plaintext.toString("utf8"),
        );
        expect(value).toBe(`parallel-${index}`);
      }
      await raw().query("DELETE FROM encrypted_secrets WHERE tenant_id = $1", [
        context.tenantId,
      ]);
    });
  });

  describe("redaction", () => {
    it("keeps plaintext and key material out of every metadata and error surface", async () => {
      const context = await seedTenant("owner");
      const plaintext = "unique-canary-plaintext-9f2a";
      const created = await currentVault().create(context, {
        purpose: "redaction.check",
        secret: plaintext,
      });

      const metadata = await currentVault().getMetadata(context, created.id);
      expect(metadata).not.toBeNull();
      // Structural guarantee: the allow-list IS the surface, so no envelope
      // component, length or derived suffix can appear even if the type grows.
      expect(Object.keys(metadata as Record<string, unknown>).sort()).toEqual(
        METADATA_KEYS,
      );
      const serialized = JSON.stringify(metadata);
      for (const forbidden of [
        plaintext,
        "ciphertext",
        "nonce",
        "authTag",
        "keyVersion",
        "last4",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(serialized).not.toContain(plaintext.slice(-4));

      // Failure surfaces carry only the sanitized code.
      try {
        await currentVault().rotate(context, randomUUID());
        throw new Error("expected a failure");
      } catch (error) {
        expect(error).toBeInstanceOf(SecretVaultError);
        const surface = [
          (error as Error).message,
          (error as Error).stack ?? "",
          JSON.stringify(error),
        ].join(" ");
        expect(surface).not.toContain(plaintext);
        expect(surface).not.toContain(KEY_V1_B64);
        expect(surface).not.toContain(KEY_V2_B64);
        expect(surface).not.toContain("auth tag");
        expect(surface).not.toContain("authenticate");
      }
      await currentVault().remove(context, created.id);
    });

    it("never persists plaintext in any column", async () => {
      const context = await seedTenant("owner");
      const plaintext = "column-scan-canary-4b7e";
      const created = await currentVault().create(context, {
        purpose: "redaction.columns",
        secret: plaintext,
      });
      const row = await raw().query<Record<string, Buffer | string | null>>(
        "SELECT * FROM encrypted_secrets WHERE id = $1",
        [created.id],
      );
      const serialized = JSON.stringify(row.rows[0], (_key, value: unknown) =>
        Buffer.isBuffer(value) ? value.toString("base64") : value,
      );
      expect(serialized).not.toContain(plaintext);
      expect(serialized).not.toContain(
        Buffer.from(plaintext).toString("base64"),
      );
      expect(serialized).not.toContain(Buffer.from(plaintext).toString("hex"));
      await currentVault().remove(context, created.id);
    });
  });

  describe("envelope transplant resistance", () => {
    it("refuses an envelope physically copied onto another tenant row", async () => {
      const tenantA = await seedTenant("owner");
      const tenantB = await seedTenant("owner");
      const secretA = await currentVault().create(tenantA, {
        purpose: "transplant.a",
        secret: "tenant-a-only",
      });

      // Re-pointing tenant A's own row at tenant B is refused for the
      // same reason: the AAD binds the tenant id.
      await raw().query(
        "UPDATE encrypted_secrets SET tenant_id = $1 WHERE id = $2",
        [tenantB.tenantId, secretA.id],
      );
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            tenantB,
            {
              id: secretA.id,
              tenantId: tenantB.tenantId,
              purpose: "transplant.a",
            },
            () => "leaked",
          ),
        "SECRET_INTEGRITY_FAILURE",
      );
      await raw().query(
        "UPDATE encrypted_secrets SET tenant_id = $1 WHERE id = $2",
        [tenantA.tenantId, secretA.id],
      );

      // And a byte-for-byte copy of the envelope into a brand-new tenant B row
      // is refused too. The source row is deleted first precisely because the
      // database refuses a second `(key_version, nonce)` pair — the copy is
      // only possible once the original is gone, and it still cannot be read.
      const row = await raw().query<{
        ciphertext: Buffer;
        nonce: Buffer;
        auth_tag: Buffer;
        key_version: string;
      }>(
        "SELECT ciphertext, nonce, auth_tag, key_version FROM encrypted_secrets WHERE id = $1",
        [secretA.id],
      );
      const envelope = row.rows[0];
      await raw().query("DELETE FROM encrypted_secrets WHERE id = $1", [
        secretA.id,
      ]);

      const smuggled = await raw().query<{ id: string }>(
        "INSERT INTO encrypted_secrets (tenant_id, purpose, ciphertext, nonce, auth_tag, key_version) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [
          tenantB.tenantId,
          "transplant.b",
          envelope?.ciphertext,
          envelope?.nonce,
          envelope?.auth_tag,
          envelope?.key_version,
        ],
      );
      const smuggledId = smuggled.rows[0]?.id;
      expect(smuggledId).toBeDefined();

      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            tenantB,
            {
              id: smuggledId as string,
              tenantId: tenantB.tenantId,
              purpose: "transplant.b",
            },
            () => "leaked",
          ),
        "SECRET_INTEGRITY_FAILURE",
      );

      await raw().query("DELETE FROM encrypted_secrets WHERE id = $1", [
        smuggledId as string,
      ]);
    });
  });

  /**
   * Audit CR-03 — the single-record metadata read, proven against PostgreSQL.
   *
   * `getMetadata` is what `GET /api/secrets/:id` calls. It must return the
   * allow-list and nothing else, must be invisible across tenants, and must be
   * refused to a member and to a `platform_admin` who has no membership. The
   * HTTP projection of the same call is proven in
   * `tests/secret-vault-http.test.ts`.
   */
  describe("single-record metadata read (audit CR-03)", () => {
    it("returns exactly the allow-listed fields for one record", async () => {
      const context = await seedTenant("owner");
      const plaintext = "single-record-canary-91af";
      const created = await currentVault().create(context, {
        purpose: "cr03.metadata",
        secret: plaintext,
      });

      const metadata = await currentVault().getMetadata(context, created.id);
      expect(metadata).not.toBeNull();
      expect(Object.keys(metadata as object).sort()).toEqual(METADATA_KEYS);
      expect(metadata?.purpose).toBe("cr03.metadata");
      expect(metadata?.rotation).toBe("current");

      // None of the envelope may survive the projection in any form.
      const serialized = JSON.stringify(metadata);
      for (const forbidden of [
        plaintext,
        "ciphertext",
        "nonce",
        "authTag",
        "auth_tag",
        "keyVersion",
        "k2",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }

      // A non-canonical id is rejected outright, never coerced into a lookup.
      await expectCode(
        () => currentVault().getMetadata(context, "../../etc/passwd"),
        "INVALID_SECRET_INPUT",
      );
      // A well-formed id that simply does not exist is `null`, the sanitized
      // contract the HTTP layer turns into SECRET_NOT_FOUND.
      expect(
        await currentVault().getMetadata(context, randomUUID()),
      ).toBeNull();

      await currentVault().remove(context, created.id);
      expect(await currentVault().getMetadata(context, created.id)).toBeNull();
    });

    it("tells one tenant nothing at all about another tenant's record", async () => {
      const tenantA = await seedTenant("owner");
      const tenantB = await seedTenant("owner");
      const secretA = await currentVault().create(tenantA, {
        purpose: "cr03.isolation",
        secret: "tenant-a-value",
      });

      // `null` — byte-identical to an id that was never minted. There is no
      // signal here that could be turned into an existence oracle.
      expect(await currentVault().getMetadata(tenantB, secretA.id)).toBeNull();
      expect(
        await currentVault().getMetadata(tenantA, secretA.id),
      ).not.toBeNull();

      await currentVault().remove(tenantA, secretA.id);
    });

    it("refuses the single-record read to a member and to a bare platform_admin", async () => {
      const owner = await seedTenant("owner");
      const seeded = await currentVault().create(owner, {
        purpose: "cr03.denied",
        secret: "owner-only",
      });

      const member = await seedTenant("member");
      await expectCode(
        () => currentVault().getMetadata(member, seeded.id),
        "SECRET_FORBIDDEN",
      );

      const outsider = await seedTenant("member");
      await raw().query(
        "INSERT INTO platform_roles (user_id, role) VALUES ($1,'platform_admin')",
        [outsider.userId],
      );
      await expectCode(
        () => currentVault().getMetadata(outsider, seeded.id),
        "SECRET_FORBIDDEN",
      );

      // Even for a member of the OWNING tenant: the capability is refused, so
      // no metadata leaks at all.
      const fellowId = randomUUID();
      await raw().query("INSERT INTO users (id, status) VALUES ($1,'active')", [
        fellowId,
      ]);
      await raw().query(
        "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'member','active')",
        [owner.tenantId, fellowId],
      );
      await expectCode(
        () =>
          currentVault().getMetadata(
            {
              userId: fellowId,
              tenantId: owner.tenantId,
              role: "member",
            } as TenantContext,
            seeded.id,
          ),
        "SECRET_FORBIDDEN",
      );

      await currentVault().remove(owner, seeded.id);
    });
  });
});
