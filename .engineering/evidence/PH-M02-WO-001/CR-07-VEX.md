# PostgreSQL zlib-r1 image — fresh VEX revalidation

- Work Order: PH-M02-WO-001; originating zlib review 5455471016; active correction review 5457414821 (CR-07-AUD-02/-03/-04); PR #43.
- Exact image: polyhunter-postgres@sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 (linux/amd64; config sha256:6cfbc1caf64a3c8a85c062ca25eec78a2db1b0edbdca55906ce3d0d376e23e93).
- Base: postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24.
- Current scanner: Docker Scout CLI 1.24.0; raw SARIF SHA-256 3f4d8afede798486bbb63be076a175fb0047d33116e2e3d94695862e88f89c14.
- Deterministic build lock: `docker/postgres/image.lock.json`; build receipt and two matching BuildKit manifest/config receipts are in `cr07-portability-build-receipt.json` and `postgres-cr07-aud-02-04-reproducibility.json`.
- Exact scan command, image archive SHA-256 and Scout warning are preserved in `postgres-cr07-aud-02-04-scan-receipt.json`.
- Exact VEX JSON: postgres-zlib-r1-vex.json, which carries the per-CVE symbol, runtime, source, attacker-input, prerequisite, KEV, EPSS, network/privilege, evidence, and no-approval fields.

## Result

PENDING_EXACT_HEAD_CI until GitHub Actions Validate and SonarCloud pass on the final correction head; only then is the executor evidence ready for independent exact-head review. It does not clear raw scanner findings. CVE-2026-85091 is FIXED in this digest; the 24 remaining PostgreSQL H/C results have new, exact-digest NOT_AFFECTED proposals. All 24 remain UNDER_INVESTIGATION until independent audit and explicit owner approval under ADR-0007. Previous approvals for the old digest are recorded as history and transferred=false.

The required TypeSafe JEV 1.13.0 bounded pre-gate returned `ESCALATE` (composite `0.694142857`, `safe_to_apply=0.17`). It verified reproducible image identity and the unapproved proposal state, while marking other execution claims unsupported or needing review. This is advisory; deterministic code/evidence review and exact-head hosted checks remain the authority. No JEV result approves or suppresses a CVE, and no secret was sent.

The first exact-head hosted attempt (run 37805774337 on `add8d8b0d216fe756922f2b88da78ebc21f1fefa`) failed before image build because the runner's default Buildx `docker` driver lacked the Docker archive exporter. The workflow now bootstraps a dedicated `docker-container` builder; the sanitized failure receipt is `cr07-ci-buildx-driver-failure.txt`. Final exact-head CI and SonarCloud are pending on the follow-up head.

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

## FIXED zlib occurrence

Alpine 3.24 package zlib 1.3.2-r1 is installed. The library is /usr/lib/libz.so.1.3.2 with SHA-256 ecc8b9dfc45eb7fa29b410ffaca6257873890de53b80fe91735737b49067c5f2. The SONAME remains libz.so.1 and the old/new exported dynamic symbol-name sets match (111 symbols; list SHA-256 3a590bbd310d754b854576219134ba3858fef69d7c416f57ebff8fe69ccd5f5b). PostgreSQL resolves the updated library; startup, migrations, integration, persistence and crash recovery passed on disposable candidate databases. Exact fix and package references are linked in postgres-zlib-r1-official-candidates.md and postgres-zlib-r1-abi.txt.

## Risk and authorization

The current local application role polyhunter is superuser; classify as HIGH privilege blast radius for local development. This is not evidence of SQL injection. Recommendation: plan a separate least-privileged runtime-role change before broader or production exposure. No DB role, schema, application or migration changes were made.

The artifact remains unpublished. A clean checkout obtains it through canonical `npm run docker:up`, which builds from the pinned official base, verifies the locked manifest/config identities and fails closed before Compose startup on mismatch. CI checks out the PR head SHA, repeats the image build/runtime assertions, migrations and PostgreSQL integration tests, and uploads a receipt bound to that SHA. Raw findings and all 29 proposals remain subject to ADR-0007, with auditor and owner approvals null. No merge, checkpoint promotion, WO-002, signing or trading is authorized; liveTradingAuthorized=false.
