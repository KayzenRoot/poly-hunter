# PH-M02-WO-001 — container scan reconciliation

Scanner: Docker Scout CLI 1.24.0. Raw SARIF artifacts preserve findings and suppressions. The scan results below are package-level facts; VEX proposals remain UNDER_INVESTIGATION until independent audit and owner approval.

| Image | Digest | Results | LOW | MEDIUM | HIGH | CRITICAL | Suppressions |
|---|---|---:|---:|---:|---:|---:|---:|
| polyhunter-dev:local (prior snapshot) | sha256:1da515470671ec8175b1a1ff77dc408c333c0121f862f23f351288fb19d81fd1 | 35 | 26 | 7 | 2 | 0 | 0 |
| polyhunter-dev:local (fresh rebuilt image) | sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948 | 34 | 26 | 7 | 1 | 0 | 0 |
| PostgreSQL 17.11 zlib-r1 (previous candidate) | sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 | 57 | 7 | 26 | 22 | 2 | 0 |
| PostgreSQL 17.11 zlib-r1 (locked current image) | sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744 | 57 | 7 | 26 | 22 | 2 | 0 |

The locked PostgreSQL scan removed CVE-2026-85091 (zlib 1.3.2-r0) from the official baseline. The 57 findings and severity counts match the previously corrected candidate exactly; no new H/C IDs appeared. The 24 remaining PostgreSQL H/C results are pending, unapproved proposals, and prior-digest approvals are not transferred. The rebuilt dev image reports one current HIGH (zlib); its former GCC CVE-2026-95619 occurrence is archived as historical because it is absent from the latest scan, without being auto-classified FIXED or NOT_AFFECTED.

## Official image comparison

The official postgres:17.11-bookworm and postgres:17.11-trixie scans both still report CVE-2026-85091. Bookworm: 29 HIGH / 2 CRITICAL; Trixie: 24 HIGH / 2 CRITICAL. Candidate digests, zlib package versions, full severities and raw SARIF hashes are in postgres-zlib-r1-official-candidates.md and the two raw SARIF receipts.

## Current VEX state

- Development image: 1 current HIGH result plus three current-digest util-linux source-reconciliation proposals; the earlier 2-H scan and the absent GCC occurrence are historical. The three util-linux proposals are revalidated against digest sha256:73513629a7f6f35aab1ce2c9565f3cdb03a37f90efdf8c530b4b4368a8ce7948.
- PostgreSQL current digest: zlib FIXED; 24 current H/C occurrences have fresh exact-digest proposals with status UNDER_INVESTIGATION.
- Current scanner H/C occurrences across the latest images: 25; proposal rows exist for all 25. Three current-digest supplemental util-linux proposals bring the current pending count to 28. One absent GCC occurrence is archived historically and excluded from current pending counts. All 28 current proposals remain unapproved.
- Approval state: no executor self-approval, no transfer of old PostgreSQL digest approvals, fresh auditor/owner approvals are pending.
- No suppressions were used. Passing CI or low EPSS does not clear a finding.
