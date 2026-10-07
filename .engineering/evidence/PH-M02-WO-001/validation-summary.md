# PH-M02-WO-001 validation receipt

Date: 2026-10-07. Commands ran in the repository on the authorized branch. `npm ci`, `npm run validate`, and the separate `npm audit --audit-level=high` all exited 0.

| Check | Result |
|---|---|
| `npm ci` | PASS; 159 packages added, 167 audited, 0 vulnerabilities. npm emitted deprecated `@esbuild-kit/*` warnings and an allow-scripts notice for esbuild; install and build completed. |
| `npm run lint` (inside validate) | PASS; 93 files. One existing informational `noUselessContinue` hint in `packages/db/tests/m01-acceptance.integration.test.ts:945`; not changed in this WO. |
| `npm run format:check` | PASS; no formatter changes needed. |
| `npm run typecheck` | PASS across contracts, domain, db, testkit, new polymarket package, worker, web, and root tests. |
| `npm test` | PASS; 14 files, 223 tests. |
| `npm run build` | PASS; all workspaces and Next.js web production build completed. |
| `npm audit --audit-level=high` | PASS; 0 dependency vulnerabilities. Run once within validate and once separately after validate. |
| Targeted provider suite (`npx vitest run` with four `tests/polymarket-*.test.ts` files) | PASS; 4 files, 34 tests. Full output: `provider-tests.txt`. |
| `git diff --check` | PASS before evidence composition; will be repeated on the exact staged diff before commit. |

`npm run validate` also runs the dependency audit. The dependency audit result does not override the exact-image Docker Scout HIGH/CRITICAL blockers documented in `security-scans.md`.

The full test/build output was observed in the command tool; only the targeted provider test output is retained as raw test text. The command-level outcomes and counts above are summaries, not claimed as a raw transcript.
