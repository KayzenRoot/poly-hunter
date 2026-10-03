# PH-SEC-WO-001 — Codex Execution Brief

Execute only PH-SEC-WO-001 on branch security/ph-m01-wo001-vex-analysis.

## Preflight
1. Read the Work Order and Context Lock.
2. Verify branch/head lineage includes blocked base 3ad44a62bbcc00abdc61b34efd6983a2e765aca9.
3. Fetch origin/main and verify canonical policy commit 771f75bbd23fd458e67be1d34024e78e39f5b8af.
4. Verify all Context Lock source fingerprints and both exact image digests.
5. Verify final SARIF files are byte-identical to the locked blobs.
6. If any mismatch exists, STOP as STALE/BLOCKED.

## Execution
1. Deterministically parse the two final SARIF receipts and enumerate every unique HIGH/CRITICAL CVE.
2. Build a machine-readable disposition file and human review report.
3. For every CVE, gather authoritative evidence:
   - vendor/upstream advisory/fix status;
   - CISA KEV;
   - FIRST EPSS;
   - exact component/version;
   - exact image/digest;
   - component/code presence;
   - exploit prerequisites;
   - execution/reachability;
   - attacker control;
   - container user/capabilities/network exposure;
   - mitigation;
   - canonical VEX status/justification;
   - expiry.
4. Use deterministic local inspection of exact images where needed.
5. Do NOT add ignores/suppressions.
6. Do NOT change Dockerfile, Compose, dependencies, schema, code, migrations or tests.
7. If a claim cannot be proven, leave it UNDER_INVESTIGATION.
8. Reconcile the disposition set exactly to the scanner HIGH/CRITICAL set.

## Outputs
Create:
- .engineering/evidence/PH-SEC-WO-001-VEX.json
- .engineering/evidence/PH-SEC-WO-001-VEX.md
- .engineering/evidence/PH-SEC-WO-001-EVIDENCE.md
- supporting receipts under .engineering/evidence/PH-SEC-WO-001/

The JSON must include for each CVE: imageDigest, component, version, severity, status, justification, KEV, EPSS, evidenceRefs, expiry.

## Result semantics
- If any HIGH/CRITICAL remains AFFECTED or UNDER_INVESTIGATION: BLOCKED_UNRESOLVED.
- Only if all are FIXED/NOT_AFFECTED with complete evidence: READY_FOR_INDEPENDENT_AUDIT.
- Never self-approve NOT_AFFECTED.

## Git / PR
Commit and push on the same security branch.
Update/open nested PR against feat/ph-m01-tenancy-persistence.
Do not merge PR #15.
Final report in Brazilian Portuguese.

## STOP
Stop after evidence is PR-ready for independent HIGH_ASSURANCE audit. Do not modify product code and do not start PH-M01-WO-002.
