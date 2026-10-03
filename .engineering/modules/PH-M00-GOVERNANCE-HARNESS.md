# PH-M00 — Governance & Harness Foundation

Status: PLANNING_CANDIDATE in PH-M00-PLAN-001.

## Purpose
Create the smallest professional engineering foundation that lets later PolyHunter modules ship quickly without rediscovering repository layout, test commands, type boundaries, evidence format or CI expectations.

## Frozen stack for M00 implementation
- Language: TypeScript, strict mode.
- Runtime support: Node.js >=22 and <27; CI reference runtime Node.js 24 LTS.
- Package manager: npm with workspaces and committed package-lock.json.
- Monorepo orchestration: native npm workspaces; no Turborepo/Nx in M00.
- Lint/format: Biome.
- Unit/integration test runner: Vitest.
- Web shell: Next.js App Router, minimal non-product shell only.
- Worker shell: plain Node.js TypeScript process with no provider/trading logic.
- Contracts: runtime schemas + TypeScript types owned by packages/contracts. Exact schema library selection is allowed in M00 implementation only if justified by the Work Order and kept minimal.
- CI: GitHub Actions single primary validation workflow.
- Containers: deferred to PH-M11; M00 must keep apps containerizable but does not add production container orchestration.

## Repository layout target
- apps/web
- apps/worker
- packages/contracts
- packages/domain
- packages/testkit
- .github/workflows
- .engineering remains canonical governance

No Polymarket adapter, database implementation, auth implementation, strategy logic, live execution or tenant business behavior belongs to M00.

## Root command contract
The implementation must expose deterministic root commands:
- npm run lint
- npm run format:check
- npm run typecheck
- npm test
- npm run build
- npm run validate

npm run validate is the canonical local pre-PR aggregate and must fail if any required check fails.

## Harness rules
1. TypeScript strictness is shared from one base config.
2. Workspace package boundaries are explicit; no deep relative imports across workspaces.
3. Domain package imports no web/worker/provider implementation.
4. Tests use deterministic clocks/randomness where behavior depends on time/randomness.
5. No network call is required by the unit test suite.
6. No real secret is required by build/test.
7. .env.example contains names/documentation only.
8. CI runs from a clean checkout with npm ci.
9. Dependency audit at HIGH severity is part of validation evidence.
10. Build/test output must be compact enough for executor review.

## CI contract
Reference CI steps:
checkout -> setup Node 24 -> npm ci -> lint -> format check -> typecheck -> test -> build -> npm audit --audit-level=high.

M00 may split jobs only if that materially improves feedback time without duplicating expensive work.

## Performance / token-efficiency baseline
M00 records the first local validation timing baseline and file/test counts. No optimization claim is accepted without measured before/after evidence. Native npm workspaces are preferred initially because additional orchestration complexity has not yet earned its maintenance cost.

## Acceptance for PH-M00-WO-001
- workspace installs from clean checkout;
- every canonical root command exists and passes;
- minimal web and worker shells build/start without product logic;
- workspace boundary smoke tests pass;
- no secrets or provider credentials;
- no Polymarket/network/database/auth/trading implementation;
- CI workflow syntax is valid and all hosted checks pass on exact PR head;
- Evidence Bundle records versions, commands, durations, files and risks.

## STOP
M00 foundation does not authorize PH-M01+ behavior.
