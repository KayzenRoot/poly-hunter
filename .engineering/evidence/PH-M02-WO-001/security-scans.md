# PH-M02-WO-001 — container scan reconciliation

Scanner: Docker Scout CLI 1.24.0. Raw SARIF artifacts preserve findings and suppressions. Earlier rows and dated pre-approval sections are historical snapshots. Current state: the 24 PostgreSQL H/C occurrences have per-occurrence independent audit and conditional owner approval for one exact digest/runtime/expiry; three util-linux proposals remain unapproved on the superseded Debian development digest. No raw finding is suppressed.

| Image | Digest | Results | LOW | MEDIUM | HIGH | CRITICAL | Suppressions |
|---|---|---:|---:|---:|---:|---:|---:|
| polyhunter-dev:local (prior snapshot) | sha256:1da515470671ec8175b1a1ff77dc408c333c0121f862f23f351288fb19d81fd1 | 35 | 26 | 7 | 2 | 0 | 0 |
| polyhunter-dev:local (historical Debian image) | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948 | 34 | 26 | 7 | 1 | 0 | 0 |
| PostgreSQL 17.11 zlib-r1 (previous candidate) | sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 | 57 | 7 | 26 | 22 | 2 | 0 |
| PostgreSQL 17.11 zlib-r1 (locked current image) | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 | 57 | 7 | 26 | 22 | 2 | 0 |

Historical AUD-07 scan snapshot before Alpine remediation and per-occurrence approval: the locked PostgreSQL digest removed CVE-2026-85091 (zlib 1.3.2-r0) from the official baseline. This fixed result applies to PostgreSQL only; the separate dev-image zlib 1.3.1 result was then-current and unresolved; CR-07-AUD-08 later fixed it for the exact Alpine digest. The 57 findings and severity counts match the previously corrected candidate exactly; no new H/C IDs appeared. At that snapshot, the 24 PostgreSQL H/C results had pending proposals; the later row-by-row audit and owner decision are recorded below. At that snapshot, the rebuilt Debian dev image reported one HIGH (zlib); its former GCC CVE-2026-95619 occurrence is archived as historical because it is absent from the latest scan, without being auto-classified FIXED or NOT_AFFECTED.

## Official image comparison

The official postgres:17.11-bookworm and postgres:17.11-trixie scans both still report CVE-2026-85091. Bookworm: 29 HIGH / 2 CRITICAL; Trixie: 24 HIGH / 2 CRITICAL. Candidate digests, zlib package versions, full severities and raw SARIF hashes are in postgres-zlib-r1-official-candidates.md and the two raw SARIF receipts.

## Current VEX state

- Development image: the current Node 24 Alpine image has zlib 1.3.2-r1 and 0 HIGH / 0 CRITICAL; three util-linux proposals remain historical and bound to the prior Debian digest sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948.
- PostgreSQL current digest: zlib FIXED; 24 raw H/C occurrences remain visible (22 HIGH / 2 CRITICAL) with NOT_AFFECTED statuses supported by the formal per-occurrence audit and conditional owner approval for the exact digest/config, documented local-development runtime, and expiry 2026-10-15T13:00:00Z.
- Current scanner H/C occurrences across the latest images: 24, all on the PostgreSQL image. All 24 have the bounded audit and owner records. Three util-linux proposals remain pending and historical, bound only to the superseded Debian development digest. The old Debian dev zlib remains historical UNDER_INVESTIGATION without a proposal. One absent GCC occurrence is archived historically and excluded.
- Approval state: no executor self-approval; no transfer of old-digest decisions; three historical util-linux proposals remain unapproved. Raw findings are not suppressed.
- No suppressions were used. Passing CI or low EPSS does not clear a finding.

## CR-07-AUD-07 — current dev-zlib finding

Review 5460654469 audited HEAD 6579e97064570cc38530e69944173fde09920d7c. The unchanged dev image digest sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948 still has one raw HIGH zlib finding; the current SARIF hash remains 25a4020d28f8d5e3d55a19f9c52e02ddaa549aade93804cf92bebab6e4f68622. The evidence correction withdraws its unsupported NOT_AFFECTED proposal and records no proposed disposition. Current count: 28 VEX records, 27 unapproved proposals, 1 no-disposition zlib record; 1 GCC record historical. Raw scan data, images and digests are unchanged.

The exact Debian 1.3.1 source lacks gz_vacate but retains related gz APIs. Debian's 2026-10-05 maintainer response deferred a not-affected decision pending upstream scope; Ubuntu reports a reproducer that also crashes 1.3.0/1.3.1. Runtime analysis narrows direct application reachability but does not settle the CVE scope or every indirect dlsym path. Status is BLOCKED_UNRESOLVED. Full evidence and the group matrix are in CR-07-VEX.md and PH-M02-WO-001-INDEPENDENT-AUDIT-MATRIX.md.


