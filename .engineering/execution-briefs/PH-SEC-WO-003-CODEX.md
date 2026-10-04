# PH-SEC-WO-003 — Codex Execution Brief

Execute only PH-SEC-WO-003 on branch `security/ph-m01-postgres-libxml2-vex`.

Read first:
- `.engineering/work-orders/PH-SEC-WO-003.md`
- `.engineering/context-locks/PH-SEC-WO-003.json`
- canonical VEX/security sources referenced by the Context Lock.

Before any analysis, verify:
- parent head `c04af277990272310ed86eeb9dce02e74e4df523`;
- canonical policy main `771f75bbd23fd458e67be1d34024e78e39f5b8af`;
- locked source fingerprints;
- exact PostgreSQL image digest;
- the single locked libxml2 finding.

Perform evidence-only applicability analysis for the exact image:
- record package/library identity and hashes;
- collect authoritative upstream/package references with timestamps;
- determine whether the affected library code is present;
- determine PostgreSQL compile/link/load relationship to libxml2;
- determine whether the relevant XML feature path is enabled in the local runtime;
- use safe static inspection and benign disposable-database checks only;
- capture KEV/EPSS context;
- produce exactly one VEX record;
- use UNDER_INVESTIGATION when evidence is incomplete;
- never self-approve NOT_AFFECTED.

Do not modify product/runtime files, Dockerfile, Compose, dependencies, schema or migrations.

Create:
- `.engineering/evidence/PH-SEC-WO-003-LIBXML2-VEX.json`
- `.engineering/evidence/PH-SEC-WO-003-LIBXML2-VEX.md`
- `.engineering/evidence/PH-SEC-WO-003-EVIDENCE.md`
- supporting receipts under `.engineering/evidence/PH-SEC-WO-003/`

Commit/push on the same branch and update the nested PR. Final report in Brazilian Portuguese.

STOP: evidence ready for independent review or BLOCKED_UNRESOLVED. Do not merge PR #15 or begin PH-M01-WO-002.
