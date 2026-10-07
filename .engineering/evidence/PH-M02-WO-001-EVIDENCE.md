# PH-M02-WO-001 Evidence Bundle

Result: BLOCKED_UNRESOLVED

## Work Order and Git state

- Repository: KayzenRoot/poly-hunter; Issue #42 OPEN; PR #43 OPEN and DRAFT.
- Branch: feat/ph-m02-public-provider-foundation.
- Base and required merge-base: a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c.
- Continuation base for this correction pass: policy-hotfix commit 4956676540ace9be9e7411db65a49a18f7223b49.
- Final correction head SHA is recorded in PR #43 and the exact-head CI run after publication. This bundle does not embed its own commit SHA.
- Context Lock matched the locked canonical/module/work-order/runtime fingerprints at preflight before the authorized package, lockfile, Docker and contract changes. Receipt: preflight.md.
- Canonical checkpoint remains M01_IMPLEMENTATION_COMPLETE / STOP_AFTER_PH_M01_WO_004, completedThroughModule=PH-M01, liveTradingAuthorized=false. No canonical checkpoint was modified.

## Scope delivered

This pass applies CR-01 through CR-06 from independent review 5447028112 and reconciles CR-07 against the final images. Detailed mapping: correction-review-5447028112.md.

- CR-01: Market detail uses Gamma MarketId, validates the returned market ID, and independently validates ConditionId. The deterministic server uses /markets/559001 and rejects condition-id input before making a request.
- CR-02: SDK UserInputError, TransportError, UnexpectedResponseError, RateLimitError and TimeoutError map to the intended provider-neutral error categories, with direct regression tests.
- CR-03: The adapter supports only event families delivered by the standard market subscription; unsupported optional best_bid_ask/market_resolved variants were removed and unknown events remain fail-closed.
- CR-04: Provider-neutral contracts, ports and error types are owned by @polyhunter/contracts; the provider SDK stays in @polyhunter/polymarket.
- CR-05: Root and provider manifests declare Node >=24 <27, aligning the official SDK engine with the repository runtime.
- CR-06: Dockerfile.dev installs the provider package manifest; only worker mounts packages/polymarket. A clean no-cache build and worker import smoke passed; the browser bundle has no provider SDK import.
- CR-07: Final digest scans and PostgreSQL tag refresh are recorded below. Findings remain blocking and no approval/suppression was invented.

The delivered package is public and read-only. No private stream, credentials, signer, authenticated order API, create/cancel order, geoblock/eligibility decision, strategy, risk/execution, trading, PH-M03+, schema, migrations, TenantContext, authentication, or live-trading enablement was added. No merge, checkpoint promotion, or PH-M02-WO-002 was initiated.

## Validation evidence

- npm ci — PASS; 159 packages added, 167 audited, 0 dependency vulnerabilities.
- npm run validate — PASS: lint and format, workspace/root typechecks, 15 test files / 238 tests, all workspace builds and Next.js production build, audit.
- Separate npm audit --audit-level=high — PASS; 0 dependency vulnerabilities.
- Focused provider tests — PASS; 4 files / 35 tests. Raw output: provider-tests-final.txt.
- Docker Compose config — PASS using explicit project polyhunter-local.
- git diff --check — PASS on the completed correction/evidence change set before commit.
- Docker clean build, worker import smoke, web HTTP 200, and service health — PASS; details in docker-smoke.md and docker-runtime-final.txt.
- Exact-head GitHub Actions and CodeRabbit results are recorded after pushing the correction commit in the PR description.

Full check details: validation-summary.md. The host used Node v26.4.0/npm 11.17.0, which satisfies the declared engine range; Docker runtime uses Node v24.21.0.

## Docker runtime

The Compose project polyhunter-local is left running: web healthy at http://localhost:3000 with HTTP 200, worker process running under nodemon, PostgreSQL healthy. PostgreSQL has no published host port. The worker container resolves createPolymarketDiscovery from @polyhunter/polymarket. Compose worker has no healthcheck; process status and command line were verified. No provider credentials or external market requests were used.

## Exact-image security gate

Fresh Docker Scout CLI v1.24.0 scans are retained as raw SARIF and logs. SARIF files have zero per-result suppressions. The terminal notice of four PostgreSQL exceptions is disclosed and does not clear findings.

To keep git diff checks clean, trailing alignment spaces in the Scout recommendation text and the final focused-test transcript were removed; their pre-normalization SHA-256 values are recorded in text-receipt-pre-normalization-sha256.txt. Raw SARIF files and scan logs are unchanged.

- polyhunter-dev:local image ID sha256:1ae037eb5c185605951c688d14d19133f70e2f386fe956b20a4e4460d4338792: 79 total results, 4 CRITICAL, 19 HIGH, 19 MEDIUM, 33 LOW, 4 unspecified. Final H/C: 23, all UNDER_INVESTIGATION because no approval is bound to this exact digest. SARIF SHA-256: 97a0d713e1ba7c46f00066672b350b4d227d5923e762e59c035548bc807bdbfb.
- postgres:17.11-alpine3.24 image ID/digest sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24: 58 total results, 2 CRITICAL, 23 HIGH, 26 MEDIUM, 7 LOW. Exact-digest approvals cover 23 Go stdlib and one libxml2 finding; zlib CVE-2026-85091 remains UNDER_INVESTIGATION. SARIF SHA-256: 307df3f8cab60c17141e51d1f3237cc198f5e376aea2e4ad5581baec322a59c6.
- Current development-image H/C findings overlap zero of the 35 Go stdlib CVEs previously in scope.
- Docker pull confirmed the official PostgreSQL 17.11 Alpine 3.24 tag remains at the same digest. Scout recommendation reports no tag recommendation; the image still contains zlib 1.3.2-r0. Do not transfer VEX across image digests.
- No VEX disposition was self-approved and no generic suppression was added.

Finding-by-finding reconciliation: security-scans.md and security-scans.json. Exact SARIF/log receipts: polyhunter-dev-final.sarif.json, postgres-final.sarif.json, polyhunter-dev-scan.txt and postgres-scan.txt.

## JEV and policy receipt

The user-directed JEV policy hotfix is in commit 4956676540ace9be9e7411db65a49a18f7223b49. It sets instruction-directed blocking to 0.99, treats direct operator input and attachments as TRUSTED_OPERATOR_INPUT, continues below 0.99, routes high-confidence untrusted content to security evaluation, and preserves independent secret/destructive/security blockers. Its 14 regression tests, format check, full validation and PR CI passed. The hotfix receipt is jev-policy-hotfix.md. Final correction review/gate receipt is jev-receipt.md. No credentials, tokens, secrets, or private account data were sent to Jev.

## Final gate and stop

Result: BLOCKED_UNRESOLVED. The exact final development digest has 23 unresolved HIGH/CRITICAL findings and the exact PostgreSQL digest has one unresolved HIGH finding. These are real image-scan blockers under ADR-0007; they are not policy-screen false positives. STOP at this state. The conditional checkpoint proposal remains PROPOSED / NOT_PROMOTED.
