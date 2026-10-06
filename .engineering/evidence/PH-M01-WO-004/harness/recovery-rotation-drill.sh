#!/usr/bin/env bash
# PH-M01-WO-004 — disposable recovery + rotation drill (host orchestrator).
#
# Everything happens in a DISPOSABLE database and with EPHEMERAL test keys:
#   - the database is created for this run and dropped at the end;
#   - k1/k2 and the canary are generated in this shell, passed to the container
#     ONLY over the exec stdin pipe, and never written to any file, argv, env or
#     receipt. This transcript prints no key material and no canary.
#
# Steps: empty DB -> migrations -> seeded PH-M01 state via admitted vault paths
# -> pg_dump -> destroy DB -> fresh DB -> pg_restore -> migrate no-op ->
# verify (isolation, metadata, decrypt with v1) -> missing-v1 fails closed ->
# re-introduce v1, active v2, rotate -> k2-only decrypt -> cleanup.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/../../../.."

HARNESS_HOST=".engineering/evidence/PH-M01-WO-004/harness/drill-vault.mjs"
# The web container bind-mounts only apps/ and packages/* (plus the vitest
# config), so the harness is copied into the container instead of executed from
# the mount. It is removed again during cleanup.
HARNESS="/workspace/drill-vault.mjs"
DB="phm01_drill_$(node -e 'console.log(require("node:crypto").randomBytes(8).toString("hex"))')"
DUMP_PATH="/tmp/${DB}.dump"
PSQL=(docker compose exec -T postgres psql -U polyhunter)

if ! [[ "$DB" =~ ^phm01_drill_[0-9a-f]{16}$ ]]; then
  echo "refusing unexpected drill database name"; exit 1
fi

echo "== drill database: ${DB} (disposable) =="
docker cp "${HARNESS_HOST}" polyhunter-web:"${HARNESS}"

echo "== 1. empty DB -> migrations =="
"${PSQL[@]}" -d postgres -c "CREATE DATABASE ${DB}" >/dev/null
# drizzle-kit resolves `out: ./drizzle` from the CURRENT DIRECTORY, so the
# invocation must run from packages/db (learned the hard way: from the repo root
# it exits 1 silently without contacting PostgreSQL).
docker compose exec -T -e \
  DATABASE_URL="postgresql://polyhunter:polyhunter-local-only@postgres:5432/${DB}" \
  web sh -c "cd packages/db && npx drizzle-kit migrate" 2>&1 | tail -2

echo "== 2. migration repeat on the same DB (must be a no-op) =="
docker compose exec -T -e \
  DATABASE_URL="postgresql://polyhunter:polyhunter-local-only@postgres:5432/${DB}" \
  web sh -c "cd packages/db && npx drizzle-kit migrate" 2>&1 | tail -2

echo "== 3. seed representative PH-M01 state + v1 secret via the vault =="
K1="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))')"
K2="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))')"
CANARY="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))')"
payload() {
  # Emits the phase JSON on stdout; the caller pipes it into the container.
  node -e '
    const [k1, k2, canary, mode] = process.argv.slice(1);
    const keyringFor = (active, keys) => ({
      activeKeyVersion: active,
      keyringJson: JSON.stringify(keys),
    });
    if (mode === "seed" || mode === "verify") {
      process.stdout.write(JSON.stringify({
        keyring: keyringFor("k1", { k1 }),
        canary,
      }));
    } else if (mode === "missing") {
      process.stdout.write(JSON.stringify({
        keyring: keyringFor("k2", { k2 }),
        canary,
      }));
    } else {
      process.stdout.write(JSON.stringify({
        keyring: keyringFor("k2", { k1, k2 }),
        canary,
        k2Only: k2,
      }));
    }
  ' "$K1" "$K2" "$CANARY" "$1"
}
SEED_OUT="$(payload seed | docker compose exec -T -e \
  DATABASE_URL="postgresql://polyhunter:polyhunter-local-only@postgres:5432/${DB}" \
  web node "${HARNESS}" seed "${DB}")"
