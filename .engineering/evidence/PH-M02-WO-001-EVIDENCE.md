# PH-M02-WO-001 — Evidence Bundle / review 5455471016

## Status and scope

**Executor stop state: READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT.** This means the requested zlib remediation and evidence work are complete and ready for independent review. It is not an APPROVED VEX verdict, merge approval, checkpoint promotion, or trading authorization. Raw H/C findings still block promotion until fresh independent audit and owner approval.

- Repository: KayzenRoot/poly-hunter; PR #43; Issue #42.
- Branch: feat/ph-m02-public-provider-foundation.
- Work Order base: main@a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c.
- Audited parent HEAD: 9d197abd78eae23173021cbb6e92fbde133a87e2.
- Final correction HEAD and exact-head CI are recorded in PR #43 after push; this bundle does not self-reference its commit.
- Review: 5455471016; preflight and exact fingerprint evidence are in postgres-zlib-r1-preflight.md and postgres-zlib-r1-context-lock-validation.json.
- CR-01 through CR-06 remain accepted; only CR-07 zlib remediation and dependent evidence were changed.
- No PH-M02-WO-002, merge, canonical checkpoint promotion, signing, authenticated trading, or live trading. liveTradingAuthorized=false.

## Correction

The official postgres:17.11-bookworm and postgres:17.11-trixie candidates were scanned first and both retained CVE-2026-85091. They were rejected. The selected image is a minimal derivative of the official pinned PostgreSQL 17.11 Alpine 3.24 image. Only zlib changed from 1.3.2-r0 to 1.3.2-r1 using Alpine v3.24/main; the build asserts all other package name/version pairs are unchanged. There was no repository mixing or general upgrade. The Dockerfile and Compose are the only product configuration files changed.

The local immutable image reference is polyhunter-postgres@sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 (linux/amd64). Compose pins this digest and uses pull_policy: never. No registry publication was performed; a clean clone must build/obtain the exact local image artifact before starting Compose. This is an explicit portability limitation for independent review.

## Scan evidence

Docker Scout CLI 1.24.0, no per-result suppressions.

| Image | Digest | Results | LOW | MEDIUM | HIGH | CRITICAL | SARIF SHA-256 |
|---|---|---:|---:|---:|---:|---:|---|
| polyhunter-dev:local | sha256:1da515470671ec8175b1a1ff77dc408c333c0121f862f23f351288fb19d81fd1 | 35 | 26 | 7 | 2 | 0 | 3e61ddbfbad2ca881db4de09a2668be4700ac1d83e2a3d7bd31571f37c061cbc |
| PostgreSQL 17.11 zlib-r1 | sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 | 57 | 7 | 26 | 22 | 2 | 3f4d8afede798486bbb63be076a175fb0047d33116e2e3d94695862e88f89c14 |

The prior official Alpine digest scan was 58 results (7 LOW / 26 MEDIUM / 23 HIGH / 2 CRITICAL). Set reconciliation removed only CVE-2026-85091; no new H/C ID appeared. The new image has 24 H/C occurrences (22 HIGH, 2 CRITICAL). Every one was individually revalidated and has a fresh proposed NOT_AFFECTED record in postgres-zlib-r1-vex.json; all remain UNDER_INVESTIGATION with independentAuditor=null, ownerApproval=null, executorSelfApproval=false. Previous exact-digest approvals were not transferred. The unchanged dev findings remain under prior unapproved proposals.

The fresh KEV catalog is 2026.10.04; none of the current PostgreSQL H/C CVEs is listed. EPSS is refreshed as of 2026-10-07 and is prioritization context only. Receipts: cisa-kev-postgres-zlib-r1-final.json and epss-postgres-zlib-r1-final.json.

## zlib fix and compatibility

