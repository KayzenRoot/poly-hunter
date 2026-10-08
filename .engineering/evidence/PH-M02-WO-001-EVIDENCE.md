# PH-M02-WO-001 — Evidence Bundle / review 5455471016

## Status and scope

**Status: implementação validada no head `a8725af302d7b7b21436ade68c49c360ecfb1aa2`; a validação exata do commit de evidências fica registrada pelos checks atuais da PR #43.** O workflow corrigido passou no GitHub Actions Validate e nos gates SonarCloud/Socket desse head de implementação. Para evitar autorreferência, o resultado do commit final, que altera apenas evidências e documentação, é reportado no corpo e nos checks ao vivo da PR, não neste próprio bundle. Isso não aprova VEX, autoriza merge, promoção de checkpoint ou trading.

- Repository: KayzenRoot/poly-hunter; PR #43; Issue #42.
- Branch: feat/ph-m02-public-provider-foundation.
- Work Order base: main@a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c.
- Audited parent HEAD: 9d197abd78eae23173021cbb6e92fbde133a87e2.
- Implementation correction HEAD: `a8725af302d7b7b21436ade68c49c360ecfb1aa2`; GitHub Actions Validate and PR quality/security checks passed there. The final evidence-only HEAD and its exact-head checks are recorded in the current PR #43 body/checks; this bundle does not self-reference its commit.
- Originating zlib review: 5455471016. Active Correction Delta review: 5457414821, limited to CR-07-AUD-02, CR-07-AUD-03 and CR-07-AUD-04. Preflight and exact fingerprint evidence are in postgres-zlib-r1-preflight.md and postgres-zlib-r1-context-lock-validation.json.
- Preflight found the Context Lock's JEV policy fingerprint differs from the committed policy at the audited parent (`expected c163b1ec843dbe3588bc8740074f224e42003c89`, actual `c11093ec10d2a06f7d19f8fafb3ab325d3b7d6d6`). This is the earlier operator-authorized policy hotfix in commit `4956676540ace9be9e7411db65a49a18f7223b49`; this Correction Delta does not modify that policy or expand its scope. The module-plan/work-order fingerprints and other frozen sources match. Context Lock runtime fingerprints are pre-implementation baselines: `package.json`/`package-lock.json` and `Dockerfile.dev` already reflect accepted PH-M02-WO-001 changes (`d298c06`, `82ce781`, `d4b48a8`); `compose.yaml` also includes the previously accepted zlib change at `86a7ed6`, with the current correction's Compose/package-script changes recorded in this delta. Other runtime fingerprints match.
- CR-01 through CR-06 remain accepted; only CR-07 zlib remediation and dependent evidence were changed.
- No PH-M02-WO-002, merge, canonical checkpoint promotion, signing, authenticated trading, or live trading. liveTradingAuthorized=false.

## Correction

The official postgres:17.11-bookworm and postgres:17.11-trixie candidates were scanned first and both retained CVE-2026-85091. They were rejected. The selected image is a minimal derivative of the official pinned PostgreSQL 17.11 Alpine 3.24 image. Only zlib changed from 1.3.2-r0 to 1.3.2-r1 using Alpine v3.24/main; the build asserts all other package name/version pairs are unchanged. There was no repository mixing or general upgrade. The PostgreSQL Dockerfile and Compose image reference are the only runtime product configuration changes; supporting changes are limited to the image lock/build helper, npm command routing, CI validation, documentation and evidence. No application logic, schema, migration or trading capability changed.

The canonical image is built from the exact official base digest by scripts/postgres-image.mjs and checked against docker/postgres/image.lock.json before Compose starts. Two independent --pull --no-cache BuildKit exports produced the same manifest sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 and config sha256:6cfbc1caf64a3c8a85c062ca25eec78a2db1b0edbdca55906ce3d0d376e23e93. A clean checkout uses the documented npm run docker:up entry point, which builds and verifies this exact image, validates Compose configuration and only then starts the stack without a second implicit build. A digest mismatch fails closed before Compose startup. The corrected image was not published to a registry.

## Scan evidence

Docker Scout CLI 1.24.0, no per-result suppressions.

| Image | Digest | Results | LOW | MEDIUM | HIGH | CRITICAL | SARIF SHA-256 |
|---|---|---:|---:|---:|---:|---:|---|
| polyhunter-dev:local (prior snapshot) | sha256:1da515470671ec8175b1a1ff77dc408c333c0121f862f23f351288fb19d81fd1 | 35 | 26 | 7 | 2 | 0 | 3e61ddbfbad2ca881db4de09a2668be4700ac1d83e2a3d7bd31571f37c061cbc |
| polyhunter-dev:local (fresh rebuilt image) | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948 | 34 | 26 | 7 | 1 | 0 | 25a4020d28f8d5e3d55a19f9c52e02ddaa549aade93804cf92bebab6e4f68622 |
| PostgreSQL 17.11 zlib-r1 (locked current image) | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 | 57 | 7 | 26 | 22 | 2 | 3f4d8afede798486bbb63be076a175fb0047d33116e2e3d94695862e88f89c14 |

