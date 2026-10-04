# PH-SEC-WO-002 — PostgreSQL gosu / Go stdlib reachability

Issue: #20
Parent implementation: PH-M01-WO-001 / PR #15
Blocked parent head: e6a9457e8d8ff60341c6db90346d5916ee13fa61
Analysis branch: security/ph-m01-postgres-gosu-vex
Risk: HIGH_ASSURANCE / SECURITY_BLOCKER_RESOLUTION.

## OBJECTIVE
Determine whether the 23 HIGH/CRITICAL Go stdlib findings attributed to the gosu binary in the exact PostgreSQL 17.11 image are actually affected/reachable in the PolyHunter local-development runtime.

## CONTEXT
PH-SEC-WO-001 reconciled 24 PostgreSQL HIGH/CRITICAL image/CVE pairs. Twenty-three map to Go stdlib embedded in gosu. The remaining libxml2 finding is explicitly out of scope.

Exact image:
`postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`

Canonical policy:
`main@771f75bbd23fd458e67be1d34024e78e39f5b8af`

## IN-SCOPE CVES
- CVE-2025-68121
- CVE-2026-39821
- CVE-2025-58187
- CVE-2025-58188
- CVE-2025-61723
- CVE-2025-61725
- CVE-2025-61726
- CVE-2025-61729
- CVE-2026-25679
- CVE-2026-32280
- CVE-2026-32281
- CVE-2026-32283
- CVE-2026-33811
- CVE-2026-33814
- CVE-2026-33818
- CVE-2026-39820
- CVE-2026-39822
- CVE-2026-39836
- CVE-2026-42499
- CVE-2026-42504
- CVE-2026-56853
- CVE-2026-56859
- CVE-2026-56862

## OUT OF SCOPE
- CVE-2026-86140 / libxml2.
- Any dev-image/Node finding.
- Dockerfile/Compose/dependency/schema/migration/TenantContext/product mutations.
- Suppressions/ignores.
- PH-M01-WO-002+.

## FILES / SOURCES TO READ
1. Canonical:
   - .engineering/proposals/PH-SEC-VEX-POLICY.md
   - .engineering/decisions/ADR-0007-VEX-DISPOSITION-GATE.md
   - .engineering/SECURITY.md
   - .engineering/TEST-BENCHMARK-PLAN.md
   - .engineering/DEFINITION-OF-DONE.md
2. Parent head:
   - .engineering/evidence/PH-SEC-WO-001-VEX.json
   - .engineering/evidence/PH-SEC-WO-001-VEX.md
   - .engineering/evidence/PH-SEC-WO-001-EVIDENCE.md
   - compose.yaml
3. Exact image content and official Go vulnerability/advisory sources.

## REQUIRED PROOF OBLIGATIONS

### A. Artifact identity
- Pull/inspect the exact digest only.
- Record image RepoDigest/ID.
- Locate gosu in the image.
- Record gosu path, SHA-256, file type, size, owner/mode.
- Record `go version -m` build metadata for gosu.
- Record the Go toolchain/module metadata embedded in gosu.

### B. Binary vulnerability evidence
Use official `govulncheck` binary mode against the exact extracted gosu binary when technically supported.
- Record govulncheck version/database timestamp.
- Preserve raw output.
- Map each in-scope CVE to vulnerable package/symbol evidence.
- If govulncheck reports vulnerable symbols absent, record the reproducible proof.
- If binary mode cannot determine a CVE, keep it UNDER_INVESTIGATION and continue with symbol/path analysis.

Supplement where necessary with deterministic binary inspection:
- `go tool nm` when symbols are available;
- `strings`/build metadata;
- official Go advisory package/symbol lists;
- exact source/build metadata for the shipped gosu binary.

### C. Entrypoint execution path
Inspect the exact image's `docker-entrypoint.sh` and runtime behavior.
Prove:
- the exact conditions under which gosu is invoked;
- the arguments/data passed to gosu;
- whether any network/request/user payload is processed by gosu;
- whether gosu execs/replaces itself or remains resident;
- whether any gosu process exists after PostgreSQL reaches healthy steady state.

Preserve:
- entrypoint script hash and relevant lines;
- process tree before/during/after privilege drop where reproducibly observable;
- PID/exe/cmdline evidence;
- open socket evidence for gosu when observable.

### D. Per-CVE exploit prerequisites
For every in-scope CVE:
- identify vulnerable stdlib package/function/symbol from authoritative source;
- identify required attacker input/precondition;
- determine if that package/symbol exists in the exact gosu binary;
- determine if the actual PolyHunter entrypoint invocation can reach it;
- determine if an adversary can control the required input;
- record network/privilege context;
- record VEX status and canonical justification.

## ALLOWED VEX OUTCOMES
- `NOT_AFFECTED / vulnerable_code_not_present` only when exact binary evidence proves the vulnerable code/symbol is absent.
- `NOT_AFFECTED / vulnerable_code_not_in_execute_path` only when the vulnerable code exists but exact entrypoint/runtime evidence proves the PolyHunter invocation cannot reach it.
- `NOT_AFFECTED / vulnerable_code_cannot_be_controlled_by_adversary` only with exact proof that required attacker-controlled input cannot reach the vulnerable operation.
- `AFFECTED` when exploit prerequisites are satisfied.
- `UNDER_INVESTIGATION` whenever proof is incomplete or contradictory.

Executor may PROPOSE NOT_AFFECTED but may not approve it.

## SAFETY CONSTRAINTS
- No exploit payloads against external systems.
- No destructive database operation.
- No product/runtime mutation.
- No global scanner suppression.
- Use disposable containers for instrumentation where practical.
- If a tracing technique requires unsafe privileges/capabilities, do not enable it; use static/runtime alternatives and record the limitation.

## ACCEPTANCE CRITERIA
1. Exact image and gosu binary identity are recorded.
2. 23/23 CVEs have individual evidence rows.
3. Every row references authoritative advisory data and exact local binary/runtime evidence.
4. Govulncheck binary-mode receipt is included when supported.
5. Entrypoint/gosu process-lifecycle proof is reproducible.
6. Counts reconcile to the 23 parent VEX rows.
7. No unsupported NOT_AFFECTED proposal.
8. Result is:
   - `READY_FOR_INDEPENDENT_AUDIT` only if all 23 are FIXED or proposed NOT_AFFECTED with complete proof; otherwise
   - `BLOCKED_UNRESOLVED`.
9. No product/runtime file changed.
10. Parent PR #15 remains unmerged.

## DELIVERABLES
- .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json
- .engineering/evidence/PH-SEC-WO-002-GOSU-VEX.md
- .engineering/evidence/PH-SEC-WO-002-EVIDENCE.md
- raw receipts under .engineering/evidence/PH-SEC-WO-002/
- commit/push and nested PR against feat/ph-m01-tenancy-persistence.

## REVIEW FORMAT
HIGH_ASSURANCE: APPROVED / CORRECTION REQUIRED / BLOCKED.
Every proposed HIGH/CRITICAL NOT_AFFECTED disposition requires independent-from-executor audit and explicit owner approval before changing the parent gate.

## STOP CONDITION
Stop when the 23-CVE gosu cluster is fully evidenced and PR-ready for independent audit, or when unresolved evidence forces BLOCKED_UNRESOLVED. Do not analyze libxml2 or dev-image findings and do not start PH-M01-WO-002.
