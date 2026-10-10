# PostgreSQL zlib image update: PGDATA recovery plan

## Scope and authorization

This plan covers only replacing the local PostgreSQL 17.11 container image to apply Alpine's zlib security fix. It does not change the PostgreSQL major/minor release, database schema, migrations, application role, or named volume. The operator's PH-M02-WO-001 request explicitly authorizes this local image correction and requires the Compose stack to finish healthy. The existing `polyhunter-local-postgres17` volume is persistent and must be preserved.

## Baseline

- Compose project: `polyhunter-local`.
- PostgreSQL container: `polyhunter-postgres`.
- Existing image: `postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.
- Existing named volume: `polyhunter-local-postgres17`, approximately 77.8 MiB, mounted at `/var/lib/postgresql/data`.
- Baseline PostgreSQL role `polyhunter` has `rolsuper=true`; active extension inventory was `plpgsql`.

## Pre-change recovery artifacts

1. `pg_dumpall --username=polyhunter --no-role-passwords` passed with the application services stopped and PostgreSQL healthy. The SQL dump is outside the repository at `%TEMP%\polyhunter-local-postgres-before-zlib-r1.sql`, 48,012 bytes, SHA-256 `06E59021255CFDAB29A9A7FBF4FB8C59D19655BA7FCBB18DB87F73A043637646`. Role password hashes were excluded. The file contents were not inspected or committed.
2. The Compose services stopped cleanly. With PostgreSQL stopped, a read-only source-volume archive was created outside the repository at `%TEMP%\polyhunter-postgres-zlib-r1-physical-backup\polyhunter-local-postgres17-before-zlib-r1.tar.gz`; 13,951,077 bytes, SHA-256 `041E559AF2C3202D9B94ADBDD868C6EBA67A6B0FDCC253C393D8CFAB50345747`. The archive lists `./PG_VERSION` with value `17`. The source volume was mounted read-only and was not removed or overwritten.
3. The original official image remains available by its exact digest for a no-schema-change rollback. The schema, database role and application data were not changed by this image correction.

## Change and rollback

- Change only the PostgreSQL image reference in `compose.yaml` to the exact locally built digest of the zlib-only derivative; `pull_policy: never` prevents an unintended registry lookup.
- Start PostgreSQL and wait for the Compose health check. Then start/verify web and worker.
- If the candidate does not become healthy, stop the stack, restore the prior official digest in Compose, and start against the original named volume. Do not initialize, delete or reformat that volume.
- If the original volume cannot be opened, preserve it untouched. Recovery from the physical archive uses a new, separately named volume and requires an explicit recovery operation; do not overwrite the source volume.
- No application migrations are run against the existing named volume during this correction. Migration and integration gates run only against the disposable candidate volume.

## Recovery test boundary

Initialization, migrations, integration, persistence and crash-recovery tests run on dedicated candidate volumes. The crash/restart probe never targets `polyhunter-local-postgres17`. The offline source-volume archive is retained in the operator's temp directory and is not committed or uploaded.
