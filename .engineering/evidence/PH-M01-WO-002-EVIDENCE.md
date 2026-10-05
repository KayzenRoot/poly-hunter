# PH-M01-WO-002 — Evidence Bundle

**Work Order:** PH-M01-WO-002 — Identity & RBAC
**Branch:** `feat/ph-m01-identity-rbac` · **PR:** #37 (OPEN, DRAFT, base `main@cd3e00475f434be6c358fff89e82965370cc6c70`) · **Issue:** #36
**Risk class:** HIGH_ASSURANCE
**Status:** `READY_FOR_INDEPENDENT_AUDIT` (proposed; see §10 for the one open VEX approval item)

Executor: Codex. No disposition is self-approved. PH-M01-WO-003 was **not** started; the canonical checkpoint was **not** modified.

---

## 1. PREFLIGHT (Context Lock `PH-M01-WO-002.json`)

| Check | Result |
|---|---|
| Branch `feat/ph-m01-identity-rbac` | PASS |
| Merge-base(HEAD, base `cd3e004…`) == `cd3e004…` (PR #15 merge commit; PR #15 MERGED 2026-10-05) | PASS |
| Canonical checkpoint `M01_INCREMENT_IMPLEMENTED` / `STOP_AFTER_PH_M01_WO_001` / `AWAIT_OWNER_DIRECTION`, `activeWorkOrder=NONE` | PASS |
| Work Order fingerprint (`af606fa9…`) | PASS |
| frozenSources fingerprints (17/17: AGENTS, CHECKPOINT, SOURCE-HIERARCHY, REQUIREMENTS, SCOPE, ARCHITECTURE, SECURITY, DATA-MODEL, API-CONTRACTS, INTEGRATION-CONTRACTS, TEST-BENCHMARK-PLAN, DEFINITION-OF-DONE, module spec, ADR-0004/0005/0007, DECISIONS-LEDGER) | PASS |
| runtimeFingerprints (7/7: package.json, package-lock.json, compose.yaml, Dockerfile.dev, next.config.ts, db schema, db server) — validated **before first mutation** | PASS |
| Supabase official docs/changelog re-check + exact npm versions | PASS (receipt `receipts/supabase-source-check.md`) |

Note: the local `main` ref was stale (`d0cbbdd`, the initial commit) and was fast-forwarded to `origin/main` = `cd3e004…` during preflight; the merge-base check was then re-run against the locked base SHA and matched exactly. No drift.

## 2. Official source check and exact versions

Receipt: [`receipts/supabase-source-check.md`](PH-M01-WO-002/receipts/supabase-source-check.md), [`receipts/pinned-versions.json`](PH-M01-WO-002/receipts/pinned-versions.json).

| Package | Pinned (exact) | Basis |
|---|---|---|
| `@supabase/supabase-js` | `2.117.2` | current `latest` on npm registry (checked 2026-10-05) |
| `@supabase/ssr` | `0.12.7` | current `latest`; peer `@supabase/supabase-js ^2.114.0` satisfied; published 2026-09-08 |

Official guidance verified (docs/guides/auth/server-side, /nextjs, /creating-a-client; changelog breaking-changes):

- `createBrowserClient` (browser only) / `createServerClient` (per-request) with the `getAll`/`setAll` cookie API.
- `getClaims()` is the recommended verified-identity path (signature verified per call); `getUser()` for fresh provider user state; **`getSession()` must never be trusted for authorization** (docs warning quoted in the receipt) — our IdentityPort forbids it.
- Next.js 16 uses **`proxy.ts`** (a `middleware.ts` file is never called on Next 16).
- Browser configuration carries only the project URL + **publishable** key; no service-role/secret key exists anywhere in this Work Order.
- PKCE-compatible SSR flow (`signInWithOAuth` through the SSR cookie store).
- Changelog: no breaking change affecting `getUser`/`getSession`; `@supabase/ssr` remains 0.x → adapter isolation is mandatory (honored); Node 22+ and TS 5.0 requirements satisfied (Node 24.21.0, TS 6.0.3).

## 3. Architecture implemented (trust boundary)

```
browser ──(publishable key only)──▶ proxy.ts (session refresh via getClaims; NO authorization)
   │                                     │
   └──▶ /api/auth/login (302 to provider, PKCE; returnTo sanitized)
        /auth/callback (code exchange; idempotent provisioning; open-redirect guard)
        /api/auth/logout (POST; clears provider cookies + tenant selection)
        /api/auth/select-tenant (POST; selector validated against authoritative row)
        /api/me (sanitized identity; no tokens/metadata)
                │ server-side only
                ▼
   IdentityPort (domain) ──▶ Supabase adapter (apps/web/src/identity/supabase-adapter.ts)
                │                               [the ONLY @supabase/* import + proxy.ts]
                ▼
   packages/db server/identity.ts ── internal user + identity_links (idempotent, race-safe)
   packages/db server/index.ts    ── memberships.resolveMembershipRow (authoritative row read)
   domain evaluateTenantResolution ── fail-closed issuance policy (pure, unit-tested)
```

Key files: `packages/contracts/src/index.ts` (VerifiedIdentity, IdentityUnavailabilityReason, PlatformRole), `packages/domain/src/index.ts` (IdentityPort, PlatformContext, `evaluateTenantResolution`, `tenantRoleHasCapability`, `isPlatformAdmin`), `packages/db/src/server/identity.ts`, `packages/db/src/schema/index.ts` (+`platform_roles`), `apps/web/proxy.ts`, `apps/web/src/identity/{supabase-adapter,session-service,open-redirect,identity-sanitizer}.ts`, routes under `apps/web/app/{api/me,api/auth/*,auth/*}`.

Security invariants:
- Identity derives only from signature-verified provider claims (`getClaims()`; `getUser()` fallback). `getSession().user` is never read for authorization.
- `user_metadata` is structurally ignored by the identity sanitizer (unit-proven: injected `platform_admin`/`role`/`tenant_id` metadata fields are dropped).
- Internal user + identity_link provisioning is transactional and race-safe: `FOR UPDATE` on the identity_link row, unique `(provider, subject)`, and a 23505 race-loss path that re-reads the winner after ROLLBACK.
- Tenant roles come only from active `tenant_memberships` rows; `platform_admin` comes only from persisted `platform_roles` (enum admits only `platform_admin`; unique `(user_id, role)`; cascade delete).
- The tenant selector cookie (`ph-active-tenant`, httpOnly, SameSite=Lax, Secure in production) is a selector only; every authoritative operation re-reads membership.
- Absent Supabase configuration → explicit fail-closed states (`provider_not_configured`), never a fabricated user.

## 4. Migration

- `packages/db/drizzle/0001_tiresome_menace.sql` — `platform_role` enum (`platform_admin` only) + `platform_roles(id, user_id→users.id ON DELETE cascade ON UPDATE cascade, role, created_at)` + unique `(user_id, role)`.
- SHA-256: SQL `cbd5ed27…4992494`, snapshot `ec214177…b0af`, journal `232b0c11…704ae` (`receipts/migration-hashes.txt`).
- Applied to: two empty disposable databases in integration setup (migration + repeat application PASS) and the running dev DB (`platform_roles` verified via `\d`).
- No `encrypted_secrets` table was created (WO-003 scope).

## 5. Tests (all PASS)

**Unit (28/28, `npm test`)** — includes new `tests/identity-rbac-adversarial.test.ts` (21 cases):
- tenant resolution policy: unauthenticated / no membership / suspended membership / invited membership / suspended user / suspended tenant all fail closed; issuance only for the fully active row (frozen context).
- RBAC matrix: owner/admin capabilities vs member denials (member cannot rename/invite/remove).
- platform_admin separation: `isPlatformAdmin(null)` is false for every tenant role; authority comes only from the authoritative value.
- open-redirect guard: same-origin relative paths accepted; absolute, protocol-relative, encoded-slash, backslash and oversized values rejected.
- identity shape: malformed subjects fail closed; forged `user_metadata` (`platform_admin`, `tenant_id`, `role`) is structurally dropped from the verified identity.

**Integration (14/14, `npm run db:test:integration` inside the web container against disposable PostgreSQL databases)** — `packages/db/tests/identity-rbac.integration.test.ts` + WO-001 regression file:
- migrations from empty DBs + repeat/disposable application (WO-001 regression); `platform_roles` present.
- provisioning: verified subject → internal user; idempotent re-resolution; 3-way concurrent provisioning produces exactly one user/link (race test).
- malformed subjects fail closed with zero provisioning.
- platform authority: null without a row; `platform_admin` only after the authoritative insert; unique constraint rejects duplicates; cascade on user delete.
- tenant A selector resolves owner on A; tenant B selector returns no row; non-UUID selectors rejected.
- membership suspension/removal and tenant suspension all fail the next authoritative read (SEC-022).
- `platform_admin` is not representable as a tenant membership (enum-level rejection) — DB-level separation proof.
- WO-001 tenancy/isolation suite: 4/4 PASS (regression).

## 6. Runtime evidence (Docker, no Supabase credentials)

Receipts: `receipts/runtime/fail-closed-probes.txt`, `receipts/runtime/final-image-id.txt`.

- Image rebuilt (`--pull --no-cache`) after the dependency change: `sha256:4cb8f254120efe66d7781c2261ee451aef50e8243bde6471271995551783d538`.
- `polyhunter-web` healthy, `http://localhost:3000` → HTTP 200; `polyhunter-worker` running; `polyhunter-postgres` healthy.
- Migration applied to the dev DB; `platform_roles` verified.
- **Fail-closed probes with no Supabase credentials:** `/api/me` → `{"authenticated":false,"reason":"provider_not_configured"}`; `/api/auth/login` → 503 `identity_provider_unavailable`; `/api/auth/select-tenant` (unauthenticated) → 503; `/auth/callback?returnTo=https://evil.example&code=x` → 303 to same-origin `/?auth=failed` (no off-origin redirect; forged code rejected). No fabricated user anywhere.

## 7. Dependency/container/secret scans

- `npm ci`: PASS. `npm audit --audit-level=high`: **found 0 vulnerabilities**.
- `npm run validate` (lint + format + typecheck + unit + build + audit): **PASS**.
- Container scan (Docker Scout SARIF, final artifact): `receipts/runtime/final-image-scan.sarif` — 25 error-level rows = **20 owner-approved** (PH-SEC-WO-007) + **2 owner-approved** (PH-SEC-WO-008) + **3 new perl rows** with PROPOSED `NOT_AFFECTED` dispositions (`receipts/vex-delta-3-perl-cves.json`): `CVE-2026-42496/42497` (Archive::Tar absent — perl-base only), `CVE-2026-8376` (32-bit-only advisory; artifact is amd64 64-bit and perl is never executed). These three require independent audit + owner approval; until then they are treated as blocking under ADR-0007 (see §10).
- Secret-pattern & client-bundle leak scan: **0 hits** in source (15 files) and **0 hits** in the built client bundle (9 files) for service-role vars, private keys, JWT-shaped strings or passworded connection URLs (`receipts/secret-leak-scan.txt`). No `NEXT_PUBLIC_*` variable carries a secret.
- `git diff --check`: clean.

## 8. Adversarial coverage map (WO obligation → proof)

| # | Obligation | Proof |
|---|---|---|
| 1 | verified identity → correct internal user | integration (provisioning + idempotence) |
| 2 | forged client user id ignored | integration (non-UUID selectors rejected) + unit (context only from row) |
| 3 | duplicate/racing identity resolution idempotent | integration (3-way concurrent, 1 link, same user) |
| 4 | invalid/expired/spoofed auth fails closed | adapter fail-closed paths + runtime probe (`/api/me` 401-state) |
| 5 | provider error fails closed | adapter `provider_unavailable` path + probe 503 |
| 6 | `getSession()` not authorization evidence | adapter never calls it; domain port has no session-typed input |
| 7 | no membership → no TenantContext | unit + integration (`no_active_membership`) |
| 8 | tenant A selector cannot obtain tenant B | integration (foreign selector → null row) |
| 9 | suspended/removed membership fails next read | integration (suspension + removal sequence) |
| 10–11 | owner/admin/member matrix; member denied admin | unit capability matrix |
| 12–13 | admin/owner cannot obtain platform_admin | unit separation + integration (null role without row) |
| 14 | platform_admin separate + audited | DB enum/unique/cascade + `resolvePlatformRole` single source |
| 15 | user_metadata injection has no effect | unit (metadata structurally dropped) |
| 16 | logout invalidates local path | route + `clearActiveTenantSelection` (cookie cleared) |
| 17 | callback open redirect blocked | unit sanitizer + runtime probe (same-origin 303) |
| 18 | no token/password/auth-code leakage | secret scan 0 hits + sanitized `/api/me` design |
| 19 | migration empty/repeat DBs | integration setup + dev DB apply |
| 20 | WO-001 regression | tenancy suite 4/4 PASS |
| 21 | Docker healthy | runtime receipts |
| 22 | `npm ci`/lint/format/typecheck/test/build PASS | `npm run validate` PASS |
| 23 | audit + container/dependency/secret scan | 0 npm vulns; SARIF receipt; leak scan 0 hits |
| 24 | `git diff --check` | clean |

## 9. Scope discipline

- No product code outside the allowed mutation classes; `encrypted_secrets`, vault, AES, Polymarket, wallet/signing, market data, strategy, risk engine, dashboard and M02+ were **not** implemented.
- Canonical `.engineering/CHECKPOINT.json` untouched; `.engineering/checkpoint-deltas/PH-M01-WO-002.md` is `PROPOSED / NOT_PROMOTED`.
- PR #37 not merged.

## 10. STOP

**`READY_FOR_INDEPENDENT_AUDIT`** — implementation, tests, evidence and Docker runtime complete. One governance item accompanies the audit: the three new perl findings in the rebuilt image carry PROPOSED `NOT_AFFECTED` dispositions (`receipts/vex-delta-3-perl-cves.json`) that require independent audit + owner approval under ADR-0007; until approved they are treated as blocking. No suppression/ignore/waiver/severity downgrade was used anywhere.