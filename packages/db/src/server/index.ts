import { and, eq, exists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { TenantRole } from "@polyhunter/contracts";
import type { TenantContext } from "@polyhunter/domain";
import {
  identityLinks,
  tenantMemberships,
  tenants,
  users,
} from "../schema/index.js";

if (typeof window !== "undefined") {
  throw new Error(
    "@polyhunter/db/server cannot be imported by a browser bundle.",
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidTenantContextError extends Error {
  constructor() {
    super(
      "A TenantContext resolved by this server data-access instance is required.",
    );
    this.name = "InvalidTenantContextError";
  }
}

export interface TenantDataAccessOptions {
  readonly connectionString?: string;
  readonly maxConnections?: number;
}

export interface TenantDataAccess {
  readonly resolveTenantContext: (
    authenticatedUserId: string,
    selectedTenantId: string,
  ) => Promise<TenantContext | null>;
  readonly tenants: {
    readonly getCurrent: (context: TenantContext) => Promise<{
      id: string;
      name: string;
      slug: string;
      status: "active" | "suspended";
      createdAt: Date;
      updatedAt: Date;
    } | null>;
    readonly renameCurrent: (
      context: TenantContext,
      name: string,
    ) => Promise<{ id: string; name: string; updatedAt: Date } | null>;
  };
  readonly memberships: {
    readonly list: (context: TenantContext) => Promise<
      Array<{
        id: string;
        userId: string;
        role: TenantRole;
        status: "invited" | "active" | "suspended";
        createdAt: Date;
      }>
    >;
    readonly findById: (
      context: TenantContext,
      membershipId: string,
    ) => Promise<{
      id: string;
      userId: string;
      role: TenantRole;
      status: "invited" | "active" | "suspended";
      createdAt: Date;
    } | null>;
  };
  readonly close: () => Promise<void>;
}

/**
 * Creates server-side persistence access. Callers pass only an identity already
 * verified by their authentication boundary; a tenant selector is checked
 * against an active membership before a context is issued.
 */
export function createTenantDataAccess(
  options: TenantDataAccessOptions = {},
): TenantDataAccess {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for server-side persistence.");
  }

  const pool = new Pool({
    connectionString,
    max: options.maxConnections ?? 10,
    application_name: "polyhunter-server",
  });
  const db = drizzle(pool, {
    schema: { identityLinks, tenantMemberships, tenants, users },
  });
  const trustedContexts = new WeakSet<object>();
  const actorMembership = alias(tenantMemberships, "context_membership");
  const actorUser = alias(users, "context_user");

  function assertTrustedContext(context: TenantContext): void {
    if (
      !context ||
      typeof context !== "object" ||
      !trustedContexts.has(context)
    ) {
      throw new InvalidTenantContextError();
    }
  }

  function activeContextMembership(context: TenantContext) {
    return exists(
      db
        .select({ one: sql`1` })
        .from(actorMembership)
        .innerJoin(actorUser, eq(actorMembership.userId, actorUser.id))
        .where(
          and(
            eq(actorMembership.tenantId, tenants.id),
            eq(actorMembership.tenantId, context.tenantId),
            eq(actorMembership.userId, context.userId),
            eq(actorMembership.status, "active"),
            eq(actorUser.status, "active"),
          ),
        ),
    );
  }

  function activeTenantMembership(context: TenantContext) {
    const tenant = alias(tenants, "context_tenant");

    return exists(
      db
        .select({ one: sql`1` })
        .from(actorMembership)
        .innerJoin(actorUser, eq(actorMembership.userId, actorUser.id))
        .innerJoin(tenant, eq(actorMembership.tenantId, tenant.id))
        .where(
          and(
            eq(actorMembership.tenantId, context.tenantId),
            eq(actorMembership.userId, context.userId),
            eq(actorMembership.status, "active"),
            eq(actorUser.status, "active"),
            eq(tenant.status, "active"),
          ),
        ),
    );
  }

  function issueContext(
    userId: string,
    tenantId: string,
    role: TenantRole,
  ): TenantContext {
    const context = Object.freeze({ userId, tenantId, role }) as TenantContext;
    trustedContexts.add(context);
    return context;
  }

  async function resolveTenantContext(
    authenticatedUserId: string,
    selectedTenantId: string,
  ): Promise<TenantContext | null> {
    if (
      !UUID_PATTERN.test(authenticatedUserId) ||
      !UUID_PATTERN.test(selectedTenantId)
    ) {
      return null;
    }

    const [membership] = await db
      .select({
        userId: tenantMemberships.userId,
        tenantId: tenantMemberships.tenantId,
        role: tenantMemberships.role,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(
        and(
          eq(tenantMemberships.userId, authenticatedUserId),
          eq(tenantMemberships.tenantId, selectedTenantId),
          eq(tenantMemberships.status, "active"),
          eq(tenants.status, "active"),
          eq(users.status, "active"),
        ),
      )
      .limit(1);

    return membership
      ? issueContext(membership.userId, membership.tenantId, membership.role)
      : null;
  }

  async function getCurrent(context: TenantContext) {
    assertTrustedContext(context);

    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .where(
        and(
          eq(tenants.id, context.tenantId),
          eq(tenants.status, "active"),
          activeContextMembership(context),
        ),
      )
      .limit(1);

    return tenant ?? null;
  }

  async function renameCurrent(context: TenantContext, name: string) {
    assertTrustedContext(context);
    const normalizedName = name.trim();

    if (!normalizedName || normalizedName.length > 120) {
      throw new RangeError(
        "Tenant name must contain between 1 and 120 characters.",
      );
    }

    return db.transaction(async (transaction) => {
      const [membership] = await transaction
        .select({ role: tenantMemberships.role })
        .from(tenantMemberships)
        .innerJoin(users, eq(tenantMemberships.userId, users.id))
        .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
        .where(
          and(
            eq(tenantMemberships.tenantId, context.tenantId),
            eq(tenantMemberships.userId, context.userId),
            eq(tenantMemberships.status, "active"),
            eq(users.status, "active"),
            eq(tenants.status, "active"),
          ),
        )
        .for("update", { of: tenantMemberships });

      if (
        !membership ||
        (membership.role !== "owner" && membership.role !== "admin")
      ) {
        return null;
      }

      const [tenant] = await transaction
        .update(tenants)
        .set({ name: normalizedName, updatedAt: new Date() })
        .where(
          and(eq(tenants.id, context.tenantId), eq(tenants.status, "active")),
        )
        .returning({
          id: tenants.id,
          name: tenants.name,
          updatedAt: tenants.updatedAt,
        });

      return tenant ?? null;
    });
  }

  async function listMemberships(context: TenantContext) {
    assertTrustedContext(context);

    return db
      .select({
        id: tenantMemberships.id,
        userId: tenantMemberships.userId,
        role: tenantMemberships.role,
        status: tenantMemberships.status,
        createdAt: tenantMemberships.createdAt,
      })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, context.tenantId),
          activeTenantMembership(context),
        ),
      )
      .orderBy(tenantMemberships.createdAt, tenantMemberships.id);
  }

  async function findMembershipById(
    context: TenantContext,
    membershipId: string,
  ) {
    assertTrustedContext(context);

    if (!UUID_PATTERN.test(membershipId)) {
      return null;
    }

    const [membership] = await db
      .select({
        id: tenantMemberships.id,
        userId: tenantMemberships.userId,
        role: tenantMemberships.role,
        status: tenantMemberships.status,
        createdAt: tenantMemberships.createdAt,
      })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.id, membershipId),
          eq(tenantMemberships.tenantId, context.tenantId),
          activeTenantMembership(context),
        ),
      )
      .limit(1);

    return membership ?? null;
  }

  return {
    resolveTenantContext,
    tenants: { getCurrent, renameCurrent },
    memberships: { list: listMemberships, findById: findMembershipById },
    close: () => pool.end(),
  };
}
