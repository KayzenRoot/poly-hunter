# PostgreSQL local application role privilege risk — PH-M02-WO-001

## Classification

HIGH privilege blast radius, local-development environment. The exact post-correction runtime receipt shows PostgreSQL role polyhunter has rolsuper=true. The role can administer the database cluster; if application credentials are exposed or an SQL-injection path is later established, the resulting database impact would be materially greater than with a least-privileged runtime role.

This is a privilege-risk classification. It is not evidence that an SQL injection exists, and it is independent of the zlib CVE. The database port has no host-published binding; the project-scoped Compose network remains non-internal. Those facts reduce exposure but do not negate the role's privilege level.

## Evidence

- Exact current digest and query result: cr07-compose-runtime-final.txt.
- Current database has plpgsql installed; no other extension was active at the captured time.
- The main persistent volume was retained. No schema or role changes were made in this correction.

## Recommendation

Create a separately scoped follow-up before any broader, credential-bearing, remotely exposed, or production deployment. Use a non-superuser application runtime role restricted to required schemas/tables and reserve superuser or migration authority for controlled bootstrap/migration activity. Test grants and migration ownership before rollout. This recommendation is recorded for planning; no role, schema, application, or Compose change is included here.
