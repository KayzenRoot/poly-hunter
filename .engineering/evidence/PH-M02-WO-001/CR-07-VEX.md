# PostgreSQL zlib-r1 image — fresh VEX revalidation

- Work Order: PH-M02-WO-001; review 5455471016; PR #43.
- Exact image: polyhunter-postgres@sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 (linux/amd64).
- Base: postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24.
- Current scanner: Docker Scout CLI 1.24.0; raw SARIF SHA-256 3f4d8afede798486bbb63be076a175fb0047d33116e2e3d94695862e88f89c14.
- Exact scan command, Docker image archive SHA-256 and Scout warning are preserved in `postgres-zlib-r1-scan-receipt.json`.
- Exact VEX JSON: postgres-zlib-r1-vex.json, which carries the per-CVE symbol, runtime, source, attacker-input, prerequisite, KEV, EPSS, network/privilege, evidence, and no-approval fields.

## Result

READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT means the executor evidence is ready for an independent exact-head review. It does not clear raw scanner findings. CVE-2026-85091 is FIXED in this digest; the 24 remaining PostgreSQL H/C results have new, exact-digest NOT_AFFECTED proposals. All 24 remain UNDER_INVESTIGATION until independent audit and explicit owner approval under ADR-0007. Previous approvals for the old digest are recorded as history and transferred=false.

## Exact scan reconciliation

| Image | Digest | Results | LOW | MEDIUM | HIGH | CRITICAL | Suppressions |
|---|---|---:|---:|---:|---:|---:|---:|
| Prior official Alpine baseline | sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 | 58 | 7 | 26 | 23 | 2 | 0 |
| Selected zlib-r1 derivative | sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 | 57 | 7 | 26 | 22 | 2 | 0 |

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

A current-row proposal does not transfer the older auditor or owner decision. The exact gosu SHA-256 is unchanged at 52c8749d0142edd234e9d6bd5237dff2d81e71f43537e2f4f66f75dd4b243dd0; current runtime inspection binds that executable and its startup path to the new image. The libxml2 SHA-256 is unchanged at c7742d413585cee3e2750472e04da810a7a9883a1c10a8270c2f6e8c56231ad7; the current image/runtime and role were inspected again. Detailed per-CVE symbols and proof are preserved in the JSON with prior-analysis pointers.

## FIXED zlib occurrence

Alpine 3.24 package zlib 1.3.2-r1 is installed. The library is /usr/lib/libz.so.1.3.2 with SHA-256 ecc8b9dfc45eb7fa29b410ffaca6257873890de53b80fe91735737b49067c5f2. The SONAME remains libz.so.1 and the old/new exported dynamic symbol-name sets match (111 symbols; list SHA-256 3a590bbd310d754b854576219134ba3858fef69d7c416f57ebff8fe69ccd5f5b). PostgreSQL resolves the updated library; startup, migrations, integration, persistence and crash recovery passed on disposable candidate databases. Exact fix and package references are linked in postgres-zlib-r1-official-candidates.md and postgres-zlib-r1-abi.txt.

## Risk and authorization

The current local application role polyhunter is superuser; classify as HIGH privilege blast radius for local development. This is not evidence of SQL injection. Recommendation: plan a separate least-privileged runtime-role change before broader or production exposure. No DB role, schema, application or migration changes were made.

The selected digest exists in this local Docker image store and was not published to a registry. Compose uses pull_policy: never. Clean checkouts need a locally built artifact; this portability limitation is disclosed for independent audit. Raw findings and all VEX proposals remain subject to ADR-0007. No merge, checkpoint promotion, WO-002, signing or trading is authorized; liveTradingAuthorized=false.