- Official fix facts: Alpine 3.24 advisory data marks zlib 1.3.2-r1 fixed; upstream commit df84af25dc1942490e1d1c899a07619152a46148 clears stale deflate input pointer/length state after a nonblocking write fails. Debian's tracker still listed the tested Bookworm and Trixie zlib versions as vulnerable/unfixed. Sources: [Alpine advisory data](https://osv.dev/vulnerability/ALPINE-CVE-2026-85091), [Debian CVE tracker](https://security-tracker.debian.org/tracker/CVE-2026-85091), and [upstream zlib fix](https://github.com/madler/zlib/commit/df84af25dc1942490e1d1c899a07619152a46148).
- Exact library: /usr/lib/libz.so.1.3.2; SHA-256 ecc8b9dfc45eb7fa29b410ffaca6257873890de53b80fe91735737b49067c5f2. SONAME libz.so.1.
- GNU binutils readelf/nm 2.45.1 in ephemeral inspector containers: 111 exported names were equal between old and new library; symbol-list SHA-256 3a590bbd310d754b854576219134ba3858fef69d7c416f57ebff8fe69ccd5f5b.
- PostgreSQL remains 17.11; final runtime dynamically resolves the patched library. The image check records package inventory, libxml/gosu hashes, loader output, exact role/extensions and current persistent volume.

## Validation and database safety

- Official candidate scans: PASS, receipts and SARIF in postgres-zlib-r1-official-candidates.md and peer files.
- Final candidate clean rebuild using --pull --no-cache: PASS; exact package change asserted; final digest and build log in postgres-zlib-r1-build-final.log.
- Exact final Scout SARIF: PASS; 57 records, 0 suppressions, one baseline H/C removed, no H/C additions.
- ABI comparison: PASS; SONAME and exported symbol list equal.
- PostgreSQL fresh initialization: PASS on disposable candidate volume.
- npm run db:migrate: PASS on disposable candidate database; receipt db-migrate-zlib-r1-final.txt.
- npm run test:integration: PASS; 4 files, 66 tests on disposable candidate database; receipt postgres-integration-zlib-r1-final.txt.
- Persistence/recovery: PASS; test marker survived PostgreSQL forced crash/restart and automatic recovery on a disposable volume; receipt postgres-recovery-zlib-r1-final.txt.
- Main persistent PGDATA: preserved. Before image swap, a logical pg_dumpall and a read-only physical volume archive were verified; details, sizes and SHA-256 values in postgres-pgdata-recovery-plan.md. No migration/integration/crash test ran against the main volume; no volume was deleted.
- Current Compose: postgres healthy on exact digest, web healthy and HTTP 200 at http://localhost:3000, worker running, PostgreSQL port unpublished. Current snapshot: postgres-compose-runtime-zlib-r1-final.txt.
- `npm run validate` — PASS (lint, format, typecheck, unit tests, workspace builds, Next production build and npm audit); raw output: `npm-validate-zlib-r1-final.txt`.
- `npm audit --audit-level=high` — PASS; zero vulnerabilities; raw output: `npm-audit-zlib-r1-final.txt`.
- Focused security boundary suite — PASS, 5 files / 103 tests; raw output: `security-boundary-tests-zlib-r1-final.txt`.
- `docker compose -p polyhunter-local config --quiet` — PASS. Final live stack recheck: PostgreSQL running/healthy on the exact digest, web HTTP 200/healthy at `http://localhost:3000`, worker running; current raw snapshot: `postgres-compose-runtime-zlib-r1-final.txt`.
- `git diff --check` and evidence schema/hash validation are captured in the final local validation receipt; GitHub Actions Validate is checked on the final pushed HEAD and recorded in PR #43.
- Exact final scan invocation, image archive SHA-256, SARIF SHA-256, tool identity and Scout's nonfatal Windows archive-name warning are recorded in `postgres-zlib-r1-scan-receipt.json`.
- Text command receipts have terminal trailing padding and surplus final blank lines trimmed for clean diffs; command data is unchanged. Raw Scout SARIF remains byte-preserved, and dependent evidence hashes were refreshed.
- TypeSafe JEV 1.13.0 gate: `ESCALATE` (composite 0.79975; safe_to_apply 0.16; verification 7 verified / 2 unsupported / 4 review). It is advisory only and does not approve any CVE. I manually checked the source/config and exact receipts for its low-confidence items; the unsupported authorization statement is grounded in the operator request and canonical checkpoint. Receipt: `jev-postgres-zlib-r1-final-gate.json`.

## PostgreSQL application role risk

Role polyhunter has rolsuper=true in the exact final local database. Classification: HIGH privilege blast radius in local development. This does not establish SQL injection. Recommend a separately approved least-privilege runtime-role follow-up before broader or production exposure. The issue, evidence and recommendation are in postgres-superuser-risk.md; no role/schema changes are in this scope.

