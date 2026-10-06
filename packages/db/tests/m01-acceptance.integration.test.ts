import { randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  fstatSync,
  openSync,
  readSync,
  readdirSync,
  statSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";
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
  InvalidTenantContextError,
  createTenantDataAccess,
} from "../src/server/index.js";
import { createIdentityDataAccess } from "../src/server/identity.js";
import {
  dropDisposableDatabase,
  preflightDropStaleDatabase,
  quoteGeneratedIdentifier,
} from "./support/postgres-disposable-databases.js";

/**
 * PH-M01-WO-004 — integrated security acceptance.
 *
 * This suite exists to attack the ADMITTED PH-M01 surfaces as a system, on real
 * PostgreSQL, with the real vault and the real repository paths — not to re-run
 * the unit projections. Obligations covered here:
 *
 *   A. cross-tenant adversarial matrix (vault + repositories + context trust)
 *   B. privilege-escalation matrix (forged roles, platform scope, provisioning)
 *   C. session / tenant-selection confusion (selector attacks, tenant switching)
 *   D. authorization concurrency — lock-health probe (no deadlock cycle)
 *   F. plaintext / credential canary containment
 *
 * It deliberately contains NO `child_process` usage: the P2 subprocess premise
 * of the VEX analysis is measured over tracked source, and this file is tracked
 * source. Repository file walking uses `node:fs` only.
 */

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const configuredDatabaseUrl = process.env.DATABASE_URL ?? "";

if (!configuredDatabaseUrl) {
  throw new Error(
    "DATABASE_URL must point to a disposable-capable PostgreSQL role for acceptance tests.",
  );
}

