## PH-SEC-WO-006 — execution result

**Status: BLOCKED_UNRESOLVED.** The required zero-HIGH/zero-CRITICAL image gate was not met. PR remains open and draft.

### Preflight

- Branch: security/ph-m01-dev-nongo-remediation.
- Preflight head: 0240b17d794ee17cb348501061a21600245086e4.
- Locked parent/merge base: 6c6c05fc5d332a88b70cd5778ac9bba91df798df.
- Context Lock fingerprints: 13/13 matched.
- PR #31 was open on the required branch; parent PR #15 remains open and unmerged.
- Locked scan reconciled exactly to 22 CVEs (20 HIGH, 2 CRITICAL); the prior 35 Go CVEs were zero.

### Candidate scans

| Candidate | HIGH | CRITICAL | Finding |
|---|---:|---:|---|
| A: latest official Node 24 Bookworm slim | 20 | 2 | Same 22 locked findings |
| B1: Bookworm plus available PCRE2 security update | 19 | 2 | 21 remain |
| B2: B1 plus stable npm 12.2.0 | 15 | 2 | 17 remain |
| C: official Node 24 Trixie slim | 13 | 0 | 12 original remain; new HIGH CVE-2026-84782 in OpenSSL |
| D: Node 24 Alpine, evidence only | 8 | 0 | Eight npm HIGH remain; not adopted |

All candidates preserved Node major 24. The 35 prior Go CVEs remain at zero HIGH/CRITICAL. Candidate C passed the full functional, build, database, Compose, web reload, and worker restart checks; its security scan prevents promotion. No candidate was selected, and Dockerfile.dev, Compose topology, dependencies, product behavior, schema, migrations, and TenantContext were not changed.

### Evidence

- Candidate matrix: .engineering/evidence/PH-SEC-WO-006-CANDIDATES.md
- Evidence Bundle: .engineering/evidence/PH-SEC-WO-006-EVIDENCE.md
- Raw manifests, metadata, SARIF, package/version receipts, test logs, hot reload proof, and hashes: .engineering/evidence/PH-SEC-WO-006/

The original local Compose image was restored and left running: web HTTP 200, worker running, PostgreSQL healthy. That image has the locked 22 findings and is not remediated by this Work Order.

**STOP CONDITION:** BLOCKED_UNRESOLVED. No implementation image is promoted. Do not merge PR #15 and do not start PH-M01-WO-002.
