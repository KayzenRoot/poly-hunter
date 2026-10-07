# Exact-image vulnerability scan reconciliation

Date: 2026-10-07. Scanner: Docker Scout CLI v1.24.0. Both final SARIF receipts were freshly generated against the final local image IDs; SHA-256 values are recorded below.

| Image | Immutable digest | Findings (all severities) | HIGH | CRITICAL | SARIF SHA-256 |
|---|---|---:|---:|---:|---|
| polyhunter-dev:local | sha256:1ae037eb5c185605951c688d14d19133f70e2f386fe956b20a4e4460d4338792 | 79 unique | 19 | 4 | 97a0d713e1ba7c46f00066672b350b4d227d5923e762e59c035548bc807bdbfb |
| postgres:17.11-alpine3.24 | sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 | 58 unique | 23 | 2 | 307df3f8cab60c17141e51d1f3237cc198f5e376aea2e4ad5581baec322a59c6 |

Both SARIF files contain zero per-result suppression entries. The Scout terminal summary stated "4 exceptions obtained" for PostgreSQL; that notice is preserved and does not clear any finding. Machine-readable findings and digest-bound VEX reconciliation are in [security-scans.json](security-scans.json).

## Development image HIGH/CRITICAL — 23 unresolved on the current digest

CVE-2026-102276 (HIGH; pkg:npm/brace-expansion@5.0.7; fixed upstream: 5.0.10; UNDER_INVESTIGATION)
CVE-2026-102278 (HIGH; pkg:npm/brace-expansion@5.0.7; fixed upstream: 5.0.11; UNDER_INVESTIGATION)
CVE-2026-12087 (CRITICAL; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: 5.36.0-7+deb12u4; UNDER_INVESTIGATION)
CVE-2026-13221 (CRITICAL; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: 5.36.0-7+deb12u4; UNDER_INVESTIGATION)
CVE-2026-14257 (HIGH; pkg:npm/brace-expansion@5.0.7; fixed upstream: 5.0.8; UNDER_INVESTIGATION)
CVE-2026-19534 (HIGH; pkg:npm/undici@6.27.0; fixed upstream: 6.28.1; UNDER_INVESTIGATION)
CVE-2026-42496 (CRITICAL; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: 5.36.0-7+deb12u4; UNDER_INVESTIGATION)
CVE-2026-42497 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: 5.36.0-7+deb12u4; UNDER_INVESTIGATION)
CVE-2026-48959 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: 5.36.0-7+deb12u4; UNDER_INVESTIGATION)
CVE-2026-48962 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: 5.36.0-7+deb12u4; UNDER_INVESTIGATION)
CVE-2026-57432 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: 5.36.0-7+deb12u4; UNDER_INVESTIGATION)
CVE-2026-69152 (HIGH; pkg:npm/brace-expansion@5.0.7; fixed upstream: 5.0.9; UNDER_INVESTIGATION)
CVE-2026-69192 (HIGH; pkg:npm/ip-address@10.2.0; fixed upstream: 10.3.1; UNDER_INVESTIGATION)
CVE-2026-73566 (HIGH; pkg:npm/tar@7.5.19; fixed upstream: 7.5.21; UNDER_INVESTIGATION)
CVE-2026-76642 (HIGH; pkg:deb/debian/util-linux@2.38.1-5%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: not fixed; UNDER_INVESTIGATION)
CVE-2026-78408 (HIGH; pkg:deb/debian/util-linux@2.38.1-5%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: not fixed; UNDER_INVESTIGATION)
CVE-2026-78409 (HIGH; pkg:deb/debian/util-linux@2.38.1-5%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: not fixed; UNDER_INVESTIGATION)
CVE-2026-78410 (HIGH; pkg:deb/debian/util-linux@2.38.1-5%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: not fixed; UNDER_INVESTIGATION)
CVE-2026-82560 (HIGH; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: not fixed; UNDER_INVESTIGATION)
CVE-2026-8376 (CRITICAL; pkg:deb/debian/perl@5.36.0-7%2Bdeb12u3?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: 5.36.0-7+deb12u4; UNDER_INVESTIGATION)
CVE-2026-85091 (HIGH; pkg:deb/debian/zlib@1%3A1.2.13.dfsg-1?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: not fixed; UNDER_INVESTIGATION)
CVE-2026-93748 (HIGH; pkg:npm/http-cache-semantics@4.2.0; fixed upstream: not fixed; UNDER_INVESTIGATION)
CVE-2026-95619 (HIGH; pkg:deb/debian/gcc-12@12.2.0-14%2Bdeb12u1?os_distro=bookworm&os_name=debian&os_version=12; fixed upstream: not fixed; UNDER_INVESTIGATION)

Fresh final image digest: sha256:1ae037eb5c185605951c688d14d19133f70e2f386fe956b20a4e4460d4338792 (local image ID matches). All 23 H/C records default to UNDER_INVESTIGATION because no approval/VEX exists for this exact digest. Prior exact-image approvals are bound to the older digest sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3 and are not transferred. The new final image scan contains zero of the 35 unique Go stdlib CVEs previously in scope; those 35 remain 0 HIGH/CRITICAL.

The final Docker Scout recommendation receipt for the dev image reports the pinned official node:24-bookworm-slim base is up to date and offers no base refresh that would remove these findings. No generic suppression or self-approval was applied.

## PostgreSQL HIGH/CRITICAL — 25 total, 1 unresolved

CVE-2025-58187 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2025-58188 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2025-61723 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2025-61725 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2025-61726 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2025-61729 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2025-68121 (CRITICAL; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-25679 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-32280 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-32281 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-32283 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-33811 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-33814 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-33818 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-39820 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-39821 (CRITICAL; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-39822 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-39836 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-42499 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-42504 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-56853 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-56859 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-56862 (HIGH; pkg:golang/stdlib@1.24.6; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json)
CVE-2026-85091 (HIGH; pkg:apk/alpine/zlib@1.3.2-r0?os_name=alpine&os_version=3.24; UNDER_INVESTIGATION)
CVE-2026-86140 (HIGH; pkg:apk/alpine/libxml2@2.13.9-r2?os_name=alpine&os_version=3.24; NOT_AFFECTED — approved exact-digest VEX at .engineering/evidence/PH-SEC-WO-003-LIBXML2-VEX.json)

The official tag postgres:17.11-alpine3.24 was freshly pulled; Docker reported it already up to date at the exact same digest. The recommendation receipt reports no tag recommendation. The image still contains Alpine zlib 1.3.2-r0; CVE-2026-85091 remains UNDER_INVESTIGATION. Existing exact-digest, owner-approved and independently audited VEX dispositions cover 23 Go stdlib findings and one libxml2 finding; no disposition was changed here.

## Gate

Result: BLOCKED_UNRESOLVED. 23 development-image and one PostgreSQL HIGH/CRITICAL finding remain unresolved. No suppression, executor self-approval, or old-digest approval was treated as a current disposition.
