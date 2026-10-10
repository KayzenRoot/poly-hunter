# PostgreSQL zlib-r1 image — fresh VEX revalidation

- Work Order: PH-M02-WO-001; prior corrections preserved; current security correction review 5461309598; PR #43. Earlier scan/image history remains below; current dev image and VEX state are in CR-07-AUD-08. The old Debian assessment in AUD-07 is historical and digest-bound.
- Exact image: polyhunter-postgres@sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 (linux/amd64; config sha256:6cfbc1caf64a3c8a85c062ca25eec78a2db1b0edbdca55906ce3d0d376e23e93).
- Base: postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24.
- Current scanner: Docker Scout CLI 1.24.0; raw SARIF SHA-256 3f4d8afede798486bbb63be076a175fb0047d33116e2e3d94695862e88f89c14.
- Deterministic build lock: `docker/postgres/image.lock.json`; build receipt and two matching BuildKit manifest/config receipts are in `cr07-portability-build-receipt.json` and `postgres-cr07-aud-02-04-reproducibility.json`.
- Exact scan command, image archive SHA-256 and Scout warning are preserved in `postgres-cr07-aud-02-04-scan-receipt.json`.
- Exact VEX JSON: postgres-zlib-r1-vex.json, which carries the per-CVE symbol, runtime, source, attacker-input, prerequisite, KEV, EPSS, network/privilege, evidence, and no-approval fields.

## Result

Implementation head `a8725af302d7b7b21436ade68c49c360ecfb1aa2` passed GitHub Actions Validate (run 37806245360), including image build/runtime identity, validation gates, migrations and PostgreSQL integration; SonarCloud and Socket checks also passed. The downloaded runtime receipt is `ci-postgres-runtime-a8725.json`. The exact checks for the final evidence-only commit are tracked live in PR #43 to avoid a self-referential bundle. This does not clear raw scanner findings. The zlib finding is FIXED in the locked PostgreSQL digest only; all 24 PostgreSQL raw HIGH/CRITICAL occurrences remain visible and unsuppressed; each has an exact-digest NOT_AFFECTED disposition supported by the formal per-occurrence audit and conditional owner decision for the documented local-development runtime and expiry. The superseded Debian dev-image zlib record remains UNDER_INVESTIGATION without a proposal; the current Alpine dev-image digest is FIXED for that CVE. The previous statement that all 24 awaited audit and owner approval was the pre-audit snapshot and is superseded by the dated independent-audit qualification and owner-decision updates below. Previous approvals for the old digest are recorded as history and transferred=false.

The required TypeSafe JEV 1.13.0 bounded pre-gate returned `ESCALATE` (composite `0.694142857`, `safe_to_apply=0.17`). It verified reproducible image identity and the then-unapproved proposal state, while marking other execution claims unsupported or needing review. This is advisory; deterministic code/evidence review and exact-head hosted checks remain the authority. No JEV result approves or suppresses a CVE, and no secret was sent.

The first hosted attempt (run 37805774337 on `add8d8b0d216fe756922f2b88da78ebc21f1fefa`) failed before image build because the runner's default Buildx `docker` driver lacked the Docker archive exporter. The workflow now bootstraps a dedicated `docker-container` builder; the sanitized failure receipt is `cr07-ci-buildx-driver-failure.txt`. The corrected implementation head passed in run 37806245360; the final evidence-only head checks are surfaced by PR #43.

## Exact scan reconciliation

| Image | Digest | Results | LOW | MEDIUM | HIGH | CRITICAL | Suppressions |
|---|---|---:|---:|---:|---:|---:|---:|
| Prior official Alpine baseline | sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 | 58 | 7 | 26 | 23 | 2 | 0 |
| Previous zlib-r1 candidate | sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 | 57 | 7 | 26 | 22 | 2 | 0 |
| Current locked zlib-r1 image | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 | 57 | 7 | 26 | 22 | 2 | 0 |

The only removed CVE is CVE-2026-85091. No new HIGH/CRITICAL ID appeared. The changed package inventory is zlib 1.3.2-r0 to 1.3.2-r1; all other Alpine package name/version pairs are equal. The final scan has no zlib result. Alpine advisory data identifies `1.3.2-r1` as fixed; the upstream patch changes `gzwrite.c` to clear the stale input pointer and length after a nonblocking write error. Debian's tracker still lists the tested Bookworm and Trixie zlib package versions as vulnerable/unfixed at assessment time.

## Per-occurrence VEX dispositions

