import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  identityLinks,
  tenantMemberships,
  tenants,
  users,
} from "../src/schema/index.js";
import {
  createTenantDataAccess,
  InvalidTenantContextError,
} from "../src/server/index.js";
import type { TenantContext } from "@polyhunter/domain";

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

function quoteGeneratedIdentifier(identifier: string): string {
  if (!/^phm01_[0-9a-f]{32}$/.test(identifier)) {
    throw new Error(
      "Refusing to use an unexpected integration database identifier.",
    );
  }

  return `"${identifier}"`;
}

function databaseRows(database: Pool, table: string, id: string) {
  if (table !== "identity_links" && table !== "tenant_memberships") {
    throw new Error("Unexpected table requested by an integration assertion.");
  }

  return database.query(`SELECT id FROM ${table} WHERE user_id = $1`, [id]);
}

describe("PostgreSQL tenancy persistence", () => {
  const databaseNames = [
    `phm01_${randomUUID().replaceAll("-", "")}`,
    `phm01_${randomUUID().replaceAll("-", "")}`,
  ];
  let adminPool: Pool | undefined;
  let testPool: Pool | undefined;
  let dataAccess: ReturnType<typeof createTenantDataAccess> | undefined;
  let tenantAId = "";
  let tenantBId = "";
  let ownerAId = "";
  let ownerBId = "";
  let membershipAId = "";
  let membershipBId = "";
  let contextA: TenantContext;
  let contextB: TenantContext;
  let contextAInB: TenantContext;

  function getTestPool(): Pool {
    if (!testPool) {
      throw new Error("PostgreSQL integration fixtures were not initialized.");
    }
    return testPool;
  }

  function getDataAccess(): ReturnType<typeof createTenantDataAccess> {
    if (!dataAccess) {
      throw new Error(
        "Tenant data-access integration fixture was not initialized.",
      );
    }
    return dataAccess;
  }

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: configuredDatabaseUrl, max: 1 });
    for (const databaseName of databaseNames) {
      await adminPool.query(
        `CREATE DATABASE ${quoteGeneratedIdentifier(databaseName)}`,
      );
    }

    for (const databaseName of databaseNames) {
      const migrationPool = new Pool({
        connectionString: databaseUrlFor(databaseName),
        max: 1,
      });
      try {
        await migrate(drizzle(migrationPool), { migrationsFolder });
        if (databaseName === databaseNames[0]) {
          await migrate(drizzle(migrationPool), { migrationsFolder });
        }
      } finally {
        await migrationPool.end();
      }
    }

    const primaryDatabaseName = databaseNames[0];
    if (!primaryDatabaseName) {
      throw new Error("Integration database name was not generated.");
    }
    testPool = new Pool({
      connectionString: databaseUrlFor(primaryDatabaseName),
      max: 5,
    });
    const testDb = drizzle(testPool, {
      schema: { identityLinks, tenantMemberships, tenants, users },
    });

    const [tenantA] = await testDb
      .insert(tenants)
      .values({
        name: "Tenant A",
        slug: `tenant-a-${randomUUID().slice(0, 8)}`,
      })
      .returning({ id: tenants.id });
    const [tenantB] = await testDb
      .insert(tenants)
      .values({
        name: "Tenant B",
        slug: `tenant-b-${randomUUID().slice(0, 8)}`,
      })
      .returning({ id: tenants.id });
    const [ownerA] = await testDb
      .insert(users)
      .values({})
      .returning({ id: users.id });
    const [ownerB] = await testDb
      .insert(users)
      .values({})
      .returning({ id: users.id });
    if (!tenantA || !tenantB || !ownerA || !ownerB) {
      throw new Error("Failed to create tenancy integration fixtures.");
    }

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;

    const membershipRows = await testDb
      .insert(tenantMemberships)
      .values([
        {
          tenantId: tenantAId,
          userId: ownerAId,
          role: "owner",
          status: "active",
        },
        {
          tenantId: tenantBId,
          userId: ownerBId,
          role: "owner",
          status: "active",
        },
        {
          tenantId: tenantBId,
          userId: ownerAId,
          role: "member",
          status: "active",
        },
      ])
      .returning({
        id: tenantMemberships.id,
        tenantId: tenantMemberships.tenantId,
      });
    const membershipA = membershipRows.find(
      (row) => row.tenantId === tenantAId,
    );
    const membershipB = membershipRows.find(
      (row) => row.tenantId === tenantBId,
    );
    if (!membershipA || !membershipB) {
      throw new Error(
        "Failed to create tenant membership integration fixtures.",
      );
    }
    membershipAId = membershipA.id;
    membershipBId = membershipB.id;

    await testDb.insert(identityLinks).values({
      userId: ownerAId,
      provider: "test-provider",
      subject: "owner-a-subject",
    });

    dataAccess = createTenantDataAccess({
      connectionString: databaseUrlFor(primaryDatabaseName),
    });
    const resolvedA = await dataAccess.resolveTenantContext(
      ownerAId,
      tenantAId,
    );
    const resolvedB = await dataAccess.resolveTenantContext(
      ownerBId,
      tenantBId,
    );
    const resolvedMember = await dataAccess.resolveTenantContext(
      ownerAId,
      tenantBId,
    );
    if (!resolvedA || !resolvedB || !resolvedMember) {
      throw new Error(
        "Active membership did not produce a server tenant context.",
      );
    }

    contextA = resolvedA;
    contextB = resolvedB;
    contextAInB = resolvedMember;
  }, 120_000);

  afterAll(async () => {
    await dataAccess?.close();
    await testPool?.end();

    if (adminPool) {
      for (const databaseName of databaseNames) {
        await adminPool.query(
          `DROP DATABASE IF EXISTS ${quoteGeneratedIdentifier(databaseName)} WITH (FORCE)`,
        );
      }
      await adminPool.end();
    }
  }, 120_000);

  it("applies versioned migrations to separate empty databases and is repeatable", async () => {
    expect(databaseNames).toHaveLength(2);
    for (const databaseName of databaseNames) {
      const pool = new Pool({
        connectionString: databaseUrlFor(databaseName),
        max: 1,
      });
      try {
        const result = await pool.query<{ table_name: string }>(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)",
          [["tenants", "users", "identity_links", "tenant_memberships"]],
        );
        expect(result.rows.map((row) => row.table_name).sort()).toEqual(
          ["identity_links", "tenant_memberships", "tenants", "users"].sort(),
        );
        const timestampColumns = await pool.query<{
          column_name: string;
          data_type: string;
        }>(
          "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1) AND column_name IN ('created_at', 'updated_at')",
          [["tenants", "users", "identity_links", "tenant_memberships"]],
        );
        expect(timestampColumns.rows).toHaveLength(6);
        expect(
          timestampColumns.rows.every(
            (column) => column.data_type === "timestamp with time zone",
          ),
        ).toBe(true);
      } finally {
        await pool.end();
      }
    }
  });

  it("keeps reads and writes bound to the resolved tenant context", async () => {
    expect(
      await getDataAccess().resolveTenantContext(ownerAId, tenantBId),
    ).toMatchObject({
      userId: ownerAId,
      tenantId: tenantBId,
      role: "member",
    });
    expect(
      await getDataAccess().resolveTenantContext(ownerBId, tenantAId),
    ).toBeNull();

    const tenantA = await getDataAccess().tenants.getCurrent(contextA);
    const tenantB = await getDataAccess().tenants.getCurrent(contextB);
    expect(tenantA).toMatchObject({
      id: tenantAId,
      name: "Tenant A",
      status: "active",
    });
    expect(tenantB).toMatchObject({
      id: tenantBId,
      name: "Tenant B",
      status: "active",
    });

    const membershipsA = await getDataAccess().memberships.list(contextA);
    expect(membershipsA.map((membership) => membership.id)).toEqual([
      membershipAId,
    ]);
    expect(
      await getDataAccess().memberships.findById(contextA, membershipBId),
    ).toBeNull();

    const changedA = await getDataAccess().tenants.renameCurrent(
      contextA,
      "Tenant A renamed",
    );
    expect(changedA?.name).toBe("Tenant A renamed");
    expect(
      await getDataAccess().tenants.renameCurrent(
        contextAInB,
        "Unauthorized rename",
      ),
    ).toBeNull();

    const databaseState = await getTestPool().query<{
      id: string;
      name: string;
    }>("SELECT id, name FROM tenants WHERE id = ANY($1::uuid[]) ORDER BY id", [
      [tenantAId, tenantBId],
    ]);
    expect(
      databaseState.rows.find((tenant) => tenant.id === tenantAId)?.name,
    ).toBe("Tenant A renamed");
    expect(
      databaseState.rows.find((tenant) => tenant.id === tenantBId)?.name,
    ).toBe("Tenant B");

    const forgedContext = JSON.parse(JSON.stringify(contextA)) as TenantContext;
    await expect(
      getDataAccess().tenants.getCurrent(forgedContext),
    ).rejects.toBeInstanceOf(InvalidTenantContextError);
    const forgedTenantSelector = {
      userId: ownerAId,
      tenantId: tenantBId,
      role: "owner",
    } as unknown as TenantContext;
    await expect(
      getDataAccess().memberships.list(forgedTenantSelector),
    ).rejects.toBeInstanceOf(InvalidTenantContextError);
  });

  it("enforces unique keys, enum domains, foreign keys and delete cascades", async () => {
    const duplicateSlug = `duplicate-${randomUUID().slice(0, 8)}`;
    await getTestPool().query(
      "INSERT INTO tenants (name, slug) VALUES ($1, $2)",
      ["One", duplicateSlug],
    );
    await expect(
      getTestPool().query("INSERT INTO tenants (name, slug) VALUES ($1, $2)", [
        "Two",
        duplicateSlug,
      ]),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      getTestPool().query("INSERT INTO tenants (name, slug) VALUES ($1, $2)", [
        "Invalid slug",
        `Upper-${randomUUID().slice(0, 8)}`,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      getTestPool().query("INSERT INTO tenants (name, slug) VALUES ($1, $2)", [
        "   ",
        `blank-name-${randomUUID().slice(0, 8)}`,
      ]),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      getTestPool().query(
        "INSERT INTO identity_links (user_id, provider, subject) VALUES ($1, $2, $3)",
        [ownerAId, "test-provider", "owner-a-subject"],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      getTestPool().query(
        "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1, $2, $3, $4)",
        [tenantAId, ownerAId, "owner", "active"],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      getTestPool().query(
        "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1, $2, $3, $4)",
        [tenantAId, randomUUID(), "platform_admin", "active"],
      ),
    ).rejects.toMatchObject({ code: "22P02" });
    await expect(
      getTestPool().query(
        "INSERT INTO identity_links (user_id, provider, subject) VALUES ($1, $2, $3)",
        [randomUUID(), "test-provider", "missing-user"],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      getTestPool().query(
        "INSERT INTO identity_links (user_id, provider, subject) VALUES ($1, $2, $3)",
        [ownerAId, "invalid provider", "bad-provider"],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      getTestPool().query(
        "INSERT INTO identity_links (user_id, provider, subject) VALUES ($1, $2, $3)",
        [ownerAId, "test-provider", "   "],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const temporaryUserResult = await getTestPool().query<{ id: string }>(
      "INSERT INTO users DEFAULT VALUES RETURNING id",
    );
    const temporaryUser = temporaryUserResult.rows[0];
    if (!temporaryUser) {
      throw new Error("Failed to create cascade integration fixture.");
    }
    await getTestPool().query(
      "INSERT INTO identity_links (user_id, provider, subject) VALUES ($1, $2, $3)",
      [temporaryUser.id, "test-provider", "cascade-subject"],
    );
    await getTestPool().query(
      "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1, $2, $3, $4)",
      [tenantAId, temporaryUser.id, "member", "active"],
    );
    await getTestPool().query("DELETE FROM users WHERE id = $1", [
      temporaryUser.id,
    ]);
    expect(
      (await databaseRows(getTestPool(), "identity_links", temporaryUser.id))
        .rowCount,
    ).toBe(0);
    expect(
      (
        await databaseRows(
          getTestPool(),
          "tenant_memberships",
          temporaryUser.id,
        )
      ).rowCount,
    ).toBe(0);

    await getTestPool().query("DELETE FROM tenants WHERE id = $1", [tenantBId]);
    const tenantBMemberships = await getTestPool().query(
      "SELECT id FROM tenant_memberships WHERE tenant_id = $1",
      [tenantBId],
    );
    expect(tenantBMemberships.rowCount).toBe(0);
    expect(await getDataAccess().tenants.getCurrent(contextB)).toBeNull();
  });

  it("fails closed on membership revocation for an already-issued context", async () => {
    await getTestPool().query("DELETE FROM tenant_memberships WHERE id = $1", [
      membershipAId,
    ]);
    expect(await getDataAccess().tenants.getCurrent(contextA)).toBeNull();
    expect(await getDataAccess().memberships.list(contextA)).toEqual([]);
    expect(
      await getDataAccess().tenants.renameCurrent(
        contextA,
        "Should not persist",
      ),
    ).toBeNull();
  });
});
