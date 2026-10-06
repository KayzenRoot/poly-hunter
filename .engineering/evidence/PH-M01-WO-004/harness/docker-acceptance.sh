#!/usr/bin/env bash
# PH-M01-WO-004 audit CR-03 — ONE final artifact for the whole acceptance.
#
# Builds the final candidate from the clean tree, re-tags polyhunter-dev:local
# with THAT build, records its exact digest plus the base-image digest and the
# build-input hashes, then runs compose with --no-build so the running
# containers ARE the recorded candidate (asserted by image id), and executes
# the HTTP/vault/module probes against it.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/../../../.."

echo "== 0. record the artifact that is being replaced =="
docker inspect polyhunter-dev:local --format 'previous local tag: {{.Id}}' || true

echo "== 1. clean tree: remove stale build output =="
rm -rf packages/*/dist apps/web/.next
echo "removed packages/*/dist and apps/web/.next"

echo "== 2. npm ci (host) =="
npm ci 2>&1 | tail -1

echo "== 3. build-input hashes =="
sha256sum Dockerfile.dev package.json package-lock.json tsconfig.base.json \
  apps/web/package.json apps/worker/package.json \
  packages/contracts/package.json packages/domain/package.json \
  packages/db/package.json packages/testkit/package.json

echo "== 4. build the FINAL candidate (pinned base) and tag it =="
docker build -f Dockerfile.dev -t polyhunter-dev:local . 2>&1 | tail -2
FINAL_ID="$(docker inspect polyhunter-dev:local --format '{{.Id}}')"
BASE_ID="$(docker inspect node:24-bookworm-slim --format '{{.Id}}')"
echo "final candidate id: ${FINAL_ID}"
echo "pinned base id:     ${BASE_ID}"
echo "${FINAL_ID}" > /tmp/wo004-final-image-id
echo "${BASE_ID}" > /tmp/wo004-base-image-id

echo "== 5. compose down + up --no-build (the candidate IS the runtime) =="
docker compose down 2>&1 | tail -1
docker compose up -d --no-build 2>&1 | tail -3
for i in $(seq 1 60); do
  healthy="$(docker compose ps --format '{{.Name}} {{.Status}}' | grep -c healthy || true)"
  if [[ "${healthy}" -ge 2 ]]; then break; fi
  sleep 2
done
docker compose ps --format '{{.Name}} {{.Status}}'

echo "== 6. assert the running containers ARE the recorded candidate =="
WEB_IMAGE="$(docker inspect polyhunter-web --format '{{.Image}}')"
WORKER_IMAGE="$(docker inspect polyhunter-worker --format '{{.Image}}')"
echo "web container image:    ${WEB_IMAGE}"
echo "worker container image: ${WORKER_IMAGE}"
if [[ "${WEB_IMAGE}" != "${FINAL_ID}" || "${WORKER_IMAGE}" != "${FINAL_ID}" ]]; then
  echo "FAIL: running containers do not match the final candidate"
  exit 1
fi
echo "OK: web and worker run THE final candidate ${FINAL_ID}"

echo "== 7. HTTP probes =="
docker compose exec -T web node -e "
(async () => {
  const home = await fetch('http://127.0.0.1:3000/');
  console.log('GET / ->', home.status);
  const list = await fetch('http://127.0.0.1:3000/api/secrets');
  console.log('GET /api/secrets ->', list.status, '| cache-control:', list.headers.get('cache-control'));
  const single = await fetch('http://127.0.0.1:3000/api/secrets/11111111-1111-4111-8111-111111111111');
  console.log('GET /api/secrets/<uuid> ->', single.status, '| cache-control:', single.headers.get('cache-control'));
  const me = await fetch('http://127.0.0.1:3000/api/me');
  console.log('GET /api/me ->', me.status);
  const login = await fetch('http://127.0.0.1:3000/auth/login');
  console.log('GET /auth/login ->', login.status);
})().catch((e) => { console.error('probe failed:', e.message); process.exit(1); });
"

echo "== 8. vault probes on the candidate: no-keyring fail-closed + ephemeral path =="
docker cp .engineering/evidence/PH-M01-WO-004/harness/docker-probe.mjs polyhunter-web:/workspace/docker-probe.mjs
docker compose exec -T web node /workspace/docker-probe.mjs
docker compose exec -T web rm -f /workspace/docker-probe.mjs

echo "== 9. module resolution sweep =="
echo -n "web module errors:    "
docker compose logs web 2>&1 | grep -ci "Cannot find module\|ERR_MODULE_NOT_FOUND" || true
echo -n "worker module errors: "
docker compose logs worker 2>&1 | grep -ci "Cannot find module\|ERR_MODULE_NOT_FOUND" || true

echo "== final artifact acceptance complete; candidate: ${FINAL_ID} =="