| CVE | Severity | Current VEX status | Proposed disposition |
|---|---|---|---|
| CVE-2025-68121 | CRITICAL | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-39821 | CRITICAL | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2025-58187 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2025-58188 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2025-61723 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2025-61725 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2025-61726 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2025-61729 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-25679 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-32280 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-32281 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-32283 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-33811 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-33814 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-33818 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-39820 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-39822 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-39836 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-42499 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-42504 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-56853 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-56859 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-56862 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |
| CVE-2026-86140 | HIGH | NOT_AFFECTED | Per-occurrence audit and conditional owner approval for exact runtime; expires 2026-10-15T13:00:00Z |

A current-row proposal does not transfer older auditor or owner decisions. For the 23 Go stdlib/gosu rows, the gosu SHA-256 remains 52c8749d0142edd234e9d6bd5237dff2d81e71f43537e2f4f66f75dd4b243dd0, but the locked image has Config.User=postgres; the official entrypoint root-only gosu branch is skipped. This exact runtime fact was evaluated per Go occurrence by the formal audit; conditional approval is recorded below and remains bound to the exact image/config, local-development runtime and expiry. The single libxml2 row retains its PH-SEC-WO-003-specific reachability analysis; its library SHA-256 is c7742d413585cee3e2750472e04da810a7a9883a1c10a8270c2f6e8c56231ad7, with current image/runtime evidence rebound. Detailed per-CVE evidence remains in the JSON with prior-analysis pointers.

## CR-07-AUD-05/-06 — exact runtime and proposal reconciliation

The current correction review found and corrected stale runtime assertions in all 23 gosu records. Each now records Config.User=postgres, initial entrypoint UID/GID 70:70, and the root-only gosu branch as skipped. Their justification no longer says syscall.Exec occurred. The exact gosu SHA, symbol inventories, advisory evidence, status, proposed disposition, and approval fields are preserved. The libxml2 row now also records the initial and steady PostgreSQL UID/GID 70:70; its CVE-specific reachability analysis is unchanged.

Read-only Compose evidence is bound to PostgreSQL digest sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 and dev digest sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948. The dev web and worker use the exact dev digest as UID/GID 1000:1000 with zero effective capabilities. Current util-linux packages are 2.41.5-0+deb13u1; /etc/fstab is root-owned mode 0644 with only its base-system comment. mount is SUID root; nsenter is not SUID. Runtime process inventory and source search found no application invocation of either tool. CAP_SYS_ADMIN is absent from the process capability bounding set.

| Finding | Current image | Current SARIF result | Current exact-runtime premise | VEX |
|---|---|---|---|---|
| CVE-2026-76642 (mount/libmount) | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948 | Absent; source-reconciled supplemental occurrence | No authorized fstab/helper entry and no application call path; SUID mount remains present | UNDER_INVESTIGATION; NOT_AFFECTED proposed, unapproved |
| CVE-2026-78408 (nsenter) | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948 | Absent; source-reconciled supplemental occurrence | nsenter mode 0755, no app invocation or target selector, and no CAP_SYS_ADMIN in CapBnd | UNDER_INVESTIGATION; NOT_AFFECTED proposed, unapproved |
| CVE-2026-78410 (mount) | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948 | Absent; source-reconciled supplemental occurrence | No authorized fstab source entry/path and no application call path; SUID mount remains present | UNDER_INVESTIGATION; NOT_AFFECTED proposed, unapproved |

There are **28 current VEX records**: 25 current scan H/C occurrences and 3 current-digest supplemental util-linux records. Of these, **27** have unapproved NOT_AFFECTED proposals; the dev zlib record has no proposed disposition. GCC CVE-2026-95619 is archived as **one historical occurrence** because it is absent from the current dev digest SARIF. Its prior UNDER_INVESTIGATION / proposed NOT_AFFECTED fields remain preserved in the archive; absence is not treated as FIXED or NOT_AFFECTED. It is excluded from current pending counts.

Evidence receipts: cr07-aud-05-06-runtime-revalidation.txt (SHA-256 d74939d197cea015414000a8c7f05cdae12a5395a6142ef9f3687c13c9d31539) and jev-cr07-aud-05-06-verify.json (SHA-256 506793037c121387a059f94e765029f169f63c89570b9997c2d804813dd46e66). TypeSafe JEV verified the two bounded consistency claims; one was routed to review. Its output is advisory and approves no vulnerability.

## PostgreSQL digest FIXED zlib occurrence

