# PH-M01-WO-001 Evidence Bundle

Status: IMPLEMENTATION_COMPLETE / READY_FOR_INDEPENDENT_HIGH_ASSURANCE_AUDIT.

## Repository and lineage

- Repository: `KayzenRoot/poly-hunter`.
- Branch: `feat/ph-m01-tenancy-persistence`.
- PR: [#15](https://github.com/KayzenRoot/poly-hunter/pull/15), draft and not merged.
- Context Lock base: `main@e1237cda839829a6a4eedba3b9917d6ee45c6352`.
- Pre-execution target head: `e5f85e1575cf3ebb36027f51518a524e9cb624a8`.
- Validated implementation head: `0a2a1a8e91bd7f86ebc947b8b1323fdcd86f56bd`.
- Context Lock lineage and all 16 critical-source fingerprints matched before implementation. The PR head was on the authorized branch/base and the merge base was the exact locked base.
- This evidence-only commit follows the validated implementation head. The final PR head and its exact-head CI run are recorded in the PR description/checks to avoid a self-referential commit hash in this file.
- No force-push, merge, checkpoint edit, PH-M01-WO-002 work, auth provider, secret vault, Polymarket or trading code.

## Scope implemented

- Added `packages/db` as a workspace with exact-pinned `drizzle-orm@0.45.3`, `drizzle-kit@0.31.11`, `pg@8.23.1` and `@types/pg@8.23.1`.
- Added PostgreSQL enums and tables for `tenants`, `users`, `identity_links` and `tenant_memberships`; UUID keys; UTC-capable `timestamptz`; unique tenant slug, provider/subject and tenant/user constraints; canonical slug/provider checks; explicit cascading foreign keys.
- Added tenant role/status contracts and opaque domain `TenantContext` type. The server entry point is the only package export, has a browser runtime guard and issues frozen contexts held in a private `WeakSet` only after active user, tenant and membership validation.
- Tenant repositories derive scope only from a validated context. Reads include the tenant predicate and live active-membership checks; rename re-checks owner/admin authority under a row lock and writes only to the context tenant. Revoked/suspended membership fails closed for already-issued contexts.
- Added real PostgreSQL migration, constraint, delete behavior, forged-context, revocation and tenant A/B integration coverage. No DB client or database URL is imported by web source.
- Added PostgreSQL 17 to Compose on an internal-only network with a named persistent volume and healthcheck; web and worker wait for PostgreSQL health. The database URL is server-container-only. Local startup reads the ignored `.env` copied from `.env.example`; Compose has no password fallback.
- Added a PostgreSQL-backed Node 24 GitHub Actions job. Its disposable CI password is derived from the workflow run id/attempt and repository id rather than stored as a static credential.

## Versions and migration integrity

- Docker Desktop: `4.88.1 (237512)`; Docker Engine `29.7.2`; Compose `v5.4.0`; Linux `x86_64` under WSL2.
- PostgreSQL: `17.11` (`x86_64-pc-linux-musl`). Compose and CI use `postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` (multi-platform manifest-list digest).
- Development runtime: Node `v24.21.0`, npm `11.19.0`; host validation runtime: Node `v26.4.0`, npm `11.17.0`.
- Migration: `packages/db/drizzle/0000_brainy_azazel.sql`, SHA-256 `FE9D8ADC440CBA166F58D6A4E1764517A092E23E264DEC3C0A31C3CAD5B23789`.
- Drizzle snapshot: `packages/db/drizzle/meta/0000_snapshot.json`, SHA-256 `831991A66238F97FCBF6F5DC0911CC3AE9017A9418378773ECED96405DCB0DF4`.
- Migration journal: `packages/db/drizzle/meta/_journal.json`, SHA-256 `F2C39377129245514E3A2DB52DCCF7C83C4887FCFB6695778EDCF7CAE046355F`.
- `npm run db:migrate` applied successfully twice to the local Compose database. Integration tests migrated two independent empty databases and re-applied the migration on one of them. All migration clients and test pools close explicitly; disposable databases are dropped with `WITH (FORCE)` in teardown.
- Recovery is forward-only for this initial schema: take a database backup before applying a production migration; on failure preserve logs and the pre-migration backup, restore only if the database cannot be made consistent, and ship a corrective versioned migration after diagnosis. Do not edit an already promoted migration or delete the persistent local volume as a recovery shortcut.

## Validation evidence

Local checkout at the validated implementation head:

- `npm ci`: PASS.
- `docker compose --project-name polyhunter-local config --quiet`: PASS.
- `npm run db:migrate`: PASS twice.
- `npm run db:test:integration`: PASS, 1 file / 4 real PostgreSQL tests. It covered two fresh databases, repeat application, UUID/time-zone schema, unique keys, enum domains, invalid slug/name/provider/subject checks, foreign keys, user and tenant cascades, tenant A/B isolation, role denial, serialized-context rejection and membership revocation.
- `npm run validate`: PASS — lint, format, typecheck, 3 unit files / 7 tests, all workspace builds, Next.js production build and `npm audit --audit-level=high`.
- `npm audit --audit-level=high`: PASS at the requested threshold. npm reports four MODERATE findings in the transitive `@esbuild-kit`/`esbuild` dependency chain used by `drizzle-kit`; no HIGH or CRITICAL npm advisory was reported.
- Secret-pattern review of changed runtime/workflow files: PASS. No static PostgreSQL password fallback or known token/private-key pattern remains in Compose or CI.
- `git diff --check`: PASS.

At implementation head `0a2a1a8e91bd7f86ebc947b8b1323fdcd86f56bd`:

- GitHub Actions [run 37149899337](https://github.com/KayzenRoot/poly-hunter/actions/runs/37149899337): PASS. Node 24 install, required validation, versioned migration and PostgreSQL integration steps all succeeded.
- SonarCloud Quality Gate: PASS; 0 new vulnerabilities and 0 security hotspots. It reports two `plsql:S1192` maintainability findings on repeated enum-value literals in PostgreSQL DDL. These are not security findings or runtime defects; the independent auditor should review the persistence-specific trade-off.
- Socket Security: Project Report PASS; Pull Request Alerts PASS, no new dependency alerts.
- CodeRabbit did not review because PR #15 is draft. This is not an independent audit.

## Running local stack at stop condition

- `polyhunter-postgres`: `Up (healthy)`, PostgreSQL `17.11`, named volume `polyhunter-local-postgres17`; port `5432` is not published to the host.
- `polyhunter-web`: `Up (healthy)`; `http://localhost:3000` returned HTTP `200`.
- `polyhunter-worker`: container and `nodemon` process remain `Up`. The current worker shell intentionally exits after its startup message and is restarted/held by nodemon; no trading or product worker loop is implemented in this Work Order.
- Stack remains running for owner inspection.

## Security boundaries and residual risks

- No authentication provider is included. `resolveTenantContext` accepts an `authenticatedUserId` contract argument; future call sites must supply it only from a verified server identity. There are no web route call sites in this increment. Membership and tenant status are checked in PostgreSQL before context issuance and on each repository operation.
- The local `.env.example` password is explicitly development-only; `.env` is ignored by Git. Local Postgres is not host-published. Do not reuse these values outside local development.
- The local Compose bootstrap role is privileged and is shared by the development web/worker and migration/test commands. This is confined to the internal-only development network; production role separation and least-privilege grants remain required before deployment.
- npm audit retains four moderate development-tool advisories described above. Sonar retains two non-security maintainability findings for enum literals required inline by the SQL migration syntax.
- HIGH_ASSURANCE independent-from-executor audit is still required before promotion. Keep PR #15 draft; do not merge or advance to another Work Order here.

## Proposed checkpoint delta

The canonical checkpoint was not changed. After independent exact-head approval and merge, record PH-M01-WO-001 as implemented while keeping PH-M01 incomplete, `liveTradingAuthorized=false`, no later Work Order prepared by this execution, and stop for owner/planning direction.

## STOP

PH-M01-WO-001 is implemented and validated. Stop here; do not start PH-M01-WO-002, secret storage, Polymarket or trading.
