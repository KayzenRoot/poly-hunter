# PH-SEC-WO-004 — Codex Execution Brief

Execute only PH-SEC-WO-004 on branch `security/ph-m01-dev-go-vex`.

## Preflight
1. Read Work Order + Context Lock.
2. Verify lineage includes parent head `339ef9ae3100b022623dfd0cfaa49b66a56cb7f0`.
3. Verify canonical policy main `771f75bbd23fd458e67be1d34024e78e39f5b8af`.
4. Verify all locked fingerprints.
5. Parse the exact dev-image SARIF and reconcile:
   - 56 unique HIGH/CRITICAL CVEs total;
   - 35 unique Go stdlib CVEs;
   - 64 Go stdlib scanner occurrences;
   - exactly the three locked binary paths.
6. Any mismatch => STOP STALE/BLOCKED.

## Execution
1. Identify/hash the three exact binaries from the exact development image.
2. Record npm package/lockfile lineage and `go version -m` metadata.
3. Run official govulncheck binary mode on each binary when supported and preserve raw output/tool version/database timestamp.
4. Build a deterministic 35-CVE × binary occurrence matrix.
5. For every occurrence, map advisory package/symbols and exact symbol/code presence.
6. Prove actual execution paths in the canonical Docker development commands/scripts.
7. Analyze attacker-controlled inputs and prerequisites.
8. Capture CISA KEV and FIRST EPSS as context only.
9. Assign VEX status per occurrence, then aggregate per unique CVE.
10. If any occurrence is incomplete, leave it UNDER_INVESTIGATION.
11. Never self-approve NOT_AFFECTED.
12. Do not modify Dockerfile, Compose, dependencies, lockfile, app, schema or migrations.

## Outputs
Create:
- `.engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.json`
- `.engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.md`
- `.engineering/evidence/PH-SEC-WO-004-EVIDENCE.md`
- supporting receipts under `.engineering/evidence/PH-SEC-WO-004/`

Machine-readable output must include:
- perBinary inventory;
- perOccurrence records;
- perCve aggregate records;
- exact evidence refs;
- expiry/revalidation triggers.

## Result
- All 35 unique CVEs aggregate to FIXED/proposed NOT_AFFECTED => `READY_FOR_INDEPENDENT_AUDIT`.
- Any AFFECTED/UNDER_INVESTIGATION => `BLOCKED_UNRESOLVED`.

## Git / PR
Commit/push on this branch.
Open/update nested PR against `feat/ph-m01-tenancy-persistence`.
Do not merge PR #15.
Final report in Brazilian Portuguese.

## STOP
Stop after the Go stdlib cluster is evidence-complete. Do not analyze remaining non-Go dev-image findings and do not begin PH-M01-WO-002.
