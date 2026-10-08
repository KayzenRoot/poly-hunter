# PostgreSQL 17.11 zlib candidate comparison — PH-M02-WO-001

Assessment date: 2026-10-08. Scanner: Docker Scout CLI 1.24.0.

## Official PostgreSQL 17.11 images tested first

Commands used:

    docker scout cves registry://postgres:17.11-bookworm --platform linux/amd64 --format sarif --output .engineering/evidence/PH-M02-WO-001/postgres-17.11-bookworm-official.sarif.json
    docker scout cves registry://postgres:17.11-trixie --platform linux/amd64 --format sarif --output .engineering/evidence/PH-M02-WO-001/postgres-17.11-trixie-official.sarif.json

| Official image | OCI index digest | PostgreSQL | zlib package | Scout findings | LOW / MEDIUM / HIGH / CRITICAL / UNKNOWN | Decision |
|---|---|---:|---|---:|---|---|
| postgres:17.11-bookworm | sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826 | 17.11 | Debian zlib1g 1:1.2.13.dfsg-1 | 117 | 56 / 28 / 29 / 2 / 2 | Rejected; CVE-2026-85091 remains HIGH. |
| postgres:17.11-trixie | sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3 | 17.11 | Debian zlib1g 1:1.3.dfsg+really1.3.1-1+b1 | 102 | 49 / 27 / 24 / 2 / 0 | Rejected; CVE-2026-85091 remains HIGH. |

Raw official-image SARIF and hashes:
- Bookworm: postgres-17.11-bookworm-official.sarif.json, SHA-256 7f60e031b78669b2b817db7a6bb899d2ad41d772dbe24ca41bcc68812ffbe059.
- Trixie: postgres-17.11-trixie-official.sarif.json, SHA-256 511d2a6b11e3b1894cfd8149fbba55d5b8a65c3dbe3680a4b1ac977e41f9cf4b.

The current official Debian packages did not contain Alpine's fixed package revision. Debian's tracker listed the CVE as not fixed for the tested package versions at assessment time. https://security-tracker.debian.org/tracker/CVE-2026-85091

## Selected isolated candidate

Base: postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24.

The committed recipe at docker/postgres/Dockerfile uses only the signed Alpine v3.24/main repository and pins zlib=1.3.2-r1. It asserts base package version 1.3.2-r0, final 1.3.2-r1, and byte-compares sorted Alpine package name/version inventories after excluding the single zlib row. No repository mixing, edge, or general upgrade is used. The Dockerfile leaves PostgreSQL major/minor at 17.11.

Build command:

    docker buildx build --pull --no-cache --platform linux/amd64 --provenance=false --load -f docker/postgres/Dockerfile -t polyhunter-postgres:17.11-alpine3.24-zlib-r1-final .

Selected local image reference/digest:
polyhunter-postgres@sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 (linux/amd64).

Exact new-image Scout SARIF: 57 results: 7 LOW, 26 MEDIUM, 22 HIGH, 2 CRITICAL; 0 suppressions. Compared with the prior exact official Alpine digest (58 results: 7 LOW, 26 MEDIUM, 23 HIGH, 2 CRITICAL), the only result removed is CVE-2026-85091; the set of H/C CVE IDs has no additions. The 24 remaining PostgreSQL H/C occurrences receive fresh, unapproved proposals in postgres-zlib-r1-vex.json.

The built digest is available in this local Docker image store and Compose intentionally uses pull_policy: never; no registry package was published by this correction. This is a portability risk for clean checkouts and is disclosed for independent audit.

## Fix evidence

- Alpine OSV reports Alpine 3.24 fixed package version 1.3.2-r1: https://osv.dev/vulnerability/ALPINE-CVE-2026-85091
- Upstream patch resets zlib's input pointer/available-input fields after nonblocking write failure: https://github.com/madler/zlib/commit/df84af25dc1942490e1d1c899a07619152a46148
- Exact package diff/build: postgres-zlib-r1-build-final.log.
- Current package, libz hash, loader, PG version, role and volume: postgres-image-revalidation-zlib-r1-final.txt.
- ABI SONAME and exported symbol set: postgres-zlib-r1-abi.txt, libz-symbols-old.txt, libz-symbols-fixed.txt.
