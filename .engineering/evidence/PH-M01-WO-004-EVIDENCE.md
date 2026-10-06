# PH-M01-WO-004 — M01 Security Acceptance — Evidence

**Work Order:** PH-M01-WO-004 — M01 Security Acceptance
**Branch:** `feat/ph-m01-security-acceptance`
**PR:** #41 (Draft — **not merged**)
**Issue:** #40
**Base / merge-base:** `main@895e4bf2221b9fd7e335f0dd348be05f851fccde` (verified exact)
**Acceptance target:** the combined WO-001 + WO-002 + WO-003 implementation as a
system; this Work Order adds **no product capability**.
**Artifact (entering, preserved):**
`polyhunter-dev:local@sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2`
**Date:** 2026-10-06

**STOP STATE: `READY_FOR_FINAL_M01_INDEPENDENT_AUDIT`**

`liveTradingAuthorized` remains `false`. PR #41 is not merged, the checkpoint is not
promoted, no owner approval is requested, and no PH-M02 surface was touched.

---

## 0. PREFLIGHT (all deterministic, all green)

| Check | Expected | Observed |
| --- | --- | --- |
| Branch | `feat/ph-m01-security-acceptance` | checked out from origin |
| Merge-base vs `origin/main` | `895e4bf…` | `895e4bf…` (exact) |
| Context Lock fingerprints | workOrder + 17 frozenSources + 8 runtimeFingerprints | **26/26 OK** via `git hash-object` |
| CHECKPOINT | `STOP_AFTER_PH_M01_WO_003 / AWAIT_OWNER_DIRECTION` | match (phase `M01_INCREMENT_IMPLEMENTED`, completedThrough `PH-M00`) |
| PR #39 | MERGED as `895e4bf2221b9fd7e335f0dd348be05f851fccde` | MERGED, mergeCommit matches |
| main Validate #88 | SUCCESS on `895e4bf` | run `37518179390`, SUCCESS, `Node 24 validation` green |
| JEV MCP | healthy, live inventory | `[jev-mcp] ready — model jev-latest`; 12 tools discovered (receipt `05`) |

---

## 1. ACCEPTANCE RESULTS (obligations A–L)

Every obligation is mapped to concrete evidence in the machine-readable matrix:
**`.engineering/evidence/PH-M01-WO-004/acceptance-matrix.json`** — 37 rows, each with the
exact test title or receipt path, result `PASS`, the execution head, the artifact, a
residual-gap field and reviewer state (`PENDING_INDEPENDENT_AUDIT`). No row is PASS
without a named test or receipt.

New this round: `packages/db/tests/m01-acceptance.integration.test.ts` — 12 tests on
real PostgreSQL 17 covering the integrated system, not the projections:

| Obligation | Coverage (examples) |
| --- | --- |
| A. Cross-tenant matrix | full 7-operation matrix from tenant A against tenant B's records with a byte-identical after-snapshot of B's row; ids are not authority (direct id substitution, handles, malformed shapes); absent vs foreign id produce identical null/code/message; `TenantDataAccess` selector attacks; unissued context refused |
| B. Privilege escalation | every forged role pair at every vault surface; `platform_admin` without membership; provider-input role injection (smuggled `role`/`user_metadata` provisions a plain user, platform role only from `platform_roles`); downgrade and membership/user/tenant suspension revoke the next operation |
| C. Session / tenant selection | active-membership resolution incl. invited/suspended membership, suspended user/tenant, foreign/malformed selectors (no default fallback); one user switching between two valid tenants with zero cross-contamination; unit boundary suites for CSRF/origin/redirect/cache |
| D. Authorization concurrency | the two CR-09 two-connection tests re-run in this round (65/65 suite) plus a new lock-health probe: interleaved rotations × role flips × reads complete without a 40P01 cycle and end consistent |
| E. Envelope adversarial | the vault crypto suite and vault integration suite (tamper/AAD/nonce/wrong-key/missing-key; no-store matrix; public-boundary and single-plaintext-path tests) |
| F. Canary containment | a runtime-only high-entropy canary is absent from console output, error text, metadata, **every column of every table** and **every file of the working tree** (chunked byte scan); delta secret scan clean; keyring hygiene tests |
| G/H. Recovery + rotation drills | receipt `01` — full disposable pg_dump/pg_restore cycle and v1→v2 rotation (below) |
| I. Migrations | empty + repeat no-op in the acceptance fixture, the drill and the WO-001 suite; historical migrations untouched |
| J. Clean Docker acceptance | receipt `02` (below) |
| K. Static gates/scans | receipt `03` (below) |
| L. VEX | entering state verified; digest preserved; premises re-measured (below) |

