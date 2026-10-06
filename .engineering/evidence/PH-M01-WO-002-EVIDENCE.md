# PH-M01-WO-002 — Evidence Bundle

**Work Order:** PH-M01-WO-002 — Identity & RBAC
**Branch:** `feat/ph-m01-identity-rbac` · **PR:** #37 (OPEN, DRAFT, base `main@cd3e00475f434be6c358fff89e82965370cc6c70`) · **Issue:** #36
**Risk class:** HIGH_ASSURANCE
**Status:** `APPROVED AS EVIDENCE / OWNER_SECURITY_APPROVED / READY_FOR_MERGE_AND_CHECKPOINT_DECISION` (25/25 HIGH/CRITICAL rows are `NOT_AFFECTED` on the exact final digest; see §15)

> **Revision 2 — correction delta.** Independent audit `5420502909` of `sha256:4cb8f254…83d538` returned **CORRECTION REQUIRED** with CR-01..CR-04. This revision records those corrections. Sections 1–5 and 8–9 describe the original WO-002 delivery and are unchanged except where noted. Sections 6, 7 and 10 are superseded by §11.
>
> **Revision 3 — second correction delta.** Independent re-audit `5427078628` of `sha256:eddda17a…cb7c` at `de18b34` **ACCEPTED** the Auth/RBAC architecture, **closed CR-02, CR-03 and CR-04**, and accepted the CR-01 revalidation method in principle. It raised two remaining findings, recorded in §13: **CR-05** (nondeterministic integration teardown, red exact-head CI) and **CR-06** (VEX machine-readable inconsistency). Both are closed below. Neither changed an image build input, so the artifact digest is unchanged — see §13.3.
> **Revision 4 — third correction delta (CR-07).** Independent audit `5427442224` of `sha256:eddda17a…cb7c` at `15a645e` **closed CR-05 and CR-06** and **accepted the technical basis of the 25 proposed `NOT_AFFECTED` dispositions**. It raised exactly one remaining finding, recorded in §14: **CR-07** (`@supabase/ssr` 0.12.7 auth-cookie cache headers — the server adapter's `setAll` declared only one parameter and discarded the delivered cache policy). CR-07 is closed below. It changed only TypeScript source, tests and test config, none of which is baked into the image, so the artifact digest is unchanged — see §14.3.

**Audited code head:** `0a761490459531d9fb2623c14227354b0b03a120` (CR-07)
**Previous code heads:** `85b3aaa2…` (CR-05/CR-06), `7a54bb76…` (CR-01..CR-04)
**FINAL artifact:** `polyhunter-dev:local@sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c` — **unchanged across all three correction deltas**

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

Key files: `packages/contracts/src/index.ts` (VerifiedIdentity, IdentityUnavailabilityReason, PlatformRole), `packages/domain/src/index.ts` (IdentityPort, PlatformContext, `evaluateTenantResolution`, `tenantRoleHasCapability`, `isPlatformAdmin`), `packages/db/src/server/identity.ts`, `packages/db/src/schema/index.ts` (+`platform_roles`), `apps/web/proxy.ts`, `apps/web/src/identity/{supabase-adapter,session-service,open-redirect,identity-sanitizer,app-origin,csrf-guard}.ts`, routes under `apps/web/app/{api/me,api/auth/*,auth/*}`.

Correction-delta files: `apps/web/src/identity/app-origin.ts`, `apps/web/src/identity/csrf-guard.ts`, `apps/web/app/api/auth/select-tenant/handler.ts`, `apps/web/app/api/auth/logout/handler.ts`. Both handlers are pure dependency-injection units; `route.ts` stays a thin wrapper that wires the production service, so the security logic is testable without a provider or database.

Security invariants:
- Identity derives only from signature-verified provider claims (`getClaims()`; `getUser()` fallback). `getSession().user` is never read for authorization.
- `user_metadata` is structurally ignored by the identity sanitizer (unit-proven: injected `platform_admin`/`role`/`tenant_id` metadata fields are dropped).
- Internal user + identity_link provisioning is transactional and race-safe: `FOR UPDATE` on the identity_link row, unique `(provider, subject)`, and a 23505 race-loss path that re-reads the winner after ROLLBACK.
- Tenant roles come only from active `tenant_memberships` rows; `platform_admin` comes only from persisted `platform_roles` (enum admits only `platform_admin`; unique `(user_id, role)`; cascade delete).
- The tenant selector cookie (`ph-active-tenant`, httpOnly, SameSite=Lax, Secure in production) is a selector only; every authoritative operation re-reads membership. The write is **awaited** before the response is produced, so a successful response always implies a written cookie.
- Absent Supabase configuration → explicit fail-closed states (`provider_not_configured`), never a fabricated user.
- **State-changing Route Handlers enforce Origin explicitly** (`apps/web/src/identity/csrf-guard.ts`). Next.js applies automatic Origin protection to Server Actions, **not** to custom Route Handlers — so `POST /api/auth/select-tenant` and `POST /api/auth/logout` call `assertSameOrigin()` themselves as the first statement, before any state is read or written. Cross-origin fails closed with 403.
- The trusted origin comes only from `NEXT_PUBLIC_APP_ORIGIN` (`apps/web/src/identity/app-origin.ts`). The request `Host`, `X-Forwarded-Host` and the client-supplied `Origin` are **never** used to derive it. Forwarded headers are deliberately ignored for security decisions (reverse-proxy policy). SameSite cookies are defense-in-depth, not the primary proof.
- Every redirect target is built by `appUrlFor()` from the configured origin. `returnTo` remains a sanitized **relative** path only.

## 4. Migration

- `packages/db/drizzle/0001_tiresome_menace.sql` — `platform_role` enum (`platform_admin` only) + `platform_roles(id, user_id→users.id ON DELETE cascade ON UPDATE cascade, role, created_at)` + unique `(user_id, role)`.
- SHA-256: SQL `cbd5ed27…4992494`, snapshot `ec214177…b0af`, journal `232b0c11…704ae` (`receipts/migration-hashes.txt`).
- Applied to: two empty disposable databases in integration setup (migration + repeat application PASS) and the running dev DB (`platform_roles` verified via `\d`).
- No `encrypted_secrets` table was created (WO-003 scope).

## 5. Tests (all PASS)

**Unit (105/105 across 6 files, `npm test`)** — the correction delta added `tests/app-origin-csrf.test.ts` (43) and `tests/route-handler-security.test.ts` (33); `tests/identity-rbac-adversarial.test.ts` contributes 21.
- tenant resolution policy: unauthenticated / no membership / suspended membership / invited membership / suspended user / suspended tenant all fail closed; issuance only for the fully active row (frozen context).
- RBAC matrix: owner/admin capabilities vs member denials (member cannot rename/invite/remove).
- platform_admin separation: `isPlatformAdmin(null)` is false for every tenant role; authority comes only from the authoritative value.
- open-redirect guard: same-origin relative paths accepted; absolute, protocol-relative, encoded-slash, backslash and oversized values rejected.
- identity shape: malformed subjects fail closed; forged `user_metadata` (`platform_admin`, `tenant_id`, `role`) is structurally dropped from the verified identity.
- **app origin + CSRF (43, CR-02/CR-04):** local `http://localhost:3000` and production `https://app.example.test` both accepted; missing, malformed, relative, bare-host, `ftp:` and `javascript:` origins rejected; production requires `https` and otherwise throws `InvalidAppOriginError`; the CSRF guard fails closed on that error; a spoofed `Host` is ignored while an exact-match `Origin` is allowed; foreign, sibling-subdomain, parent-lookalike, different-protocol, different-port, `null`, malformed, whitespace and missing origins all rejected; `Host`-only and `X-Forwarded-Host`-only requests rejected; `appUrlFor` rejects `//evil.example`, absolute URLs, `…localhost:3000.evil.example` and backslash paths.
- **route handler security (33, CR-02/CR-03):** ten hostile header shapes × both endpoints return 403 with the session resolver, cookie writer, `signOut` and `clearSelection` all proven never called; the cookie write is proven **awaited** (a held-open promise leaves the handler unsettled); foreign, suspended, inactive-tenant, malformed-selector, unauthenticated and provider-unconfigured paths never write the cookie; cookie attributes captured through a mocked `next/headers` prove `ph-active-tenant` is httpOnly, SameSite=Lax, path `/`, Secure in production and not Secure in development; logout returns 303 to the configured origin and never to `localhost`.

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

> Superseded by §11.4 — the digest below is the artifact the first audit scanned, and it is no longer the artifact under audit.

Receipts: `receipts/runtime/fail-closed-probes.txt`, `receipts/runtime/prior-image-id.txt`.

- Image rebuilt (`--pull --no-cache`) after the dependency change: `sha256:4cb8f254120efe66d7781c2261ee451aef50e8243bde6471271995551783d538`.
- `polyhunter-web` healthy, `http://localhost:3000` → HTTP 200; `polyhunter-worker` running; `polyhunter-postgres` healthy.
- Migration applied to the dev DB; `platform_roles` verified.
- **Fail-closed probes with no Supabase credentials:** `/api/me` → `{"authenticated":false,"reason":"provider_not_configured"}`; `/api/auth/login` → 503 `identity_provider_unavailable`; `/api/auth/select-tenant` (unauthenticated) → 503; `/auth/callback?returnTo=https://evil.example&code=x` → 303 to same-origin `/?auth=failed` (no off-origin redirect; forged code rejected). No fabricated user anywhere.

## 7. Dependency/container/secret scans

> Superseded by §11.5. The dispositions described below were valid only for the prior digest and have expired.

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
| CR-02 | state-changing Route Handlers reject cross-origin | 43 unit + 33 handler tests + 13 live probes (`runtime/cr02-cr04-live-probes.txt`) |
| CR-03 | tenant cookie is written before the response | handler tests prove the write is awaited and never runs on a failure path |
| CR-04 | redirect target follows configuration, not a literal | live container with `NEXT_PUBLIC_APP_ORIGIN=http://configured-origin.test:4321` redirects there and rejects `localhost` as foreign |

## 9. Scope discipline

- No product code outside the allowed mutation classes; `encrypted_secrets`, vault, AES, Polymarket, wallet/signing, market data, strategy, risk engine, dashboard and M02+ were **not** implemented.
- Canonical `.engineering/CHECKPOINT.json` untouched; `.engineering/checkpoint-deltas/PH-M01-WO-002.md` is `PROPOSED / NOT_PROMOTED`.
- PR #37 not merged.

## 10. STOP

**`READY_FOR_INDEPENDENT_AUDIT`** — CR-02, CR-03 and CR-04 are closed in code with adversarial unit coverage, live-container probes and a clean validation chain; CR-01 is closed with a full objective-equivalence revalidation on the FINAL digest. The audit request is therefore re-opened against `sha256:eddda17a…cb7c` at head `7a54bb7…`.

One governance item accompanies the audit, and it is now larger than it was in Revision 1: because the corrections changed application code, the image digest necessarily changed, and under PH-SEC-VEX-POLICY that expires **every** prior `NOT_AFFECTED` disposition. All 25 HIGH/CRITICAL rows are therefore `UNDER_INVESTIGATION` on the FINAL digest with *proposed* dispositions only (see §11.5). The prior owner approvals are historical records of the prior digest and do not approve this one. A new independent audit plus owner approval is required.

No suppression, ignore, waiver or severity downgrade was used anywhere.

---

## 11. Correction delta CR-01 … CR-04 (independent audit `5420502909`)

### 11.1 CR-01 — final-digest VEX revalidation

The audit found the WO-002 build produced `sha256:4cb8f254…83d538` while the approved artifact was `sha256:ed140fd5…9297ba3`. PH-SEC-VEX-POLICY expires a `NOT_AFFECTED` disposition at a new image digest, so **all** prior dispositions had lapsed.

The FINAL artifact is `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c` (`linux/amd64`, user `node`), scanned with Docker Scout v1.24.0 / Docker Engine 29.7.2. Every one of the 22 carried-over rows was revalidated across the six policy axes before being preserved by reference:

| Axis | Result |
|---|---|
| component/package | 80/80 SARIF rows identical; 0 added, 0 changed, 0 removed |
| exact version | Debian dpkg inventory byte-identical to the WO-007 artifact (88 packages); every npm purl version identical |
| architecture | amd64 / x86-64 unchanged; `perl-base` amd64 |
| installed files | `node`, `libstdc++.so.6.0.30`, `sharp-linux-x64-0.35.5.node`, `libvips-cpp.so.8.18.7` all SHA-256 identical to the WO-008 baseline |
| runtime assumptions | uid 1000 `node`, not privileged, no cap add/drop, web on `127.0.0.1:3000` only, worker unpublished, no perl process in either container, no `child_process`/`exec`/`spawn` call site |
| prior proof assumptions | every precondition quoted verbatim from the prior disposition and re-measured on the FINAL artifact |

No axis changed, so no prior analysis had to be redone. Receipts: `receipts/cr01-revalidation/00`–`08`, `receipts/runtime/prior-image-scan.sarif`, `receipts/runtime/final-image-scan.sarif`.

**The three Perl advisories.** `CVE-2026-42496`/`CVE-2026-42497` keep `vulnerable_code_not_present` only because the absence of `Archive::Tar` was **re-proven on the FINAL artifact** by three independent methods: `dpkg -S` finds no owning package (`perl`/`perl-modules` are `not-installed`), a filesystem `find` returns zero hits across every mount, and the image's own perl fails `perl -MArchive::Tar` while enumerating all ten `@INC` roots. `CVE-2026-8376` no longer rests primarily on "perl is never executed": it now rests on a measured, unsatisfiable 32-bit prerequisite — `perl-base` 5.36.0-7+deb12u3 amd64, ELF `EI_CLASS=0x02` (ELF64), `e_machine=0x3e` (x86-64), `Config{ivsize}=8` bytes, `LONG_BIT=64`, `Config{ptrsize}=8` bytes. "Perl is never executed" is retained only as secondary defense-in-depth.

### 11.2 CR-02 — explicit same-origin protection on the Route Handlers

The audit correctly noted that Next.js applies automatic Origin protection to Server Actions but **not** to custom Route Handlers. `apps/web/src/identity/csrf-guard.ts` now provides `assertSameOrigin()`, called as the first statement of both `POST /api/auth/select-tenant` and `POST /api/auth/logout` — before any session read, cookie write or sign-out. Cross-origin returns 403 and touches nothing.

The trusted origin is taken **only** from `NEXT_PUBLIC_APP_ORIGIN`. The request `Host`, `X-Forwarded-Host` and the client `Origin` are never used to derive it. **Reverse-proxy policy:** forwarded headers are deliberately ignored for security decisions; if PolyHunter is ever deployed behind a proxy, the proxy must pass the real origin and `NEXT_PUBLIC_APP_ORIGIN` must be set to the public origin. SameSite cookies remain defense-in-depth only.

Coverage: correct origin, `evil.example`, sibling subdomain, parent-lookalike subdomain, different protocol, different port, malformed, whitespace, `null`, missing, `Host` spoof, `X-Forwarded-Host` spoof — 43 unit cases, 33 handler cases and 13 live probes. **This bundle previously made no CSRF claim; it now states the protection explicitly and its actual mechanism.**

### 11.3 CR-03 — the active-tenant cookie write is awaited

`await writeActiveTenantSelection(resolution.tenantId)` now completes before the response is constructed, so a 200 always implies a written cookie. Tests prove the write is genuinely awaited (a held-open promise leaves the handler unsettled) and that foreign, suspended, inactive-tenant, malformed-selector, unauthenticated and provider-unconfigured paths never write it. Cookie attributes are captured through a mocked `next/headers`: `ph-active-tenant`, httpOnly, SameSite=Lax, path `/`, Secure in production and not Secure in development.

### 11.4 CR-04 — centralized trusted app origin, no hard-coded redirects

`apps/web/src/identity/app-origin.ts` is the single server-only source of truth. Every hard-coded `http://localhost` redirect in the auth callback (success/denied/invalid/failed) and in logout is gone; all now resolve through `appUrlFor()`, which builds from the configured origin and rejects anything that is not a relative path (`//evil.example`, absolute URLs, backslash forms, and any resolution whose origin differs from the configured one). `sanitizeReturnTo` validates against an RFC 2606 sentinel so no `localhost` literal remains in source.

Validation: must be an absolute URL; only `http`/`https` allowed; `https` is **required** when `NODE_ENV=production`; an absent or invalid production configuration throws `InvalidAppOriginError`, which `originMatchesTrusted` converts into a denial of every request. The origin is never derived from an arbitrary request `Host`.

Live proof that no literal remains — a one-off container with `NEXT_PUBLIC_APP_ORIGIN=http://configured-origin.test:4321`:

| | default origin | configured origin |
|---|---|---|
| callback `access_denied` redirect | `http://localhost:3000/?auth=denied` | `http://configured-origin.test:4321/?auth=denied` |
| `Origin: http://localhost:3000` | allowed (503 = passed guard) | **403 rejected as foreign** |

Changing only the configuration changed both behaviours, which a hard-coded literal could not do. `returnTo` stays a sanitized relative path; the open-redirect probe `?returnTo=https://evil.example&code=x` still lands on `/?auth=failed` on the configured origin.

### 11.5 Final security reconciliation

`receipts/cr01-revalidation/09-final-security-reconciliation.txt` and `receipts/cr01-revalidation/PH-M01-WO-002-VEX-FINAL.json`:

- 25 HIGH/CRITICAL rows on `sha256:eddda17a…cb7c` (21 HIGH, 4 CRITICAL).
- 22 carried over from PH-SEC-WO-007 (20) and PH-SEC-WO-008 (2); 3 analysed from scratch in this delta.
- **25 proposed `NOT_AFFECTED`, 0 approved.** Every row is `UNDER_INVESTIGATION`, with `approvalState.independentAuditor = null` and `ownerApproval = null`.
- Every justification is inside the ADR-0007 permitted set. No suppression, ignore, waiver or severity downgrade.

### 11.6 Validation chain after the corrections

Full receipt: `receipts/validation-gates.txt`.

| Gate | Result |
|---|---|
| `npm ci` | PASS, 0 vulnerabilities |
| `npm run format:check` | PASS (57 files) |
| `npm run lint` | PASS (57 files) |
| `npm run typecheck` | PASS, no diagnostics |
| `npm test` | **105 passed** (6 files) |
| `npm run build` | PASS |
| `npm audit --audit-level=high` | **0 vulnerabilities** |
| DB migrations from empty + integration | **14 passed** (2 files), disposable empty databases, re-application idempotent |
| `npm run db:migrate` (dev DB) | migrations applied |
| Runtime | postgres healthy, web healthy `HTTP 200`, worker running — all three app containers on `sha256:eddda17a…cb7c` |
| Container scan | SARIF on the FINAL digest, 80 rows, 25 HIGH/CRITICAL |
| Secret pattern scan | 0 real hits (the 3 matches are a comment and a negative test assertion) |
| Client bundle scan | 0 hits across 9 client chunks |
| `git diff --check` | clean |

One pre-existing test failure was found and fixed in passing: `tests/environment-example.test.ts` asserted an exact `.env.example` key set that commit `88bfa76` had already widened with `NEXT_PUBLIC_*` variables. Left alone it would have made CI red for a reason unrelated to these corrections.

Docker is left running as required: `polyhunter-postgres` healthy, `polyhunter-web` healthy on `127.0.0.1:3000`, `polyhunter-worker` up.
## 12. Receipt index

All paths are relative to `.engineering/evidence/PH-M01-WO-002/`.

**Correction delta — CR-01 revalidation on the FINAL digest**

| Receipt | Content |
|---|---|
| `receipts/cr01-revalidation/00-final-image-identity.txt` | FINAL digest, os/arch, user, entrypoint/cmd, scanner version |
| `receipts/cr01-revalidation/01-final-image-dpkg-inventory.txt` | 88-package Debian inventory, diffed byte-identical vs the WO-007 artifact |
| `receipts/cr01-revalidation/02-final-artifact-sha256.txt` | SHA-256 of `node`, `libstdc++.so.6.0.30`, `sharp-linux-x64-0.35.5.node`, `libvips-cpp.so.8.18.7` |
| `receipts/cr01-revalidation/03-final-perl-and-toolchain-packages.txt` | `perl`/`perl-modules` dpkg status; only `perl-base` installed |
| `receipts/cr01-revalidation/04-perl-archive-tar-absence.txt` | three independent proofs of `Archive::Tar` absence on the FINAL image |
| `receipts/cr01-revalidation/05-perl-bitness-ivsize.txt` | ELF64, `e_machine=0x3e`, `ivsize=8`, `LONG_BIT=64` |
| `receipts/cr01-revalidation/06-runtime-assumptions.txt` | uid, capabilities, privileged flag, ports, commands, process table, subprocess call sites |
| `receipts/cr01-revalidation/07-component-version-comparison.txt` | like-for-like SARIF row comparison, 80/80 identical |
| `receipts/cr01-revalidation/08-prior-row-revalidation.md` | six-axis verdict per carried-over row, quoting each prior proof |
| `receipts/cr01-revalidation/09-final-security-reconciliation.txt` | ledger of all 25 HIGH/CRITICAL rows and their policy status |
| `receipts/cr01-revalidation/PH-M01-WO-002-VEX-FINAL.json` | the VEX document itself — 25 findings, all `UNDER_INVESTIGATION` |
| `receipts/cr01-revalidation/analysis/*.cjs` | the scripts that generated 07, 08, 09 and the VEX — kept so the results are reproducible |
| `receipts/cr05-teardown-verification.txt` | CR-05 root cause, fix, leak-guard proof and repeated-run results |
| `receipts/final-validation.txt` | the final validation chain (npm ci, validate, audit, migrations, 8x integration, diff-check, secret scan, client bundle scan) plus the image-build-input proof for the unchanged digest |
| `receipts/cr07-auth-cache-headers.txt` | CR-07 contract, defect, fix, per-route coverage, tests, digest proof and VEX premise re-verification |
| `receipts/final-validation-cr07.txt` | the post-CR-07 validation chain (npm ci, validate, audit, migrations, auth tests, 5x integration, scans, diff-check) plus the image-build-input proof and VEX premise re-verification |

**Correction delta — CR-02 / CR-03 / CR-04 runtime and scans**

| Receipt | Content |
|---|---|
| `receipts/runtime/cr02-cr04-live-probes.txt` | 13 live CSRF probes + the configured-origin container comparison |
| `receipts/runtime/capture-cr02-cr04-probes.sh` | the script that produced the receipt above |
| `receipts/runtime/final-image-id.txt` | FINAL digest |
| `receipts/runtime/final-image-scan.sarif` | Docker Scout SARIF of the FINAL artifact |
| `receipts/validation-gates.txt` | the full post-correction validation chain |
| `receipts/client-bundle-secret-scan.txt` | credential scan of the built client bundle |
| `receipts/secret-leak-scan.txt` | credential scan of the tracked source tree |

**Original WO-002 delivery (still valid)**

| Receipt | Content |
|---|---|
| `receipts/supabase-source-check.md` | official Supabase docs/changelog re-check |
| `receipts/pinned-versions.json` | exact pinned dependency versions |
| `receipts/migration-hashes.txt` | migration / snapshot / journal SHA-256 |
| `receipts/runtime/fail-closed-probes.txt` | fail-closed probes with no provider credentials |
| `receipts/runtime/prior-image-id.txt` | superseded digest scanned by audit `5420502909` |
| `receipts/runtime/prior-image-scan.sarif` | SARIF of that superseded digest |
| `receipts/vex-delta-3-perl-cves.json` | first-pass proposals for the 3 Perl rows |
| `receipts/perl-cves-component-presence.txt`, `receipts/new-perl-cves-advisories.json` | Perl component presence and upstream advisory text |
| `receipts/validation-summary.txt` | original validation summary |

---

## 13. Second correction delta CR-05 / CR-06 (independent re-audit `5427078628`)

Audit verdict on `de18b34`: the Auth/RBAC architecture is **ACCEPTED**, CR-02/CR-03/CR-04 are **CLOSED**, and the CR-01 revalidation method is **ACCEPTED IN PRINCIPLE** — the independent auditor judged the objective-equivalence evidence for the prior 22 rows sufficient for revalidation, and accepted the technical basis of all three Perl findings. Two findings remained.

### 13.1 CR-05 — deterministic integration teardown

GitHub Actions Validate #57 (`37385950835`) failed at `de18b34` with `57P01 terminating connection due to administrator command` even though all 14 assertions passed (identity-rbac 10/10, tenancy 4/4).

**Root cause.** The serialized `pg` client in the failure carried the decisive state: `_ending: true, _ended: false, _connected: true, _txStatus: 'I'`. `pool.end()` *had* been called and awaited, but `pg` resolves `end()` once every client has been told to end — the socket teardown is asynchronous and the server-side backend stays attached for a short window afterwards. `DROP DATABASE … WITH (FORCE)` inside that window terminated a backend that was already on its way out; the dying client emitted `57P01` on a socket nobody was listening to. `FORCE` was therefore **masking a teardown race**, not describing a defect. Two distinct pools were implicated: a `createTenantDataAccess` pool (`application_name: 'polyhunter-server'`) and a bare `new Pool(...)` (`poolUseCount: 1`).

**Fix.** New shared fixture `packages/db/tests/support/postgres-disposable-databases.ts`:

1. every owned pool is closed **and awaited** in `afterAll` — the identity pool, the tenant pool and the test pool;
2. `waitForNoBackends()` polls `pg_stat_activity` until zero backends remain;
3. `dropDisposableDatabase()` then issues a plain `DROP DATABASE IF EXISTS`;
4. a wait timeout throws an explicit `RESOURCE LEAK` naming every offending backend (`pid`, `application_name`, `state`, `backend_type`, `query`) — a genuine leak is reported, never hidden;
5. `WITH (FORCE)` survives **only** in `preflightDropStaleDatabase()`, used at setup to clear debris from a previously interrupted run.

`identity-rbac.integration.test.ts` additionally moved its disposable migration pool into a `try/finally`, so a throwing migration can no longer leave a backend behind.

**Verification.** Before the fix the suite reproduced `57P01` on run 2 of 6. After the fix, **8 consecutive runs were clean** (exit 0, zero unhandled errors, 14/14). A throwaway probe confirmed the guard is not a no-op: an intentionally leaked connection was reported as `RESOURCE LEAK`, and once the pool was closed the drop proceeded normally. `grep -n 'WITH (FORCE)' packages/db/tests/` now matches only the preflight helper.

Receipt: `receipts/cr05-teardown-verification.txt`.

### 13.2 CR-06 — machine-readable VEX consistency

The three Perl rows carried the string `"no"` in `vulnerableCodePresent`, while the 22 carried-over rows used booleans — a type mismatch, and for `CVE-2026-8376` a semantic contradiction, since "code not present" cannot support a `vulnerable_code_cannot_be_controlled_by_adversary` justification.

All 25 rows now carry a strict boolean:

| CVE | `vulnerableCodePresent` | justification | coherence |
|---|---|---|---|
| CVE-2026-42496 | `false` | `vulnerable_code_not_present` | absent code, not-present disposition |
| CVE-2026-42497 | `false` | `vulnerable_code_not_present` | absent code, not-present disposition |
| CVE-2026-8376 | `true` | `vulnerable_code_cannot_be_controlled_by_adversary` | code present, adversary cannot reach it |

`CVE-2026-8376` is encoded `true` deliberately. `Perl_study_chunk`, the regular-expression compilation path named by the advisory, ships inside `perl-base` 5.36.0-7+deb12u3, which **is installed** on this artifact; claiming otherwise would have been the less honest option. What an attacker cannot do is reach its overflow condition:

- the advisory requires a **32-bit (ILP32)** Perl build;
- the artifact's perl-base is **amd64**, the kernel is **x86-64**;
- the interpreter's ELF header is **EI_CLASS=0x02 (ELF64)**, **e_machine=0x3e (x86-64)** — a 32-bit build cannot even be loaded;
- the interpreter reports **`ivsize=8`** bytes (64-bit IV), **`longsize=8`** (**LONG_BIT=64**), **`ptrsize=8`** bytes, `ivtype=long`, `use64bitint=define`;
- therefore no attacker-controlled input can drive the arithmetic into the vulnerable overflow condition.

"Perl is never executed in this container" is explicitly **not** part of this justification; it appears in receipt 06 only as secondary defense-in-depth.

The generator now **asserts** the invariants and fails rather than emitting an incoherent document: every `vulnerableCodePresent` is a boolean, every justification is inside the ADR-0007 set, `vulnerableCodePresent: false` is only ever paired with a not-present justification, every row is `UNDER_INVESTIGATION`, and `approvalState.independentAuditor` / `ownerApproval` are `null`.

### 13.3 Artifact digest is unchanged

Neither correction touched an image build input. `Dockerfile.dev` copies package manifests and tsconfig only — it does **not** bake the integration test source into the image — and this delta changed no manifest, dependency, base image, schema, migration or product source. Per the re-audit's own note, a test-only teardown fix therefore does not require a new digest and does not re-open the final artifact VEX.

Preserved and re-proved: **`sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`**. Had any image input changed, a rebuild, a new digest and a fresh VEX revalidation would have been mandatory.

### 13.4 Security state is unchanged by this delta

All 25 HIGH/CRITICAL rows remain **`UNDER_INVESTIGATION`** with **25 proposed `NOT_AFFECTED`** and **0 approvals**, bound to `sha256:eddda17a…cb7c`. The CR-06 fix changed the *encoding* of three rows to be truthful and machine-readable; it did not approve anything and it did not weaken a disposition. `approvalState.independentAuditor` and `ownerApproval` remain `null`, and no owner approval has been requested.


---

## 14. Third correction delta — CR-07 (independent audit `5427442224`)

Audit `5427442224` of `15a645e9504c002d4b5ae191b076d8b1582e405e` **closed CR-05 and CR-06** and
**accepted the technical basis of the 25 proposed `NOT_AFFECTED` dispositions**. Exactly one finding
remained: **CR-07**.

### 14.1 CR-07 — `@supabase/ssr` 0.12.7 auth-cookie cache headers

**The contract.** In `@supabase/ssr` 0.12.7 the server-side cookie contract is
`setAll(cookiesToSet, cacheHeaders)` — verified in
`node_modules/@supabase/ssr/dist/main/types.d.ts:23-58`. Whenever auth cookies are written the library
delivers a fixed anti-cache policy (`node_modules/@supabase/ssr/dist/main/cookies.js:505-509`):

```
Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0
Expires: 0
Pragma: no-cache
```

Those headers must accompany every response that may create, update or remove auth cookies —
otherwise a CDN or reverse proxy can store one user's session response and serve it to another.

**The defect.** `apps/web/proxy.ts` already forwarded the delivered object directly and correctly.
`apps/web/src/identity/supabase-adapter.ts` declared `async setAll(cookiesToSet)` and silently
discarded the second argument, so Route Handlers writing auth cookies emitted responses with no
anti-cache policy.

**The fix** (commit `0a76149`), server-only, explicit and concurrency-safe:

- **New `apps/web/src/identity/auth-cache-headers.ts`** centralizes the policy as a frozen constant
  (`AUTH_NO_STORE_HEADERS`) and exposes `applyAuthNoStoreHeaders(response)`, which applies the three
  headers, overwrites weaker pre-existing values and returns the same response for call-site
  chaining. The module holds **no mutable state** — a frozen constant plus a pure function that
  touches only the response it is given — so concurrent requests cannot interfere through it. A test
  applies it to 8 responses concurrently to prove this.
- **The adapter now declares `setAll(cookiesToSet, cacheHeaders)` explicitly** and routes the
  delivered object through `recordAuthCookieMutation`, which returns the centralized policy when it
  matches exactly and **throws on any drift** (a missing `no-store`, an extra header, a changed
  value). Drift therefore surfaces as a library-upgrade error instead of silently degrading to a
  weaker policy. The second argument is never pretended away.
- **The documented boundary.** The `next/headers` cookie store exposes no response handle, so the
  adapter's `setAll` *cannot* write headers to the outgoing response. Cookies are written through the
  cookie store; the anti-cache headers are **obligatorily applied by the Route Handler** through the
  centralized helper. Both halves of this boundary are stated in the source.
- **Routes covered** — the policy is applied unconditionally on *every* response path, not only the
  happy path:
  - `/api/auth/login` (PKCE initiation): 302 provider redirect, 503 provider unavailable,
    503 provider-redirect mismatch;
  - `/auth/callback`: 303 success, 303 denied, 303 invalid, 303 failed exchange;
  - `/api/auth/logout`: 303 sign-out redirect — previously set only `Cache-Control`, and now emits
    the full triple through the helper.
- **Tests** — `tests/auth-cache-headers.test.ts`, 16 cases: the helper itself (exact value, frozen,
  same instance, overwrite of weaker values, concurrent application), login (success and both 503s),
  callback (success / denied / invalid / failed, plus an absolute `returnTo` still collapsing to `/`
  to prove CR-04 survived the refactor), logout, and the adapter contract (accepts the delivered
  policy, throws on both drift shapes, empty storage-only delivery still yields the policy). Every
  response assertion compares the **exact** `Cache-Control` string, not a superset, because a
  present-but-weaker value is itself a session-leak vector. Suite total: **121/121**.
- **Refactor.** `login` and `auth/callback` were extracted into `handler.ts` modules matching the
  existing `select-tenant` / `logout` pattern so the policy is testable without a provider or a
  database; the route files keep only wiring. **CSRF (CR-02), RBAC, `TenantContext`, the
  open-redirect / trusted-origin behavior (CR-04), `apps/web/proxy.ts` and everything under
  `packages/` are unchanged.**

### 14.2 Coverage note

The library was also measured to call `setAll(x, {})` on its storage-only internal writes and to
forward the policy only on the first cookie write per client instance. That is why the server client
is created per request, and why the Route Handler policy is applied unconditionally rather than
relying on the library delivering headers on a particular call — a `setAll` that happens to receive
`{}` can still be part of a request whose response sets cookies.

### 14.3 Artifact digest is unchanged, and proved

CR-07 changed only TypeScript source, test files and test configuration. It did **not** touch
`package.json`, `package-lock.json`, `Dockerfile.dev`, `compose.yaml`, the base image, dependencies,
schema or migrations. `Dockerfile.dev` COPYs only the workspace package manifests and
`tsconfig.base.json`; verified empirically against the image itself:

```
docker run --rm --entrypoint sh polyhunter-dev:local -c "ls /workspace/apps/web/src"
-> NO apps/web/src in image
```

`compose.yaml` bind-mounts `./apps/web` over `/workspace/apps/web`, so web source is supplied at
runtime and is never baked into the image. `node_modules` *is* baked, so the installed package set is
pinned by the manifests — which did not change. **No rebuild was performed.** Preserved and re-proved:
**`sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`**, and the container scan
SARIF is byte-identical at
`sha256:9153fc1bf029b57ab285778c067f3b780504a13735558e3281369acc9991f3ff`.

### 14.4 CR-07 does not disturb any VEX premise

The 25 rows are container-scan findings carried across six equivalence axes: *component/package,
exact version, architecture, installed files, runtime assumptions,* and *prior proof assumptions*.
CR-07 adds no dependency, changes no version and touches no installed file, so no axis is reachable by
this delta. Two were nonetheless **re-measured live** precisely because CR-07 modified `apps/`
source, since the *runtime assumptions* axis includes source-level subprocess call sites:

- **subprocess call sites**: re-grepped `apps/` and `packages/` for
  `child_process` / `exec` / `execSync` / `spawn` / `execFile`, excluding build output ->
  **0 call sites**. Premise holds.
- **live containers**: uid `1000` (node) in both `web` and `worker`; `privileged=false`;
  `capadd=[]`; `capdrop=[]`; web published on `127.0.0.1:3000` only; worker unpublished; no `perl`
  process in either container.

Regenerating the VEX at the new head reproduced all 25 rows identically (22 preserved by reference,
3 new from CR-01); no row changed status, justification or `vulnerableCodePresent`.

### 14.5 Security state is unchanged by this delta

All 25 HIGH/CRITICAL rows remain **`UNDER_INVESTIGATION`** with **25 proposed `NOT_AFFECTED`** and
**0 approvals**. `approvalState.independentAuditor` and `ownerApproval` remain `null`, and **no owner
approval has been requested**. No suppression, ignore, waiver, accepted risk or severity downgrade
was used. The canonical `.engineering/CHECKPOINT.json` is untouched, the checkpoint delta remains
**`PROPOSED / NOT_PROMOTED`**, PH-M01-WO-003 was **not** started, and no merge was performed.

## 15. Independent audit and Project Owner approval

Final independent HIGH_ASSURANCE audit:
- audit head: `a4a0039512292aec38b19e78b37ebc716baac730`
- review: `5428454026`
- verdict: `APPROVED AS EVIDENCE + READY_FOR_OWNER_APPROVAL`

Project Owner approval:
- date: 2026-10-06
- artifact: `polyhunter-dev:local@sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`
- scope: exactly the 25 dispositions enumerated in `.engineering/evidence/PH-M01-WO-002/receipts/cr01-revalidation/PH-M01-WO-002-VEX-FINAL.json` at the audit head above
- receipt: `.engineering/evidence/PH-M01-WO-002-OWNER-APPROVAL.md`

ADR-0007 approval chain is complete for all 25 HIGH/CRITICAL rows on this exact artifact.

Current security state:
- 25/25 `NOT_AFFECTED`
- 0 `UNDER_INVESTIGATION`
- 0 `AFFECTED`
- no suppression, ignore, waiver, accepted-risk shortcut or severity downgrade

The checkpoint remains NOT_PROMOTED and PR #37 remains unmerged until a separate Project Owner merge/checkpoint decision.
