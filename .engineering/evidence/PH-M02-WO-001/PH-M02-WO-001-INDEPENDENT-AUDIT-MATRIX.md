# PH-M02-WO-001 — Independent Audit Matrix (Review 5461309598)

**Scope and current state:** This matrix reconciles 29 current/historical VEX records in its table; one archived GCC occurrence is excluded. The 24 PostgreSQL proposals (23 gosu and one libxml2; 22 HIGH / 2 CRITICAL) have formal per-occurrence independent audit and conditional owner approval for only PostgreSQL digest `sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744`, the documented local-development runtime, and expiry `2026-10-15T13:00:00Z`. Three util-linux proposals remain unapproved and bound only to the superseded Debian development digest. This matrix records evidence and bounded approval; it does not approve any other image or finding.

| Group | Records / CVEs | Exact image and component | Current state | Audit focus and open risk |
|---|---|---|---|---|
| PostgreSQL gosu / Go stdlib | 23: CVE-2025-58187, CVE-2025-58188, CVE-2025-61723, CVE-2025-61725, CVE-2025-61726, CVE-2025-61729, CVE-2025-68121, CVE-2026-25679, CVE-2026-32280, CVE-2026-32281, CVE-2026-32283, CVE-2026-33811, CVE-2026-33814, CVE-2026-33818, CVE-2026-39820, CVE-2026-39821, CVE-2026-39822, CVE-2026-39836, CVE-2026-42499, CVE-2026-42504, CVE-2026-56853, CVE-2026-56859, CVE-2026-56862 | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744; gosu / Go stdlib | NOT_AFFECTED; independently audited per occurrence and conditionally owner-approved for exact local-dev runtime through 2026-10-15T13:00:00Z | Scope is the documented non-root Config.User=postgres path and exact image/config digest. No digest transfer. |
| PostgreSQL libxml2 | 1: CVE-2026-86140 | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744; Alpine libxml2 2.13.9-r2 | NOT_AFFECTED; independently audited per occurrence and conditionally owner-approved for exact local-dev runtime through 2026-10-15T13:00:00Z | Exact PostgreSQL XML/native-extension analysis; arbitrary custom native extensions and future DTD validation remain outside the proposal. Application role remains superuser. |
| Development util-linux — prior Debian digest | 3: CVE-2026-76642, CVE-2026-78408, CVE-2026-78410 | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948; util-linux 2.41.5-0+deb13u1 | UNDER_INVESTIGATION; NOT_AFFECTED proposed, unapproved; HISTORICAL_SUPERSEDED | Review only against the old exact Debian digest. The proposals do not transfer to Alpine and are no longer current scan findings. |
| Development zlib — prior Debian digest | 1: CVE-2026-85091 | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948; Debian zlib 1:1.3.dfsg+really1.3.1-1+b1 | UNDER_INVESTIGATION; no proposed disposition; HISTORICAL_SUPERSEDED | Preserve old scope uncertainty without using it to classify the current fixed Alpine artifact. |
| Development zlib — current Alpine digest | 1: CVE-2026-85091 | sha256:6a6c3d9dda7cd7c5d392d34cf28b00034909b4cae14af364a016aae46d7604e2; Alpine zlib 1.3.2-r1 | FIXED for this exact artifact; no proposed disposition | Verify fixed package and exact scan absence; no reachability-based NOT_AFFECTED claim. |

## Count and approval state

- Current VEX records UNDER_INVESTIGATION: **0**. The 24 PostgreSQL exact-digest rows are NOT_AFFECTED with the recorded per-occurrence independent audit and conditional owner approval.
- Existing NOT_AFFECTED proposals: **27** total — 24 current PostgreSQL rows conditionally approved for the exact digest/runtime/expiry above, plus 3 historical old-Debian-dev util-linux rows still unapproved.
- Current unproposed HIGH/CRITICAL findings: **0** on the exact current image digests. Current dev zlib CVE-2026-85091 is FIXED on sha256:6a6c3d9dda7cd7c5d392d34cf28b00034909b4cae14af364a016aae46d7604e2.
- Historical under-investigation records: the old Debian dev zlib record (no proposal) and three util-linux proposals (pending, digest-bound to old Debian image). No dispositions transfer to the Alpine image.
- GCC CVE-2026-95619 remains archived from the prior image and excluded from current counts.
- Three historical util-linux proposals remain unapproved; the historical Debian dev zlib record remains UNDER_INVESTIGATION without a proposal. PostgreSQL current raw findings remain visible (24; 22 HIGH / 2 CRITICAL) with zero suppressions. `executorSelfApproval=false`.

