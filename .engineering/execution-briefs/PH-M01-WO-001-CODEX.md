# PH-M01-WO-001 — Codex Execution Brief

Execute `PH-M01-WO-001` on branch `feat/ph-m01-tenancy-persistence`.

1. Read `AGENTS.md`, the exact Work Order and `.engineering/context-locks/PH-M01-WO-001.json` before mutation.
2. Verify HEAD lineage includes base `e1237cda839829a6a4eedba3b9917d6ee45c6352` and all 16 critical-source fingerprints match. If stale, STOP.
3. Verify Docker Engine/Compose are healthy and the existing local PolyHunter stack is running or can be started.
4. Preflight npm registry for the current stable versions of the approved PostgreSQL/Drizzle dependencies, prove Node 24 compatibility, then exact-pin direct dependencies. Do not change the frozen architecture.
5. Implement only PH-M01-WO-001.
6. Add PostgreSQL 17 to local Compose and keep web at http://localhost:3000 plus worker running.
7. Prove migrations against multiple independent fresh databases, schema constraints and two-tenant isolation. Do not fake database tests with mocks.
8. Run every Work Order check, including clean npm install, full validation, integration tests, audit, Docker health and diff/secret review.
9. For HIGH_ASSURANCE evidence, explicitly document:
   - exact base/head SHA;
   - dependency/image versions and image digest;
   - migration files/hashes and forward/recovery procedure;
   - tenant A/B adversarial cases and expected denials;
   - DB connection/cleanup behavior;
   - CI receipts and security scanner findings;
   - residual risks and proposed Checkpoint Delta.
10. Create/update `.engineering/evidence/PH-M01-WO-001-EVIDENCE.md`.
11. Commit/push on the same branch and update PR #15 if it exists; otherwise open a draft PR to main titled `feat(m01): tenancy and persistence foundation`.
12. LEAVE the local Docker stack running at STOP CONDITION for owner inspection.
13. Final report in Brazilian Portuguese.

STOP CONDITION: PH-M01-WO-001 is functional, tested, documented and PR-ready, or a real BLOCKED state exists. Do not start Supabase Auth, encrypted secret vault, Polymarket or PH-M01-WO-002+.
