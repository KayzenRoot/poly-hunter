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
 * The AUTHORITATIVE role read (audit CR-02).
 *
 * This selects `tenant_memberships.role` itself — the column, not a copy the
 * caller supplied. Nothing in the vault decides a capability from a value that
 * arrived on a request object; the capability decision is a function of this
 * row and of the ACTIVE membership/user/tenant predicates above.
 *
 * The join is kept (rather than a bare membership SELECT) so an ACTIVE
 * membership under a suspended user or a suspended tenant is not returned.
 */
export function authoritativeTenantRoleProbe(
  context: TenantContext,
): SQL<unknown> {
  return sql`SELECT ph_membership.role AS role
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

/**
 * The same authoritative role read, holding a row-level SHARE lock on the
 * membership row for the remainder of the transaction (audit CR-02: no TOCTOU
 * between the role check and the secret mutation).
 *
 * `FOR SHARE` is chosen because it is the concurrency authority PostgreSQL
 * itself enforces: a concurrent `UPDATE tenant_memberships SET role = ...`
 * needs a conflicting lock mode and therefore BLOCKS until the vault's
 * transaction ends. The guarantee is a database property, not an in-memory
 * mutex — a second vault process in another container obeys exactly the same
 * rule, which an in-process lock could never provide.
 *
 * `OF ph_membership` restricts the lock to the membership row. The `users` and
 * `tenants` rows are read for their status only and are deliberately not
 * locked, so this can never widen into a deadlock with unrelated tenant
 * administration traffic; a membership that is concurrently suspended or
 * deleted simply makes this probe return no row, which denies.
 */
export function lockedAuthoritativeTenantRoleProbe(
  context: TenantContext,
): SQL<unknown> {
  return sql`SELECT ph_membership.role AS role
    FROM tenant_memberships AS ph_membership
    INNER JOIN users AS ph_user ON ph_user.id = ph_membership.user_id
    INNER JOIN tenants AS ph_tenant ON ph_tenant.id = ph_membership.tenant_id
    WHERE ph_membership.tenant_id = ${context.tenantId}
      AND ph_membership.user_id = ${context.userId}
      AND ph_membership.status = 'active'
      AND ph_user.status = 'active'
      AND ph_tenant.status = 'active'
    LIMIT 1
    FOR SHARE OF ph_membership`;
}
