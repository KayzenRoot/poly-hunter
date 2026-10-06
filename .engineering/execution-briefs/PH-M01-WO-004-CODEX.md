# PH-M01-WO-004 — CODEX EXECUTION BRIEF

JEV MCP: REQUIRED

Repo: KayzenRoot/poly-hunter
Branch: `feat/ph-m01-security-acceptance`
Issue: #40
Base: `main@895e4bf2221b9fd7e335f0dd348be05f851fccde`
Risk: HIGH_ASSURANCE

## READ FIRST

1. `.engineering/policies/JEV-PROMPT-POLICY.md`
2. `.engineering/work-orders/PH-M01-WO-004.md`
3. `.engineering/context-locks/PH-M01-WO-004.json`

Then read only the frozen sources referenced by the Context Lock as needed.

Do not ask for project history already present in the repository.

## PREFLIGHT

Deterministic first:
- verify branch and exact merge-base;
- verify every Context Lock fingerprint;
- confirm checkpoint is `STOP_AFTER_PH_M01_WO_003 / AWAIT_OWNER_DIRECTION`;
- confirm PR #39 is merged at `895e4bf2221b9fd7e335f0dd348be05f851fccde`;
- confirm main Validate #88 is green.

JEV MCP:
- verify actual local JEV MCP health;
- enumerate live advertised tools/capabilities;
- record inventory;
- use every relevant capability according to the live schemas;
- batch bounded judgments;
- never send secrets/keys/tokens/provider credentials;
- if unavailable: `BLOCKED_JEV_MCP_UNAVAILABLE`.

## EXECUTE

Perform the complete acceptance plan in the Work Order.

This is acceptance/hardening, NOT a feature increment.

Primary obligations:
1. cross-tenant adversarial matrix;
2. privilege escalation matrix;
3. session/tenant-selection confusion attacks;
4. authorization-concurrency proof;
5. Vault tamper/AAD/nonce/public-boundary/no-store acceptance;
6. plaintext/credential canary containment;
7. empty migration + repeat migration;
8. disposable backup/destroy/restore drill;
9. v1 -> v2 key rotation/recovery drill;
10. clean Docker acceptance;
11. exact-head unit/integration/CI/scans;
12. exact artifact/VEX reconciliation;
13. machine-readable acceptance matrix.

Use minimal corrective code only if a named acceptance obligation exposes a real defect. Every fix requires a regression test.

## JEV MCP

Use the discovered JEV MCP where relevant for bounded:
- obligation -> evidence mapping;
- gap classification;
- candidate file/evidence screening;
- evidence reranking;
- current-vs-frozen invariant comparison;
- bounded claim verification;
- diff pre-review;
- final acceptance pre-gate.

Do NOT let JEV:
- see secret canaries/keyring/token values;
- approve CVEs;
- replace PostgreSQL concurrency tests;
- replace deterministic scan/CI evidence;
- approve merge/checkpoint/module completion.

Create a JEV execution receipt with inventory, actual tools used, purposes, escalations and no-secrets assertion.

## RECOVERY DRILL

Use disposable PostgreSQL only.

Required:
- migrate empty DB;
- seed representative PH-M01 state via admitted application/repository paths;
- store a TEST-ONLY encrypted secret under key v1;
- logical backup;
- destroy DB;
- restore into fresh DB;
- verify schema + tenant isolation;
- decrypt only through authorized Vault callback with correct ephemeral keyring;
- prove missing v1 fails closed;
- restore v1, set active v2, rotate safely;
- prove envelope changes and identity metadata remains stable;
- verify after restore/rotation;
- discard all test-only key material.

Prefer pg_dump/pg_restore if available.

## ACCEPTANCE MATRIX

Create:
`.engineering/evidence/PH-M01-WO-004/acceptance-matrix.json`

Every obligation row needs:
- id;
- invariant/requirement;
- exact evidence/test/receipt;
- result;
- exact head/artifact;
- residual gap;
- reviewer state.

No PASS without evidence.

## SECURITY / VEX

Entering artifact:
`polyhunter-dev:local@sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2`

Entering approved state:
25 NOT_AFFECTED / 0 UNDER_INVESTIGATION / 0 AFFECTED.

If artifact-bound build input changes:
- rebuild;
- new digest;
- fresh scan;
- reset H/C to UNDER_INVESTIGATION;
- revalidate all;
- executor proposes only.

If digest remains identical:
- revalidate affected reachability/runtime premises against WO-004 source changes.

No suppressions/waivers/downgrades.

## VALIDATE

At minimum:
- npm ci
- npm run validate
- npm audit --audit-level=high
- full PostgreSQL integration
- new acceptance suite
- cross-tenant matrix
- auth/session confusion suite
- concurrency suite
- migration empty/repeat
- backup/destroy/restore
- key rotation/recovery
- secret canary containment
- client-bundle scan
- git diff --check
- Docker clean build/up/health
- exact image/dependency scan/VEX
- GitHub Actions Validate on FINAL HEAD
- CodeRabbit

## EVIDENCE

Create:
- `.engineering/evidence/PH-M01-WO-004-EVIDENCE.md`
- receipts under `.engineering/evidence/PH-M01-WO-004/`
- `.engineering/checkpoint-deltas/PH-M01-WO-004.md` as `PROPOSED / NOT_PROMOTED`

Do NOT modify canonical `.engineering/CHECKPOINT.json`.

If all obligations pass, checkpoint delta may propose:
- `phase=M01_IMPLEMENTATION_COMPLETE`
- `stopState=STOP_AFTER_PH_M01_WO_004`
- `completedThroughModule=PH-M01`
- `nextLegalStage=AWAIT_OWNER_DIRECTION`
- `activeWorkOrder=NONE`
- `preparedWorkOrder=NONE`
- `liveTradingAuthorized=false`

## PROHIBITED

No:
- Polymarket credential integration;
- signing;
- market data;
- strategy;
- risk;
- execution;
- trading;
- PH-M02+ implementation;
- merge;
- checkpoint promotion.

## STOP

Success:
`READY_FOR_FINAL_M01_INDEPENDENT_AUDIT`

JEV unavailable:
`BLOCKED_JEV_MCP_UNAVAILABLE`

Any unresolved security/recovery/VEX uncertainty:
`BLOCKED_UNRESOLVED`

Final report in Brazilian Portuguese.
