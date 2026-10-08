# Exact-image scan and VEX reconciliation — PH-M02-WO-001 CR-07

Date: 2026-10-07. Scanner: Docker Scout CLI v1.24.0. Both full SARIF scans were freshly generated after the clean/no-cache final build and final PostgreSQL tag refresh.

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

The same digest remains unchanged after a fresh pull. Twenty-four Go/libxml2 findings retain their existing exact-digest owner/auditor approvals. The one remaining proposal is `CVE-2026-85091`, HIGH, Alpine zlib `1.3.2-r0`. The vulnerable library is present, but `postgres` imports only `deflate`; `pg_dump` and `pg_restore` import `gzwrite`/`gzopen` and do not import `gzprintf`/`gzvprintf`, the CVE trigger functions. Only PostgreSQL server processes run; dump/restore are not called by the application. Proposal: `NOT_AFFECTED`, justification `vulnerable_code_not_in_execute_path`; status remains `UNDER_INVESTIGATION` pending independent audit and owner approval.

## Additional exact-version source reconciliation

Final Scout does not report util-linux HIGH/CRITICAL findings, but the exact Debian Trixie package is `2.41.5-0+deb13u1`. Debian's current tracker/upstream sources still include that release for CVE-2026-76642, CVE-2026-78408, and CVE-2026-78410. The binaries/features are present, so their absence from final SARIF is not treated as remediation. Individual proposals are recorded in [CR-07-VEX.md](CR-07-VEX.md) and [CR-07-VEX.json](CR-07-VEX.json): no authorized `fstab` entry or mount helper for CVE-76642; no app call or privileged operator path to `nsenter --join-cgroup` for CVE-78408; and no fstab-authorized restricted bind source/hook for CVE-78410. Each remains `UNDER_INVESTIGATION` pending audit/owner.

CVE-2026-78409 is not a final-image finding: Red Hat defines the affected range as util-linux v2.42–v2.42.2 and explicitly marks v2.40/v2.41 not affected; final image is v2.41.5. The prior Bookworm scanner row was a package/version mismatch, not a final-image disposition.

Current CISA KEV catalog `2026.10.04` lists none of the six proposed CVEs. FIRST EPSS values dated 2026-10-07 are in [cr07-kev-epss-reconciliation.json](cr07-kev-epss-reconciliation.json). Low EPSS is prioritization context only.

## Reconciliation and decision

All 23 development-image CVE IDs from the prior Bookworm digest are reconciled in [security-scans.json](security-scans.json): patched npm global-bundle packages, the Bookworm-to-Trixie Perl package-line change/module absence, util-linux source-version/path analysis, and exact zlib/libstdc++ proposals. No old-digest VEX approval has been transferred to the final development image.

Final exact scans, complete output, and Compose status: [cr07-full-final-scan-reconciliation.txt](cr07-full-final-scan-reconciliation.txt), [polyhunter-dev-cr07-full-final-scan.log](polyhunter-dev-cr07-full-final-scan.log), [postgres-cr07-full-final-scan.log](postgres-cr07-full-final-scan.log). Detailed per-occurrence fields, evidence hashes, expiry, and pending approval state: [CR-07-VEX.json](CR-07-VEX.json).

**Result: `READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT`.** All six proposed rows remain `UNDER_INVESTIGATION`, independent auditor and owner approval are pending, and no suppression or executor self-approval exists. This does not authorize merge, checkpoint promotion, or any trading capability.
