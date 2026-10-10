# Wave A proposed exclusive ownership matrix

Status: **PROPOSED / MUST BE ACCEPTED BEFORE ANY LANE EXECUTION**
Baseline for this proposal: `85489b2d5f7745e9e4dd81495cda41dcaba1090e`

Paths below are proposed boundaries, not claims that the directories already exist. They use existing workspaces so lane agents need not edit shared root manifests or create competing workspace registrations. Each lane receives its own branch and isolated worktree at the same accepted source SHA. No worktree is shared between writers.

## Shared coordinator ownership

Only the integration coordinator may write:

- `packages/contracts/**` including Wave A contract source and exports;
- root manifests/lockfiles, workspace/package registration, TypeScript/Biome/Vitest config and shared package barrel exports;
- `packages/db/**`, schema, migrations, `TenantContext`, authorization/authentication and secret handling;
- `apps/web/app/layout.tsx`, `apps/web/proxy.ts`, shared middleware, login/session/auth/API routes, shared design shell;
- `apps/worker/src/index.ts` and service wiring;
- `.github/**`, Dockerfile/Compose, scripts, policies, security/VEX, `.engineering/CHECKPOINT.*`, canonical Scope/Requirements/Architecture/ADR/Backlog;
- wave integration branch, PR ordering, consolidated CI/test campaign, and final checkpoint proposal.

Lane agents may submit a change request to the coordinator for a shared path. They may not edit that path in their lane worktree.

## Lane-exclusive owned paths

| Issue / module | Agent worktree branch proposal | Exclusive implementation paths | Explicit non-ownership / integration handoff |
|---|---|---|---|
| #45 PH-M03 | `feat/ph-m03-market-data` | `packages/domain/src/market-data/**`; `tests/market-data/**` | No `packages/polymarket/**`, worker entrypoint, root export or package manifest. Wait for PH-M02-WO-005 promotion and stop reconciliation. |
| #46 PH-M04 | `feat/ph-m04-strategy` | `packages/domain/src/strategy/**`; `tests/strategy/**` | No risk, worker, provider, shared domain barrel or order path. |
| #47 PH-M05 | `feat/ph-m05-risk` | `packages/domain/src/risk/**`; `tests/risk/**` | No strategy-owned paths, DB/auth, order adapter or risk profile migration. HIGH_ASSURANCE independent review. |
| #49 PH-M07 | `feat/ph-m07-replay-paper` | `packages/domain/src/replay/**`; `packages/testkit/src/replay/**`; `tests/replay/**` | No strategy/risk/market-data source, M06 order path, runtime wiring, or production claim. |
| #50 PH-M08 | `feat/ph-m08-dashboard` | `apps/web/app/(tenant)/dashboard/**`; `apps/web/src/dashboard/**`; `tests/dashboard/**` | No root layout, tenant session/authorization, auth/proxy/API, secret routes, or LIVE setting path. |
| #51 PH-M09 | `feat/ph-m09-admin-shell` | `apps/web/app/(admin)/admin/**`; `apps/web/src/admin/**`; `tests/admin/**` | No role/authorization/auth routes, DB, kill execution API, M05/M06 paths or shared root layout. HIGH_ASSURANCE authorization/UI audit. |
| #53 PH-M11 | `feat/ph-m11-observability-foundation` | `apps/worker/src/observability/**`; `tests/observability/**` | No worker entrypoint wiring, production infrastructure/deployment, backup/restore changes, Docker/Compose, secret source or shared logging config. |

## Evidence ownership

Each future lane owns only its own receipts under `.engineering/evidence/PH-Mxx-WO-001/**` and proposed checkpoint delta under `.engineering/checkpoint-deltas/PH-Mxx-WO-001.md`. These are separate per-lane paths. The coordinator owns the combined Wave A receipt and integration report. All receipts must be sanitized and content-hashed; no credentials or raw secrets may be stored.

## Collision rule

Before any lane starts, compare its changed-path manifest with this table and every other lane's manifest. Any overlap, shared-export need, dependency change, API/scope drift, or unowned file is a stop and coordinator handoff. The coordinator integrates only after each lane reaches code freeze; integrations are serial, not shared-worktree editing.