**Full suites on this delta:** unit **189/189** (`npm run validate` exit 0, 0 audit
vulnerabilities, production build OK) and PostgreSQL integration **65/65** across four
files — 39 secret-vault (incl. the CR-09 two-connection window), 12 m01-acceptance,
10 identity-RBAC (**WO-002 regression**), 4 tenancy (**WO-001 regression**).

## 2. RECOVERY / ROTATION DRILL (obligations G + H) — receipt `01`

`.engineering/evidence/PH-M01-WO-004/harness/recovery-rotation-drill.sh` +
`drill-vault.mjs`, all inside a disposable database, with ephemeral keys passed to the
container only over the exec **stdin** pipe (never argv, env, file or log):

1. empty DB → migrations applied; **repeat run = no-op**;
2. seeded two tenants through the admitted Vault path (`create`, isolation check,
   authorized `withDecryptedSecret` OK);
3. `pg_dump -Fc` (17,358 bytes) → **DROP DATABASE** → fresh DB → `pg_restore` (exit 0);
4. re-applied migrations on the restored DB (roll-forward guidance; already at 3);
5. post-restore: metadata intact; **tenant B sees `null` for tenant A's record** (no
   oracle); an unmapped context is refused `SECRET_FORBIDDEN`; the authorized callback
   decrypts the canary with ephemeral v1; the envelope hash is **byte-stable across
   backup/restore**;
6. with **k1 absent** from the keyring: decrypt fails closed `KEY_VERSION_UNAVAILABLE`
   and the envelope hash is unchanged (**no corruption**);
7. re-introduce k1, active **v2**, `rotate` → status `rotated`, envelope hash
   **changes** (`d3979b01…` → `b5bb57e4…`), identity metadata
   (`purpose`/`tenant_id`/`created_at`) **stable**, and a **k2-only** keyring decrypts
   the rotated envelope == the canary;
8. cleanup: database dropped, dump removed, keys/canary discarded. No key material or
   canary value appears anywhere in the transcript.

## 3. CLEAN DOCKER ACCEPTANCE (obligation J) — receipt `02`

No stale `packages/**/dist` or `.next`; `npm ci`; compose down/up on the **canonical
image**; postgres + web healthy, worker running; `GET /` 200; `/api/secrets` and
`/api/secrets/<uuid>` 401 with `Cache-Control: no-store`; `/api/me` 401; **0
module-resolution errors** in either service.

Vault probes (in-container, keys in memory only): **without a keyring** `isConfigured()
= false` and every operation fails closed `VAULT_UNAVAILABLE` while the rest of the app
is healthy; **with an ephemeral test-only keyring** the admitted path works end-to-end
(create → decrypt → rotate → list → remove) and a **cross-tenant handle is refused**
`SECRET_FORBIDDEN`; probe rows are deleted afterwards.

**Recorded, not hidden:** a rebuild of the *same* inputs into a separate tag produced a
different image id (`40782d8c…` vs the canonical `aee3ad8c…`) — this Docker recipe is
not bit-reproducible. No build input changed in WO-004, the canonical tag and digest
were never re-pointed, and the artifact of record (with its VEX approvals) is
unaffected; the observation is a reproducibility note, not an artifact-delta event.

## 4. STATIC GATES AND EXACT-ARTIFACT RECONCILIATION (obligation K) — receipt `03`

`npm run validate` exit 0 (lint/format/typecheck, 189 unit tests, production build,
**0 vulnerabilities**); `npm audit --audit-level=high` 0; `git diff --check` clean;
client bundle **0 across 15 patterns** in `.next/static` against a **non-zero
server-side control**; delta secret scan **0 keyring values / 0 base64-32-byte
literals**.

**Exact artifact:** a fresh `docker scout` scan of `polyhunter-dev:local` is
**byte-identical** to the committed WO-003 scan (`md5 f30da92d…`): 82 rows, **0 added,
0 removed, 25 HIGH/CRITICAL** — the artifact the VEX is bound to has not moved.

**P2 premise re-measured:** `git ls-files apps packages tests` (code extensions) = 56
files after this round (55 before; the new acceptance test adds one), **0** matching
`child_process|execSync|spawnSync|execFile|spawn(` — the acceptance suite itself
contains no subprocess primitive (the repository walk uses `node:fs`).