printf '%s\n' "${SEED_OUT}"
TENANT_A="$(printf '%s\n' "${SEED_OUT}" | sed -n 's/^seed: tenantA=\([0-9a-f-]*\) .*/\1/p')"
USER_A="$(printf '%s\n' "${SEED_OUT}" | sed -n 's/^seed: tenantA=[^ ]* userA=\([0-9a-f-]*\) .*/\1/p')"
SECRET_A="$(printf '%s\n' "${SEED_OUT}" | sed -n 's/^seed: tenantA=[^ ]* userA=[^ ]* secretA=\([0-9a-f-]*\)$/\1/p')"
TENANT_B="$(printf '%s\n' "${SEED_OUT}" | sed -n 's/^seed: tenantB=\([0-9a-f-]*\) .*/\1/p')"
USER_B="$(printf '%s\n' "${SEED_OUT}" | sed -n 's/^seed: tenantB=[^ ]* userB=\([0-9a-f-]*\) .*/\1/p')"
HASH_BEFORE="$(printf '%s\n' "${SEED_OUT}" | sed -n 's/^seed: envelopeHashA=\([0-9a-f]*\)$/\1/p')"
if [[ -z "${TENANT_A}" || -z "${USER_A}" || -z "${SECRET_A}" || -z "${TENANT_B}" || -z "${USER_B}" || -z "${HASH_BEFORE}" ]]; then
  echo "seed output could not be parsed"; exit 1
fi
echo "(ids captured: tenantA, userA, secretA, tenantB, userB and the envelope hash; no key material printed)"

echo "== 4. logical backup (pg_dump -Fc) =="
docker compose exec -T postgres pg_dump -U polyhunter -Fc -d "${DB}" -f "${DUMP_PATH}"
docker compose exec -T postgres sh -c "ls -l ${DUMP_PATH}" | awk '{print "dump size bytes:", $5}'

echo "== 5. destroy the database =="
"${PSQL[@]}" -d postgres -c "DROP DATABASE ${DB}" >/dev/null
echo "database dropped"

echo "== 6. fresh database + restore (pg_restore) =="
"${PSQL[@]}" -d postgres -c "CREATE DATABASE ${DB}" >/dev/null
docker compose exec -T postgres pg_restore -U polyhunter -d "${DB}" "${DUMP_PATH}"
echo "restore completed (exit 0)"

echo "== 7. roll-forward guidance: migrations re-applied on the restored DB =="
docker compose exec -T -e \
  DATABASE_URL="postgresql://polyhunter:polyhunter-local-only@postgres:5432/${DB}" \
  web sh -c "cd packages/db && npx drizzle-kit migrate" 2>&1 | tail -2

echo "== 8. verify restored state: isolation, metadata, authorized decrypt =="
payload verify | docker compose exec -T -e \
  DATABASE_URL="postgresql://polyhunter:polyhunter-local-only@postgres:5432/${DB}" \
  web node "${HARNESS}" verify-restored "${DB}" "${TENANT_A}" "${USER_A}" "${SECRET_A}" "${TENANT_B}" "${USER_B}"

echo "== 9. required old key version missing: fail closed, row intact =="
payload missing | docker compose exec -T -e \
  DATABASE_URL="postgresql://polyhunter:polyhunter-local-only@postgres:5432/${DB}" \
  web node "${HARNESS}" missing-key "${DB}" "${TENANT_A}" "${USER_A}" "${SECRET_A}"

echo "== 10. re-introduce v1, active v2, rotate; k2-only decrypt afterwards =="
payload rotate | docker compose exec -T -e \
  DATABASE_URL="postgresql://polyhunter:polyhunter-local-only@postgres:5432/${DB}" \
  web node "${HARNESS}" rotate "${DB}" "${TENANT_A}" "${USER_A}" "${SECRET_A}" "${HASH_BEFORE}"

echo "== 11. cleanup: drop the database, the dump, and the copied harness =="
"${PSQL[@]}" -d postgres -c "DROP DATABASE ${DB}" >/dev/null
echo "dropped ${DB}"
docker compose exec -T postgres sh -c "rm -f ${DUMP_PATH}"
docker compose exec -T web rm -f "${HARNESS}"
K1=""; K2=""; CANARY=""
echo "== drill complete: test keys and canary discarded (never persisted) =="
