# PH-M00-WO-001 Evidence Bundle

Status: IMPLEMENTED / LOCAL_AND_EXACT_HEAD_CI_PASS / INDEPENDENT_AUDIT_PENDING.

## Base and implementation head

- Repository: `KayzenRoot/poly-hunter`.
- Branch: `feat/ph-m00-governance-harness`.
- PR: [#7](https://github.com/KayzenRoot/poly-hunter/pull/7), draft, base `main`.
- Base SHA: `b0d63d3b889f0a495313414c6e789ccade93251a`.
- Implementation head tested locally and by CI: `320b451d40dfcb2e5e26f0943f500acdfa32fb3f`.
- The implementation commit changes only PH-M00 harness/configuration/tests/documentation; frozen `.engineering` inputs are unchanged.
- The Context Lock was checked before edits: base and target branch matched; 11/11 locked source fingerprints matched; lock SHA-256 `0AD236666231B4DA7D6AC982ABB3EDFE0429A84BFE74DB480B86323E8917E439`; `liveTradingAuthorized=false`.

## Runtime and direct dependencies

- Local runtime: Node.js `v26.4.0`, npm `11.17.0`, Git `2.55.0.windows.3`.
- CI reference: Node.js 24; workflow action pins are `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` and `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020`.
- Exact-pinned external direct dependencies:
  - `@biomejs/biome@2.5.15`
  - `@types/node@24.19.1`
  - `@types/react@19.3.0`
  - `@types/react-dom@19.3.0`
  - `next@16.3.8`
  - `react@19.3.0`
  - `react-dom@19.3.0`
  - `typescript@7.0.2`
  - `vite@6.4.3`
  - `vitest@4.1.11`
- Local workspace packages: `@polyhunter/contracts@0.0.0`, `@polyhunter/domain@0.0.0`, `@polyhunter/testkit@0.0.0`, `@polyhunter/web@0.0.0`, `@polyhunter/worker@0.0.0`. Domain depends only on contracts; contracts and testkit have no runtime package dependency.

## Files created or modified by the implementation commit

32 files: `.gitattributes`, `.env.example`, `.github/workflows/validate.yml`, `.gitignore`, `README.md`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/next-env.d.ts`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/worker/package.json`, `apps/worker/src/index.ts`, `apps/worker/tsconfig.json`, `biome.json`, `package-lock.json`, `package.json`, `packages/contracts/package.json`, `packages/contracts/src/index.ts`, `packages/contracts/tsconfig.json`, `packages/domain/package.json`, `packages/domain/src/index.ts`, `packages/domain/tsconfig.json`, `packages/testkit/package.json`, `packages/testkit/src/fixed-clock.ts`, `packages/testkit/src/index.ts`, `packages/testkit/tsconfig.json`, `tests/environment-example.test.ts`, `tests/fixed-clock.test.ts`, `tests/tsconfig.json`, `tests/workspace-boundaries.test.ts`, `tsconfig.base.json`, and `vitest.config.ts`.

The evidence bundle and proposed checkpoint delta are additional governance records; the canonical checkpoint and Context Lock were not edited.

## Local validation

All listed commands exited 0. Timings are wall-clock measurements on the local Windows environment unless stated otherwise.

| Command | Result | Duration / detail |
| --- | --- | --- |
| `npm ci` | PASS | 74 packages added; 80 packages audited; 0 vulnerabilities; npm summary rounded duration to 1 minute. |
| `npm run lint` | PASS | 1.25 s |
| `npm run format:check` | PASS | 1.21 s |
| `npm run typecheck` | PASS | 4.95 s; all five workspaces and test TypeScript config. |
| `npm test` | PASS | 3.13 s; 3 test files, 6 tests. |
| `npm run build` | PASS | 10.56 s; contracts, domain, testkit, worker and Next web build. |
| `npm run validate` | PASS | 18.74 s on the final implementation tree; lint, format, typecheck, tests, build and audit. |
| `npm audit --audit-level=high` | PASS | 1.80 s; 0 vulnerabilities. |
| `npm run start --workspace @polyhunter/worker` | PASS | Shell started without product behavior. |
| Built `@polyhunter/testkit` package import smoke | PASS | Node resolved the package export to built JavaScript and the fixed-clock assertion passed. |
| `git diff --check` and frozen-source diff | PASS | No whitespace errors; no changes under `.engineering` source inputs. |
| Secret-pattern review | PASS | No secret-like assignments, credential tokens, or private-key patterns in new configuration/example/source files. |

## Exact-head CI receipts

All receipts below are for implementation head `320b451d40dfcb2e5e26f0943f500acdfa32fb3f`:

- GitHub Actions `Node 24 validation`: **SUCCESS**, run [37132649616](https://github.com/KayzenRoot/poly-hunter/actions/runs/37132649616), including clean `npm ci` and `npm run validate`.
- Socket Security `Pull Request Alerts`: **SUCCESS**.
- Socket Security `Project Report`: **SUCCESS**.
- CodeRabbit status: **SUCCESS / review skipped because the PR is draft**; this is not an independent code review.

## Scope and residual risks

- Only the PH-M00 governance/harness foundation was added. No Polymarket/provider, trading, wallet, database, auth, strategy, risk, deployment, or PH-M01 behavior was introduced.
- `npm ci` emitted npm 11's `allow-scripts` advisory that `esbuild@0.25.12`'s postinstall is not approved. Installation, Vitest, and the Next production build all passed without approving that script; retain this advisory for maintainer review.
- Local verification used Node 26.4.0; CI verification used the specified Node 24 reference runtime. Other supported Node majors were not separately executed.
- PR #7 remains draft and unmerged pending independent owner audit. No checkpoint promotion or next-module admission is claimed.

## Proposed checkpoint delta

See `.engineering/checkpoint-deltas/PH-M00-WO-001.md`. It is proposed only and must not be promoted before independent audit and merge.

## STOP

PH-M00 implementation and exact-head CI are complete. Stop here; do not begin PH-M01 or PolyHunter product/trading work.
