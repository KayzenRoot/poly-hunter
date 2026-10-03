# PH-M00-WO-002 — Codex Execution Brief

Execute PH-M00-WO-002 on branch `feat/ph-m00-local-docker`.

1. Read `AGENTS.md`, the exact Work Order and `.engineering/context-locks/PH-M00-WO-002.json` first.
2. Verify HEAD lineage includes base `518aef27896cfb83257c60bfa8baa90636e08588` and all critical-source fingerprints still match. If stale, STOP.
3. Implement only the local Docker development runtime.
4. Ensure the final developer workflow is simple:
   - `npm run docker:up`
   - open `http://localhost:3000`
   - `npm run docker:logs` for web/worker logs
   - `npm run docker:down` only when the owner wants to stop it.
5. Prove Docker config/build/up, web health, worker running, web hot reload and worker restart/reload.
6. Run existing `npm ci`, `npm run validate` and `npm audit --audit-level=high`.
7. Produce `.engineering/evidence/PH-M00-WO-002-EVIDENCE.md` with Docker/Compose versions, exact base/head SHA, files/dependencies, command outputs, service status, localhost proof, reload proof, security findings and proposed checkpoint delta.
8. Commit/push and update PR #11 if it exists; otherwise open a PR titled `feat(docker): local development runtime`.
9. LEAVE THE DOCKER STACK RUNNING at the STOP CONDITION so the owner can keep watching development locally.
10. Final report in Brazilian Portuguese.

STOP CONDITION: local Docker runtime functional/tested/documented, web visible on localhost:3000, worker running, stack left up, and PR ready for audit. Do not begin PH-M01.