Alpine 3.24 package zlib 1.3.2-r1 is installed. The library is /usr/lib/libz.so.1.3.2 with SHA-256 ecc8b9dfc45eb7fa29b410ffaca6257873890de53b80fe91735737b49067c5f2. The SONAME remains libz.so.1 and the old/new exported dynamic symbol-name sets match (111 symbols; list SHA-256 3a590bbd310d754b854576219134ba3858fef69d7c416f57ebff8fe69ccd5f5b). PostgreSQL resolves the updated library; startup, migrations, integration, persistence and crash recovery passed on disposable candidate databases. Exact fix and package references are linked in postgres-zlib-r1-official-candidates.md and postgres-zlib-r1-abi.txt.

## Risk and authorization

The current local application role polyhunter is superuser; classify as HIGH privilege blast radius for local development. This is not evidence of SQL injection. Recommendation: plan a separate least-privileged runtime-role change before broader or production exposure. No DB role, schema, application or migration changes were made.

The artifact remains unpublished. A clean checkout obtains it through canonical `npm run docker:up`, which builds from the pinned official base, verifies the locked manifest/config identities and fails closed before Compose startup on mismatch. CI checks out the PR head SHA, repeats the image build/runtime assertions, migrations and PostgreSQL integration tests, and uploads a receipt bound to that SHA. Raw findings remain visible; 27 proposed NOT_AFFECTED dispositions remain subject to ADR-0007 with auditor/owner approval unset, and one current dev-zlib record remains UNDER_INVESTIGATION without a proposed disposition. One absent GCC occurrence is archived historically. No merge, checkpoint promotion, WO-002, signing or trading is authorized; liveTradingAuthorized=false.

## CR-07-AUD-07 — dev-image CVE-2026-85091 source/runtime reconciliation

Review 5460654469 audited HEAD 6579e97064570cc38530e69944173fde09920d7c. The current dev image remains digest sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948; current Docker Scout SARIF is unchanged (25a4020d28f8d5e3d55a19f9c52e02ddaa549aade93804cf92bebab6e4f68622), with one HIGH CVE-2026-85091 and no CRITICAL.

The exact Debian source package is 1:1.3.dfsg+really1.3.1-1; binary package is 1:1.3.dfsg+really1.3.1-1+b1. The official .dsc, orig tar and Debian tar hashes are recorded in dev-zlib-debian-source-archive-verification.json and the source archive hashes match the .dsc. The exact gzwrite.c hash is 469b1e58932ea11bdda2a153f6655f7b3c13254240fae157181b49ed1bc93b47. It lacks gz_vacate but contains gz_write, gzvprintf, gzprintf and gzputc. The exact system libz hash is 85590dd58edf5445e18bc7193e5ebc01ac5841f1ae187e97705a662e90c6421e and exports related gz APIs. Absence of gz_vacate alone does not resolve the assigned CVE scope.

The Debian security maintainer response dated 2026-10-05 declined to mark Bookworm/Trixie not affected pending upstream determination whether the older-version behavior is a separate issue or within this CVE. Ubuntu's advisory reports that its reproducer also crashes older 1.3.0/1.3.1 and that the tested candidate patch did not resolve that reproducer. Sources: https://lists.debian.org/debian-security-tracker/2026/10/msg00005.html, https://bugs.debian.org/1146895#36, https://ubuntu.com/security/CVE-2026-85091, https://github.com/madler/zlib/issues/1310 and https://github.com/madler/zlib/issues/1292.

Exact-image runtime evidence: Compose web and worker use Node v24.21.0 and bundled zlib 1.3.2.1-motley-8002e91, run UID/GID 1000 with CapEff zero, and their active Node process maps do not contain system libz.so.1. The Node binding source uses deflate/inflate and does not call gz* APIs; the Node executable itself has embedded gz* symbols and imports dlsym. The currently mapped Next SWC addon has no literal gz API names, but literal scanning is not proof against computed lookup. Installed ELF consumers include dpkg-deb/libapt-pkg importing gz APIs and libcrypto importing deflate/inflate. No direct application gzip/C gz call or subprocess path was found; not every possible indirect path is proven unreachable.

Because upstream scope remains unresolved and exact runtime evidence cannot settle the older-reproducer scope or all indirect lookup paths, the earlier dev-zlib NOT_AFFECTED proposal is withdrawn. VEX remains UNDER_INVESTIGATION with no proposed disposition, no approval and no suppression. Exact open premise: whether the 1.3.0/1.3.1 reproducer/crash is distinct from or within CVE-2026-85091, plus proof that any affected operation cannot be reached through an indirect symbol path.