## CR-07-AUD-08 — current dev image after fixed-zlib promotion

| Image | Digest | Results | LOW | MEDIUM | HIGH | CRITICAL | Suppressions |
|---|---|---:|---:|---:|---:|---:|---:|
| Current canonical dev image — Node 24 Alpine 3.24, zlib 1.3.2-r1 | sha256:6a6c3d9dda7cd7c5d392d34cf28b00034909b4cae14af364a016aae46d7604e2 | 6 | 0 | 6 | 0 | 0 | 0 |
| Preserved current PostgreSQL image — unchanged | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 | 57 | 7 | 26 | 22 | 2 | 0 |

The exact current dev image supersedes Debian digest sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948. Its one HIGH CVE-2026-85091 is fixed by Alpine zlib 1.3.2-r1; the raw exact-image scan has no HIGH/CRITICAL, no new H/C and no suppressions. Six MEDIUM findings remain. Docker Scout CLI 1.24.0 raw SARIF and scan receipt are preserved.

Current proposal reconciliation: 24 PostgreSQL H/C proposals are NOT_AFFECTED after individual audit and conditional owner approval, limited to the exact PostgreSQL manifest/config digests, documented local-development runtime and expiry 2026-10-15T13:00:00Z. Three util-linux proposals remain unapproved and historical, bound to the old Debian digest. The old Debian zlib record remains UNDER_INVESTIGATION without a proposal and historical only; current Alpine zlib is FIXED for its exact digest. No disposition transfers between image digests. PostgreSQL digest, data volume and prior corrections were preserved.

The prior local validation/runtime snapshot passed: candidate provider/boundary tests 43/43; npm run validate 238/238 tests plus lint/format/typecheck/build/audit; db:generate no drift; migrations PASS; PostgreSQL integration 66/66; Docker Compose config PASS; web healthy / HTTP 200; worker running; PostgreSQL healthy. Docker Desktop/WSL storage later became unavailable, so current stack health is not claimed. Exact-head GitHub Actions and required checks must pass on the final pushed head.

## Historical audit-qualification snapshot before resolution — 2026-10-10 UTC

The 24 current PostgreSQL findings remain visible in the exact Scout result: 22 HIGH, 2 CRITICAL, no suppressions. A separate audit report covers 24/24 rows and concludes that the existing evidence supports the proposed `NOT_AFFECTED` positions for the documented runtime. Audit SHA-256: `4955638fa19eb027f76f1bc119af849b07f219e9a9c6a395d7f2ab1727b6b2c2`; proposal head: `8a4cb2e6c91a5ff458e02dd64f877311a5af9665`; PostgreSQL digest: `sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744`.

The owner decision is recorded and conditional on a formal independent audit per occurrence (receipt SHA-256 `7752574a801af692003b6079705ca64af4cb2ba8cdfbf1b4227710db2ac329b9`). The reviewer report says the reviewer was a role-separated subagent in the same Codex system, not a human/third-party and not blind, and left auditor qualification to governance. This is the historical state before the qualification-resolution receipt; the current section below supersedes this interim gate. No scan was repeated because image digests and runtime artifacts did not change.

## Current scan and VEX state — 2026-10-10 UTC

The current development image sha256:6a6c3d9dda7cd7c5d392d34cf28b00034909b4cae14af364a016aae46d7604e2 has 0 HIGH / 0 CRITICAL findings. The exact PostgreSQL image sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 still reports 24 raw findings (22 HIGH / 2 CRITICAL), with 0 suppressions. Each current PostgreSQL occurrence has now been independently reviewed per row and owner-approved as NOT_AFFECTED for the bounded local-dev runtime, expiring 2026-10-15T13:00:00Z; no raw SARIF finding was removed.

Current unresolved high/critical VEX findings: 0 for the exact current image digests. Historical unapproved proposals: 3 util-linux rows remain only on the old Debian dev digest; the old Debian zlib remains UNDER_INVESTIGATION without a proposal and the GCC row is archived. No historical approval transfers. The local PostgreSQL superuser role remains a risk item. Image scans are unchanged because no image or runtime artifact changed.

The malformed provider correction and complete local validation are recorded in provider-malformed-shape-correction-20261010.json. Exact final-head GitHub checks and independent PR review are linked in PR #43. Checkpoint Delta remains proposed; no merge/promotion/trading authorization is implied. The current integrity receipt binds 879 VEX evidence hash pairs across 101 unique referenced paths and the 100-file non-self-referential aggregate manifest, with zero missing paths or mismatches; its final SHA is recorded in the machine-readable VEX evidence.
