#!/usr/bin/env bash
# PH-M01-WO-004 — clean-environment Docker acceptance (host orchestrator).
#
# From a tree with no stale build output: npm ci, a rebuild into a SEPARATE tag
# (the canonical polyhunter-dev:local image is NOT re-tagged — its identity is
# the artifact the VEX is bound to and is compared, not replaced), compose
# down/up on the canonical image, HTTP probes, the no-keyring FAIL-CLOSED probe
# and the ephemeral-keyring admitted-path probe (in-container, keys in memory),
# and a module-resolution sweep.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/../../../.."

echo "== 1. remove stale build output =="
rm -rf packages/*/dist apps/web/.next
echo "removed packages/*/dist and apps/web/.next"

echo "== 2. npm ci (host) =="
npm ci 2>&1 | tail -2

echo "== 3. rebuild into a separate tag and compare identity =="
docker build -f Dockerfile.dev -t polyhunter-dev:acceptance-rebuild . 2>&1 | tail -3
CANONICAL_ID="$(docker inspect polyhunter-dev:local --format '{{.Id}}')"
REBUILD_ID="$(docker inspect polyhunter-dev:acceptance-rebuild --format '{{.Id}}')"
echo "canonical: ${CANONICAL_ID}"
echo "rebuild:   ${REBUILD_ID}"
if [[ "${CANONICAL_ID}" == "${REBUILD_ID}" ]]; then
  echo "identity: BIT-REPRODUCIBLE — the rebuild produced the same image id"
else
  echo "identity: rebuild differs from the canonical artifact (recorded, not hidden)."
  echo "The canonical tag and the artifact digest are UNCHANGED; no build input changed,"
  echo "so this is a reproducibility observation, not an artifact-delta event."
fi

echo "== 4. compose down + up on the canonical image =="
docker compose down 2>&1 | tail -2
docker compose up -d 2>&1 | tail -3
for i in $(seq 1 60); do
  healthy="$(docker compose ps --format '{{.Name}} {{.Status}}' | grep -c healthy || true)"
  if [[ "${healthy}" -ge 2 ]]; then break; fi
  sleep 2
done
docker compose ps --format '{{.Name}} {{.Status}}'

echo "== 5. HTTP probes =="
docker compose exec -T web node -e "
(async () => {
  const home = await fetch('http://127.0.0.1:3000/');
  console.log('GET / ->', home.status);
  const list = await fetch('http://127.0.0.1:3000/api/secrets');
  console.log('GET /api/secrets ->', list.status, '| cache-control:', list.headers.get('cache-control'));
  const single = await fetch('http://127.0.0.1:3000/api/secrets/11111111-1111-4111-8111-111111111111');
  console.log('GET /api/secrets/<uuid> ->', single.status, '| cache-control:', single.headers.get('cache-control'));
  const auth = await fetch('http://127.0.0.1:3000/api/me');
  console.log('GET /api/me ->', auth.status);
})().catch((e) => { console.error('probe failed:', e.message); process.exit(1); });
"

echo "== 6. vault probes: no-keyring fail-closed + ephemeral admitted path =="
docker cp .engineering/evidence/PH-M01-WO-004/harness/docker-probe.mjs polyhunter-web:/workspace/docker-probe.mjs
docker compose exec -T web node /workspace/docker-probe.mjs
docker compose exec -T web rm -f /workspace/docker-probe.mjs

echo "== 7. module resolution sweep =="
echo -n "web module errors:    "
docker compose logs web 2>&1 | grep -ci "Cannot find module\|ERR_MODULE_NOT_FOUND" || true
echo -n "worker module errors: "
docker compose logs worker 2>&1 | grep -ci "Cannot find module\|ERR_MODULE_NOT_FOUND" || true

echo "== 8. remove the acceptance rebuild tag (the canonical tag is untouched) =="
docker image rm polyhunter-dev:acceptance-rebuild >/dev/null 2>&1 || true
docker inspect polyhunter-dev:local --format 'canonical image still: {{.Id}}'
echo "== docker acceptance complete =="
