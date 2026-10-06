# PH-M01-WO-003 — Encrypted Secret Vault

Server-only encrypted secret vault. AES-256-GCM envelopes in PostgreSQL, a fail-closed
server-only keyring, tenant-bound authorization, a masked HTTP surface, atomic key
rotation and nonce-collision handling.

**STOP STATE: `READY_FOR_FINAL_INDEPENDENT_AUDIT`**

## Correction rounds

| Round | Review | Findings | State |
| --- | --- | --- | --- |
| 1 | `5430901717` | CR-01..CR-04 | CLOSED |
| 2 | `5431841905` | CR-05..CR-08 | CLOSED |
| 3 | `5432758271` | **CR-09..CR-10** | this round |

**The AES-256-GCM architecture remains accepted and was not revisited.**

### CR-09 — authoritative status window (this round)

The authority probe decided from `ph_membership.role` **plus** `ph_user.status` and
`ph_tenant.status`, but held only `FOR SHARE OF ph_membership`. Under READ COMMITTED a
concurrent user/tenant suspension could commit after the probe returned, and the vault
would continue its mutation or plaintext materialization on a stale decision.

**The fix.** The single probe statement now holds
`FOR SHARE OF ph_membership, ph_user, ph_tenant` — all three authority rows stable for
the whole transaction. One statement, deterministic order (membership → user → tenant,
matching the FROM/JOIN order), `authorize` as the **first statement** of every vault
transaction, and the vault is the only multi-row locker of these tables in the product
(the only other row lock is `FOR UPDATE` on `identity_links`), so the global lock order
into `encrypted_secrets` is never inverted and no wait cycle can form. No in-memory
mutex anywhere; the guarantee is a PostgreSQL property and holds across processes and
containers.

**Proven on independent connections** (`authoritative status window (audit CR-09)`, 2
tests against real PostgreSQL 17): for each of the four authority mutations — role
downgrade, membership suspension, user suspension, tenant suspension — the change
**blocks** (SQLSTATE `55P03` under an explicit `SET LOCAL lock_timeout`) while the
window is held, on **both** `withDecryptedSecret` (callback promise resolved from
inside the transaction) and a **mutation** (`replace`; a holder connection parks the
vault after `authorize`, synchronized via `pg_stat_activity`
`wait_event_type = 'Lock'` — no sleep decides any ordering point). After the vault
transaction ends, the queued change commits and the **next** operation fails closed
with `SECRET_FORBIDDEN`.

**Negative control:** with the pre-correction membership-only lock, both tests FAIL —
`user suspension was NOT blocked by the authority window` — while role downgrade and
membership suspension still pass, pinpointing exactly the half CR-02 had not closed.
Comments in `authorization.ts` and `vault/index.ts` were rewritten to the real
semantics. Receipt `23`, section 3.

### CR-10 — `CVE-2026-8376` canonical basis (this round)

The top level was correct after CR-05, but the **nested**
`preservedPriorBasis.justification` still carried the superseded
`vulnerable_code_not_in_execute_path`, seeded from the PRE-correction WO-002 delta file
— two incompatible justification axes in one machine-readable row.

**The fix.** Delta-sourced preserved bases are rebuilt from the canonical owner-approved
`PH-M01-WO-002-VEX-FINAL.json` and flagged `fromCanonicalFinal: true`; a delta-sourced
row without a canonical row is a hard stop at generation time. For `CVE-2026-8376`
every justification-bearing field now resolves to
`vulnerableCodePresent: true` + `vulnerable_code_cannot_be_controlled_by_adversary`,
with the canonical record's own evidence text as the preserved basis — the text that
states "Perl is never executed" is **not** part of the justification (it remains only
as explicitly-labelled secondary defence-in-depth).

