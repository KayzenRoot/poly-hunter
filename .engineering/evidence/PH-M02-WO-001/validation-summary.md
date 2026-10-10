# PH-M02-WO-001 validation receipt

Date: 2026-10-07. Final clean install and full validation ran in the authorized branch worktree. The host runtime was Node v26.4.0 with npm 11.17.0, inside the declared >=24 <27 range. The final Docker runtime is Node v24.21.0.

| Check | Result |
|---|---|
| npm ci | PASS; 159 packages added, 167 audited, zero dependency vulnerabilities. npm reported legacy @esbuild-kit deprecation warnings and four esbuild install-script approval warnings; install completed. |
| npm run lint (inside validate) | PASS; 94 files. One pre-existing informational noUselessContinue hint at packages/db/tests/m01-acceptance.integration.test.ts:945; this Work Order did not alter that test. |
| npm run format:check | PASS; 94 files, no changes required. |
| npm run typecheck | PASS across contracts, domain, db, testkit, polymarket, worker, web and root tests. |
| npm test (inside validate) | PASS; 15 files, 238 tests. |
| npm run build (inside validate) | PASS; all workspaces and Next.js 16.3.8 production build completed. |
| npm audit --audit-level=high | PASS; zero dependency vulnerabilities, both inside validate and as a separate command. |
| Focused provider suite | PASS; 4 files, 35 tests covering boundary, decimals/events, REST behavior and stream lifecycle. Raw output: provider-tests-final.txt. |
| Docker Compose config | PASS with explicit project polyhunter-local. |
| Docker runtime | PASS; web HTTP 200/healthy, PostgreSQL healthy, worker process running; Node 24.21.0 worker import smoke resolves the provider adapter. |
| git diff --cached --check | PASS on the exact staged source, checkpoint and evidence set. |

The npm dependency audit does not clear exact-image Docker Scout findings. Exact image findings and digest-bound dispositions are recorded in security-scans.md and security-scans.json. Final gate remains BLOCKED_UNRESOLVED for unresolved image findings.
