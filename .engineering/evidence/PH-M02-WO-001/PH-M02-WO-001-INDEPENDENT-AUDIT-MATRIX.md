# PH-M02-WO-001 — Independent Audit Matrix (Review 5460654469)

**Scope:** 28 current HIGH/CRITICAL VEX records on the exact image digests below. The rows group records for independent review; they are not approvals.

| Group | Records / CVEs | Exact image and component | Current VEX | Audit focus and open risk |
|---|---|---|---|---|
| PostgreSQL gosu / Go stdlib | 23: CVE-2025-58187, CVE-2025-58188, CVE-2025-61723, CVE-2025-61725, CVE-2025-61726, CVE-2025-61729, CVE-2025-68121, CVE-2026-25679, CVE-2026-32280, CVE-2026-32281, CVE-2026-32283, CVE-2026-33811, CVE-2026-33814, CVE-2026-33818, CVE-2026-39820, CVE-2026-39821, CVE-2026-39822, CVE-2026-39836, CVE-2026-42499, CVE-2026-42504, CVE-2026-56853, CVE-2026-56859, CVE-2026-56862 | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744; gosu / Go stdlib | UNDER_INVESTIGATION; NOT_AFFECTED proposed | Verify per-CVE vulnerable-symbol/code evidence and exact non-root entrypoint path (Config.User=postgres, UID/GID 70; root-only gosu branch skipped). No digest transfer. |
| PostgreSQL libxml2 | 1: CVE-2026-86140 | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744; Alpine libxml2 2.13.9-r2 | UNDER_INVESTIGATION; NOT_AFFECTED proposed | Review PostgreSQL XML/native-extension path. App DB role is still superuser; arbitrary native extension execution is outside the assessed default path. |
| Dev zlib scope | 1: CVE-2026-85091 | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948; Debian zlib1g 1:1.3.dfsg+really1.3.1-1+b1 | UNDER_INVESTIGATION; no proposed disposition | Debian did not mark Bookworm/Trixie not affected pending upstream scope; Ubuntu records older-version reproducer behavior. Exact question: separate 1.3.0/1.3.1 issue vs CVE scope, plus indirect dlsym/API reachability. |
| Dev util-linux | 3: CVE-2026-76642, CVE-2026-78408, CVE-2026-78410 | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948; util-linux 2.41.5-0+deb13u1 | UNDER_INVESTIGATION; NOT_AFFECTED proposed | Check each CVE prerequisite against exact fstab, mode/SUID, capabilities and call-path evidence. mount remains SUID root. |

## Count and approval state

- 28 current VEX records remain UNDER_INVESTIGATION: 27 proposed NOT_AFFECTED dispositions and 1 zlib record with no proposed disposition.
- All 27 proposals still need independent auditor verification and explicit owner approval under ADR-0007. independentAuditor=null, ownerApproval=null, executorSelfApproval=false.
- One GCC CVE-2026-95619 occurrence from the prior dev digest is archived historically and excluded from the 28 current records; absence from the current scan is not treated as a disposition.
- The raw scans and their findings are unchanged. No image rebuild or rescan was performed for this evidence-only correction.

## Evidence references

- Exact Debian source archive and file hashes: dev-zlib-debian-source-archive-verification.json.
- Exact image/runtime/native consumer review: dev-zlib-source-and-path-review-5460654469.json, dev-zlib-runtime-review-5460654469.json, dev-zlib-native-addon-marker-scan.json, dev-zlib-elf-inventory.txt.
- Full current zlib VEX record and all per-CVE rows: CR-07-VEX.json and postgres-zlib-r1-vex.json.
- Machine-readable matrix: PH-M02-WO-001-INDEPENDENT-AUDIT-MATRIX.json.

## Stop state

BLOCKED_UNRESOLVED — CVE-2026-85091 scope remains undecided by upstream/Debian for the installed 1.3.1 source, and no exact-runtime proof resolves whether the older-release crash is in scope. This matrix does not approve or suppress any finding.