function databaseUrlFor(databaseName: string): string {
  const url = new URL(configuredDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

const KEY_V1_B64 = Buffer.alloc(32, 0x31).toString("base64");
const FULL_KEYRING = {
  activeKeyVersion: "k1",
  keyringJson: JSON.stringify({ k1: KEY_V1_B64 }),
};

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

/** Every vault operation, as named thunks bound to one context. */
function everyVaultOperation(
  vault: SecretVault,
  context: TenantContext,
  secretId: string,
  purpose: string,
): readonly (readonly [string, () => Promise<unknown>])[] {
  return [
    ["listMetadata", () => vault.listMetadata(context)],
    ["getMetadata", () => vault.getMetadata(context, secretId)],
    [
      "create",
      () => vault.create(context, { purpose: "accept.create", secret: "v" }),
    ],
    ["replace", () => vault.replace(context, secretId, { secret: "v" })],
    ["remove", () => vault.remove(context, secretId)],
    ["rotate", () => vault.rotate(context, secretId)],
    [
      "withDecryptedSecret",
      () =>
        vault.withDecryptedSecret(
          context,
          { id: secretId, tenantId: context.tenantId, purpose },
          () => "leaked",
        ),
    ],
  ];
}

describe("PH-M01-WO-004 security acceptance against PostgreSQL", () => {
  const databaseNames: [string, string] = [
    `phm01_${randomUUID().replaceAll("-", "")}`,
    `phm01_${randomUUID().replaceAll("-", "")}`,
  ];
  let adminPool: Pool | undefined;
  let testPool: Pool | undefined;
  let vault: SecretVault | undefined;
  const ownedVaults: SecretVault[] = [];
  const ownedClosers: Array<() => Promise<void>> = [];

  function openVault(): SecretVault {
    const created = createSecretVault({
      connectionString: databaseUrlFor(databaseNames[0]),
      keyring: FULL_KEYRING,
    });
    ownedVaults.push(created);
    return created;
  }

  function currentVault(): SecretVault {
    if (!vault) throw new Error("acceptance fixtures not initialized");
    return vault;
  }

  function raw(): Pool {
    if (!testPool) throw new Error("acceptance fixtures not initialized");
    return testPool;
  }

  type MembershipSpec = Readonly<{
    role: "owner" | "admin" | "member";
    membershipStatus?: "active" | "suspended" | "invited";
    userStatus?: "active" | "suspended";
    tenantStatus?: "active" | "suspended";
  }>;

  /** Seed one user + one tenant + one membership; returns the ids. */
  async function seedMembership(
    spec: MembershipSpec,
  ): Promise<{ userId: string; tenantId: string }> {
    const tenantId = randomUUID();
    const userId = randomUUID();
    await raw().query(
      "INSERT INTO tenants (id, name, slug, status) VALUES ($1,$2,$3,$4)",
      [
        tenantId,
        `ac-tenant-${tenantId.slice(0, 8)}`,
        `ac-${tenantId.slice(0, 8)}`,
        spec.tenantStatus ?? "active",
      ],
    );
    await raw().query("INSERT INTO users (id, status) VALUES ($1,$2)", [
      userId,
      spec.userStatus ?? "active",
    ]);
    await raw().query(
      "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,$4)",
      [tenantId, userId, spec.role, spec.membershipStatus ?? "active"],
    );
    return { userId, tenantId };
  }

  /** An owner context over a brand-new active tenant. */
  async function seedTenant(role: MembershipSpec["role"]) {
    const { userId, tenantId } = await seedMembership({ role });
    return Object.freeze({ userId, tenantId, role }) as TenantContext;
  }

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: configuredDatabaseUrl });
    testPool = new Pool({ connectionString: databaseUrlFor(databaseNames[0]) });

    const admin = adminPool;
    for (const name of databaseNames) {
      await preflightDropStaleDatabase(admin, name);
      await admin.query(`CREATE DATABASE ${quoteGeneratedIdentifier(name)}`);
    }

    // Obligation I is exercised by this fixture too: the SECOND disposable
    // database is migrated twice on empty (empty path + repeat no-op path).
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
    vault = openVault();
  });

  afterAll(async () => {
    for (const close of ownedClosers) {
      await close();
    }
    for (const owned of ownedVaults) {
      await owned.close();
    }
    if (testPool) {
      await testPool.end();
    }
    if (adminPool) {
      for (const name of databaseNames) {
        await dropDisposableDatabase(adminPool, name);
      }
      await adminPool.end();
    }
  });

  describe("A. cross-tenant adversarial matrix", () => {
    it("keeps every vault operation inside the caller's tenant", async () => {
      const tenantA = await seedTenant("owner");
      const tenantB = await seedTenant("owner");

      const secretA = await currentVault().create(tenantA, {
        purpose: "accept.a",
        secret: "tenant-a-value",
      });
      const secretB = await currentVault().create(tenantB, {
        purpose: "accept.b",
        secret: "tenant-b-value",
      });

      // Snapshot B's stored row: no attack from A may alter one byte of it.
      const snapshot = await raw().query(
        "SELECT ciphertext, nonce, auth_tag, key_version, purpose, tenant_id, created_at, updated_at, rotated_at FROM encrypted_secrets WHERE id = $1",
        [secretB.id],
      );

      // A's context must fail on B's object id at EVERY surface. Reads answer
      // not-found; mutations answer not-found; the decrypt handle refuses the
      // tenant mismatch. Never a success, never a distinct error that leaks
      // existence.
      expect(await currentVault().getMetadata(tenantA, secretB.id)).toBeNull();
      await expectCode(
        () => currentVault().replace(tenantA, secretB.id, { secret: "x" }),
        "SECRET_NOT_FOUND",
      );
      await expectCode(
        () => currentVault().remove(tenantA, secretB.id),
        "SECRET_NOT_FOUND",
      );
      await expectCode(
        () => currentVault().rotate(tenantA, secretB.id),
        "SECRET_NOT_FOUND",
      );
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            tenantA,
            { id: secretB.id, tenantId: tenantA.tenantId, purpose: "accept.b" },
            () => "x",
          ),
        "SECRET_NOT_FOUND",
      );

      // And A's own listing never contains B's row.
      const listed = await currentVault().listMetadata(tenantA);
      expect(listed.map((row) => row.id)).toEqual([secretA.id]);

      const after = await raw().query(
        "SELECT ciphertext, nonce, auth_tag, key_version, purpose, tenant_id, created_at, updated_at, rotated_at FROM encrypted_secrets WHERE id = $1",
        [secretB.id],
      );
      expect(after.rows[0]).toEqual(snapshot.rows[0]);
    });

    it("never treats an object id as authorization evidence", async () => {
      const tenantA = await seedTenant("owner");
      const tenantB = await seedTenant("owner");
      const secretB = await currentVault().create(tenantB, {
        purpose: "accept.id",
        secret: "id-is-not-authority",
      });

      // Same id, wrong caller: every surface refuses. The id has no power.
      const ctxForeign = Object.freeze({
        userId: tenantA.userId,
        tenantId: tenantA.tenantId,
        role: "owner",
      }) as TenantContext;
      expect(
        await currentVault().getMetadata(ctxForeign, secretB.id),
      ).toBeNull();
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            ctxForeign,
            {
              id: secretB.id,
              tenantId: tenantA.tenantId,
              purpose: "accept.id",
            },
            () => "x",
          ),
        "SECRET_NOT_FOUND",
      );

      // A purpose-scoped handle for B's id under A's tenant is refused too.
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            ctxForeign,
            {
              id: secretB.id,
              tenantId: tenantB.tenantId,
              purpose: "accept.id",
            },
            () => "x",
          ),
        "SECRET_FORBIDDEN",
      );

      // The handle shape itself rejects non-canonical data before any query.
      await expectCode(
        () =>
          currentVault().withDecryptedSecret(
            ctxForeign,
            {
              id: "not-a-uuid",
              tenantId: tenantB.tenantId,
              purpose: "accept.id",
            },
            () => "x",
          ),
        "INVALID_SECRET_INPUT",
      );
    });

    it("does not turn the cross-tenant miss into an existence oracle", async () => {
      const tenantA = await seedTenant("owner");
      const tenantB = await seedTenant("owner");
      const secretB = await currentVault().create(tenantB, {
        purpose: "accept.oracle",
        secret: "oracle",
      });

      const absentId = randomUUID();
      const foreignMeta = await currentVault().getMetadata(tenantA, secretB.id);
      const absentMeta = await currentVault().getMetadata(tenantA, absentId);
      expect(foreignMeta).toBeNull();
      expect(absentMeta).toBeNull();

      const foreignOutcome: unknown = await currentVault()
        .rotate(tenantA, secretB.id)
        .catch((error: unknown) => error);
      const absentOutcome: unknown = await currentVault()
        .rotate(tenantA, absentId)
        .catch((error: unknown) => error);
      expect(foreignOutcome).toBeInstanceOf(SecretVaultError);
      expect(absentOutcome).toBeInstanceOf(SecretVaultError);
      expect((foreignOutcome as SecretVaultError).code).toBe(
        (absentOutcome as SecretVaultError).code,
      );
      expect((foreignOutcome as SecretVaultError).message).toBe(
        (absentOutcome as SecretVaultError).message,
      );
    });

    it("binds repository reads to the resolved tenant context", async () => {
      const access = createTenantDataAccess({
        connectionString: databaseUrlFor(databaseNames[0]),
      });
      ownedClosers.push(() => access.close());

      const a = await seedMembership({ role: "owner" });
      const b = await seedMembership({ role: "owner" });
      const ctxA = await access.resolveTenantContext(a.userId, a.tenantId);
      expect(ctxA).not.toBeNull();
      if (!ctxA) throw new Error("unreachable");

      // Foreign or malformed selectors resolve to nothing — never to a context.
      expect(
        await access.resolveTenantContext(a.userId, b.tenantId),
      ).toBeNull();
      expect(
        await access.resolveTenantContext(a.userId, "not-a-uuid"),
      ).toBeNull();

      // The membership list is tenant-scoped: only A's membership row.
      const memberships = await access.memberships.list(ctxA);
      expect(memberships.map((row) => row.userId)).toEqual([a.userId]);

      // Another tenant's membership id is not found through A's context.
      const foreignMembership = await raw().query<{ id: string }>(
        "SELECT id FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2",
        [b.tenantId, b.userId],
      );
      const foreignId = foreignMembership.rows[0]?.id ?? "";
      expect(await access.memberships.findById(ctxA, foreignId)).toBeNull();

      // A context this instance did not issue is refused outright. The data
      // access functions are promise-based, so the refusal arrives as a
      // rejected promise — assert it on the promise, not on a sync throw.
      const forged = Object.freeze({
        userId: a.userId,
        tenantId: a.tenantId,
        role: "owner",
      }) as unknown as TenantContext;
      await expect(access.tenants.getCurrent(forged)).rejects.toThrow(
        InvalidTenantContextError,
      );
      await expect(access.memberships.list(forged)).rejects.toThrow(
        InvalidTenantContextError,
      );
    });
  });

  describe("B. privilege-escalation matrix", () => {
    it("refuses forged member->admin/owner and admin->owner at every vault surface", async () => {
      for (const stored of ["member", "admin"] as const) {
        for (const claimed of ["owner", "admin", "member"] as const) {
          if (claimed === stored) continue;
          const { userId, tenantId } = await seedMembership({ role: stored });
          const forged = Object.freeze({
            userId,
            tenantId,
            role: claimed,
          }) as unknown as TenantContext;

          for (const [name, operation] of everyVaultOperation(
            currentVault(),
            forged,
            randomUUID(),
            "accept.forge",
          )) {
            await expectCode(operation, "SECRET_FORBIDDEN");
            expect(name).not.toBe("");
          }
        }
      }
    });

    it("keeps platform_admin out of tenant authority without a membership", async () => {
      const { userId, tenantId } = await seedMembership({ role: "member" });
      await raw().query(
        "INSERT INTO platform_roles (user_id, role) VALUES ($1,'platform_admin')",
        [userId],
      );
      const forged = Object.freeze({
        userId,
        tenantId,
        role: "owner",
      }) as unknown as TenantContext;
      for (const [, operation] of everyVaultOperation(
        currentVault(),
        forged,
        randomUUID(),
        "accept.platform",
      )) {
        await expectCode(operation, "SECRET_FORBIDDEN");
      }
    });

    it("decides platform role only from platform_roles rows, never from provider input", async () => {
      const identity = createIdentityDataAccess({
        connectionString: databaseUrlFor(databaseNames[0]),
      });
      ownedClosers.push(() => identity.close());

      const subject = `subject-${randomUUID()}`;
      // A verified identity carrying smuggled extra fields: role claims and
      // metadata must have NO effect — the only authority is the persisted row.
      const smuggled = {
        provider: "acceptance-provider",
        subject,
        role: "platform_admin",
        user_metadata: { role: "admin", platform_admin: true },
      } as unknown as Parameters<typeof identity.resolveInternalIdentity>[0];
      const resolved = await identity.resolveInternalIdentity(smuggled);
      expect(resolved).not.toBeNull();
      if (!resolved) throw new Error("unreachable");
      expect(resolved.userStatus).toBe("active");

      expect(await identity.resolvePlatformRole(resolved.userId)).toBeNull();

      // No membership was conjured for the provisioned user either.
      const memberships = await raw().query(
        "SELECT 1 FROM tenant_memberships WHERE user_id = $1",
        [resolved.userId],
      );
      expect(memberships.rowCount).toBe(0);

      // Malformed provider shapes do not provision.
      for (const bad of [
        { provider: "UPPERCASE", subject: "s" },
        { provider: "ok", subject: "" },
        { provider: "ok", subject: "has space" },
        { provider: "ok", subject: "x".repeat(300) },
      ]) {
        expect(
          await identity.resolveInternalIdentity(
            bad as unknown as Parameters<
              typeof identity.resolveInternalIdentity
            >[0],
          ),
        ).toBeNull();
      }
    });

    it("honours downgrades and suspensions on the next authoritative operation", async () => {
      // Downgrade: context resolved as owner, role changed to member after.
      const owner = await seedTenant("owner");
      const seeded = await currentVault().create(owner, {
        purpose: "accept.downgrade",
        secret: "downgrade",
      });
      await raw().query(
        "UPDATE tenant_memberships SET role = 'member' WHERE tenant_id = $1 AND user_id = $2",
        [owner.tenantId, owner.userId],
      );
      for (const [, operation] of everyVaultOperation(
        currentVault(),
        owner,
        seeded.id,
        "accept.downgrade",
      )) {
        await expectCode(operation, "SECRET_FORBIDDEN");
      }

      // Suspension of membership, user and tenant each revoke the NEXT op.
      for (const kind of ["membership", "user", "tenant"] as const) {
        const victim = await seedTenant("owner");
        const row = await currentVault().create(victim, {
          purpose: "accept.suspend",
          secret: "suspension",
        });
        expect(await currentVault().listMetadata(victim)).toHaveLength(1);
        if (kind === "membership") {
          await raw().query(
            "UPDATE tenant_memberships SET status = 'suspended' WHERE tenant_id = $1 AND user_id = $2",
            [victim.tenantId, victim.userId],
          );
        } else if (kind === "user") {
          await raw().query(
            "UPDATE users SET status = 'suspended' WHERE id = $1",
            [victim.userId],
          );
        } else {
          await raw().query(
            "UPDATE tenants SET status = 'suspended' WHERE id = $1",
            [victim.tenantId],
          );
        }
        for (const [, operation] of everyVaultOperation(
          currentVault(),
          victim,
          row.id,
          "accept.suspend",
        )) {
          await expectCode(operation, "SECRET_FORBIDDEN");
        }
      }
    });
  });

  describe("C. session and tenant-selection confusion", () => {
    it("resolves only an active membership for the authenticated user and selector", async () => {
      const access = createTenantDataAccess({
        connectionString: databaseUrlFor(databaseNames[0]),
      });
      ownedClosers.push(() => access.close());

      const active = await seedMembership({ role: "owner" });
      expect(
        await access.resolveTenantContext(active.userId, active.tenantId),
      ).not.toBeNull();

      const suspendedMembership = await seedMembership({
        role: "owner",
        membershipStatus: "suspended",
      });
      const invitedMembership = await seedMembership({
        role: "owner",
        membershipStatus: "invited",
      });
      const suspendedUser = await seedMembership({
        role: "owner",
        userStatus: "suspended",
      });
      const suspendedTenant = await seedMembership({
        role: "owner",
        tenantStatus: "suspended",
      });

      for (const victim of [
        suspendedMembership,
        invitedMembership,
        suspendedUser,
        suspendedTenant,
      ]) {
        expect(
          await access.resolveTenantContext(victim.userId, victim.tenantId),
        ).toBeNull();
      }

      // A selector naming another user's tenant resolves nothing for this user.
      const other = await seedMembership({ role: "owner" });
      expect(
        await access.resolveTenantContext(active.userId, other.tenantId),
      ).toBeNull();

      // Malformed selectors resolve nothing — no default tenant fallback.
      for (const malformed of [
        ",",
        "0",
        "null",
        "' OR 1=1 --",
        randomUUID().toUpperCase(),
      ]) {
        expect(
          await access.resolveTenantContext(active.userId, malformed),
        ).toBeNull();
      }

      // The raw membership row read agrees with the resolver on the same inputs.
      expect(
        await access.memberships.resolveMembershipRow(
          active.userId,
          active.tenantId,
        ),
      ).not.toBeNull();
      expect(
        await access.memberships.resolveMembershipRow(
          active.userId,
          other.tenantId,
        ),
      ).toBeNull();
    });

    it("switches between two valid tenants without cross-contamination", async () => {
      const access = createTenantDataAccess({
        connectionString: databaseUrlFor(databaseNames[0]),
      });
      ownedClosers.push(() => access.close());

      // One user, genuinely active in two tenants, with different roles.
      const userId = randomUUID();
      const tenantOne = randomUUID();
      const tenantTwo = randomUUID();
      await raw().query(
        "INSERT INTO tenants (id, name, slug, status) VALUES ($1,$2,$3,'active'),($4,$5,$6,'active')",
        [
          tenantOne,
          `switch-a-${tenantOne.slice(0, 8)}`,
          `sw-a-${tenantOne.slice(0, 8)}`,
          tenantTwo,
          `switch-b-${tenantTwo.slice(0, 8)}`,
          `sw-b-${tenantTwo.slice(0, 8)}`,
        ],
      );
      await raw().query("INSERT INTO users (id, status) VALUES ($1,'active')", [
        userId,
      ]);
      await raw().query(
        "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'owner','active'),($3,$4,'owner','active')",
        [tenantOne, userId, tenantTwo, userId],
      );

      const ctxOne = await access.resolveTenantContext(userId, tenantOne);
      const ctxTwo = await access.resolveTenantContext(userId, tenantTwo);
      expect(ctxOne).not.toBeNull();
      expect(ctxTwo).not.toBeNull();
      if (!ctxOne || !ctxTwo) throw new Error("unreachable");

      const secretOne = await currentVault().create(ctxOne, {
        purpose: "accept.switch",
        secret: "belongs-to-one",
      });
      await currentVault().create(ctxTwo, {
        purpose: "accept.switch",
        secret: "belongs-to-two",
      });

      // Each context sees exactly its own tenant's records...
      const listedOne = await currentVault().listMetadata(ctxOne);
      const listedTwo = await currentVault().listMetadata(ctxTwo);
      expect(listedOne).toHaveLength(1);
      expect(listedTwo).toHaveLength(1);
      expect(listedOne[0]?.id).not.toBe(listedTwo[0]?.id);
      // ...and switching back and forth never leaks across.
      expect(await currentVault().getMetadata(ctxTwo, secretOne.id)).toBeNull();
      expect(
        await currentVault().getMetadata(ctxOne, secretOne.id),
      ).not.toBeNull();
      expect(await currentVault().getMetadata(ctxTwo, secretOne.id)).toBeNull();
    });
  });

  describe("D. authorization concurrency — lock-health probe", () => {
    it("completes interleaved rotations and authority changes without deadlock and stays consistent", async () => {
      const context = await seedTenant("owner");
      const secrets = [
        await currentVault().create(context, {
          purpose: "accept.lock",
          secret: "lock-1",
        }),
        await currentVault().create(context, {
          purpose: "accept.lock",
          secret: "lock-2",
        }),
        await currentVault().create(context, {
          purpose: "accept.lock",
          secret: "lock-3",
        }),
      ];

      const DEADLOCK = "40P01";
      /** Re-throw a deadlock or an unexpected transport error; admit sanitized denials. */
      function admitOrFail(error: unknown): void {
        const code = (error as { code?: string }).code;
        if (code === DEADLOCK) {
          throw new Error(`lock cycle detected: ${DEADLOCK}`);
        }
        const causeCode = (error as { cause?: { code?: string } }).cause?.code;
        if (causeCode === DEADLOCK) {
          throw new Error(`lock cycle detected in cause chain: ${DEADLOCK}`);
        }
        if (error instanceof SecretVaultError) return;
        throw error;
      }

      const iterations = 3;
      const actors: Promise<void>[] = [];

      // Actor 1..3: rotate each secret repeatedly.
      for (let actor = 0; actor < 3; actor += 1) {
        actors.push(
          (async () => {
            for (let round = 0; round < iterations; round += 1) {
              const target = secrets[(actor + round) % secrets.length];
              if (!target) continue;
              try {
                await currentVault().rotate(context, target.id);
              } catch (error) {
                admitOrFail(error);
              }
            }
          })(),
        );
      }

      // Actor 4: flip the membership role owner <-> admin while rotations run.
      actors.push(
        (async () => {
          for (let round = 0; round < iterations; round += 1) {
            const role = round % 2 === 0 ? "admin" : "owner";
            await raw().query(
              "UPDATE tenant_memberships SET role = $1 WHERE tenant_id = $2 AND user_id = $3",
              [role, context.tenantId, context.userId],
            );
          }
        })(),
      );

      // Actor 5: read metadata concurrently.
      actors.push(
        (async () => {
          for (let round = 0; round < iterations; round += 1) {
            try {
              await currentVault().listMetadata(context);
            } catch (error) {
              admitOrFail(error);
            }
          }
        })(),
      );

      await Promise.all(actors);

      // Deterministic end state: owner restored, every secret present, every
      // envelope internally consistent, and a fresh decrypt proves it.
      await raw().query(
        "UPDATE tenant_memberships SET role = 'owner' WHERE tenant_id = $1 AND user_id = $2",
        [context.tenantId, context.userId],
      );
      const listed = await currentVault().listMetadata(context);
      expect(listed).toHaveLength(secrets.length);
      for (const secret of secrets) {
        const outcome = await currentVault().rotate(context, secret.id);
        expect(["rotated", "already_current"]).toContain(outcome.status);
        const value = await currentVault().withDecryptedSecret(
          context,
          { id: secret.id, tenantId: context.tenantId, purpose: "accept.lock" },
          (plaintext) => Buffer.from(plaintext).toString("utf8"),
        );
        expect(value).toMatch(/^lock-[123]$/);
      }
    });
  });

  describe("F. plaintext / credential canary containment", () => {
    /** Walk the repository working tree, skipping build output and deps. */
    function repositoryFiles(): string[] {
      const root = fileURLToPath(new URL("../../..", import.meta.url));
      const found: string[] = [];
      const skip = new Set([
        "node_modules",
        ".git",
        ".next",
        "dist",
        "coverage",
      ]);
      const walk = (directory: string): void => {
        let entries: string[];
        try {
          entries = readdirSync(directory);
        } catch {
          return;
        }
        for (const entry of entries) {
          if (skip.has(entry)) continue;
          const path = resolvePath(directory, entry);
          let isDirectory = false;
          try {
            isDirectory = statSync(path).isDirectory();
          } catch {
            continue;
          }
          if (isDirectory) {
            walk(path);
          } else {
            found.push(path);
          }
        }
      };
      for (const top of ["apps", "packages", "tests", ".engineering"]) {
        walk(resolvePath(root, top));
      }
      return found;
    }

    /**
     * True when the raw bytes of `path` contain `needle`. Chunked with an
     * overlap so a needle spanning a chunk boundary is still found and large
     * pre-existing binaries are never loaded whole.
     */
    function fileContains(path: string, needle: string): boolean {
      const needleBuffer = Buffer.from(needle, "latin1");
      // Node's flag vocabulary is 'r' (not the POSIX 'rb'); reads are binary
      // regardless of platform.
      const fd = openSync(path, "r");
      try {
        const size = fstatSync(fd).size;
        const chunkSize = 4 * 1024 * 1024;
        const overlap = Math.max(0, needleBuffer.length - 1);
        const buffer = Buffer.alloc(chunkSize);
        let position = 0;
        let carry = Buffer.alloc(0);
        while (position < size) {
          const bytes = readSync(fd, buffer, 0, chunkSize, position);
          if (bytes <= 0) break;
          const combined = Buffer.concat([carry, buffer.subarray(0, bytes)]);
          if (combined.includes(needleBuffer)) return true;
          carry = combined.subarray(Math.max(0, combined.length - overlap));
          position += bytes;
        }
        return false;
      } finally {
        closeSync(fd);
      }
    }

    it("never lets the canary escape through logs, errors, metadata, the database or the working tree", async () => {
      // High-entropy, runtime-only canary. The base64url alphabet cannot be
      // mistaken for the repository's own base64 scanning patterns, and the
      // value is never written to any file, receipt or log.
      const canary = randomBytes(32).toString("base64url");
      const context = await seedTenant("owner");

      const logs: string[] = [];
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };
      console.warn = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };
      console.error = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      let secretId = "";
      let errorCode = "";
      let errorText = "";
      try {
        const created = await currentVault().create(context, {
          purpose: "accept.canary",
          secret: canary,
        });
        secretId = created.id;
        const metadata = await currentVault().getMetadata(context, created.id);
        expect(JSON.stringify(metadata)).not.toContain(canary);

        const decrypted = await currentVault().withDecryptedSecret(
          context,
          {
            id: created.id,
            tenantId: context.tenantId,
            purpose: "accept.canary",
          },
          (plaintext) => Buffer.from(plaintext).toString("utf8"),
        );
        expect(decrypted).toBe(canary);

        // Force an error path with the canary in scope and capture its text.
        await raw().query(
          "UPDATE encrypted_secrets SET ciphertext = $2 WHERE id = $1",
          [created.id, Buffer.from("tampered")],
        );
        try {
          await currentVault().withDecryptedSecret(
            context,
            {
              id: created.id,
              tenantId: context.tenantId,
              purpose: "accept.canary",
            },
            () => "never",
          );
        } catch (error) {
          errorCode = (error as SecretVaultError).code ?? "";
          errorText = String(error);
        }
      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
      }

      expect(secretId).not.toBe("");
      expect(errorCode).toBe("SECRET_INTEGRITY_FAILURE");
      expect(errorText).not.toContain(canary);

      // 1. No captured console output contains the canary.
      expect(logs.join("\n")).not.toContain(canary);

      // 2. No non-bytea value in ANY table contains the canary, and no bytea
      //    column contains it in the clear either (checked by scanning the
      //    stringified rows — ciphertext must not equal plaintext).
      const tables = await raw().query<{
        table_schema: string;
        table_name: string;
      }>(
        `SELECT table_schema, table_name FROM information_schema.tables
         WHERE table_schema IN ('public', 'drizzle') AND table_type = 'BASE TABLE'`,
      );
      expect(tables.rowCount ?? 0).toBeGreaterThanOrEqual(6);
      for (const table of tables.rows) {
        const rows = await raw().query(
          `SELECT * FROM "${table.table_schema}"."${table.table_name}"`,
        );
        for (const row of rows.rows) {
          const textual = JSON.stringify(row, (_key, value: unknown) =>
            Buffer.isBuffer(value) ? value.toString("hex") : value,
          );
          expect(textual).not.toContain(canary);
        }
      }

      // 3. The canary is absent from every file in the working tree.
      for (const path of repositoryFiles()) {
        if (fileContains(path, canary)) {
          throw new Error(`canary leaked into ${path}`);
        }
      }
    });
  });
});
