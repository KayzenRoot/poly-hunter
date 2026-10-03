# PH-M01-WO-001 Evidence Bundle

Status: CR-03_CANDIDATES_TESTED / BLOCKED_NO_CLEAN_OFFICIAL_POSTGRESQL_17_IMAGE.

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
- Added PostgreSQL 17 to the project-scoped Compose network, with its port not published on the host, a named persistent volume and healthcheck; web and worker wait for PostgreSQL health. The database URL is server-container-only. Local startup reads the ignored `.env` copied from `.env.example`; Compose has no password fallback.
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

## Correction Delta CR-01 — container vulnerability scans

- Scanner: Docker Scout CLI `v1.24.0` (`b1c9331b2166aef7ec690aa16fd655b8798ea4c6`), invoked with `docker scout cves --format sarif --output <receipt> local://<image>` against the exact local images used by Compose. Both scans completed and wrote SARIF; Scout's command exit code was 0. Trivy was not installed.
- Scan timestamp: 2026-10-03 UTC. The SARIF receipts below preserve all scanner result records; severity counts are unique CVE IDs, so repeated findings against bundled Go runtimes are counted once per image.

| Image | Immutable image digest | Indexed packages | Scout summary | Critical | High | Medium | Low | Unspecified | Result |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `polyhunter-dev:local` | `sha256:7b9974f05b1b85d6c665470c0574c014d1ab74fb3993481ef1db790008dbc02f` | 548 | 26 vulnerable packages; 154 unique CVEs | 6 | 50 | 58 | 35 | 5 | **BLOCKS PROMOTION** |
| `postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` | `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` | 66 | 3 vulnerable packages; 57 unique CVEs | 2 | 22 | 26 | 7 | 0 | **BLOCKS PROMOTION** |

- Neither SARIF report marks any result suppressed. The dev image's High/Critical findings include bundled Go standard libraries, Debian packages and npm packages; the PostgreSQL image's High/Critical findings include its bundled Go standard library (`gosu`) and Alpine `libxml2`.
- Raw receipts: [polyhunter-dev SARIF](PH-M01-WO-001-container-scans/polyhunter-dev-local.sarif), SHA-256 `8598EE724CAB6D05402392EB5F79B9C7EC9B95EF3414EC1F7D72DB9703BEA934`; [PostgreSQL SARIF](PH-M01-WO-001-container-scans/postgres-17.11-alpine3.24.sarif), SHA-256 `44A3C64B51E25C8E6AA08B0DDB95C0980A0A0A20060662A02E47CD2A28ACF3C9`.
- Docker Scout emitted a non-fatal Windows temporary-archive cleanup warning after each successful report; both images were indexed and both SARIF reports were written with exit code 0. This does not change the findings.
- **Promotion gate:** known High/Critical findings remain in both pinned images. Keep PR #15 draft; do not promote, merge, or advance until the selected images are remediated or replaced within an authorized correction and rescanned with zero High/Critical findings. This correction records and blocks on the findings; it does not suppress or claim to fix them.

## Correction Delta CR-02 — Compose network wording

- The Compose network is `polyhunter-local_default`, a project-scoped bridge network (`Internal=false`). PostgreSQL has no published host port (`5432/tcp` is container-only). This describes the Compose wiring and does not claim broader network isolation.

## Correction Delta CR-03 — image recommendations and candidate scans

### Recommendations and official candidates

