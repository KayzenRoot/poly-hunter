# PH-M02-WO-001 Evidence Bundle

**Result: `BLOCKED_UNRESOLVED`**

## Work Order and Git state

- Repository: `KayzenRoot/poly-hunter`; Issue #42 OPEN; PR #43 OPEN and DRAFT.
- Branch: `feat/ph-m02-public-provider-foundation`.
- Starting branch head before this execution: `1e5997c9282925a9e7197e3ab5d615c8962e370d`.
- Required base / merge-base: `a02a8f97ad0a2fe0847aecf24d302fb2c04e3a9c` (observed exact match).
- Final implementation/evidence commit and pushed PR head are recorded in the PR #43 description after publication; this file does not embed a self-referential commit SHA.
- Context Lock fingerprints: all frozen/module/work-order fingerprints matched; all runtime fingerprints matched at initial head before the permitted manifest/lock edits. See `PH-M02-WO-001/preflight.md`.
- Canonical checkpoint remains unchanged: `M01_IMPLEMENTATION_COMPLETE / STOP_AFTER_PH_M01_WO_004 / PH-M01`; `liveTradingAuthorized=false`.

## Scope delivered

Introduced the provider-neutral public market-data contracts and the `packages/polymarket` adapter: bounded market discovery/details, outcome/asset mapping, exact decimal value handling, order-book and price metadata, normalized provider errors, market WebSocket events, heartbeat, deterministic connection health/staleness, bounded reconnect/backoff, and snapshot resynchronization. Added deterministic fixtures and tests for the boundary, REST failure modes, decimals, malformed data, stream lifecycle, timeout, disconnect/reconnect, stale state, resubscribe, and provider faults.

No authenticated/private stream, credentials, signer, order creation/cancellation, geoblock decision, strategy, risk/execution, trading, PH-M03+, schema, migrations, TenantContext, auth, Dockerfile.dev, compose.yaml, or canonical checkpoint changes were made. The provider is read-only. No live network smoke was used as deterministic truth.

## Files

- `package.json`, `package-lock.json`
- `packages/polymarket/package.json`, `packages/polymarket/tsconfig.json`
- `packages/polymarket/src/contracts.ts`, `decimal.ts`, `errors.ts`, `fixtures.ts`, `fixtures/gamma-keyset.ts`, `index.ts`, `rest.ts`, `stream.ts`, `wire.ts`
- `tests/polymarket-boundary.test.ts`, `polymarket-decimal.test.ts`, `polymarket-rest.test.ts`, `polymarket-stream.test.ts`
- Required Evidence Bundle, receipts under `.engineering/evidence/PH-M02-WO-001/`, and conditional checkpoint proposal `.engineering/checkpoint-deltas/PH-M02-WO-001.md`.

## Provider/dependency decision

Official documentation on 2026-10-07 identifies `@polymarket/client` as the unified TypeScript SDK and documents a `PublicClient`, paginated market discovery, public order-book data, and market stream events. The exact pinned SDK is `@polymarket/client@0.12.0`; current registry metadata says Node `>=24`. This repository declares `>=22 <27`, so Node 22/23 compatibility is not claimed. The current CI/Docker runtime is Node 24. Direct `ws@8.22.0` is confined to this adapter because the selected SDK surface does not expose injected socket/clock/heartbeat/reconnect controls needed for deterministic staleness and resynchronization proof. `zod@4.6.5` provides strict payload validation. Exact versions are locked.

Source snapshot and URLs: `PH-M02-WO-001/provider-docs.md`.

## Validation evidence

- `npm ci` — PASS; 159 packages added, 167 audited, zero dependency vulnerabilities. npm emitted deprecation notices for legacy `@esbuild-kit/*` packages and an allow-scripts notice for esbuild.
- `npm run validate` — PASS (exit 0): lint (93 files; one pre-existing informational hint outside this WO), format check, workspace/root typecheck, 14 test files / 223 tests, workspace and Next.js production builds, npm audit.
- Separate `npm audit --audit-level=high` — PASS, zero vulnerabilities.
- Targeted provider tests — PASS, 4 files / 34 tests; raw output `PH-M02-WO-001/provider-tests.txt`.
- `git diff --cached --check` — PASS on the exact staged diff immediately before commit.
- Boundary scans — no provider SDK import outside `packages/polymarket`; no credential environment/API/signing/order-mutation identifiers in provider implementation; no provider package/endpoints in `apps/web/.next/static`. Output: `PH-M02-WO-001/security-boundary.txt`. Runtime unit tests additionally assert the public export boundary.

