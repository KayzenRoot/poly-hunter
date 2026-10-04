# PH-SEC-WO-006 — Codex Execution Brief

Execute only PH-SEC-WO-006 on branch `security/ph-m01-dev-nongo-remediation`.

## Read first
- .engineering/work-orders/PH-SEC-WO-006.md
- .engineering/context-locks/PH-SEC-WO-006.json
- canonical sources referenced by the Context Lock
- PH-SEC-WO-005 Evidence Bundle and exact CR-01 final SARIF

## Preflight
1. Verify branch, parent head and ancestry.
2. Verify PR #15 is open/unmerged.
3. Verify all Context Lock fingerprints.
4. Parse exact locked CR-01 SARIF:
   - 22 unique HIGH/CRITICAL;
   - 20 HIGH;
   - 2 CRITICAL;
   - original 35 Go blockers = 0.
5. Reconcile exact CVE/component set from the Work Order.
6. Query current official Node 24 Docker image manifests/digests and stable npm metadata.
7. Create PH-SEC-WO-006-CANDIDATES.md before edits.
8. Any mismatch => STOP STALE/BLOCKED.

## Candidate order
A. Latest official Node 24 bookworm-slim digest, no extra mutation.
B. Bookworm-slim plus minimal supported Debian security refresh and stable npm update only if they remove known findings.
C. Latest official Node 24 trixie-slim digest.
D. Alpine evidence candidate only; do not adopt without owner decision.

Do not change Node major.

## Candidate rules
- Build each candidate cleanly with pull/no-cache.
- Record immutable base digest, Node/npm/OS/package versions.
- Scan each candidate.
- Compare exact HIGH/CRITICAL tuples against locked baseline.
- Prefer the smallest supported candidate that reaches zero HIGH/CRITICAL.
- Never surgically edit npm's private nested dependency tree.
- Never suppress/ignore findings.

## Final validation
If a supported candidate reaches zero HIGH/CRITICAL:
- implement the minimum Dockerfile/tooling change;
- pin/record immutable base digest;
- npm ci;
- lint;
- format check;
- typecheck;
- tests;
- build;
- npm audit high;
- validate;
- db generate;
- disposable migration;
- integration tests;
- Docker rebuild pull/no-cache;
- Compose config/up/health;
- web HTTP 200;
- Windows host hot reload without manual container touch;
- worker restart;
- final scan;
- verify 22/22 removed;
- verify 35 original Go remain zero;
- verify no new HIGH/CRITICAL.

Keep Docker running on success.

## Result
- zero HIGH/CRITICAL + all gates pass => READY_FOR_INDEPENDENT_AUDIT
- only Alpine or another architecture choice can pass => BLOCKED_OPTION_REQUIRED
- no tested supported candidate passes => BLOCKED_UNRESOLVED

## Git / PR
Commit/push on the same branch.
Open/update nested PR against feat/ph-m01-tenancy-persistence.
Do not merge parent PR #15.
Do not start PH-M01-WO-002.
Final report in Brazilian Portuguese.