## Evidence index

- Fresh current PostgreSQL VEX: postgres-zlib-r1-vex.json and CR-07-VEX.md.
- Machine scanner rollup: security-scans.json; human scan summary: security-scans.md.
- Official and selected candidates: postgres-zlib-r1-official-candidates.md and raw SARIF.
- Recovery plan/receipts: postgres-pgdata-recovery-plan.md, postgres-prechange-stack-and-backup.txt, postgres-recovery-zlib-r1-final.txt.
- Build/runtime/test receipts and raw final SARIF are in .engineering/evidence/PH-M02-WO-001/.
- Exact scan invocation and validation output: `postgres-zlib-r1-scan-receipt.json` and `postgres-zlib-r1-final-validation.txt`; JEV advisory receipt: `jev-postgres-zlib-r1-final-gate.json`.
- Proposed checkpoint delta: .engineering/checkpoint-deltas/PH-M02-WO-001.md; not promoted.

## Approval and remaining risks

The 24 current PostgreSQL proposals and the existing dev proposals are not approvals. Independent security audit and explicit owner approval remain required by ADR-0007. Raw Scout findings stay visible. A reviewer may reject any proposal, especially those whose prior evidence must be accepted against the changed image digest.

The local image digest is not published to a registry, so clean-checkout portability depends on building/obtaining the candidate artifact. The app database role remains superuser. Proposed VEX rows expire 2026-10-15T23:59:59Z or earlier on digest, scan, advisory, KEV, runtime, exposure or evidence changes.

## Stop condition

READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT. Stop here for the same PR #43 independent exact-head audit. Do not merge, promote the canonical checkpoint, start WO-002, sign, or enable trading.

## Project Progress Snapshot

Review: PH-M02-WO-001 / PR #43 — CORRECTION REQUIRED on input review 5455471016; correction response is executor-ready for independent audit — audited parent head `9d197abd78eae23173021cbb6e92fbde133a87e2` (final correction head and exact-head CI are in PR #43).

Canonical completed through: PH-M01 (`M01_IMPLEMENTATION_COMPLETE / STOP_AFTER_PH_M01_WO_004`).
Canonical completion: N/A (production denominator is 0).
Estimated MVP completion: ~17–22% done / ~78–83% remaining.
Active module/WO: PH-M02-WO-001 ~100% executor evidence complete; independent audit and required owner VEX dispositions remain external gates. This is not canonical module completion.

Done:
- PH-M00 and PH-M01 are canonically complete through the current Checkpoint.
- PH-M02-WO-001 provider foundation and CR-01 through CR-06 have prior accepted evidence.
- CR-07 remediation-first delta updates PostgreSQL zlib to Alpine 3.24 `1.3.2-r1`, validates the exact image/runtime, and records fresh unapproved proposals for every remaining PostgreSQL H/C finding.

Remaining:
- Independent audit and explicit owner decisions for current H/C VEX proposals; resolve any correction they identify.
- Necessary modules PH-M02 remainder, PH-M03 through PH-M09, PH-M11 and PH-M12. PH-M10 is IMPORTANT; PH-M13/PH-M14 are FUTURE and excluded from the MVP denominator.

Estimated time:
- Next milestone: about 1–3 executor prompts if audit requests corrections, plus 1 audit/owner decision cycle; wall-clock time is externally gated and unknown.
- MVP: unknown until remaining Work Orders are frozen and security/live-acceptance gates are sized.
- External waits: independent security review and project-owner VEX decisions.

Estimated prompts:
- To next milestone: ~1–3 Codex prompts plus one review/owner decision cycle (estimate; depends on independent review outcome).
- To MVP: ~12–25 Codex prompts (LOW-confidence estimate; later Work Orders are not frozen).
- Review/correction cycles: ~1–3 for this increment; ~8–15 across remaining increments (estimate).

Confidence: LOW.
Basis: canonical Checkpoint, frozen Backlog, PR #43 exact-head CI, and this Evidence Bundle. The completion percentage is an estimate because canonical production weighting is uninitialized and the remaining Work Orders are not admitted.
