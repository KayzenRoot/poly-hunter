# PH-M02-WO-001 — container scan reconciliation

Scanner: Docker Scout CLI 1.24.0. Raw SARIF artifacts preserve findings and suppressions. The scan results below are package-level facts; VEX proposals remain UNDER_INVESTIGATION until independent audit and owner approval.

| Image | Digest | Results | LOW | MEDIUM | HIGH | CRITICAL | Suppressions |
|---|---|---:|---:|---:|---:|---:|---:|
| polyhunter-dev:local | sha256:1da515470671ec8175b1a1ff77dc408c333c0121f862f23f351288fb19d81fd1 | 35 | 26 | 7 | 2 | 0 | 0 |
| PostgreSQL 17.11 zlib-r1 local derivative | sha256:5c07b04ab44ac72e8387efafb68bef3340785edc012761c1f81a62b9a5cc3aa0 | 57 | 7 | 26 | 22 | 2 | 0 |

The selected PostgreSQL scan removed exactly one H finding from its prior exact digest: CVE-2026-85091 (zlib 1.3.2-r0). It introduced no new H/C IDs. The remaining PostgreSQL H/C results are 22 HIGH and 2 CRITICAL. They are represented individually in postgres-zlib-r1-vex.json as fresh, unapproved proposals; no previous digest approval is transferred.

## Official image comparison

The official postgres:17.11-bookworm and postgres:17.11-trixie scans both still report CVE-2026-85091. Bookworm: 29 HIGH / 2 CRITICAL; Trixie: 24 HIGH / 2 CRITICAL. Candidate digests, zlib package versions, full severities and raw SARIF hashes are in postgres-zlib-r1-official-candidates.md and the two raw SARIF receipts.

## Current VEX state

- Development image: 2 current HIGH results plus three disclosed util-linux source-reconciliation proposals; prior CR-07 proposals remain unapproved.
- PostgreSQL current digest: zlib FIXED; 24 current H/C occurrences have fresh exact-digest proposals with status UNDER_INVESTIGATION.
- Current high/critical scanner occurrences across both images: 26; proposed rows exist for all 26. The three supplementary util-linux rows remain separate source reconciliations.
- Approval state: no executor self-approval, no transfer of old PostgreSQL digest approvals, fresh auditor/owner approvals are pending.
- No suppressions were used. Passing CI or low EPSS does not clear a finding.
