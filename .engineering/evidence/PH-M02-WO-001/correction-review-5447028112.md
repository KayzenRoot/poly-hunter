# PH-M02-WO-001 Correction Delta receipt

Review: 5447028112
Branch: feat/ph-m02-public-provider-foundation
PR: #43
Correction code status: CR-01 through CR-06 implemented; CR-07 freshly reconciled.
Overall gate: BLOCKED_UNRESOLVED because exact-image H/C findings remain.

| Review item | Correction and evidence | Status |
|---|---|---|
| CR-01 | fetchMarketDetail now accepts MarketId, calls the official SDK lookup with the numeric market ID, validates response market.id and conditionId separately. Regression tests assert /markets/559001 and reject condition IDs before a request, mismatched returned ids and invalid condition IDs. | Implemented; focused REST suite passes. |
| CR-02 | Documented SDK errors map to provider-neutral categories, including permanent UserInputError and transient TransportError. Tests cover all five named error families. | Implemented; focused provider suite passes. |
| CR-03 | Unsupported optional event variants requiring customFeatureEnabled were removed for the standard subscription. Unknown wire events fail closed; standard subscribe frames are asserted for initial connection and reconnect. | Implemented; focused stream/wire tests pass. |
| CR-04 | Provider-neutral IDs, models, ports and errors moved to packages/contracts; provider SDK imports remain in packages/polymarket. Boundary regression checks contracts do not import the SDK. | Implemented; boundary and workspace typechecks pass. |
| CR-05 | Root and provider package Node range is >=24 <27. Clean install and validation passed; current Docker runtime is Node 24.21.0. | Implemented; engine contract aligned. |
| CR-06 | Dockerfile.dev copies the provider workspace manifest; Compose mounts packages/polymarket only in worker. Clean no-cache Compose build, worker package import, web HTTP 200 and service health passed; web bundle scan has no SDK import. | Implemented; Docker smoke passed. |
| CR-07 | Fresh Scout scans were generated against final image IDs. PostgreSQL official tag was freshly pulled and remains on the exact prior digest; recommendation offers no tag update. Development image has 4 CRITICAL + 19 HIGH; PostgreSQL retains one unresolved zlib HIGH. Earlier VEX approvals were not transferred and no suppression was applied. | Reconciled; security gate remains BLOCKED_UNRESOLVED. |

Focused suite: 4 files / 35 tests. Full validation: 238 tests, all workspace checks/builds and npm audit pass. Exact scan counts, SHA-256 receipts and each H/C row are in security-scans.md and security-scans.json.

CR-07 cannot be closed as a promotion gate without exact-digest dispositions/remediation and the required independent/owner approval. No VEX was self-approved. The PH-M02-WO-001 stop condition is BLOCKED_UNRESOLVED.