**The gate now walks every nested field:** any string exactly equal to a VEX
justification enum anywhere in the row must equal the accepted justification; any
boolean `vulnerableCodePresent` at any nesting must equal the accepted value; a
WO-002-sourced preserved basis must be flagged canonical; a row may not register an
approval or leave `UNDER_INVESTIGATION`. **Both failure modes were observed to fail the
gate:** the historical delta-seeding mechanism, and the review's requested mutation of
a nested field back to `vulnerable_code_not_in_execute_path` (exactly one divergence
reported, for `CVE-2026-8376`, at
`$.preservedPriorBasis.justification (justification enum, nested scan)`). Receipt `23`,
section 4.

**Independent confirmation, three ways:** deterministic recursive scan over all 25 rows
→ 0 exact-enum mismatches vs the canonical record; JEV advisory classification → 25
CONSISTENT / 0 divergent (it flagged `CVE-2026-8376` before the fix and cleared it
after — a sensitivity check, receipt `24`); and the review's expected state:
**25 `UNDER_INVESTIGATION` / 25 proposed `NOT_AFFECTED` / 0 `AFFECTED` / 0
independent-auditor approvals / 0 owner approvals.**

### Previous rounds (CLOSED)

- **CR-01** source-first workspace exports remove the stale/untracked `dist` dependency
  (clean-checkout hermeticity).
- **CR-02** capability authority is the current `tenant_memberships.role` inside the
  transaction; divergence from `context.role` fails closed.
- **CR-03** `GET /api/secrets/[id]`, metadata only, no cross-tenant existence oracle.
- **CR-04** the VEX is a proposed-state machine; the executor proposes, it does not
  dispose.
- **CR-05** `CVE-2026-8376` restored to the accepted disposition semantics.
- **CR-06** raw decrypt/keyring primitives removed from the public package surface;
  the two vault subpaths deleted from `packages/db/package.json`.
- **CR-07** `Cache-Control: no-store` a mandatory default on every status, merged last
  so no call site can downgrade it.
- **CR-08** governance synchronised (real PR body, counts, digest, VEX state, Work
  Order header).

## Execution HEAD

