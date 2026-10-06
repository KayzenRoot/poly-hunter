# PH-M01-WO-002 — CODEX EXECUTION BRIEF

Repository: KayzenRoot/poly-hunter
Branch: `feat/ph-m01-identity-rbac`
Base: `main@cd3e00475f434be6c358fff89e82965370cc6c70`
Issue: #36
Risk: HIGH_ASSURANCE

## READ FIRST

1. `.engineering/work-orders/PH-M01-WO-002.md`
2. `.engineering/context-locks/PH-M01-WO-002.json`
3. `.engineering/modules/PH-M01-IDENTITY-TENANCY-SECRETS.md`
4. `.engineering/SECURITY.md`
5. `.engineering/ARCHITECTURE.md`
6. `.engineering/DATA-MODEL.md`
7. `.engineering/INTEGRATION-CONTRACTS.md`
8. `.engineering/TEST-BENCHMARK-PLAN.md`
9. ADR-0004, ADR-0005, ADR-0007

## PREFLIGHT

- Verify current branch and exact merge-base.
- Verify Context Lock fingerprints before mutation.
- Verify PR #15 is merged and canonical checkpoint is `M01_INCREMENT_IMPLEMENTED / STOP_AFTER_PH_M01_WO_001 / AWAIT_OWNER_DIRECTION`.
- Re-check current Supabase changelog/docs and current exact npm versions before installing packages.
- Use official Supabase docs, not remembered snippets.
- Confirm Next.js major/version in repository and apply the correct Next.js 16 `proxy.ts` convention.

## SUPABASE SOURCE RULES

- `@supabase/ssr` remains adapter-isolated.
- Use publishable/public key in browser-facing client configuration only.
- Never expose secret/service-role keys to browser/client bundles.
- Use verified server identity via `getClaims()` and/or `getUser()` as appropriate.
- Do NOT authorize from `getSession().user`.
- Do NOT authorize from `user_metadata`.
- Keep application persistence through `packages/db`; do not couple PolyHunter domain/repositories to Supabase Data API.

## IMPLEMENT

Implement only PH-M01-WO-002:
- provider-neutral IdentityPort/contracts;
- Supabase SSR browser/server/proxy adapter;
- minimal login/logout/callback shell;
- internal identity resolution and idempotent identity linking;
- platform_roles migration/repository;
- active tenant selector validated from current active membership;
- explicit owner/admin/member authorization + separate platform_admin authorization;
- sanitized `/api/me` or equivalent;
- adversarial tests and migration coverage.

Local Docker base startup must still work without real Supabase credentials. When credentials are absent, auth-dependent operations must fail closed/return an explicit unavailable state; never fabricate a user.

## SECURITY ATTACK CASES TO TEST

- forged user_id/tenant_id/role;
- user_metadata role injection;
- tenant cookie tampering;
- tenant A -> tenant B selection;
- revoked/suspended membership;
- member -> admin escalation;
- admin/owner -> platform_admin escalation;
- invalid/expired/spoofed session;
- provider/network ambiguity;
- open redirect in callback;
- token/password/auth-code leakage;
- duplicate/racing identity-link provisioning.

## VALIDATION

- migration apply on fresh disposable Postgres;
- existing WO-001 integration/isolation regression;
- new IdentityPort/RBAC/session tests;
- `npm ci`;
- `npm run validate`;
- `npm audit --audit-level=high`;
- rebuild exact dev image if dependencies changed;
- Docker Compose config/up/health;
- web HTTP 200;
- worker running;
- Postgres healthy;
- exact final container scan;
- dependency/security scan;
- secret-pattern/client-bundle leak check;
- `git diff --check`.

Any HIGH/CRITICAL finding is `UNDER_INVESTIGATION` and blocks unless FIXED or policy-complete VEX NOT_AFFECTED per ADR-0007. Do not suppress it.

## EVIDENCE / PR

Create/update:
- `.engineering/evidence/PH-M01-WO-002-EVIDENCE.md`
- `.engineering/checkpoint-deltas/PH-M01-WO-002.md` as PROPOSED / NOT_PROMOTED only
- any receipts needed under `.engineering/evidence/PH-M01-WO-002/`

Update the existing PR body with exact execution head, versions, tests, scans and STOP state.

## STOP CONDITIONS

`READY_FOR_INDEPENDENT_AUDIT` only if all requirements and security gates pass.

`BLOCKED_UNRESOLVED` if any HIGH/CRITICAL, auth/session ambiguity, tenant-isolation uncertainty, missing proof, or provider limitation remains.

`BLOCKED_STALE_CONTEXT` on Context Lock/merge-base drift.

Do not merge the PR.
Do not start PH-M01-WO-003.
Do not implement Vault, Polymarket or trading.

Final report in Brazilian Portuguese.