- Docker Scout CLI `v1.24.0` (`b1c9331b2166aef7ec690aa16fd655b8798ea4c6`) recommendations for the development image identified `node:24-bookworm-slim` as the auto-detected base. The recommendation snapshot showed digest `sha256:5cbc7caba8c2c0f0bca675d1b61b9f2857e1cf1853c6164ee9dd409501a936e7` with `2 Critical / 19 High / 19 Medium / 32 Low / 4 Unspecified`, and reported that base as up to date with no alternative-tag rows.
- Recommendations for pinned PostgreSQL identified Alpine `3.24.2`, digest `sha256:d56c381f961d307a21b3ca004cf1e3910f106644aefb1f43e654c8a56c4fd395`, with `0 Critical / 0 High / 0 Medium / 0 Low` in the base image. Scout said the base was up to date and had no alternative-tag recommendations; the findings in the full Postgres image remain in its `gosu` Go runtime and other image packages.
- Official image tag references were checked on [Docker Hub Node](https://hub.docker.com/_/node?name=alpine&page=1&tab=description) and [Docker Hub PostgreSQL](https://hub.docker.com/_/postgres/tags?name=17.&page=1). Node candidates were `24.21.0` and satisfy repository engine range `>=22 <27`. PostgreSQL candidates remained version `17.11`, major 17.
- Candidate pulls, Node/PostgreSQL runtime-version checks, and scans were completed before any Dockerfile, Compose, dependency, schema, TenantContext or product-code edit; no such edits were made. The Bookworm scan receipt and all candidate/final SARIF reports were added to the Evidence Bundle afterward. No ignore or suppression was used; all seven CR-03 reports contain zero suppressed results.

### Candidate and final image scan results

Counts below are unique CVE IDs from each SARIF report. The scanner indexed/package and vulnerable-package counts are retained where reported by Scout.

| Image tested | Digest | Packages indexed / vulnerable | CVEs | Critical | High | Medium | Low | Unspecified | Gate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Official Node `24-alpine` candidate (`v24.21.0`, npm `11.19.0`) | `sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1` | 170 / 5 | 20 | 0 | 8 | 11 | 1 | 0 | Fails High gate |
| Official Node `24-bookworm-slim` candidate (`v24.21.0`, npm `11.19.0`) | `sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` | 276 / 20 | 76 | 2 | 19 | 19 | 32 | 4 | Fails Critical/High gate |
| Official PostgreSQL `17.11-alpine3.23` candidate | `sha256:9ea644da56f1a82283b173fa38a316636fe7c538991a8ae41998cd3765434991` | not reported / 4 | 58 | 2 | 22 | 27 | 7 | 0 | Fails Critical/High gate |
| Official PostgreSQL `17.11-trixie` candidate | `sha256:d74eeac9a635390a49bc21bd49fccd973de707e2a53a76ac49b552b8712ec46f` | 206 / 25 | 118 | 2 | 27 | 32 | 57 | 0 | Fails Critical/High gate |
| Official PostgreSQL `17.11-bookworm` candidate | `sha256:639ab7ceb90e13123085b741fb31ef493fba25463002f6da665352e7b534b652` | 210 / 24 | 144 | 5 | 38 | 40 | 57 | 4 | Fails Critical/High gate |
| Rebuilt Compose development image `polyhunter-dev:local` | `sha256:6c8701d8141745e1625c392da42ff643389ed1dab1fcddd13d8dcff704180caa` | 548 / 26 | 154 | 6 | 50 | 58 | 35 | 5 | Fails Critical/High gate |
| Pinned Compose PostgreSQL `17.11-alpine3.24` final scan | `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` | 66 / 3 | 57 | 2 | 22 | 26 | 7 | 0 | Fails Critical/High gate |

- `polyhunter-dev:local` final digest is the exact image ID used by both running web and worker containers. Its source base resolved during `docker compose build --pull --no-cache` to official `node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
- PostgreSQL candidate commands returned PostgreSQL `17.11` for `17.11-trixie`, `17.11-alpine3.23` and `17.11-bookworm`. No major-version change was tested or applied. The tested bookworm tag resolves to Debian 12 (`17.11-1.pgdg12+2`).
- The pinned official PostgreSQL 17.11 Alpine digest and three official 17.11 variants all fail the gate. Both Alpine variants report the same 2 Critical / 21 Go High findings in `golang/stdlib@1.24.6` bundled in `/usr/local/bin/gosu`; Alpine also reports `CVE-2026-86140` in `libxml2` with no fixed version in Scout's data. Trixie contains the same Go findings plus 6 Debian High findings. Bookworm contains the same Go findings plus 3 Debian Critical and 17 Debian High findings. The official images tested therefore provide no clean PostgreSQL major-17 candidate.

### PostgreSQL 17 blocker — exact CVEs and scanner fixes

Docker Scout reports these Go fixes, but each tested official PostgreSQL 17.11 digest still contains the `gosu` binary linked to Go standard library `1.24.6`; none contains the listed fixed Go runtime. Alpine's libxml2 issue has no fixed version reported. These findings block promotion.

| Severity | CVE | Detected package | Fixed version reported by Scout |
| --- | --- | --- | --- |
| Critical | `CVE-2025-68121` | Go stdlib `1.24.6` in `gosu` | `1.24.13` |
| Critical | `CVE-2026-39821` | Go stdlib `1.24.6` in `gosu` | `1.25.13` |
| High | `CVE-2025-58187` | Go stdlib `1.24.6` in `gosu` | `1.24.9` |
| High | `CVE-2025-58188` | Go stdlib `1.24.6` in `gosu` | `1.24.8` |
| High | `CVE-2025-61723` | Go stdlib `1.24.6` in `gosu` | `1.24.8` |
| High | `CVE-2025-61725` | Go stdlib `1.24.6` in `gosu` | `1.24.8` |
| High | `CVE-2025-61726` | Go stdlib `1.24.6` in `gosu` | `1.24.12` |
| High | `CVE-2025-61729` | Go stdlib `1.24.6` in `gosu` | `1.24.11` |
| High | `CVE-2026-25679` | Go stdlib `1.24.6` in `gosu` | `1.25.8` |
| High | `CVE-2026-32280` | Go stdlib `1.24.6` in `gosu` | `1.25.9` |
| High | `CVE-2026-32281` | Go stdlib `1.24.6` in `gosu` | `1.25.9` |
| High | `CVE-2026-32283` | Go stdlib `1.24.6` in `gosu` | `1.25.9` |
| High | `CVE-2026-33811` | Go stdlib `1.24.6` in `gosu` | `1.25.10` |
| High | `CVE-2026-33814` | Go stdlib `1.24.6` in `gosu` | `1.25.10` |
| High | `CVE-2026-33818` | Go stdlib `1.24.6` in `gosu` | `1.25.13` |
| High | `CVE-2026-39820` | Go stdlib `1.24.6` in `gosu` | `1.25.10` |
| High | `CVE-2026-39822` | Go stdlib `1.24.6` in `gosu` | `1.25.12` |
| High | `CVE-2026-39836` | Go stdlib `1.24.6` in `gosu` | `1.25.10` |
| High | `CVE-2026-42499` | Go stdlib `1.24.6` in `gosu` | `1.25.10` |
| High | `CVE-2026-42504` | Go stdlib `1.24.6` in `gosu` | `1.25.11` |
| High | `CVE-2026-56853` | Go stdlib `1.24.6` in `gosu` | `1.25.13` |
| High | `CVE-2026-56859` | Go stdlib `1.24.6` in `gosu` | `1.25.13` |
| High | `CVE-2026-56862` | Go stdlib `1.24.6` in `gosu` | `1.25.13` |
| High | `CVE-2026-86140` | Alpine `libxml2` (`2.13.9-r2` / `2.13.9-r1`) | Not fixed in Scout data |

The Trixie candidate adds these distro findings on top of the shared Go CVEs:

| CVE | Package | Fixed version reported by Scout |
| --- | --- | --- |
| `CVE-2026-102010` | Debian `gcc-14` | Not fixed in Scout data |
| `CVE-2026-103111` | Debian `pcre2` | `10.46-1~deb13u3` |
| `CVE-2026-74860` | Debian `libxml2` | Not fixed in Scout data |
| `CVE-2026-84782` | Debian `openssl` | `3.5.7-1~deb13u3` |
| `CVE-2026-86140` | Debian `libxml2` | Not fixed in Scout data |
| `CVE-2026-95619` | Debian `gcc-14` | Not fixed in Scout data |

The Bookworm candidate adds the following Debian findings on top of the shared Go CVEs. “Not fixed” means Docker Scout's scan data did not report a fixed package version for that image's Debian 12 package; the SARIF receipt retains each package and affected-version record.

| Severity | CVE(s) | Package in `postgres:17.11-bookworm` | Fixed version reported by Scout |
| --- | --- | --- | --- |
| Critical | `CVE-2026-12087`, `CVE-2026-13221` | Perl `5.36.0-7+deb12u3` | Not fixed |
| Critical | `CVE-2026-75803` | OpenSSL `3.0.20-1~deb12u2` | `3.0.22-1~deb12u1` |
| High | `CVE-2026-102010`, `CVE-2026-95619` | GCC 12 `12.2.0-14+deb12u1` | Not fixed |
| High | `CVE-2026-103111` | PCRE2 `10.42-1+deb12u1` | Not fixed |
| High | `CVE-2026-48959`, `CVE-2026-48962`, `CVE-2026-57432`, `CVE-2026-82560` | Perl `5.36.0-7+deb12u3` | Not fixed |
| High | `CVE-2026-54874`, `CVE-2026-63072`, `CVE-2026-63076` | OpenSSL `3.0.20-1~deb12u2` | `3.0.22-1~deb12u1` |
| High | `CVE-2026-74860`, `CVE-2026-86140` | libxml2 `2.9.14+dfsg-1.3~deb12u6` | Not fixed |
| High | `CVE-2026-76642`, `CVE-2026-78408`, `CVE-2026-78409`, `CVE-2026-78410` | util-linux `2.38.1-5+deb12u3` | Not fixed |
| High | `CVE-2026-84782` | OpenSSL `3.0.20-1~deb12u2` | Not fixed |

### Scan receipts

All seven CR-03 candidate/final SARIF reports were generated by Docker Scout CLI `v1.24.0` on 2026-10-03 UTC. SHA-256 values below are over the report files; every report has zero suppressed results.

| Report | SHA-256 |
| --- | --- |
| [Node 24 Alpine candidate](PH-M01-WO-001-container-scans/node-24-alpine-candidate.sarif) | `05E114DD6D5E347E84E7FAD86118449E16D26D299273ECB7C4C8D18E21133FEA` |
| [Node 24 Bookworm slim candidate](PH-M01-WO-001-container-scans/node-24-bookworm-slim-candidate.sarif) | `227308017E4A516915F8C397FFE7565E2B491A0AB0DF3A564A167B99C1EAAB4A` |
| [PostgreSQL 17.11 Alpine 3.23 candidate](PH-M01-WO-001-container-scans/postgres-17.11-alpine3.23-candidate.sarif) | `5EFEC7B97F8AA97691BB7EF8BE13823A8D08F042D259EE27F012291D3445B4F7` |
| [PostgreSQL 17.11 Trixie candidate](PH-M01-WO-001-container-scans/postgres-17.11-trixie-candidate.sarif) | `40878DD843D1C7E15732726290E53D75C37913EBEA459E57E146FF86898A529E` |
| [PostgreSQL 17.11 Bookworm candidate](PH-M01-WO-001-container-scans/postgres-17.11-bookworm-candidate.sarif) | `3E6A47C589466C901344F1FE29DF477BCB5D5109FBDCCE08CEBB9238FD7F6E57` |
| [Rebuilt PolyHunter development image final scan](PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif) | `E703FF5206493044293AB3EE0A54502223DD0BFFA5C8972BEE0F8F131E96B86D` |
| [PostgreSQL 17.11 Alpine 3.24 final scan](PH-M01-WO-001-container-scans/postgres-17.11-alpine3.24-final.sarif) | `44A3C64B51E25C8E6AA08B0DDB95C0980A0A0A20060662A02E47CD2A28ACF3C9` |

### Required post-build validation

- `docker compose --project-name polyhunter-local build --pull --no-cache`: PASS; resolved Node base digest `sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
- `docker compose --project-name polyhunter-local config --quiet`: PASS.
- `docker compose --project-name polyhunter-local up -d`: PASS.
- Web: healthy; `http://localhost:3000` returned HTTP `200` after first compile. Worker: running `nodemon` process. PostgreSQL: `healthy`; `pg_isready` accepted connections.
- `npm run db:migrate`: PASS.
- `docker compose --project-name polyhunter-local exec -T web npm run test:integration`: PASS, 1 file / 4 real PostgreSQL tests.
- `npm ci`: PASS.
- `npm run validate`: PASS — lint, format, typecheck, 7 unit tests, workspace/Next production builds and audit at HIGH threshold.
- `npm audit --audit-level=high`: PASS; 4 MODERATE transitive `@esbuild-kit`/`esbuild` findings, no npm HIGH/CRITICAL.
- Final Docker Scout scans: completed and receipts attached. The image gate fails due the High/Critical counts above.
- No Dockerfile, Compose, dependency, schema, TenantContext or product code was changed. No ignore/suppression was used.
- **STOP/BLOCKED:** no tested official PostgreSQL major-17 image digest reaches zero Critical/High, and the final development image also fails that gate. Keep current Postgres 17 pin and PR #15 draft; do not change major version, promote, merge or proceed to another Work Order. Reopen image remediation when an official PostgreSQL 17 image contains fixes for the reported `gosu`/OS packages and both final images pass fresh scans with zero Critical/High.

## Running local stack at stop condition

- `polyhunter-postgres`: `Up (healthy)`, PostgreSQL `17.11`, named volume `polyhunter-local-postgres17`; its port `5432` is not published to the host and the service is attached to the project-scoped Compose network.
- `polyhunter-web`: `Up (healthy)`; `http://localhost:3000` returned HTTP `200`.
- `polyhunter-worker`: container and `nodemon` process remain `Up`. The current worker shell intentionally exits after its startup message and is restarted/held by nodemon; no trading or product worker loop is implemented in this Work Order.
- Stack remains running for owner inspection.

## Security boundaries and residual risks

- No authentication provider is included. `resolveTenantContext` accepts an `authenticatedUserId` contract argument; future call sites must supply it only from a verified server identity. There are no web route call sites in this increment. Membership and tenant status are checked in PostgreSQL before context issuance and on each repository operation.
- The local `.env.example` password is explicitly development-only; `.env` is ignored by Git. Local Postgres is not host-published. Do not reuse these values outside local development.
- The local Compose bootstrap role is privileged and is shared by the development web/worker and migration/test commands. PostgreSQL is attached to the project-scoped Compose network with no host-published port; production role separation and least-privilege grants remain required before deployment.
- npm audit retains four moderate development-tool advisories described above. Sonar retains two non-security maintainability findings for enum literals required inline by the SQL migration syntax.
- Docker Scout found High/Critical vulnerabilities in both final images, and the additional official `17.11-bookworm` candidate also failed. Promotion is blocked until remediation and clean rescans; do not merge or advance to another Work Order here. Independent HIGH_ASSURANCE audit remains required after the promotion-blocking findings are resolved.

## Proposed checkpoint delta

The canonical checkpoint was not changed. After independent exact-head approval and merge, record PH-M01-WO-001 as implemented while keeping PH-M01 incomplete, `liveTradingAuthorized=false`, no later Work Order prepared by this execution, and stop for owner/planning direction.

## STOP

PH-M01-WO-001 and CR-01/CR-02/CR-03 evidence are recorded; promotion is blocked because the official PostgreSQL 17 candidates and final images have known High/Critical findings. Stop here; do not start PH-M01-WO-002, secret storage, Polymarket or trading.
