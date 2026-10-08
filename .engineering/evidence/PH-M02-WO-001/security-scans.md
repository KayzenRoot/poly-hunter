# Exact-image scan and VEX reconciliation — PH-M02-WO-001 CR-07

Scan date: 2026-10-07. CR-07-AUD-01 evidence update: 2026-10-08. Scanner: Docker Scout CLI v1.24.0. Both full SARIF scans were freshly generated after the clean/no-cache final build and final PostgreSQL tag refresh.

| Image | Exact local digest | All findings | LOW | MEDIUM | HIGH | CRITICAL | SARIF SHA-256 |
|---|---|---:|---:|---:|---:|---:|---|
| `polyhunter-dev:local` | `sha256:1da515470671ec8175b1a1ff77dc408c333c0121f862f23f351288fb19d81fd1` | 35 | 26 | 7 | 2 | 0 | `3e61ddbfbad2ca881db4de09a2668be4700ac1d83e2a3d7bd31571f37c061cbc` |
| `postgres:17.11-alpine3.24` | `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` | 58 | 7 | 26 | 23 | 2 | `307df3f8cab60c17141e51d1f3237cc198f5e376aea2e4ad5581baec322a59c6` |

Both final SARIF files contain zero per-result suppressions. Docker Scout printed “4 exceptions obtained” for PostgreSQL; that notice is preserved and does not clear any finding.

## Current final-scan findings

### Development image — 2 HIGH, 0 CRITICAL

- `CVE-2026-95619`, HIGH — Debian `gcc-14`/libstdc++ `14.2.0-19`. The aligned `operator new` symbol is present, but exact final library disassembly shows alignment validation and `posix_memalign` with the original requested size. The vulnerable size-overflow operation is absent. Proposal: `NOT_AFFECTED`, justification `vulnerable_code_not_present`; status remains `UNDER_INVESTIGATION` pending independent audit and owner approval.
- `CVE-2026-85091`, HIGH — Debian `zlib1g 1:1.3.dfsg+really1.3.1-1+b1`. Exact Debian source lacks `gz_vacate`; Node's separate bundled zlib is reached through streaming `deflate`/`inflate` APIs, with no `gzprintf`/`gzvprintf` route from the runtime/application. Proposal: `NOT_AFFECTED`, justification `vulnerable_code_not_in_execute_path`; status remains `UNDER_INVESTIGATION` pending independent audit and owner approval.

### PostgreSQL image — 23 HIGH, 2 CRITICAL

The same digest remains unchanged; no rebuild or rescan was required for this evidence-only correction. Twenty-four Go/libxml2 findings retain their existing exact-digest owner/auditor approvals. PostgreSQL zlib `CVE-2026-85091` remains HIGH, Alpine zlib `1.3.2-r0`, and the vulnerable library is present and mapped. A recursive 237-ELF scan found additional direct libz consumers (`libxml2`, `pgcrypto.so`, `libLLVM`, utilities and others) and inspected all 87 PostgreSQL shared objects. No direct `gzprintf`/`gzvprintf` imports were found in those modules, but PostgreSQL uses generic `dlopen`/`dlsym`, and `pgcrypto.so` depends on libz. POSIX handle lookup includes dependencies. The exact PostgreSQL-ABI trigger sequence and attacker-controlled arbitrary SQL path were not proven. The prior `NOT_AFFECTED` proposal is withdrawn; this finding is `UNDER_INVESTIGATION` with no proposed disposition. Details and exact unresolved premises: [CR-07-VEX.md](CR-07-VEX.md#cr-07-aud-01-expanded-postgresql-evidence) and the `cr07-aud-01-*` receipts.

## Additional exact-version source reconciliation

Final Scout does not report util-linux HIGH/CRITICAL findings, but the exact Debian Trixie package is `2.41.5-0+deb13u1`. Debian's current tracker/upstream sources still include that release for CVE-2026-76642, CVE-2026-78408, and CVE-2026-78410. The binaries/features are present, so their absence from final SARIF is not treated as remediation. Individual proposals are recorded in [CR-07-VEX.md](CR-07-VEX.md) and [CR-07-VEX.json](CR-07-VEX.json): no authorized `fstab` entry or mount helper for CVE-76642; no app call or privileged operator path to `nsenter --join-cgroup` for CVE-78408; and no fstab-authorized restricted bind source/hook for CVE-78410. Each remains `UNDER_INVESTIGATION` pending audit/owner.

CVE-2026-78409 is not a final-image finding: Red Hat defines the affected range as util-linux v2.42–v2.42.2 and explicitly marks v2.40/v2.41 not affected; final image is v2.41.5. The prior Bookworm scanner row was a package/version mismatch, not a final-image disposition.

Current CISA KEV catalog `2026.10.04` lists none of the six proposed CVEs. FIRST EPSS values dated 2026-10-07 are in [cr07-kev-epss-reconciliation.json](cr07-kev-epss-reconciliation.json). Low EPSS is prioritization context only.

## Reconciliation and decision

All 23 development-image CVE IDs from the prior Bookworm digest are reconciled in [security-scans.json](security-scans.json): patched npm global-bundle packages, the Bookworm-to-Trixie Perl package-line change/module absence, util-linux source-version/path analysis, and exact zlib/libstdc++ proposals. No old-digest VEX approval has been transferred to the final development image.

Final exact scans, complete output, and Compose status: [cr07-full-final-scan-reconciliation.txt](cr07-full-final-scan-reconciliation.txt), [polyhunter-dev-cr07-full-final-scan.log](polyhunter-dev-cr07-full-final-scan.log), [postgres-cr07-full-final-scan.log](postgres-cr07-full-final-scan.log). Detailed per-occurrence fields, evidence hashes, expiry, and pending approval state: [CR-07-VEX.json](CR-07-VEX.json).

**Result: `BLOCKED_UNRESOLVED`.** All six exact-image/source rows remain `UNDER_INVESTIGATION`; five have unapproved proposed dispositions and the PostgreSQL zlib occurrence has no proposed disposition because indirect symbol resolution and the attacker-controlled trigger path are unresolved. No suppression or executor self-approval exists. This does not authorize merge, checkpoint promotion, or any trading capability.
