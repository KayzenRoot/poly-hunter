# Exact-image vulnerability scan reconciliation

Date: 2026-10-07. Scanner: Docker Scout CLI v1.24.0. Raw SARIF and SHA-256 receipts are retained alongside this summary.

| Image | Immutable digest | Findings (all severities) | HIGH | CRITICAL | SARIF SHA-256 |
|---|---|---:|---:|---:|---|
| polyhunter-dev:local | `sha256:d38a0a1222ef551cf5926496ffdc8c0fd06d8950e2d0a1b6d0c2f5c8d1a54b62` | 81 unique | 20 | 4 | `449aa68a6896bb6b12a954aa92fb1a54b49cdd47ee1d2a3a24fcfd6b098b937c` |
| postgres:17.11-alpine3.24 | `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` | 58 unique | 23 | 2 | `307df3f8cab60c17141e51d1f3237cc198f5e376aea2e4ad5581baec322a59c6` |

Each SARIF has zero per-result suppression entries. The Scout terminal summary stated “4 exceptions obtained”; this is preserved as a caveat and does not clear any finding. Machine-readable findings and digest-bound VEX reconciliation are in [security-scans.json](security-scans.json).

## Development image HIGH/CRITICAL — 24 unresolved on current digest

CVE-2026-102010 (HIGH; pkg:deb/debian/gcc-12@12.2.0-14%2Bdeb12u1?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-78409 (HIGH; pkg:deb/debian/util-linux@2.38.1-5%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-48962 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-102276 (HIGH; pkg:npm/brace-expansion@5.0.7; UNDER_INVESTIGATION)
CVE-2026-102278 (HIGH; pkg:npm/brace-expansion@5.0.7; UNDER_INVESTIGATION)
CVE-2026-14257 (HIGH; pkg:npm/brace-expansion@5.0.7; UNDER_INVESTIGATION)
CVE-2026-19534 (HIGH; pkg:npm/undici@6.27.0; UNDER_INVESTIGATION)
CVE-2026-42497 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-48959 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-69152 (HIGH; pkg:npm/brace-expansion@5.0.7; UNDER_INVESTIGATION)
CVE-2026-73566 (HIGH; pkg:npm/tar@7.5.19; UNDER_INVESTIGATION)
CVE-2026-82560 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-69192 (HIGH; pkg:npm/ip-address@10.2.0; UNDER_INVESTIGATION)
CVE-2026-95619 (HIGH; pkg:deb/debian/gcc-12@12.2.0-14%2Bdeb12u1?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-78410 (HIGH; pkg:deb/debian/util-linux@2.38.1-5%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-78408 (HIGH; pkg:deb/debian/util-linux@2.38.1-5%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-85091 (HIGH; pkg:deb/debian/zlib@1%3A1.2.13.dfsg-1?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-57432 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-76642 (HIGH; pkg:deb/debian/util-linux@2.38.1-5%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-93748 (HIGH; pkg:npm/http-cache-semantics@4.2.0; UNDER_INVESTIGATION)
CVE-2026-12087 (CRITICAL; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-13221 (CRITICAL; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-42496 (CRITICAL; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)
CVE-2026-8376 (CRITICAL; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; UNDER_INVESTIGATION)

PH-SEC-WO-007 previously received owner and independent approval for 20 NOT_AFFECTED dispositions, plus 2 UNDER_INVESTIGATION findings, against the old image digest `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`. That evidence cannot be transferred to the present `sha256:d38a0a1222ef551cf5926496ffdc8c0fd06d8950e2d0a1b6d0c2f5c8d1a54b62` artifact. All 24 current H/C records therefore remain UNDER_INVESTIGATION under ADR-0007 pending exact-image review.

## PostgreSQL HIGH/CRITICAL — 25 total, 1 unresolved

CVE-2025-58187 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2025-58188 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2025-61723 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2025-61725 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2025-61726 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2025-61729 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-25679 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-32280 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-32281 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-32283 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-33811 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-33814 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-33818 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-39820 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-39836 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-42499 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-42504 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-56853 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-56859 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-56862 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-39822 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-86140 (HIGH; pkg:apk/alpine/libxml2@2.13.9-r2?os_name=alpine&os_version=3.24; NOT_AFFECTED — approved exact-digest VEX)
CVE-2026-85091 (HIGH; pkg:apk/alpine/zlib@1.3.2-r0?os_name=alpine&os_version=3.24; UNDER_INVESTIGATION)
CVE-2026-39821 (CRITICAL; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)
CVE-2025-68121 (CRITICAL; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX)

Existing exact-digest, owner-approved and independently audited VEX dispositions cover 23 Go stdlib findings in PH-SEC-WO-002 and one libxml2 finding in PH-SEC-WO-003. The remaining zlib finding CVE-2026-85091 remains UNDER_INVESTIGATION. It blocks under ADR-0007.

## Gate

Result: **BLOCKED_UNRESOLVED**. No suppression, self-approval, or old-digest approval was treated as a current disposition.