The prior official Alpine digest scan was 58 results (7 LOW / 26 MEDIUM / 23 HIGH / 2 CRITICAL). Set reconciliation removed only CVE-2026-85091; no new H/C ID appeared. The locked image has 24 H/C occurrences (22 HIGH, 2 CRITICAL). Each retains a proposed NOT_AFFECTED record in postgres-zlib-r1-vex.json; all 24 remain UNDER_INVESTIGATION with independentAuditor=null, ownerApproval=null and executorSelfApproval=false. Go stdlib/gosu rows now reflect the non-root postgres entrypoint, which skips gosu; the libxml2 row retains its PH-SEC-WO-003-specific reachability assessment. No proposal is approved and prior exact-digest approvals were not transferred. The fresh dev scan reports one current HIGH (zlib); its GCC proposal remains historical and UNDER_INVESTIGATION because it is absent from the fresh scan. All 29 VEX proposals remain unapproved.

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
- PostgreSQL fresh initialization: PASS on a disposable candidate volume using the exact locked digest.
- npm run db:migrate --workspace @polyhunter/db: PASS on a fresh disposable candidate database; cr07-candidate-migrations.txt.
- npm run test:integration: PASS; 4 files / 66 tests on a fresh disposable candidate database; cr07-candidate-integration.txt.
- Persistence/recovery: PASS; marker survived forced crash/restart and PostgreSQL recovered on the disposable volume; cr07-candidate-recovery.txt. The volume was retained and not deleted.
- Main persistent PGDATA: preserved. Before image swap, a logical pg_dumpall and a read-only physical volume archive were verified; details, sizes and SHA-256 values in postgres-pgdata-recovery-plan.md. No migration/integration/crash test ran against the main volume; no volume was deleted.
- Current Compose: postgres healthy on exact digest, web healthy and HTTP 200 at http://localhost:3000, worker running, PostgreSQL port unpublished. Current snapshot: cr07-compose-runtime-final.txt.
- `npm ci` — PASS; summary receipt: cr07-npm-ci-result.txt.
- `npm run validate` — initial attempt had two 5-second unit-test timeouts during concurrent Docker export; the two complete runs after export completion passed (15 files / 238 tests), with raw output in cr07-npm-validate-retry.txt and cr07-npm-validate-final.txt.
- Evidence-update rerun: `npm run validate` — PASS; raw output in `cr07-npm-validate-evidence-update.txt` (lint, formatting, typecheck, 15 files / 238 tests, builds and npm audit).
- Evidence-update security boundary suite — PASS; 5 files / 103 tests; raw output in `cr07-security-boundary-evidence-update.txt`.
- `npm audit --audit-level=high` — PASS; zero vulnerabilities; explicit final output: cr07-npm-audit-final.txt.
- Focused security boundary suite — PASS, 5 files / 103 tests; raw output: `security-boundary-tests-zlib-r1-final.txt`.
- `docker compose -p polyhunter-local config --quiet` — PASS. Final live stack recheck: PostgreSQL running/healthy on the exact digest, web HTTP 200/healthy at `http://localhost:3000`, worker running; current raw snapshot: `cr07-compose-runtime-final.txt`.
- `git diff --check`, JSON/VEX consistency and Evidence Bundle hash validation are captured in `cr07-evidence-integrity.txt`.
- First hosted attempt: [GitHub Actions run 37805774337](https://github.com/KayzenRoot/poly-hunter/actions/runs/37805774337), exact input head `add8d8b0d216fe756922f2b88da78ebc21f1fefa`; failed in the image-build step because GitHub's default Buildx `docker` driver does not support the `type=docker` exporter. No image or downstream tests ran. The workflow now creates/bootstraps a `docker-container` Buildx builder and removes it during always-run cleanup. Sanitized receipt: `cr07-ci-buildx-driver-failure.txt`.
- Corrected implementation-head CI: [GitHub Actions Validate run 37806245360](https://github.com/KayzenRoot/poly-hunter/actions/runs/37806245360) passed on `a8725af302d7b7b21436ade68c49c360ecfb1aa2`. Buildx setup, exact PostgreSQL image build/runtime checks, `npm ci`, required validation, migrations, PostgreSQL integration and receipt upload all passed. The downloaded receipt `ci-postgres-runtime-a8725.json` records the exact image/config digest and runtime identity. SonarCloud Code Analysis and both Socket checks also passed; CodeRabbit skipped because the PR remains draft.
- Exact final scan invocation, image archive SHA-256, SARIF SHA-256, tool identity and Scout's nonfatal Windows archive-name warning are recorded in `postgres-zlib-r1-scan-receipt.json`.
- Text command receipts have terminal trailing padding and surplus final blank lines trimmed for clean diffs; command data is unchanged. Raw Scout SARIF remains byte-preserved, and dependent evidence hashes were refreshed.
- TypeSafe JEV 1.13.0 bounded pre-gate returned `ESCALATE` (composite `0.694142857`, `safe_to_apply=0.17`; 2 claims verified, 3 unsupported, 3 needing review; no contradicted claims). The receipt is `jev-cr07-aud-02-04-gate.json`. It verified matching independent-build identities and the unapproved VEX state, while it could not establish the clean-checkout/workflow/non-root claims at the time of review. The first hosted attempt exposed an exporter-driver mismatch, corrected and then passed in run 37806245360. JEV is advisory, cannot approve CVEs, and received no secrets.

## PostgreSQL application role risk

Role polyhunter has rolsuper=true in the exact final local database. Classification: HIGH privilege blast radius in local development. This does not establish SQL injection. Recommend a separately approved least-privilege runtime-role follow-up before broader or production exposure. The issue, evidence and recommendation are in postgres-superuser-risk.md; no role/schema changes are in this scope.

## Evidence index

- Fresh current PostgreSQL VEX: postgres-zlib-r1-vex.json and CR-07-VEX.md.
- Machine scanner rollup: security-scans.json; human scan summary: security-scans.md.
- Official and selected candidates: postgres-zlib-r1-official-candidates.md and raw SARIF.
- Recovery plan/receipts: postgres-pgdata-recovery-plan.md, postgres-prechange-stack-and-backup.txt, postgres-recovery-zlib-r1-final.txt.
- Build/runtime/test receipts and raw final SARIF are in .engineering/evidence/PH-M02-WO-001/.
- Hosted PostgreSQL receipt for implementation head `a8725af` is `ci-postgres-runtime-a8725.json`; final evidence-commit checks are linked from PR #43.
- Exact scan invocation and validation output: `postgres-zlib-r1-scan-receipt.json` and `postgres-zlib-r1-final-validation.txt`; JEV advisory receipt: `jev-postgres-zlib-r1-final-gate.json`.
- Proposed checkpoint delta: .engineering/checkpoint-deltas/PH-M02-WO-001.md; not promoted.

## Approval and remaining risks

The 24 current PostgreSQL proposals and the existing dev proposals are not approvals. Independent security audit and explicit owner approval remain required by ADR-0007. Raw Scout findings stay visible. A reviewer may reject any proposal, especially those whose prior evidence must be accepted against the changed image digest.

The image is local-only and not published to a registry; clean-checkout portability is provided by the fail-closed pinned build helper and locked manifest/config digests. Building requires Docker Buildx timestamp-rewrite support and access to the exact official base plus Alpine v3.24/main. The app database role remains superuser. Proposed VEX rows expire 2026-10-15T23:59:59Z or earlier on digest, scan, advisory, KEV, runtime, exposure or evidence changes. All 29 proposals remain unapproved.

## Stop condition

Implementation-head validation passed on `a8725af302d7b7b21436ade68c49c360ecfb1aa2`. The final evidence-only commit is eligible for `READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT` only when its exact-head GitHub Actions Validate, SonarCloud and required PR checks pass; those live results are intentionally tracked in PR #43 to avoid a self-referential bundle. All 29 proposals remain unapproved. Do not merge, promote the canonical checkpoint, start WO-002, sign, or enable trading.

## Project Progress Snapshot

Review: PH-M02-WO-001 / PR #43 — CORRECTION REQUIRED on input review 5457414821; only CR-07-AUD-02/-03/-04 are in this correction pass. Audited parent head `86a7ed6b0b6eea350a36873c1313c6f9db183176`; final correction head and exact-head CI are recorded in PR #43.

Canonical completed through: PH-M01 (`M01_IMPLEMENTATION_COMPLETE / STOP_AFTER_PH_M01_WO_004`).
Canonical completion: N/A (production denominator is 0).
Estimated MVP completion: ~17–22% done / ~78–83% remaining.
Active module/WO: PH-M02-WO-001 ~100% executor evidence complete; independent audit and required owner VEX dispositions remain external gates. This is not canonical module completion.

Done:
- PH-M00 and PH-M01 are canonically complete through the current Checkpoint.
- PH-M02-WO-001 provider foundation and CR-01 through CR-06 have prior accepted evidence.
- CR-07 zlib remediation was followed by the bounded AUD-02/-03/-04 correction: reproducible locked PostgreSQL image, exact-head CI, non-root startup, SonarCloud gate remediation, and fresh exact-image evidence. The 29 proposals remain unapproved.

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
