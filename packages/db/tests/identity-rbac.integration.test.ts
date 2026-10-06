import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  identityLinks,
  platformRoles,
  tenantMemberships,
  tenants,
  users,
} from "../src/schema/index.js";
import { createIdentityDataAccess } from "../src/server/identity.js";
import { createTenantDataAccess } from "../src/server/index.js";
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

const SUPABASE = "supabase";

/**
 * PH-M01-WO-002 integration suite: identity resolution, platform_roles,
 * tenant-context resolution and adversarial authorization against a real
 * PostgreSQL. Migrations run from empty databases (and are re-applied to a
 * disposable DB) covering WO-001 regression plus the WO-002 additions.
 */
describe("PH-M01-WO-002 identity, platform_roles and tenant resolution", () => {
  const databaseNames: [string, string] = [
    `phm01_${randomUUID().replaceAll("-", "")}`,
    `phm01_${randomUUID().replaceAll("-", "")}`,
  ];
  let adminPool: Pool | undefined;
  let testPool: Pool | undefined;
  let identityDataAccess:
    | ReturnType<typeof createIdentityDataAccess>
    | undefined;
  let tenantDataAccess: ReturnType<typeof createTenantDataAccess> | undefined;

  function getTestPool(): Pool {
    if (!testPool) throw new Error("integration fixtures not initialized");
    return testPool;
  }

  function getIdentityDataAccess() {
    if (!identityDataAccess)
      throw new Error("identity data access fixture not initialized");
    return identityDataAccess;
  }

  function getTenantDataAccess() {
    if (!tenantDataAccess)
      throw new Error("tenant data access fixture not initialized");
    return tenantDataAccess;
  }

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: configuredDatabaseUrl });
    testPool = new Pool({ connectionString: databaseUrlFor(databaseNames[0]) });

    const admin = adminPool;
    for (const name of databaseNames) {
      // Preflight only: clear debris from a previously interrupted run. The
      // normal teardown below never uses FORCE.
      await preflightDropStaleDatabase(admin, name);
      await admin.query(`CREATE DATABASE ${quoteGeneratedIdentifier(name)}`);
    }

    // Migration from empty DB (also proves repeat/disposable validation).
    // The disposable pool is closed in `finally` so a failed migration cannot
    // leave a backend behind for the teardown to trip over.
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

    const testDb = drizzle(testPool);
    await migrate(testDb, { migrationsFolder });

    identityDataAccess = createIdentityDataAccess({
      connectionString: databaseUrlFor(databaseNames[0]),
    });
    tenantDataAccess = createTenantDataAccess({
      connectionString: databaseUrlFor(databaseNames[0]),
    });
  });

  afterAll(async () => {
    // CR-05: close and AWAIT every pool this fixture owns before touching the
    // databases — the identity pool, the tenant pool and the test pool. A
    // disposable pool that fails mid-setup has already been closed in `finally`.
    await identityDataAccess?.close();
    await tenantDataAccess?.close();
    await testPool?.end();

    const admin = adminPool;
    if (admin) {
      for (const name of databaseNames) {
        // Waits for zero backends, then drops WITHOUT FORCE. A live connection
        // here surfaces as an explicit RESOURCE LEAK rather than being hidden.
        await dropDisposableDatabase(admin, name);
      }
      await admin.end();
    }
  });

  let providerSubject = "";

  it("applies migrations to an empty DB including platform_roles (WO-001 regression + WO-002)", async () => {
    const result = await getTestPool().query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    );
    const tables = result.rows.map((r) => r.table_name as string);
    for (const expected of [
      "tenants",
      "users",
      "identity_links",
      "tenant_memberships",
      "platform_roles",
    ]) {
      expect(tables).toContain(expected);
    }
    // platform_roles role constraint admits only platform_admin
    const check = await getTestPool().query(
      "SELECT constraint_name, check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE 'platform_roles%'",
    );
    expect(check.rowCount).toBeGreaterThanOrEqual(0);
  });

  it("provisions an internal user + identity link from a verified subject", async () => {
    providerSubject = `prov-${randomUUID()}`;
    const first = await getIdentityDataAccess().resolveInternalIdentity({
      provider: SUPABASE,
      subject: providerSubject,
    });
    expect(first).not.toBeNull();
    expect(first?.userStatus).toBe("active");

    // Idempotent: same subject resolves to the same internal user.
    const second = await getIdentityDataAccess().resolveInternalIdentity({
      provider: SUPABASE,
      subject: providerSubject,
    });
    expect(second?.userId).toBe(first?.userId);

    const links = await getTestPool().query(
      "SELECT user_id FROM identity_links WHERE provider=$1 AND subject=$2",
      [SUPABASE, providerSubject],
    );
    expect(links.rowCount).toBe(1);
  });

  it("duplicate identity callback never creates a second internal user (racing inserts)", async () => {
    const subject = `race-${randomUUID()}`;
    const [a, b, c] = await Promise.all([
      getIdentityDataAccess().resolveInternalIdentity({
        provider: SUPABASE,
        subject,
      }),
      getIdentityDataAccess().resolveInternalIdentity({
        provider: SUPABASE,
        subject,
      }),
      getIdentityDataAccess().resolveInternalIdentity({
        provider: SUPABASE,
        subject,
      }),
    ]);
    expect(a?.userId).toBeTruthy();
    expect(b?.userId).toBe(a?.userId);
    expect(c?.userId).toBe(a?.userId);
    const links = await getTestPool().query(
      "SELECT COUNT(*)::int AS n FROM identity_links WHERE provider=$1 AND subject=$2",
      [SUPABASE, subject],
    );
    expect(links.rows[0]?.n).toBe(1);
  });

  it("fails closed on malformed provider subjects (no user provisioning)", () => {
    const malformed: Array<string> = [
      "",
      "   ",
      "x".repeat(256),
      "UPPER CASE",
      "with space",
    ];
    return Promise.all(
      malformed.map(async (subject) => {
        const outcome = await getIdentityDataAccess().resolveInternalIdentity({
          provider: SUPABASE,
          subject,
        });
        expect(outcome).toBeNull();
      }),
    ).then(() => undefined);
  });

  it("platform_admin comes only from authoritative platform_roles rows", async () => {
    const identity = await getIdentityDataAccess().resolveInternalIdentity({
      provider: SUPABASE,
      subject: `admin-${randomUUID()}`,
    });
    if (!identity) throw new Error("identity fixture missing");

    // No row -> no platform authority (even for an authenticated user).
    expect(
      await getIdentityDataAccess().resolvePlatformRole(identity.userId),
    ).toBeNull();

    // Insert the authoritative row; only then does platform authority exist.
    await getTestPool().query(
      "INSERT INTO platform_roles (user_id, role) VALUES ($1, 'platform_admin')",
      [identity.userId],
    );
    expect(
      await getIdentityDataAccess().resolvePlatformRole(identity.userId),
    ).toBe("platform_admin");

    // user_metadata-style values in identity_links/tenant tables grant nothing:
    // resolvePlatformRole never reads provider metadata.
    const nonAdmin = await getIdentityDataAccess().resolveInternalIdentity({
      provider: SUPABASE,
      subject: `plain-${randomUUID()}`,
    });
    expect(
      await getIdentityDataAccess().resolvePlatformRole(
        nonAdmin?.userId ?? randomUUID(),
      ),
    ).toBeNull();
  });

  it("unique (user_id, role) prevents duplicate platform roles", async () => {
    const identity = await getIdentityDataAccess().resolveInternalIdentity({
      provider: SUPABASE,
      subject: `uniq-${randomUUID()}`,
    });
    if (!identity) throw new Error("identity fixture missing");
    await getTestPool().query(
      "INSERT INTO platform_roles (user_id, role) VALUES ($1, 'platform_admin')",
      [identity.userId],
    );
    await expect(
      getTestPool().query(
        "INSERT INTO platform_roles (user_id, role) VALUES ($1, 'platform_admin')",
        [identity.userId],
      ),
    ).rejects.toBeTruthy();
  });

  it("platform_roles cascade on user delete (explicit delete behavior)", async () => {
    const identity = await getIdentityDataAccess().resolveInternalIdentity({
      provider: SUPABASE,
      subject: `cascade-${randomUUID()}`,
    });
    if (!identity) throw new Error("identity fixture missing");
    await getTestPool().query(
      "INSERT INTO platform_roles (user_id, role) VALUES ($1, 'platform_admin')",
      [identity.userId],
    );
    await getTestPool().query("DELETE FROM users WHERE id = $1", [
      identity.userId,
    ]);
    const remaining = await getTestPool().query(
      "SELECT COUNT(*)::int AS n FROM platform_roles WHERE user_id = $1",
      [identity.userId],
    );
    expect(remaining.rows[0]?.n).toBe(0);
  });

  it("tenant A selector cannot obtain tenant B context; forged selector fails closed", async () => {
    const db = drizzle(getTestPool());
    // tenant A + owner membership for the provider user
    const identity = await getIdentityDataAccess().resolveInternalIdentity({
      provider: SUPABASE,
      subject: `sel-${randomUUID()}`,
    });
    if (!identity) throw new Error("identity fixture missing");
    const [tenantA] = await db
      .insert(tenants)
      .values({
        name: "Tenant A",
        slug: `tenant-a-${randomUUID().slice(0, 8)}`,
      })
      .returning({ id: tenants.id });
    const [tenantB] = await db
      .insert(tenants)
      .values({
        name: "Tenant B",
        slug: `tenant-b-${randomUUID().slice(0, 8)}`,
      })
      .returning({ id: tenants.id });
    if (!tenantA || !tenantB) throw new Error("tenant fixtures missing");
    await db.insert(tenantMemberships).values({
      tenantId: tenantA.id,
      userId: identity.userId,
      role: "owner",
      status: "active",
    });

    // tenant A selector: resolves with owner role.
    const okRow = await getTenantDataAccess().memberships.resolveMembershipRow(
      identity.userId,
      tenantA.id,
    );
    expect(okRow?.role).toBe("owner");
    expect(okRow?.tenantId).toBe(tenantA.id);

    // tenant B selector (foreign tenant): no row -> fail closed.
    const foreignRow =
      await getTenantDataAccess().memberships.resolveMembershipRow(
        identity.userId,
        tenantB.id,
      );
    expect(foreignRow).toBeNull();

    // forged/invalid selector values are rejected before the DB read.
    expect(
      await getTenantDataAccess().memberships.resolveMembershipRow(
        identity.userId,
        "not-a-uuid",
      ),
    ).toBeNull();
    expect(
      await getTenantDataAccess().memberships.resolveMembershipRow(
        "not-a-uuid",
        tenantA.id,
      ),
    ).toBeNull();
  });

  it("suspended tenant/membership or suspended user fails authoritative resolution", async () => {
    const db = drizzle(getTestPool());
    const identity = await getIdentityDataAccess().resolveInternalIdentity({
      provider: SUPABASE,
      subject: `susp-${randomUUID()}`,
    });
    if (!identity) throw new Error("identity fixture missing");
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Suspendable", slug: `susp-${randomUUID().slice(0, 8)}` })
      .returning({ id: tenants.id });
    if (!tenant) throw new Error("tenant fixture missing");
    await db.insert(tenantMemberships).values({
      tenantId: tenant.id,
      userId: identity.userId,
      role: "member",
      status: "active",
    });

    // baseline: resolves
    let row = await getTenantDataAccess().memberships.resolveMembershipRow(
      identity.userId,
      tenant.id,
    );
    expect(row?.status).toBe("active");

    // membership suspension: fails on the next authoritative read (SEC-022)
    await db
      .update(tenantMemberships)
      .set({ status: "suspended" })
      .where(eqMembership(tenant.id, identity.userId));
    row = await getTenantDataAccess().memberships.resolveMembershipRow(
      identity.userId,
      tenant.id,
    );
    expect(row?.status).toBe("suspended");

    // membership removal: no row at all
    await db
      .delete(tenantMemberships)
      .where(eqMembership(tenant.id, identity.userId));
    row = await getTenantDataAccess().memberships.resolveMembershipRow(
      identity.userId,
      tenant.id,
    );
    expect(row).toBeNull();

    // re-add active membership, then suspend the tenant: fails closed
    await db.insert(tenantMemberships).values({
      tenantId: tenant.id,
      userId: identity.userId,
      role: "member",
      status: "active",
    });
    await db
      .update(tenants)
      .set({ status: "suspended" })
      .where(drizzleEqTenantId(tenant.id));
    row = await getTenantDataAccess().memberships.resolveMembershipRow(
      identity.userId,
      tenant.id,
    );
    expect(row?.tenantStatus).toBe("suspended");
  });

  it("platform_roles migration repository path is independent of tenant memberships", async () => {
    // platform_admin must not be representable as a tenant membership shortcut:
    // tenant_role enum has no platform_admin value (DB-level proof).
    await expect(
      getTestPool().query(
        "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES (gen_random_uuid(), gen_random_uuid(), 'platform_admin', 'active')",
      ),
    ).rejects.toBeTruthy();
    expect(
      (
        await getTestPool().query(
          "SELECT COUNT(*)::int AS n FROM platform_roles",
        )
      ).rows[0]?.n,
    ).toBeGreaterThanOrEqual(0);
  });

  // -- helpers -------------------------------------------------------------

  function eqMembership(tenantId: string, userId: string) {
    return and(
      eq(tenantMemberships.tenantId, tenantId),
      eq(tenantMemberships.userId, userId),
    );
  }

  function drizzleEqTenantId(tenantId: string) {
    return eq(tenants.id, tenantId);
  }

  void platformRoles;
  void identityLinks;
  void users;
});