## 5. JEV MCP EXECUTION (mandatory) — receipt `05`

The locally installed JEV MCP was confirmed healthy at preflight; the live inventory
(12 tools) was discovered and recorded; six bounded calls were made and are logged with
their purposes, results, token usage and escalations in
`receipts/05-jev-mcp-execution.txt`. Highlights: the obligation→evidence classification
returned **36/37 EVIDENCE_SPECIFIC** and flagged row **L3** as `EVIDENCE_WEAK` — whose
first citation pointed at a document that did not yet exist — and L3 was **corrected**
to cite the existing machine-readable `suppressionPolicy` block and the fresh scan
receipt; three bounded claims were **verified** (0.93 / 0.99 / 1.00); the final gate
initially reported one **unsupported** claim because the per-file test breakdown was
missing from the supplied evidence, and on the corrected evidence it returned **6/6
verified / 0 contradicted / 0 unsupported** (both runs recorded). The diff pre-review
and both gate review halves **escalated conservatively** on `safe_to_apply` (recorded
as-is; never treated as an approval and never cited as evidence of a security
property). No secrets — no canary, keyring, key, token or credential — were sent to
JEV at any point.

## 6. VEX (obligation L)

Entering approved artifact `sha256:aee3ad8c…` with **25 NOT_AFFECTED / 0
UNDER_INVESTIGATION / 0 AFFECTED** and independent audit + owner approval bound to that
exact digest (`PH-M01-WO-003-OWNER-APPROVAL.md`, review `5433259153`,
`59945ea…`).

WO-004 changes **no Docker build input** (test + harness + evidence only), so no
artifact-delta event occurs: the digest, the scan and the approvals stand. The premises
affected by the delta were re-measured rather than assumed (P2 above; no dependency,
native artifact or caller-input surface changed). Suppressions 0, ignore rules 0,
severity downgrades 0. The executor proposes nothing and approves nothing.

## 7. RECEIPTS

| Receipt | Contents |
| --- | --- |
| `01-recovery-rotation-drill.txt` | disposable backup/destroy/restore + v1→v2 rotation transcript (no key material printed) |
| `02-docker-clean-acceptance.txt` | clean-tree npm ci, separate-tag rebuild + identity comparison, compose down/up, HTTP probes, fail-closed + ephemeral-keyring vault probes, module sweep |
| `03-static-gates-scans.txt` | validate/audit/diff-check, bundle scan with positive control, P2 recount, exact-artifact scan identity (md5), delta secret scan |
| `04-*` (if produced) | additional captures referenced from the matrix |
| `05-jev-mcp-execution.txt` | JEV MCP health, live inventory, every call with purpose/result/escalation, no-secrets statement |
| `harness/recovery-rotation-drill.sh`, `harness/drill-vault.mjs` | the drill itself (committed for reproducibility; keys via stdin only) |
| `harness/docker-acceptance.sh`, `harness/docker-probe.mjs` | the Docker acceptance itself (keys in-process memory only) |
| `acceptance-matrix.json` | the 37-row machine-readable acceptance matrix |

## 8. AUDIT REQUEST

`READY_FOR_FINAL_M01_INDEPENDENT_AUDIT`.

The audit target is the tip of `feat/ph-m01-security-acceptance` after this round's
commits; GitHub Actions Validate and CodeRabbit must be SUCCESS on that exact commit,
and the run IDs and SHAs are recorded in the real PR #41 body (a SHA written into a
file cannot name the commit that carries the file).

Points an auditor should weigh most heavily:

1. **The acceptance suite is the delta** — it contains no product change. Confirm that
   claim from the diff itself (only test/harness/evidence files), then attack the tests:
   the cross-tenant matrix, the no-oracle equality, and the deadlock probe (which
   asserts invariants, never timings).
2. **The drill's key discipline** — keys and canary travel only over stdin/in-process
   memory; verify from the harness sources that no path can persist them, then re-run
   the drill and compare the envelope-hash transitions.
3. **The L3 correction** — a citation that pointed at a not-yet-existing document was
   caught by JEV advisory classification and corrected; confirm the replacement
   citations resolve to real content.
4. **The rebuild non-reproducibility observation** — decide whether it warrants a
   follow-up (it is recorded, not suppressed; the artifact of record is unchanged).
5. **The VEX has nothing new to approve here** — the digest did not move; confirm the
   entering approvals are correctly bound and that WO-004 added no suppression.
