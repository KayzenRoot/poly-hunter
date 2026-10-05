# PH-SEC-WO-007 — Codex Execution Brief

Execute only PH-SEC-WO-007 on branch `security/ph-m01-dev-nongo-vex`.

## Read first
- .engineering/work-orders/PH-SEC-WO-007.md
- .engineering/context-locks/PH-SEC-WO-007.json
- all canonical sources referenced by the Context Lock
- PH-SEC-WO-005 and PH-SEC-WO-006 Evidence Bundles
- exact locked CR-01 SARIF

## Preflight
1. Verify branch, parent head/ancestry and PR #15 open/unmerged.
2. Verify every Context Lock fingerprint.
3. Verify exact target image digest `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`.
4. Parse the exact locked scan to exactly 22 unique HIGH/CRITICAL: 20 HIGH + 2 CRITICAL.
5. Verify the original 35 Go HIGH/CRITICAL findings remain zero.
6. Reconcile the exact 22 CVEs from the Work Order.
7. Capture current KEV/EPSS/source timestamps.
8. Any mismatch => STOP BLOCKED_STALE_CONTEXT.

## Analysis
For every CVE, produce an individual machine-readable and human-readable row with:
- component/version/path;
- affected condition from authoritative advisory;
- vulnerable code presence;
- exact execution/reachability;
- attacker-controlled input prerequisite;
- privilege/network/filesystem prerequisites;
- runtime/dev/build/install phase applicability;
- safe static/trace/benign disposable-container evidence;
- KEV/EPSS;
- FIXED / proposed NOT_AFFECTED / AFFECTED / UNDER_INVESTIGATION;
- ADR-0007 justification and expiry/revalidation trigger.

Treat npm-bundled findings separately from application dependencies. Prove whether the vulnerable path is reachable through the npm CLI/dev workflow; do not infer safety merely because the app does not import the package.

## Hard rules
- Evidence only. Do not edit Dockerfile, Compose, package manifests/lockfile, application, schema, migration, TenantContext or product behavior.
- No scanner ignores/suppression.
- No self-approval of NOT_AFFECTED.
- No exploit payloads against external systems.
- Use only safe static inspection, local disposable-container tracing and benign probes.
- Do not start PH-M01-WO-002.

## Deliverables
- PH-SEC-WO-007-EVIDENCE.md
- PH-SEC-WO-007-VEX.md
- PH-SEC-WO-007-VEX.json
- evidence receipts + SHA256SUMS.txt
- PR body with exact result

## Result
- 22/22 = FIXED or policy-complete proposed NOT_AFFECTED; 0 AFFECTED/UNDER_INVESTIGATION => READY_FOR_INDEPENDENT_AUDIT
- any AFFECTED/UNDER_INVESTIGATION => BLOCKED_UNRESOLVED + exact minimal remediation delta
- any fingerprint/artifact drift => BLOCKED_STALE_CONTEXT

Commit and push to the same branch. Open/update a draft nested PR against `feat/ph-m01-tenancy-persistence`.
Final report in Brazilian Portuguese.