Receipts: dev-zlib-debian-source-archive-verification.json; dev-zlib-source-and-path-review-5460654469.json; dev-zlib-runtime-review-5460654469.json; dev-zlib-exact-image-native-runtime.txt; dev-zlib-native-addon-marker-scan.json; dev-zlib-elf-inventory.txt; jev-cr07-aud-07-verify.json; cr07-aud-07-evidence-integrity.txt. TypeSafe JEV verified four source/runtime claims but did not determine CVE status or approve any proposal.

The current matrix has 28 VEX records: 27 unapproved proposed NOT_AFFECTED dispositions and this one unresolved zlib record without a disposition. See PH-M02-WO-001-INDEPENDENT-AUDIT-MATRIX.md / .json.

Result: BLOCKED_UNRESOLVED. No image rebuild, scan, product change, database operation, merge, checkpoint promotion, WO-002, signing or trading was performed. liveTradingAuthorized=false.


## CR-07-AUD-08 — Node 24 Alpine remediation-first canary (review 5461309598)

The Debian dev zlib blocker was resolved by one isolated canary using official `node:24.21.0-alpine3.24@sha256:83f1c388c31fb2e51f7cbd4dea949b96260798c98f206e8e4696bc93bd964e3a` (linux/amd64). The canary updated only zlib from Alpine v3.24/main, exactly `1.3.2-r0 → 1.3.2-r1`, enforced by an installed-package inventory guard. The candidate and promoted canonical image are digest-pinned; final canonical dev digest is sha256:6a6c3d9dda7cd7c5d392d34cf28b00034909b4cae14af364a016aae46d7604e2. The corrected PostgreSQL image remains sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 and was not rebuilt or changed.

The exact final Docker Scout scan is `polyhunter-dev-alpine-final.sarif.json`: 6 findings (6 MEDIUM, 0 HIGH, 0 CRITICAL), zero suppressions. The prior exact Debian dev image sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948 had one HIGH CVE-2026-85091. This exact Alpine image carries fixed zlib 1.3.2-r1; CVE-2026-85091 is recorded FIXED for this digest only. The prior Debian zlib record remains UNDER_INVESTIGATION with no proposed disposition and is historical only; the prior 3 util-linux proposals remain unapproved and bound to the old Debian digest. No prior disposition or approval transfers.

Candidate early gates passed: Node v24.21.0/npm 12.2.0; clean image npm ci; all seven workspaces; musl Next SWC and Rollup native binaries; Biome; 43 provider/boundary tests; isolated Compose web HTTP 200, worker running and PostgreSQL healthy. At the AUD-08 runtime receipt capture, the canonical stack was healthy. A later interruption left the historical Docker Desktop/WSL store unresolved; the AUD-08 snapshot did not establish the final stack state. The later CR-07-AUD-09 receipt records the authorized new Docker store running the stack healthy, while historical storage remains unavailable and untouched. Migrations passed, PostgreSQL integration passed (66/66), db:generate reported no schema drift, `npm run validate` passed (238 tests, builds and npm audit with 0 vulnerabilities), and `docker compose config --quiet` passed. Full receipts are listed in dev-alpine-remediation-receipt.json and cr07-aud09-docker-runtime.json.

At the AUD-08 handoff snapshot before per-occurrence audit qualification and the operative owner decision, 27 NOT_AFFECTED proposals were still pending: 24 current on PostgreSQL and 3 historical on the old Debian development digest. That interim state is superseded by the current disposition section below. The application PostgreSQL superuser risk remains. Six MEDIUM npm findings remain in the dev image.

TypeSafe/JEV 1.13.0 returned a bounded advisory recommendation to promote the candidate (0.96 confidence; no contradicted requirements); this is not vulnerability approval. Final status is READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT only after GitHub Actions Validate and required checks pass on the exact pushed HEAD. Checkpoint Delta remains PROPOSED / NOT_PROMOTED. No merge, checkpoint promotion, WO-002, signing or trading; `liveTradingAuthorized=false`.

## Historical auditor-qualification snapshot before resolution — 2026-10-10 UTC

The Project Owner conditionally approved the 24 proposed PostgreSQL `NOT_AFFECTED` dispositions, and the exact decision is preserved in `owner-approval-postgres-vex-20261010.json` (SHA-256 `7752574a801af692003b6079705ca64af4cb2ba8cdfbf1b4227710db2ac329b9`). Scope is limited to PostgreSQL digest `sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744`, its documented local-development runtime, 23 gosu findings and one libxml2 finding; expiry is `2026-10-15T13:00:00Z`.

