import { sql, type SQL } from "drizzle-orm";
import type { TenantContext } from "@polyhunter/domain";

if (typeof window !== "undefined") {
  throw new TypeError(
    "@polyhunter/db/server/authorization cannot be imported by a browser bundle.",
  );
}

/**
 * PH-M01-WO-003 — the vault's membership authority, in one place.
 *
 * The rule is the same one `packages/db/src/server/index.ts` applies to the
 * tenants/memberships tables, restated here so the vault does not have to
 * inline it into six statements: an operation proceeds only while an ACTIVE
 * membership row exists for (context.tenantId, context.userId) whose USER is
 * ACTIVE and whose TENANT is ACTIVE.
 *
 * It is expressed as a raw `EXISTS` predicate rather than a drizzle join so the
 * exact same expression composes onto a pool query AND a transaction query,
 * and so the audited rule is readable in one place instead of being scattered
 * across the vault's statements. The vault's adversarial suite exercises the
 * behaviour (suspended user, suspended membership, suspended tenant, foreign
 * tenant, member role) rather than trusting the expression by inspection.
 *
 * Because it is an `EXISTS` subquery it never appears in the outer `FROM`
 * clause, so `SELECT ... FOR UPDATE` locks only the `encrypted_secrets` row and
 * rotation concurrency stays governed by that row lock alone.
 */
export function activeTenantMembershipPredicate(
  context: TenantContext,
): SQL<unknown> {
  return sql`EXISTS (
    SELECT 1
    FROM tenant_memberships AS ph_membership
    INNER JOIN users AS ph_user ON ph_user.id = ph_membership.user_id
    INNER JOIN tenants AS ph_tenant ON ph_tenant.id = ph_membership.tenant_id
    WHERE ph_membership.tenant_id = ${context.tenantId}
      AND ph_membership.user_id = ${context.userId}
      AND ph_membership.status = 'active'
      AND ph_user.status = 'active'
      AND ph_tenant.status = 'active'
  )`;
}

/**
 * The same rule as a standalone probe, used before an operation begins. Written
 * as raw SQL so it can run on a pool and on a transaction interchangeably.
 */
export function activeTenantMembershipProbe(
  context: TenantContext,
): SQL<unknown> {
  return sql`SELECT 1
    FROM tenant_memberships AS ph_membership
    INNER JOIN users AS ph_user ON ph_user.id = ph_membership.user_id
    INNER JOIN tenants AS ph_tenant ON ph_tenant.id = ph_membership.tenant_id
    WHERE ph_membership.tenant_id = ${context.tenantId}
      AND ph_membership.user_id = ${context.userId}
      AND ph_membership.status = 'active'
      AND ph_user.status = 'active'
      AND ph_tenant.status = 'active'
    LIMIT 1`;
}