| | |
| --- | --- |
| Audit target (code + tests + evidence) | `5905bc24f22b5d038d8cba86fb26eeec5686f5b9` |
| GitHub Actions Validate | run `37514172213` — **SUCCESS**, `Node 24 validation` job green |
| CodeRabbit | **success** on the same commit (review skipped while the PR is a draft — CodeRabbit's configured behavior, status green) |
| Governance base of this round | `0ee159f65fb3…` (revised JEV MCP policy) — run `37510790332`, green |
| Branch | `feat/ph-m01-encrypted-secret-vault` |
| Base | `main@af6235d2164171985af6152ba03835826ace3cdb` |
| Merge-base | `af6235d2164171985af6152ba03835826ace3cdb` — exact, zero drift |
| Artifact | `polyhunter-dev:local@sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2` — **PRESERVED this round** |
| JEV MCP | used through its actual installed server; inventory, calls, escalation and no-secrets statement in receipt `24` |

**No rebuild this round, and that is proven rather than assumed.** The delta touches
application source (bind-mounted), tests and evidence scripts only; the build-input
diff over the delta is empty (`git diff --name-only … | grep -E
"package\.json|package-lock|Dockerfile|compose|tsconfig"` → empty);
`docker inspect` reports the running image is still `aee3ad8c…`; premises P1, P2, P6
and P7 were re-measured against the new source. No new scan, no VEX reset.

Any commit after the audit target is **documentation-only** (recording the CI result
itself) and carries its own green run, kept current in this section.

**Other checks on this HEAD, recorded not suppressed:** Socket Security — pass.
SonarCloud Code Analysis — **failure, pre-existing**: it fails identically on the
previously audited heads (`a55ef18`, `59ae44b`, `36fdff8`) on "New Code" ratings, with
the same 10 issue instances (list recorded in the checkpoint delta). Two worth naming:
one hit is the local-dev `POSTGRES_PASSWORD` line transcribed inside a *superseded*
receipt (explicitly labelled non-production, untracked `.env` source), and the
"critical" sort rule is `Object.keys(...).sort()` on canonical key versions — default
sort is UTF-16 order, which is deterministic, while the rule's suggested
`localeCompare` would make it locale-dependent. None of the 10 is introduced by this
round; none is a tenant secret.

## Migration

`packages/db/drizzle/0002_encrypted_secrets.sql` creates `encrypted_secrets`, verified as created in the live PostgreSQL 17 database:

| Column | Type |
| --- | --- |
| `id` | `uuid` PK, `gen_random_uuid()` |
| `tenant_id` | `uuid`, explicit FK → `tenants(id)` `ON DELETE CASCADE` |
| `purpose` | `varchar(64)` |
| `ciphertext` / `nonce` / `auth_tag` | `bytea` |
| `key_version` | `varchar(32)` |
| `created_at` / `updated_at` / `rotated_at` (nullable) | `timestamptz` |

Constraints, all verified live:

```
encrypted_secrets_nonce_length             CHECK (octet_length(nonce) = 12)
encrypted_secrets_auth_tag_length          CHECK (octet_length(auth_tag) = 16)
encrypted_secrets_ciphertext_not_empty     CHECK (octet_length(ciphertext) > 0)
encrypted_secrets_purpose_canonical        CHECK (purpose ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$' AND length(purpose) >= 2)
encrypted_secrets_key_version_canonical    CHECK (key_version ~ '^[a-z0-9][a-z0-9_-]{0,31}$')
encrypted_secrets_key_version_nonce_unique UNIQUE (key_version, nonce)
```

Migrations applied twice — the second run is a **no-op, not an error** (this round: run
inside the integration fixture across two disposable databases, one of them migrated
twice on empty). **No `trading_accounts`, no Polymarket schema**:
`information_schema.tables` returns 0 tables matching `%polymarket%`, `%trading%` or
`%wallet%`.

## Crypto protocol

`node:crypto` only. No third-party crypto dependency; `package-lock.json` byte-identical to the locked base. No primitive implemented in-house.

| Parameter | Value | Anchor |
| --- | --- | --- |
| Algorithm | AES-256-GCM | key exactly 32 bytes, enforced |
| Key object | `createSecretKey` → `KeyObject` (`type=secret`) | preferred form required by the brief |
| Nonce / IV | 12 bytes from `crypto.randomBytes(12)` | NIST SP 800-38D §5.2.1.1 |
| Auth tag | 16 bytes, `authTagLength: 16` **passed explicitly** | SP 800-38D §5.2.1.2 |
| Nonce source | RBG, ≥96-bit random field | SP 800-38D §8.2.2 |
| Nonce uniqueness | per key, DB-enforced + bounded retry | SP 800-38D §8.2 |

**AAD** binds exactly `polyhunter-secret-envelope-v1`, `secretId`, `tenantId`,
`purpose`, `keyVersion`, serialized as a fixed-order JSON array of five strings.

## Keyring contract

- `POLYHUNTER_SECRET_ACTIVE_KEY_VERSION` — version used for writes and rotation targets
- `POLYHUNTER_SECRET_KEYRING_JSON` — `{"<keyVersion>": "<base64 raw 32-byte AES key>"}`

**NUNCA use: `NEXT_PUBLIC_*` para key material.** No `NEXT_PUBLIC_SECRET` /
`NEXT_PUBLIC_KEYRING` exists anywhere. Fails closed on **12** malformed-keyring shapes,
each with a dedicated integration test; every path raises the single generic
`VAULT_UNAVAILABLE`; no value, key or keyring text ever enters an error. `remove()`
consults the keyring too, so an unconfigured vault reports unavailable for **every**
operation. `.env.example` carries only variable **names** with empty values.

## API

`GET /api/secrets`, `POST /api/secrets`, `GET|PUT|DELETE /api/secrets/[id]`,
`POST /api/secrets/[id]/rotate`. Metadata only, field-by-field allow-list.

**PROIBIDO retornar: plaintext; ciphertext; nonce; auth tag; key; keyring; access token;
refresh token; comprimento do secret; last4/suffix derivado do secret.** All enforced.
No HTTP GET returns plaintext — there is no plaintext-read endpoint. Write responses
masked; no mutation echoes the request body. Same-origin CSRF guard on all 4 mutations.
Single-record `GET /api/secrets/[id]` (CR-03) returns the same projection and is
byte-identical for absent-id vs cross-tenant-id, so the 404 is not an existence oracle.
Every response on every status carries `Cache-Control: no-store` (CR-07), merged last
inside the two response factories.

**Error policy:** `VAULT_UNAVAILABLE`, `SECRET_NOT_FOUND`, `SECRET_FORBIDDEN`,
`SECRET_INTEGRITY_FAILURE`, `KEY_VERSION_UNAVAILABLE`, `NONCE_COLLISION`,
`INVALID_SECRET_INPUT`. Six unrecognized throws — including a raw `ECONNRESET`
carrying `connect ECONNRESET 10.0.0.5:5432` — all collapse to `VAULT_UNAVAILABLE`.

**Authorization:** capability is decided ONLY from the current
`tenant_memberships.role` in PostgreSQL, inside the mutation's own transaction, with
SHARE row locks on membership, user AND tenant (CR-02 + CR-09) — downgrade and
suspension both wait for the operation to end. Any divergence from `context.role`
fails closed in both directions. `member` and bare `platform_admin` are denied every
`secret:*` capability. The only plaintext path is
`withDecryptedSecret(context, purposeScopedHandle, callback)`, best-effort zeroed in a
`finally` (no claim of total heap cleansing).

## Test counts

| Suite | Result |
| --- | --- |
| Unit (host) | **189 passed / 10 files** |
| Integration in container, real PostgreSQL 17 | **53/53** — 39 secret-vault (incl. the 2 new CR-09 two-connection tests), 10 identity-RBAC (**WO-002 regression**), 4 tenancy (**WO-001 regression**) |
| `npm run validate` | exit 0 — lint, format, typecheck clean; Next.js 16.3.8 production build; **0 audit vulnerabilities** |

`npm ci` exit 0 on the host. `npm audit --audit-level=high`: 0. `git diff --check`:
clean.

## VEX on the final digest `aee3ad8c…`

`docker scout` v1.24.0, unfiltered. 82 rows scanned, **25 HIGH/CRITICAL**:

| Field | Value |
| --- | --- |
| `vexStatus = UNDER_INVESTIGATION` | **25** |
| `proposedVexStatus = NOT_AFFECTED` | **25** |
| `vexStatus = AFFECTED` | **0** |
| `independentAuditor` set | **0** |
| `ownerApproval` set | **0** |
| premises altered by this delta | 0 |
| rows diverging from the accepted WO-002 record (all nested fields) | **0** |

**The executor proposes; it does not dispose.** No NOT_AFFECTED is registered as
current approved state; every row carries `independentAuditor: null` and
`ownerApproval: null`. The WO-002 approvals were given on `eddda17a…` and **expired at
this digest** by the expiry rule.

Objective equivalence on `aee3ad8c…` (unchanged, since the digest is unchanged): the
88-package dpkg inventory diffs to **zero** against the WO-002 baseline; the four
native artifacts are **byte-identical** by SHA-256. The 2 added rows (vs WO-002) are
below HIGH/CRITICAL and outside this repository's dependency graph. Suppressions/ignore
rules/downgrades: **0**.

**Scan↔artifact binding** (CR-05..CR-08 round, still standing): the scout SARIF embeds
no image identity, so the binding is enforced from the scout stderr receipt (must name
the declared digest, or the generator refuses to write) and structurally proven by a
digest-pinned re-scan byte-identical to the committed scan (`md5 f30da92d…`).

**`CVE-2026-95619` keeps its specific proof:** the accepted aligned-allocation /
arithmetic-bound analysis (`sz ≤ 65519` vs a `2^64−3` threshold, margin ≥ `2^48`, with
the 16-bit JPEG `APP2` marker cap), reproduced verbatim per row. One honest limitation
is recorded: `nm`/`objdump`/`readelf` are not installed, so no symbol-presence claim is
made anywhere.

## Docker and scans (this round)

- Digest **preserved** (`sha256:aee3ad8c…`), stack healthy; web `GET /` → 200;
  `/api/secrets` → 401 `no-store`; `/api/secrets/<uuid>` → 401 `no-store`; **0
  module-resolution errors**; no rebuild, no new scan.
- Without a keyring the vault **FAILS CLOSED** (`VAULT_UNAVAILABLE` for every
  operation); the rest of the app stays healthy. Stack left running in the no-keyring
  state. (Previous round's ephemeral test-only keyring probe — create / decrypt /
  rotate / list / remove plus a refused cross-tenant handle — remains the recorded
  configured-path evidence; no test keys were ever written to the repository, a file,
  evidence or a log.)
- Secret scan of the delta: **0** base64-32-byte literals, **0** keyring values in the
  new/changed files. Full-tree loose-pattern hits are all pre-existing evidence of
  earlier security WOs (Go checksums, binary artifacts); the
  `POLYHUNTER_SECRET_KEYRING_JSON` pattern hits are the variable NAME with an EMPTY
  value (`=[]` / `=[<unset>]`).
- Client bundle: not re-run — the delta touches no client-reachable surface; the prior
  scan stands on the unchanged production bundle (0 vs non-zero across 12 patterns
  against the server-side positive control).

## JEV MCP execution (policy `.engineering/policies/JEV-PROMPT-POLICY.md`)

The actual locally installed JEV MCP server was used through its advertised schemas —
6 bounded calls, all recorded in receipt `24`: VEX semantic classification
(pre-fix flagged `CVE-2026-8376`, post-fix 25/25 consistent), delta file-kind
classification vs build inputs, evidence rerank, `jev_verify` on three bounded claims
(all verified), `jev_review` and a final `jev_gate` (6/6 completion claims verified;
both review calls returned `escalate` on conservative `safe_to_apply`, which is **not**
an approval and not cited as evidence of any security property). No JEV gate replaced a
deterministic check, a test or the independent audit. No secrets were sent to JEV.

## Stop state

- `.engineering/CHECKPOINT.json` **untouched** (blob
  `6c823956bd6013b51a6327718c8260acd5e39ef5`); checkpoint delta submitted as
  **PROPOSED / NOT_PROMOTED**.
- PR #39 **not merged**, remains draft. No owner approval requested. No PH-M01-WO-004.
- `liveTradingAuthorized` remains **`false`** — no order placed, no signing authority,
  no credential handled, no Polymarket surface touched.

### For the independent auditor

1. Re-run the CR-09 negative control (the pre-correction lock makes both tests fail —
   receipt `23`, section 3) and probe the lock ordering with a deliberately inverted
   transaction before accepting the written ordering argument.
2. Re-run the CR-10 controls (receipt `23`, section 4) and try to defeat the nested
   walk with a derived field shape the controls do not cover.
3. Confirm the CR-06 surface tests still hold (add a type-only export that masks a
   runtime one; re-point `./server/vault` at `envelope.ts`).
4. Confirm the CR-07 mandatory keys merge last and no call site constructs a response
   outside the two factories.
5. `CVE-2026-8376`: confirm every justification-bearing field reads from the canonical
   record and that "Perl is never executed" is never load-bearing.
6. `CVE-2026-95619`: confirm the basis is the arithmetic bound, not a generic sentence.
7. The digest-preservation argument: re-run the build-input diff and `docker inspect`;
   if any input is found to have changed, the VEX must be reset and revalidated on a
   fresh digest — the executor's claim is that none did.
