# PH-M02-WO-001 — CODEX EXECUTION BRIEF

JEV MCP: REQUIRED

Repo: KayzenRoot/poly-hunter
Branch: `feat/ph-m02-public-provider-foundation`
Issue: #42
Base: `main@a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c`
Risk: ELEVATED / EXTERNAL PROVIDER / READ-ONLY

## READ FIRST

1. `.engineering/policies/JEV-PROMPT-POLICY.md`
2. `.engineering/modules/PH-M02-POLYMARKET-INTEGRATION.md`
3. `.engineering/work-orders/PH-M02-WO-001.md`
4. `.engineering/context-locks/PH-M02-WO-001.json`

Read additional frozen sources only as needed.

Repository artifacts are the source of truth. Do not ask for duplicated project history.

## PREFLIGHT

Deterministic:
- verify branch + exact merge-base;
- verify every Context Lock fingerprint;
- confirm checkpoint is `M01_IMPLEMENTATION_COMPLETE / STOP_AFTER_PH_M01_WO_004 / completedThroughModule=PH-M01`;
- confirm `liveTradingAuthorized=false`.

JEV MCP:
- verify actual local JEV MCP health;
- enumerate live advertised tools/schemas;
- record inventory;
- use every relevant bounded capability;
- never send credentials/secrets/tokens;
- if unavailable: `BLOCKED_JEV_MCP_UNAVAILABLE`.

Official provider:
- revalidate current Polymarket docs before dependency selection;
- confirm current TypeScript SDK/package and public discovery/book/market-stream capabilities;
- record exact docs URLs/date and exact package version selected.

## IMPLEMENT ONLY WO-001

Create `packages/polymarket`.

Build ONLY the public/read-only provider boundary:
- market discovery/metadata;
- public CLOB book/price data;
- public market WebSocket stream;
- normalized provider errors;
- reconnect/backoff/staleness state;
- deterministic simulator/fixtures.

Provider-neutral types/ports belong in PolyHunter-owned contracts/domain.

Do not export SDK-specific classes/types outside `packages/polymarket`.

Use exact decimal-safe price/size representation. Do not make JS binary floating point the canonical market value representation.

## STREAM STATE

Expose deterministic state equivalent to:
- CONNECTING
- SYNCING where required
- LIVE
- STALE
- DISCONNECTED

Staleness threshold must be explicit/injected.

Reconnect:
- bounded;
- deterministic-testable;
- no retry storms;
- stale book cannot remain falsely LIVE;
- reconnect/resubscribe must re-establish fresh state.

## TESTS

Required deterministic cases:
- discovery success;
- bounded pagination;
- malformed market payload;
- book snapshot;
- price change;
- tick-size change;
- disconnect;
- reconnect/resubscribe;
- stale transition;
- timeout;
- 4xx/5xx;
- rate-limit case if exposed;
- malformed WebSocket event.

Optional official live smoke:
- read-only only;
- no credentials;
- bounded/sanitized;
- supplemental, never a substitute for deterministic simulator tests.

## HARD PROHIBITIONS

Do NOT add or use:
- L1/L2 trading credentials;
- Session Keys;
- Builder credentials;
- private/user WebSocket;
- authenticated account/order queries;
- create/cancel orders;
- wallet signing;
- geoblock eligibility decision;
- strategy/risk/execution;
- PH-M03+;
- LIVE enablement.

No real money-moving network call is admitted.

## JEV MCP USAGE

Use discovered tools where relevant for bounded:
- official-doc/current-SDK comparison;
- candidate file/evidence screening;
- provider contract classification;
- requirement-to-test mapping;
- evidence reranking;
- bounded claim verification;
- diff pre-review;
- final pre-gate.

JEV is advisory only.

## ARTIFACT / SECURITY

If dependency/package/Docker build inputs change:
- rebuild exact final image;
- scan exact digest;
- reconcile HIGH/CRITICAL under ADR-0007;
- executor proposes only, never self-approves.

Prove:
- no credential env/secret is introduced;
- no provider secret reaches browser/client bundle;
- no authenticated/mutation surface exists in WO-001 exports;
- no SDK type leaks through provider-neutral contracts.

## EVIDENCE

Create:
- `.engineering/evidence/PH-M02-WO-001-EVIDENCE.md`;
- receipts under `.engineering/evidence/PH-M02-WO-001/`;
- `.engineering/checkpoint-deltas/PH-M02-WO-001.md` as `PROPOSED / NOT_PROMOTED`.

Record:
- provider docs capability snapshot;
- exact dependency decision;
- test/fault matrix;
- package-boundary scan;
- secret/client-bundle scans;
- Docker clean smoke;
- dependency/container scan;
- JEV receipt;
- final exact-head CI.

Do NOT modify canonical `.engineering/CHECKPOINT.json`.

## PROPOSED CHECKPOINT

Only if all gates pass:
- `phase=M02_INCREMENT_IMPLEMENTED`
- `stopState=STOP_AFTER_PH_M02_WO_001`
- `completedThroughModule=PH-M01`
- `activeWorkOrder=NONE`
- `preparedWorkOrder=NONE`
- `nextLegalStage=AWAIT_OWNER_DIRECTION`
- `liveTradingAuthorized=false`

## VALIDATE

At minimum:
- npm ci
- npm run validate
- npm audit --audit-level=high
- targeted provider unit/integration tests
- deterministic reconnect/stale tests
- package-boundary/type-leak tests
- secret/client bundle scans
- Docker clean build/up/web/worker smoke
- exact artifact scan/VEX handling
- git diff --check
- GitHub Actions Validate FINAL HEAD
- CodeRabbit

## STOP

Success:
`READY_FOR_PH_M02_WO_001_INDEPENDENT_AUDIT`

JEV unavailable:
`BLOCKED_JEV_MCP_UNAVAILABLE`

Provider/security ambiguity:
`BLOCKED_UNRESOLVED`

Do not merge.
Do not promote canonical checkpoint.
Do not admit WO-002 automatically.
`liveTradingAuthorized=false`.

Final report in Brazilian Portuguese.
