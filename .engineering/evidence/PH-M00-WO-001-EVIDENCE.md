# PH-M00-WO-001 Evidence Bundle

Status: CORRECTION_DELTA_APPLIED / LOCAL_VALIDATION_PASS / FINAL_HEAD_CI_RECEIPT_EXTERNAL_TO_BUNDLE.

## Base and implementation head

- Repository: `KayzenRoot/poly-hunter`.
- Branch: `feat/ph-m00-governance-harness`.
- PR: [#7](https://github.com/KayzenRoot/poly-hunter/pull/7), draft, base `main`.
- Base SHA: `b0d63d3b889f0a495313414c6e789ccade93251a`.
- Implementation source commit tested locally: `320b451d40dfcb2e5e26f0943f500acdfa32fb3f`.
- Earlier evidence/governance commit: `847f9bc62f4b869918f0ea1813747c68c95bb7c2`.
- Correction review input: PR head `847f9bc62f4b869918f0ea1813747c68c95bb7c2`, validated by run `37132940369` before the current correction delta.
- This bundle does not embed the SHA of its own containing commit. After the correction push, the final PR head and its exact CI receipt will be recorded in the PR description and final report.
- The implementation commit changes only PH-M00 harness/configuration/tests/documentation; frozen `.engineering` inputs are unchanged.
- The Context Lock was checked before edits: base and target branch matched; 11/11 locked source fingerprints matched; lock SHA-256 `0AD236666231B4DA7D6AC982ABB3EDFE0429A84BFE74DB480B86323E8917E439`; `liveTradingAuthorized=false`.

## Correction Delta disposition

- **CR-01:** Separate the implementation source SHA (`320b451...`), prior evidence/governance SHA and review-input SHA (`847f9bc...`), and the corrected final PR SHA/CI receipt, which will be recorded externally after push. This bundle does not claim its own commit hash.
- **CR-02:** The proposed delta now requires an **APPROVED exact-head audit**, without adding an independent-review gate; it remains `NOT_PROMOTED`.
- **CR-03:** Keep the exact Vite pin because Vitest declares Vite as a non-optional peer; the rationale and peer range are recorded below. No package or lockfile change is necessary.

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
- `vite@6.4.3` is retained as a direct exact-pinned dev dependency because Vitest `4.1.11` declares Vite as a required, non-optional peer (`vite: ^6.0.0 || ^7.0.0 || ^8.0.0`; `peerDependenciesMeta.vite.optional=false`). The source imports `vitest/config`; the direct pin satisfies Vitest's peer contract, not an independent Vite consumer.
- Local workspace packages: `@polyhunter/contracts@0.0.0`, `@polyhunter/domain@0.0.0`, `@polyhunter/testkit@0.0.0`, `@polyhunter/web@0.0.0`, `@polyhunter/worker@0.0.0`. Domain depends only on contracts; contracts and testkit have no runtime package dependency.

## Files created or modified by the implementation commit

32 files: `.gitattributes`, `.env.example`, `.github/workflows/validate.yml`, `.gitignore`, `README.md`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/next-env.d.ts`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/worker/package.json`, `apps/worker/src/index.ts`, `apps/worker/tsconfig.json`, `biome.json`, `package-lock.json`, `package.json`, `packages/contracts/package.json`, `packages/contracts/src/index.ts`, `packages/contracts/tsconfig.json`, `packages/domain/package.json`, `packages/domain/src/index.ts`, `packages/domain/tsconfig.json`, `packages/testkit/package.json`, `packages/testkit/src/fixed-clock.ts`, `packages/testkit/src/index.ts`, `packages/testkit/tsconfig.json`, `tests/environment-example.test.ts`, `tests/fixed-clock.test.ts`, `tests/tsconfig.json`, `tests/workspace-boundaries.test.ts`, `tsconfig.base.json`, and `vitest.config.ts`.

The evidence bundle and proposed checkpoint delta are additional governance records; the canonical checkpoint and Context Lock were not edited.

## Local validation

The initial PH-M00 implementation run, before the current correction delta, exited 0 for the commands below. Timings are wall-clock measurements on the local Windows environment unless stated otherwise.

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

### Required revalidation after CR-01/CR-02/CR-03

| Command | Result | Duration / detail |
| --- | --- | --- |
| `npm ci` | PASS | 59.64 s; 74 packages added, 80 audited, 0 vulnerabilities. |
| `npm run validate` | PASS | 23.12 s; lint, format, typecheck, 3 test files / 6 tests, build and embedded audit all passed. |
| `npm audit --audit-level=high` | PASS | 1.75 s; 0 vulnerabilities. |

No package manifest or lockfile change was needed for CR-03 because the exact Vite pin satisfies Vitest's required peer dependency.

## Exact-head CI receipts

Historical receipts are deliberately tied to their respective heads:

- Implementation source head `320b451d40dfcb2e5e26f0943f500acdfa32fb3f`: GitHub Actions `Node 24 validation` **SUCCESS**, run [37132649616](https://github.com/KayzenRoot/poly-hunter/actions/runs/37132649616).
- Earlier evidence/governance head `847f9bc62f4b869918f0ea1813747c68c95bb7c2`: GitHub Actions `Node 24 validation` **SUCCESS**, run [37132940369](https://github.com/KayzenRoot/poly-hunter/actions/runs/37132940369); Socket Security `Pull Request Alerts` and `Project Report` **SUCCESS**.
- The correction commit's exact head and CI run are intentionally not guessed or embedded in this file; they are recorded in PR #7 after push, without changing this evidence commit.

## Scope and residual risks

- Only the PH-M00 governance/harness foundation was added. No Polymarket/provider, trading, wallet, database, auth, strategy, risk, deployment, or PH-M01 behavior was introduced.
- `npm ci` emitted npm 11's `allow-scripts` advisory that `esbuild@0.25.12`'s postinstall is not approved. Installation, Vitest, and the Next production build all passed without approving that script; retain this advisory for maintainer review.
- Local verification used Node 26.4.0; CI verification used the specified Node 24 reference runtime. Other supported Node majors were not separately executed.
- PR #7 remains draft and unmerged pending an APPROVED exact-head audit. No checkpoint promotion or next-module admission is claimed.

## Proposed checkpoint delta

See `.engineering/checkpoint-deltas/PH-M00-WO-001.md`. It is proposed only and must not be promoted before an APPROVED exact-head audit and merge.

## STOP

The correction delta is locally validated. Await exact-head CI after push, then stop; do not begin PH-M01 or PolyHunter product/trading work.
