# PH-M01-WO-003 — VEX reconciliation against sha256:f810df3a64aa15b99e477006a39c399eb43d9b59c635376d942e89dc15cc17c8

| | |
| --- | --- |
| Image | `polyhunter-dev:local` |
| Artifact under review | `sha256:f810df3a64aa15b99e477006a39c399eb43d9b59c635376d942e89dc15cc17c8` |
| Prior artifact (dispositions inherited) | `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c` |
| Locked base | `af6235d2164171985af6152ba03835826ace3cdb` |
| Scanner | docker scout 1.24.0 |
| Rows scanned (new artifact) | 82 |
| HIGH/CRITICAL rows | 25 |

> **Severity source.** Severity is parsed from `message.text`. SARIF `level` carries the
> VEX/status channel, not the vulnerability severity; reading `level` reports 0 HIGH/CRITICAL
> on an image that has 25, which would read as "clean" on a false premise.

## Why the rebuild branch was mandatory

`Dockerfile.dev` copies `packages/db/package.json`, and this Work Order added the
`./server/vault` export mapping to it. That is a build input change, so the identical-digest
shortcut was unavailable and a rebuild plus a fresh scan was required. Unchanged:
`package.json`, `package-lock.json`, `Dockerfile.dev`, the base image `node:24-bookworm-slim`
and every dependency version. `npm audit --audit-level=high` reports 0 vulnerabilities.

## Scanner delta: prior artifact vs new artifact

Rows 80 → 82; identical 80; added 2; removed 0.

HIGH/CRITICAL 25 → 25.

Severity histogram prior: {"UNSPECIFIED":4,"LOW":33,"MEDIUM":18,"HIGH":21,"CRITICAL":4}

Severity histogram new: {"UNSPECIFIED":4,"LOW":34,"MEDIUM":19,"HIGH":21,"CRITICAL":4}

### Rows added by this scan

| CVE | Severity | Component | Fixed in |
| --- | --- | --- | --- |
| CVE-2026-105712 | LOW | `pkg:deb/debian/gnupg2@2.2.40-1.1%2Bdeb12u2?os_distro=bookworm&os_name=debian&os_version=12` | not |
| CVE-2026-104844 | MEDIUM | `pkg:npm/postcss-selector-parser@7.1.4` | 7.1.6 |

Both added rows are below HIGH/CRITICAL and originate outside this repository's dependency graph: CVE-2026-105712 (LOW) is Debian gnupg2/gpgv, shipped by the base image; CVE-2026-104844 (MEDIUM) is postcss-selector-parser@7.1.4 bundled inside npm's own node_modules in the base image. Neither appears in package-lock.json (grep count 0). Their appearance indicates the scanner datasource advanced between the two scans, not that WO-003 introduced a dependency. They are recorded here rather than suppressed.

No rows were removed by this scan.

## Outcome

| Outcome | Count |
| --- | --- |
| NOT_AFFECTED | 25 |
| UNDER_INVESTIGATION | 0 |
| AFFECTED | 0 |

Dispositions inherited: 25.
Dispositioned CVEs absent from the new scan: none.
HIGH/CRITICAL CVEs with no prior disposition: none.

## Per-finding premise revalidation

Each row was re-proven against the new artifact rather than carried forward by
reference. A premise that failed to re-confirm would have returned to
UNDER_INVESTIGATION; none did.

| CVE | Severity | Component | Prior justification | Identity | Severity | Premise | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CVE-2026-102010 | HIGH | `pkg:deb/debian/gcc-12` | vulnerable_code_not_present | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-78409 | HIGH | `pkg:deb/debian/util-linux` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-48962 | HIGH | `pkg:deb/debian/perl` | vulnerable_code_not_present | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-102276 | HIGH | `pkg:npm/brace-expansion` | vulnerable_code_cannot_be_controlled_by_adversary | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-102278 | HIGH | `pkg:npm/brace-expansion` | vulnerable_code_cannot_be_controlled_by_adversary | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-14257 | HIGH | `pkg:npm/brace-expansion` | vulnerable_code_cannot_be_controlled_by_adversary | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-19534 | HIGH | `pkg:npm/undici` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-42497 | HIGH | `pkg:deb/debian/perl` | vulnerable_code_not_present | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-48959 | HIGH | `pkg:deb/debian/perl` | vulnerable_code_not_present | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-69152 | HIGH | `pkg:npm/brace-expansion` | vulnerable_code_cannot_be_controlled_by_adversary | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-73566 | HIGH | `pkg:npm/tar` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-82560 | HIGH | `pkg:deb/debian/perl` | vulnerable_code_not_present | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-103111 | HIGH | `pkg:deb/debian/pcre2` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-69192 | HIGH | `pkg:npm/ip-address` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-95619 | HIGH | `pkg:deb/debian/gcc-12` | vulnerable_code_cannot_be_controlled_by_adversary | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-78410 | HIGH | `pkg:deb/debian/util-linux` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-78408 | HIGH | `pkg:deb/debian/util-linux` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-85091 | HIGH | `pkg:deb/debian/zlib` | vulnerable_code_not_present | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-57432 | HIGH | `pkg:deb/debian/perl` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-76642 | HIGH | `pkg:deb/debian/util-linux` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-93748 | HIGH | `pkg:npm/http-cache-semantics` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-12087 | CRITICAL | `pkg:deb/debian/perl` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-13221 | CRITICAL | `pkg:deb/debian/perl` | vulnerable_code_not_in_execute_path | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-42496 | CRITICAL | `pkg:deb/debian/perl` | vulnerable_code_not_present | same | same | reconfirmed | NOT_AFFECTED |
| CVE-2026-8376 | CRITICAL | `pkg:deb/debian/perl` | vulnerable_code_cannot_be_controlled_by_adversary | same | same | reconfirmed | NOT_AFFECTED |

## Justification axes re-evaluated

- `vulnerable_code_not_present` — dpkg inventory unchanged between artifacts; WO-003 adds no Debian package.
- `vulnerable_code_not_in_execute_path` — WO-003's sole new executable surface is packages/db/src/server/vault/*, which imports node:crypto and no other runtime module; it cannot reach the vulnerable deb path.
- `vulnerable_code_cannot_be_controlled_by_adversary` — WO-003's new attacker-controlled inputs are limited to a UUID route id and a `purpose` matching ^[a-z0-9][a-z0-9_-]{0,63}$; no regex/selector/pattern input is accepted.

## Suppression policy

Suppressions added: **0**. Ignore rules added: **0**. Severity downgrades: **0**.

This reconciliation cannot emit AFFECTED by construction; an AFFECTED row is a real defect and is raised as a correction request, not self-graded here.

## Expiry

A NOT_AFFECTED disposition expires at a new image digest. This artifact is terminal for PH-M01-WO-003; any later rebuild returns every row to UNDER_INVESTIGATION pending re-proof.
