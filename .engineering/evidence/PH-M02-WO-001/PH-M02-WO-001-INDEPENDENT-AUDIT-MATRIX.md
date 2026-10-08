# PH-M02-WO-001 — Independent Audit Matrix (Review 5461309598)

**Scope:** Preserve all 27 existing unapproved NOT_AFFECTED proposals for independent review. The 24 PostgreSQL proposals remain current and digest-bound; the 3 development util-linux proposals remain pending but historical and bound only to the old Debian digest. This matrix is not an approval.

| Group | Records / CVEs | Exact image and component | Current state | Audit focus and open risk |
|---|---|---|---|---|
| PostgreSQL gosu / Go stdlib | 23: CVE-2025-58187, CVE-2025-58188, CVE-2025-61723, CVE-2025-61725, CVE-2025-61726, CVE-2025-61729, CVE-2025-68121, CVE-2026-25679, CVE-2026-32280, CVE-2026-32281, CVE-2026-32283, CVE-2026-33811, CVE-2026-33814, CVE-2026-33818, CVE-2026-39820, CVE-2026-39821, CVE-2026-39822, CVE-2026-39836, CVE-2026-42499, CVE-2026-42504, CVE-2026-56853, CVE-2026-56859, CVE-2026-56862 | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744; gosu / Go stdlib | UNDER_INVESTIGATION; NOT_AFFECTED proposed, unapproved | Review exact per-CVE symbols and non-root Config.User=postgres path. No digest transfer. |
| PostgreSQL libxml2 | 1: CVE-2026-86140 | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744; Alpine libxml2 2.13.9-r2 | UNDER_INVESTIGATION; NOT_AFFECTED proposed, unapproved | Review PostgreSQL XML/native-extension path; application role remains superuser and arbitrary native extension execution remains outside the assessed default path. |
| Development util-linux — prior Debian digest | 3: CVE-2026-76642, CVE-2026-78408, CVE-2026-78410 | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948; util-linux 2.41.5-0+deb13u1 | UNDER_INVESTIGATION; NOT_AFFECTED proposed, unapproved; HISTORICAL_SUPERSEDED | Review only against the old exact Debian digest. The proposals do not transfer to Alpine and are no longer current scan findings. |
| Development zlib — prior Debian digest | 1: CVE-2026-85091 | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948; Debian zlib 1:1.3.dfsg+really1.3.1-1+b1 | UNDER_INVESTIGATION; no proposed disposition; HISTORICAL_SUPERSEDED | Preserve old scope uncertainty without using it to classify the current fixed Alpine artifact. |
| Development zlib — current Alpine digest | 1: CVE-2026-85091 | sha256:6a6c3d9dda7cd7c5d392d34cf28b00034909b4cae14af364a016aae46d7604e2; Alpine zlib 1.3.2-r1 | FIXED for this exact artifact; no proposed disposition | Verify fixed package and exact scan absence; no reachability-based NOT_AFFECTED claim. |

## Count and approval state

- Current VEX records UNDER_INVESTIGATION: **24**, all PostgreSQL exact-digest proposals.
- Existing NOT_AFFECTED proposals still pending independent audit and owner approval: **27** total — 24 current PostgreSQL + 3 historical old-Debian-dev proposals. All 27 remain unapproved.
- Current unproposed UNDER_INVESTIGATION findings: **0**. Current dev zlib CVE-2026-85091 is FIXED on sha256:6a6c3d9dda7cd7c5d392d34cf28b00034909b4cae14af364a016aae46d7604e2.
- Historical under-investigation records: the old Debian dev zlib record (no proposal) and three util-linux proposals (pending, digest-bound to old Debian image). No dispositions transfer to the Alpine image.
- GCC CVE-2026-95619 remains archived from the prior image and excluded from current counts.
- independentAuditor=null, ownerApproval=null, executorSelfApproval=false. No scanner suppression was used.

## Evidence references

- Current dev scan: polyhunter-dev-alpine-final.sarif.json; receipt dev-alpine-final-scan-receipt.json.
- Candidate early-gate results: dev-alpine-candidate-experiment.md and dev-alpine-candidate-scan-receipt.json.
- Final local runtime: dev-alpine-final-runtime.txt.
- PostgreSQL exact-digest per-CVE VEX: postgres-zlib-r1-vex.json.
- Prior Debian source/runtime evidence remains preserved in the historical CR-07-AUD-07 receipts.

## Stop state

READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT after GitHub Actions Validate and required checks pass on the final pushed HEAD. This matrix records proposals only; it does not approve, suppress, merge, promote CHECKPOINT, admit WO-002, sign, or authorize trading. `liveTradingAuthorized=false`.