## Evidence references

- Current dev scan: polyhunter-dev-alpine-final.sarif.json; receipt dev-alpine-final-scan-receipt.json.
- Candidate early-gate results: dev-alpine-candidate-experiment.md and dev-alpine-candidate-scan-receipt.json.
- Final local runtime: dev-alpine-final-runtime.txt.
- PostgreSQL exact-digest per-CVE VEX: postgres-zlib-r1-vex.json.
- Prior Debian source/runtime evidence remains preserved in the historical CR-07-AUD-07 receipts.

## Stop state

Historical stop state for review 5461309598: READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT after exact-head CI. The current audit qualification and gate state are recorded in the dated addendum below. This matrix records evidence and proposals only; it does not approve, suppress, merge, promote CHECKPOINT, admit WO-002, sign, or authorize trading. `liveTradingAuthorized=false`.

## Historical qualification snapshot before resolution — 2026-10-10 UTC

The row-by-row report `cr07-independent-per-occurrence-audit-20261009.json` covers the 24 PostgreSQL H/C records (22 HIGH, 2 CRITICAL) and says the existing evidence supports each proposal for the bounded local-dev runtime. Its source VEX and Scout SARIF hashes are `fe38d2b19edd8aaade332d4fc90633207452d1f9b9b154188c7800ef13077907` and `3f4d8afede798486bbb63be076a175fb0047d33116e2e3d94695862e88f89c14`; report SHA-256 is `4955638fa19eb027f76f1bc119af849b07f219e9a9c6a395d7f2ab1727b6b2c2`. Its audited proposal head is `8a4cb2e6c91a5ff458e02dd64f877311a5af9665`, with exact PostgreSQL image digest `sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744`.

The Project Owner recorded conditional approval in `owner-approval-postgres-vex-20261010.json` (SHA-256 `7752574a801af692003b6079705ca64af4cb2ba8cdfbf1b4227710db2ac329b9`), expiring `2026-10-15T13:00:00Z`. The reviewer was a separate subagent in the same Codex system, not a human/third-party and not blind; its own report leaves whether that meets ADR-0007 to project governance. The audit therefore does not populate auditor approval. All 24 rows remain `UNDER_INVESTIGATION` with `NOT_AFFECTED` proposed, no operative owner approval per row, and `executorSelfApproval=false`. Current gate: `BLOCKED_UNRESOLVED_INDEPENDENT_AUDITOR_QUALIFICATION`. The earlier matrix contents and counts remain historical; no proposal is transferred or suppressed.

## Current state after independent audit and owner decision — 2026-10-10 UTC

The 24 current PostgreSQL rows (23 gosu and one libxml2; 22 HIGH / 2 CRITICAL) are individually supported by cr07-independent-per-occurrence-audit-20261009.json and have the owner's conditional approval recorded in owner-approval-postgres-vex-20261010.json. Its condition is satisfied for exact image sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744, config sha256:6cfbc1caf64a3c8a85c062ca25eec78a2db1b0edbdca55906ce3d0d376e23e93, the documented local-dev runtime, and expiry 2026-10-15T13:00:00Z. Current row states are NOT_AFFECTED; raw scan findings remain 24 and unsuppressed.

This dated section records the intermediate state before `cr07-vex-audit-qualification-resolution-20261010.json` was applied. The current qualification and approved row states are recorded in the following section and machine-readable update. The auditor was a role-separated subagent in the same Codex system, not blind and not a third party; ADR-0007 and the VEX policy require an independent auditor but do not impose those extra conditions. The JEV recommendation for a human/third-party review remains advisory and did not approve any CVE.

Remaining proposal count: 3 historical util-linux findings, unapproved and bound only to the superseded Debian dev digest. The old Debian dev zlib remains under investigation without a proposal; the GCC occurrence remains archived. None transfers to current images. Local PostgreSQL superuser risk remains recorded. No suppression, self-approval, merge, checkpoint promotion, WO-002, signing, or trading is implied.
