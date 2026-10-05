# PH-SEC-WO-007 / validation gate results at exact head

Work Order: PH-SEC-WO-007 (evidence-only)
Branch: security/ph-m01-dev-nongo-vex
Parent head: 7d5be250255bd20cb0b20d6713f6f41c52c73b47
Target image: polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3
Executed inside the canonical local Docker runtime (`polyhunter-local` project), service `web`.

## Proof that these results are inherited, not introduced

`git diff HEAD --stat` is **empty**: no tracked file is modified by this Work Order.
Every addition lives under `.engineering/`, which Biome explicitly excludes
(`biome.json` -> `files.includes` contains `"!.engineering"`).

Therefore the gate results below are **definitionally identical** to those of the
parent head and cannot have been changed by this Work Order. Confirmed
empirically as well: no diagnostic or formatting failure references
`.engineering`, `PH-SEC-WO-007`, or any file added here.

## Results

| Gate | Command | Result | Notes |
|---|---|---|---|
| Unit/integration tests | `npm test` | **PASS** | 1 file, 4 tests passed (`packages/db/tests/tenancy.integration.test.ts`, 6.9 s) |
| Dependency audit | `npm audit --audit-level=high` | **PASS** | `found 0 vulnerabilities` |
| Lint | `npm run lint` | **FAIL (pre-existing)** | 990 errors / 1555 warnings / 105 infos. All in generated `apps/web/.next/dev/**` dev-server artifacts emitted by the running Next dev server (e.g. `static/chunks/polyfills.js` alone accounts for 851 errors). Source trees report 0 errors, 38 warnings. |
| Format check | `npm run format:check` | **FAIL (pre-existing)** | 68 errors / 2 warnings in tracked files not touched here: `tsconfig.base.json`, `vitest.integration.config.ts`, `packages/testkit/package.json`, `packages/testkit/tsconfig.json`, `packages/testkit/src/fixed-clock.ts` |
| Typecheck | `npm run typecheck` | **FAIL (pre-existing)** | `error TS5058: The specified path does not exist: 'tsconfig.json'` for workspace `@polyhunter/worker` — `apps/worker/tsconfig.json` is absent |
| Whitespace | `git diff --check HEAD` | **PASS** | no whitespace errors |
| Product mutation guard | `git diff HEAD --stat` | **PASS (empty)** | Dockerfile, Compose, package.json, package-lock.json, apps/web/next.config.ts, apps/**, packages/** all unchanged |

## Material observation for the owner

PR #15 carries **pre-existing gate failures unrelated to the security
blockers**: `lint`, `format:check` and `typecheck` all fail at the parent head,
before this Work Order touched anything. `npm run validate` therefore cannot
pass on this branch today regardless of the VEX outcome.

Two distinct causes:

1. **Lint noise from generated output** — Biome lints `apps/web/.next/dev/**`,
   which is dev-server build output present in the running container, not
   source. This is a tooling-configuration issue.
2. **Genuine gaps** — `apps/worker/tsconfig.json` is missing, and five tracked
   files are not Biome-formatted.

Neither is in scope for PH-SEC-WO-007 (evidence-only; product changes are
prohibited), and neither was modified. This is reported, not fixed.

## Receipts

| File | Content |
|---|---|
| `check-test.txt` | `npm test` output |
| `check-audit.txt` | `npm audit --audit-level=high` output |
| `check-lint.txt` | `npm run lint` output |
| `check-lint-source-only.txt` | `npx biome lint apps packages tests` output |
| `check-format.txt` | `npm run format:check` output |
| `check-typecheck.txt` | `npm run typecheck` output |