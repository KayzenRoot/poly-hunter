# PH-SEC-WO-002 — Codex Execution Brief

Execute only PH-SEC-WO-002 on branch `security/ph-m01-postgres-gosu-vex`.

## Preflight
1. Read Work Order + Context Lock.
2. Verify branch lineage includes parent head `e6a9457e8d8ff60341c6db90346d5916ee13fa61`.
3. Fetch origin/main and verify canonical policy commit `771f75bbd23fd458e67be1d34024e78e39f5b8af`.
4. Verify every locked source fingerprint.
5. Verify the exact PostgreSQL image digest.
6. Reconcile exactly 23 in-scope PostgreSQL/gosu stdlib CVE rows from PH-SEC-WO-001.
7. Any mismatch => STOP STALE/BLOCKED.

## Execution
1. Extract/copy the exact gosu binary from the exact image without modifying it.
2. Record SHA-256, file metadata and `go version -m`.
3. Run official govulncheck in binary mode against the copied binary when supported. Install/run the analysis tool outside product dependencies and record tool/version.
4. Preserve raw govulncheck output and database/source timestamp.
5. For each CVE, map official advisory package/symbols to exact binary evidence.
6. Inspect the exact `docker-entrypoint.sh`: hash it, preserve relevant control-flow lines and identify the gosu invocation.
7. Start disposable/existing exact-image containers only as needed to prove process lifecycle:
   - before/at privilege drop where observable;
   - healthy steady state;
   - absence/presence of gosu after startup;
   - cmdline/exe/user/capability/socket facts.
8. Do not grant unsafe tracing privileges solely for evidence. If ptrace would be required, prefer static/process evidence and record the limitation.
9. Build 23 per-CVE disposition records.
10. Do not classify NOT_AFFECTED from "gosu exits quickly" alone. Tie each classification to the vulnerable package/symbol and exact invocation/reachability.
11. If proof is incomplete, use UNDER_INVESTIGATION.
12. Never self-approve NOT_AFFECTED.

## Outputs
Create:
- `.engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json`
- `.engineering/evidence/PH-SEC-WO-002-GOSU-VEX.md`
- `.engineering/evidence/PH-SEC-WO-002-EVIDENCE.md`
- receipts under `.engineering/evidence/PH-SEC-WO-002/`

Each CVE JSON row must contain at least:
cve, severity, imageDigest, gosuSha256, goVersion, vulnerablePackage, vulnerableSymbols, symbolPresence, actualInvocationPath, attackerControlledInput, prerequisites, status, justification, authoritativeRefs, evidenceRefs, expiry.

## Result
- All 23 FIXED/proposed NOT_AFFECTED with complete proof => `READY_FOR_INDEPENDENT_AUDIT`.
- Any AFFECTED/UNDER_INVESTIGATION => `BLOCKED_UNRESOLVED`.

## Git / PR
Commit/push on the same security branch.
Open/update nested PR against `feat/ph-m01-tenancy-persistence`.
Do not merge parent PR #15.
Final report in Brazilian Portuguese.

## STOP
Stop after evidence is ready for independent audit. Do not touch libxml2, dev-image findings or PH-M01-WO-002.