Full result summary: `PH-M02-WO-001/validation-summary.md`.

## Docker smoke

The no-cache Docker clean build and Compose startup completed successfully. Rechecked services: web healthy and HTTP 200 at `http://localhost:3000`, PostgreSQL healthy, worker running (no healthcheck configured). Containers are left running. Exact images and the limitation that Dockerfile.dev/compose do not yet install/mount the new package are documented in `PH-M02-WO-001/docker-smoke.md`.

## Exact-image scans and security gate

Docker Scout CLI v1.24.0 scanned the exact current images. Raw outputs:
- `polyhunter-dev:local@sha256:d38a0a1222ef551cf5926496ffdc8c0fd06d8950e2d0a1b6d0c2f5c8d1a54b62` — 81 unique results: 4 CRITICAL, 20 HIGH, 19 MEDIUM, 34 LOW, 4 UNKNOWN; SARIF SHA-256 `449aa68a6896bb6b12a954aa92fb1a54b49cdd47ee1d2a3a24fcfd6b098b937c`.
- `postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` — 58 unique results: 2 CRITICAL, 23 HIGH, 26 MEDIUM, 7 LOW; SARIF SHA-256 `307df3f8cab60c17141e51d1f3237cc198f5e376aea2e4ad5581baec322a59c6`.

All HIGH/CRITICAL findings default to blocking `UNDER_INVESTIGATION` unless current exact-digest approval exists. The current development-image digest is new: prior PH-SEC-WO-007 approval is bound to `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`, so its 20 NOT_AFFECTED approvals cannot be reused. All 24 current dev H/C findings remain unresolved. PostgreSQL's exact-image approved VEX evidence clears 23 Go stdlib findings and one libxml2 finding; zlib `CVE-2026-85091` remains unresolved. The total unresolved exact-image gate is therefore 25 H/C findings. No executor self-approval or generic suppression was applied.

The Scout terminal summary reported “4 exceptions obtained”; preserved SARIF has zero per-result suppression entries. This exception notice is disclosed and was not treated as clearing a finding. Full finding-by-finding digest reconciliation: `PH-M02-WO-001/security-scans.md` and `.json`.

Under ADR-0007, unresolved HIGH/CRITICAL prevents progression. STOP CONDITION is **`BLOCKED_UNRESOLVED`**, not READY_FOR_INDEPENDENT_AUDIT. No VEX disposition is proposed by this executor.

## JEV MCP receipt

Actual local Jev MCP calls succeeded with `jev-1.13.0` / TypeSafe; advertised tool inventory was enumerated. Current source-screen result: `pass` (injection 0.02, substance 0.97, relevance 0.95). Current bounded claim verification: 4 verified, 0 contradicted, 1 unsupported/review due to an underspecified evidence excerpt; the direct official SDK page itself shows event names at lines 393-443, and this JEV output is advisory only. The final staged diff/gate result is in `PH-M02-WO-001/jev-receipt.md`. Git, tests, primary documentation, and ADR-0007 remain authoritative.

## Remaining risks and limitations

- The exact dev image has 24 H/C findings without current-digest VEX approval; PostgreSQL has one unresolved HIGH. These block independent readiness.
- Provider SDK engine requires Node >=24; Node 22/23 is not validated.
- Docker runtime does not yet mount/install the provider package; no consumer integration was admitted in this WO.
- No live public provider smoke was performed; deterministic tests are authoritative and the Work Order made live smoke optional.
- GitHub Actions Validate and CodeRabbit for the final pushed head are checked after push and reported in the PR #43 description; they are not inferred from local results.
- No merge, checkpoint promotion, or PH-M02-WO-002 admission.
