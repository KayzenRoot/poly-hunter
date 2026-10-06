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
 * The same authoritative role read, holding row-level SHARE locks on ALL THREE
 * authority rows — membership, user and tenant — for the remainder of the
 * transaction (audit CR-02, extended by audit CR-09).
 *
 * CR-02 locked only the membership row. That closed the role-downgrade race but
 * left the USER-status and TENANT-status inputs unprotected: this probe reads
 * `ph_user.status` and `ph_tenant.status`, and a concurrent
 * `UPDATE users SET status='suspended'` (or the same on `tenants`) only needs a
 * lock on the single row it updates. Under READ COMMITTED the suspension could
 * therefore commit after the probe had already returned, and the vault would
 * continue its mutation or plaintext materialization on an authorization
 * decision the database no longer agrees with. Suspension must be exclusive
 * with the whole sensitive operation, so all three rows are held, not read.
 *
 * `FOR SHARE` is the concurrency authority PostgreSQL itself enforces: a
 * concurrent UPDATE of any of the three rows needs a conflicting lock mode and
 * BLOCKS until the vault's transaction ends. The guarantee is a database
 * property, not an in-memory mutex — a second vault process in another
 * container obeys exactly the same rule.
 *
 * LOCK ORDER. All three locks are taken by THIS ONE STATEMENT, whose FROM/JOIN
 * order and OF list both run membership -> user -> tenant, so every vault
 * transaction acquires them in the same deterministic order. The vault is the
 * only multi-row locker of these tables in the product (the only other row lock
 * is `FOR UPDATE` on `identity_links`, an unrelated table), and every vault
 * operation authorizes as its FIRST statement, so the global order is
 * (membership, user, tenant) -> encrypted_secrets and is never inverted.
 * Transactions that execute one identical single statement cannot form a wait
 * cycle among themselves, and a concurrent single-row UPDATE waits without
 * holding anything the vault needs — so no deadlock cycle exists. The
 * two-connection suite in `packages/db/tests/secret-vault.integration.test.ts`
 * ("authoritative status window (audit CR-09)") proves the blocking behaviour
 * for all four authority mutations.
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
    FOR SHARE OF ph_membership, ph_user, ph_tenant`;
}
