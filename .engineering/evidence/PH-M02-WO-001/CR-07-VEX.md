# PostgreSQL zlib-r1 image — fresh VEX revalidation

- Work Order: PH-M02-WO-001; prior corrections preserved; current security correction review 5460654469; PR #43. This document retains earlier scan/image history; the current dev-zlib assessment is in the AUD-07 section below.
- Exact image: polyhunter-postgres@sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 (linux/amd64; config sha256:6cfbc1caf64a3c8a85c062ca25eec78a2db1b0edbdca55906ce3d0d376e23e93).
- Base: postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24.
- Current scanner: Docker Scout CLI 1.24.0; raw SARIF SHA-256 3f4d8afede798486bbb63be076a175fb0047d33116e2e3d94695862e88f89c14.
- Deterministic build lock: `docker/postgres/image.lock.json`; build receipt and two matching BuildKit manifest/config receipts are in `cr07-portability-build-receipt.json` and `postgres-cr07-aud-02-04-reproducibility.json`.
- Exact scan command, image archive SHA-256 and Scout warning are preserved in `postgres-cr07-aud-02-04-scan-receipt.json`.
- Exact VEX JSON: postgres-zlib-r1-vex.json, which carries the per-CVE symbol, runtime, source, attacker-input, prerequisite, KEV, EPSS, network/privilege, evidence, and no-approval fields.

## Result

Implementation head `a8725af302d7b7b21436ade68c49c360ecfb1aa2` passed GitHub Actions Validate (run 37806245360), including image build/runtime identity, validation gates, migrations and PostgreSQL integration; SonarCloud and Socket checks also passed. The downloaded runtime receipt is `ci-postgres-runtime-a8725.json`. The exact checks for the final evidence-only commit are tracked live in PR #43 to avoid a self-referential bundle. This does not clear raw scanner findings. The zlib finding is FIXED in the locked PostgreSQL digest only; the 24 remaining PostgreSQL H/C results have fresh exact-digest NOT_AFFECTED proposals. The separate dev-image zlib finding remains UNDER_INVESTIGATION with no proposed disposition. All 24 remain UNDER_INVESTIGATION until independent audit and explicit owner approval under ADR-0007. Previous approvals for the old digest are recorded as history and transferred=false.

The required TypeSafe JEV 1.13.0 bounded pre-gate returned `ESCALATE` (composite `0.694142857`, `safe_to_apply=0.17`). It verified reproducible image identity and the unapproved proposal state, while marking other execution claims unsupported or needing review. This is advisory; deterministic code/evidence review and exact-head hosted checks remain the authority. No JEV result approves or suppresses a CVE, and no secret was sent.

The first hosted attempt (run 37805774337 on `add8d8b0d216fe756922f2b88da78ebc21f1fefa`) failed before image build because the runner's default Buildx `docker` driver lacked the Docker archive exporter. The workflow now bootstraps a dedicated `docker-container` builder; the sanitized failure receipt is `cr07-ci-buildx-driver-failure.txt`. The corrected implementation head passed in run 37806245360; the final evidence-only head checks are surfaced by PR #43.

## Exact scan reconciliation

| Image | Digest | Results | LOW | MEDIUM | HIGH | CRITICAL | Suppressions |
|---|---|---:|---:|---:|---:|---:|---:|
| Prior official Alpine baseline | sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 | 58 | 7 | 26 | 23 | 2 | 0 |
| Previous zlib-r1 candidate | sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 | 57 | 7 | 26 | 22 | 2 | 0 |
| Current locked zlib-r1 image | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 | 57 | 7 | 26 | 22 | 2 | 0 |

The only removed CVE is CVE-2026-85091. No new HIGH/CRITICAL ID appeared. The changed package inventory is zlib 1.3.2-r0 to 1.3.2-r1; all other Alpine package name/version pairs are equal. The final scan has no zlib result. Alpine advisory data identifies `1.3.2-r1` as fixed; the upstream patch changes `gzwrite.c` to clear the stale input pointer and length after a nonblocking write error. Debian's tracker still lists the tested Bookworm and Trixie zlib package versions as vulnerable/unfixed at assessment time.

## Fresh per-CVE proposals

| CVE | Severity | Current VEX status | Proposed disposition |
|---|---|---|---|
| CVE-2025-68121 | CRITICAL | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-39821 | CRITICAL | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2025-58187 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2025-58188 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2025-61723 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2025-61725 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2025-61726 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2025-61729 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-25679 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-32280 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-32281 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-32283 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-33811 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-33814 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-33818 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-39820 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-39822 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-39836 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-42499 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-42504 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-56853 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-56859 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-56862 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |
| CVE-2026-86140 | HIGH | UNDER_INVESTIGATION | NOT_AFFECTED proposal; fresh audit and owner approval pending |

A current-row proposal does not transfer older auditor or owner decisions. For the 23 Go stdlib/gosu rows, the gosu SHA-256 remains 52c8749d0142edd234e9d6bd5237dff2d81e71f43537e2f4f66f75dd4b243dd0, but the locked image has Config.User=postgres; the official entrypoint root-only gosu branch is skipped. This exact runtime fact is recorded per Go occurrence and does not approve any proposal. The single libxml2 row retains its PH-SEC-WO-003-specific reachability analysis; its library SHA-256 is c7742d413585cee3e2750472e04da810a7a9883a1c10a8270c2f6e8c56231ad7, with current image/runtime evidence rebound. Detailed per-CVE evidence remains in the JSON with prior-analysis pointers.

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
