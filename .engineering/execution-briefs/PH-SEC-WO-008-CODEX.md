# PH-SEC-WO-008 — Codex Execution Brief

Execute only `PH-SEC-WO-008` on branch `security/ph-m01-libstdcpp-final-two`.

## Read first
- `.engineering/work-orders/PH-SEC-WO-008.md`
- `.engineering/context-locks/PH-SEC-WO-008.json`
- canonical security/VEX policy and ADR-0007 referenced by the lock
- PH-SEC-WO-007 VEX, Evidence Bundle and Owner Approval receipt
- locked Docker Scout SARIF

## Mission
Resolve only:
- CVE-2026-102010
- CVE-2026-95619

Use exact upstream GCC fix commits and exact shipped Node/V8/libstdc++ evidence. Treat header-only/inlined code and compiled C++ consumers correctly. Do not infer safety from TypeScript/JavaScript surface code.

## Hard boundaries
- Evidence only.
- No Dockerfile, Compose, dependency, base-image, product, schema, migration, auth, secret, TenantContext or trading mutation.
- No suppression/ignore/waiver.
- No malicious external exploit.
- No PH-M01-WO-002.
- Fail closed on incomplete evidence.

## Required output
Produce the complete PH-SEC-WO-008 Evidence Bundle, VEX JSON/Markdown, immutable receipts and SHA256SUMS. Update the same PR. Leave Docker local running/healthy when applicable.

Result:
- both rows policy-complete FIXED/proposed NOT_AFFECTED => `READY_FOR_INDEPENDENT_AUDIT`
- any unresolved/affected row => `BLOCKED_UNRESOLVED` + exact remediation delta
- drift => `BLOCKED_STALE_CONTEXT`

Commit and push to the same branch. Final report in Brazilian Portuguese.