The separate per-occurrence report `cr07-independent-per-occurrence-audit-20261009.json` (SHA-256 `4955638fa19eb027f76f1bc119af849b07f219e9a9c6a395d7f2ab1727b6b2c2`) covers all 24 rows (22 HIGH, 2 CRITICAL), bound to proposal head `8a4cb2e6c91a5ff458e02dd64f877311a5af9665`, the exact VEX SHA-256 `fe38d2b19edd8aaade332d4fc90633207452d1f9b9b154188c7800ef13077907`, and exact Scout SARIF SHA-256 `3f4d8afede798486bbb63be076a175fb0047d33116e2e3d94695862e88f89c14`. The result says the evidence supports all 24 proposals for the bounded runtime. It does not change VEX status or approve findings. The libxml2 occurrence is individually mapped to SARIF result #54; its conclusion is limited to the assessed PostgreSQL core and shipped extension paths and does not cover custom native extensions or future DTD validation.

The report transparently identifies its reviewer as a separate subagent in the same Codex system, not a human/third-party, and not blind. It explicitly leaves to project governance whether this role separation satisfies ADR-0007. The bounded JEV decision receipt `jev-audit-independence-bounded-decision-20261010.json` (advisory only; 0.90 confidence) recommends a human/third-party audit; it neither approves nor classifies any CVE. The qualification is therefore unresolved in this executor task.

This paragraph is an interim snapshot: no PostgreSQL row in `postgres-zlib-r1-vex.json` was changed: all 24 remain `UNDER_INVESTIGATION`, proposed `NOT_AFFECTED`, with independent auditor and operative owner approval fields null. Raw Scout still reports 24 H/C results with zero suppressions. Interim result at that time: `BLOCKED_UNRESOLVED_INDEPENDENT_AUDITOR_QUALIFICATION`. The then-current correction needed: obtain a formal audit by a reviewer demonstrably independent of the Codex implementation/execution task, or resolve the qualification through an approved canonical governance change before changing any VEX status. No finding is hidden, no approval transfers to another digest, and no checkpoint promotion or merge is proposed.

## Current disposition after per-occurrence audit and owner approval — 2026-10-10 UTC

The qualification resolution receipt cr07-vex-audit-qualification-resolution-20261010.json records why the existing formal role-separated audit satisfies ADR-0007 and the owner's stated condition. The reviewer was separate from the implementation/execution task and assessed every occurrence; canonical sources do not require a human/third-party or blind reviewer. The stricter JEV recommendation is preserved as advisory only. Limitations (same Codex system, prior context, not blind) remain explicit.

For the exact PostgreSQL manifest sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 and config sha256:6cfbc1caf64a3c8a85c062ca25eec78a2db1b0edbdca55906ce3d0d376e23e93, all 24 rows (22 HIGH / 2 CRITICAL) now have status NOT_AFFECTED, an individual audit reference, and the Project Owner approval reference. They apply only to the documented local-development runtime and expire 2026-10-15T13:00:00Z. Raw Scout findings remain visible with zero suppressions. The libxml2 scope remains limited to PostgreSQL core and shipped extensions; custom native extensions and future DTD validation remain outside the proposal.

The three util-linux proposals remain unapproved and bound only to the superseded Debian development digest. The prior Debian development zlib record remains UNDER_INVESTIGATION without a proposed disposition; the GCC occurrence remains archived. No digest approval transfers. The local database application role remains superuser, a documented risk for separate least-privilege planning.

The provider correction rejects invalid negRisk and malformed last-trade payloads as PROVIDER_MALFORMED, while preserving the legitimate no-trade 404-to-null behavior. Focused integration coverage passed (11/11); npm run validate passed with 15 files / 239 tests, workspace typechecks/builds, one pre-existing informational lint note, and npm audit --audit-level=high reporting zero vulnerabilities. Receipt: provider-malformed-shape-correction-20261010.json.

No image, runtime configuration, dependency, database volume, WSL distribution or Docker VHDX changed in this documentation correction. Recovery of the historical Docker Desktop/WSL storage remains unresolved; historical VHDX files, backups, volumes and PGDATA remain intact and untouched. Separately, the CR-07-AUD-09 receipt records the authorized new Docker store running the `polyhunter-local` stack healthy at capture: PostgreSQL healthy, web HTTP 200 at `http://localhost:3000`, and the worker supervisor running as an intentional stub, all with restart count 0. The new-store evidence does not recover or replace the historical data. Final exact-head GitHub Validate and independent PR review are recorded in the PR #43 body before any merge. The Checkpoint Delta remains PROPOSED / NOT_PROMOTED; CHECKPOINT.json is unchanged; liveTradingAuthorized=false.
