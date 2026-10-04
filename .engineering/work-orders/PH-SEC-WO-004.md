# PH-SEC-WO-004 — Dev-image Go stdlib reachability

Issue: #24
Parent implementation: PH-M01-WO-001 / PR #15
Parent head: 339ef9ae3100b022623dfd0cfaa49b66a56cb7f0
Analysis branch: security/ph-m01-dev-go-vex
Risk: HIGH_ASSURANCE / SECURITY_BLOCKER_RESOLUTION.

## OBJECTIVE
Resolve the largest remaining dev-image vulnerability cluster by determining applicability for every HIGH/CRITICAL Go stdlib finding in the exact PolyHunter development image.

## CONTEXT
The locked dev-image SARIF contains 56 unique HIGH/CRITICAL CVEs: 50 HIGH and 6 CRITICAL.
35 unique CVEs are Go stdlib findings represented by 64 scanner occurrences across three exact binaries:
- /workspace/node_modules/@esbuild-kit/core-utils/node_modules/@esbuild/linux-x64/bin/esbuild
- /workspace/node_modules/@esbuild/linux-x64/bin/esbuild
- /workspace/node_modules/@typescript/typescript-linux-x64/lib/tsc

The scanner reports Go stdlib versions 1.20.7, 1.23.12 and 1.26.4 for this cluster. A unique CVE may appear in more than one binary.

## IN-SCOPE UNIQUE CVES
CVE-2022-30635, CVE-2023-39325, CVE-2023-44487, CVE-2023-45283, CVE-2023-45288,
CVE-2024-24784, CVE-2024-24790, CVE-2024-24791, CVE-2024-34156, CVE-2024-34158,
CVE-2025-22871, CVE-2025-58187, CVE-2025-58188, CVE-2025-61723, CVE-2025-61725,
CVE-2025-61726, CVE-2025-61729, CVE-2025-68121, CVE-2026-25679, CVE-2026-32280,
CVE-2026-32281, CVE-2026-32283, CVE-2026-33811, CVE-2026-33814, CVE-2026-33818,
CVE-2026-39820, CVE-2026-39821, CVE-2026-39822, CVE-2026-39836, CVE-2026-42499,
CVE-2026-42504, CVE-2026-46600, CVE-2026-56853, CVE-2026-56859, CVE-2026-56862.

## OUT OF SCOPE
- Non-Go findings in the dev image.
- PostgreSQL findings already covered by PH-SEC-WO-002/003.
- Dockerfile, Compose, dependency, package-lock, application, schema, migration or TenantContext changes.
- Replacing/upgrading tooling in this Work Order.
- PH-M01-WO-002+.

## FILES / SOURCES TO READ
1. Canonical main:
   - .engineering/proposals/PH-SEC-VEX-POLICY.md
   - .engineering/decisions/ADR-0007-VEX-DISPOSITION-GATE.md
   - .engineering/SECURITY.md
   - .engineering/TEST-BENCHMARK-PLAN.md
   - .engineering/DEFINITION-OF-DONE.md
2. Parent head:
   - .engineering/evidence/PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif
   - Dockerfile.dev
   - package.json
   - package-lock.json
3. Exact binary contents from the locked development image.
4. Official Go vulnerability database/advisories and authoritative package/tool metadata.

## REQUIRED PROOF OBLIGATIONS

### A. SARIF reconciliation
- Parse the locked SARIF deterministically.
- Reconcile exactly 35 unique HIGH/CRITICAL Go stdlib CVEs and 64 scanner occurrences.
- Preserve a matrix CVE × binary × scanner stdlib version.

### B. Exact binary identity
For each of the three affected binary paths:
- hash the exact binary;
- record file metadata;
- record `go version -m` output when supported;
- record the containing npm package/version and lockfile lineage;
- prove whether each scanner-reported Go stdlib version corresponds to the exact binary.

### C. Binary vulnerability evidence
Use official `govulncheck` binary mode where supported.
- preserve raw output and tool/database version;
- distinguish module/package-only matches from symbol-level vulnerable function findings;
- map vulnerable packages/symbols per CVE and per binary;
- supplement with deterministic symbol/build inspection when needed.

### D. Actual execution paths
For each affected binary prove whether and how it is executed in the canonical local Docker workflow:
- esbuild nested under @esbuild-kit/core-utils;
- top-level esbuild;
- native tsc binary.
Record the commands/package scripts/process paths that invoke them, or exact evidence they are never invoked.

Do not classify NOT_AFFECTED solely because a binary is a development tool.

### E. Per-occurrence applicability
For every CVE × affected binary occurrence:
- component/version;
- vulnerable package/function/symbol;
- symbol/code presence;
- actual invocation path;
- attacker-controlled input;
- exploit prerequisites;
- network/privilege/filesystem context;
- KEV/EPSS;
- VEX status and allowed justification;
- evidence refs and expiry.

### F. Unique-CVE aggregation
A unique CVE may be considered proposed NOT_AFFECTED only if every scanner occurrence for that CVE is FIXED or evidence-backed NOT_AFFECTED.
Any AFFECTED/UNDER_INVESTIGATION occurrence keeps the unique CVE blocking.

## ALLOWED VEX OUTCOMES
- FIXED
- NOT_AFFECTED / component_not_present
- NOT_AFFECTED / vulnerable_code_not_present
- NOT_AFFECTED / vulnerable_code_not_in_execute_path
- NOT_AFFECTED / vulnerable_code_cannot_be_controlled_by_adversary
- AFFECTED
- UNDER_INVESTIGATION

Incomplete/contradictory proof => UNDER_INVESTIGATION.
Executor may propose NOT_AFFECTED but may not approve it.

## SAFETY
- No exploit payloads against external systems.
- No unsafe privilege escalation solely for tracing.
- Use local/disposable analysis where needed.
- No generic scanner suppression/ignore.
- No product/runtime mutation.

## ACCEPTANCE CRITERIA
1. 35/35 unique CVEs and 64/64 occurrences reconciled.
2. Exact binary identity and Go build metadata recorded.
3. Every occurrence has an explicit evidence-backed status.
4. Govulncheck/symbol evidence is preserved where supported.
5. Actual tooling execution paths are proven.
6. Unique-CVE aggregation is deterministic.
7. No unsupported NOT_AFFECTED.
8. Result:
   - READY_FOR_INDEPENDENT_AUDIT only if all 35 unique CVEs aggregate to FIXED/proposed NOT_AFFECTED;
   - otherwise BLOCKED_UNRESOLVED.
9. No product/runtime files changed.
10. PR #15 remains unmerged.

## DELIVERABLES
- .engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.json
- .engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.md
- .engineering/evidence/PH-SEC-WO-004-EVIDENCE.md
- raw receipts under .engineering/evidence/PH-SEC-WO-004/
- nested PR against feat/ph-m01-tenancy-persistence.

## REVIEW FORMAT
HIGH_ASSURANCE: APPROVED / CORRECTION REQUIRED / BLOCKED.
Every proposed HIGH/CRITICAL NOT_AFFECTED disposition requires independent audit and explicit owner approval.

## STOP CONDITION
Stop after the full Go stdlib cluster is PR-ready for independent audit, or BLOCKED_UNRESOLVED. Do not analyze non-Go dev-image findings and do not begin PH-M01-WO-002.
