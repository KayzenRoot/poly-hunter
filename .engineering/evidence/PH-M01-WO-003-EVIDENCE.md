# PH-M01-WO-003 — Evidence

**Work Order:** PH-M01-WO-003 — Encrypted Secret Vault
**Branch:** `feat/ph-m01-encrypted-secret-vault`
**PR:** #39 (Draft — **not merged**)
**Issue:** #38
**Locked base:** `af6235d2164171985af6152ba03835826ace3cdb`
**Round:** correction round for CR-05..CR-08 of independent audit review `5431841905`
(raised against HEAD `a55ef185b135f2ab8e7593989e63c90f5be2af49`; CR-01..CR-04 CLOSED)
**Final artifact:** `sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2`
**Executor:** Codex (sole implementation/test/CI/migration executor)
**Date:** 2026-10-05 / 2026-10-06

**STOP STATE: `READY_FOR_FINAL_INDEPENDENT_AUDIT`**

`liveTradingAuthorized` remains `false`. No order was placed, no signing authority
exercised, no credential handled, no owner approval requested, PR #39 not merged,
checkpoint not promoted, and no Polymarket surface touched.

> **AES-256-GCM is accepted and was not revisited.** This round narrows a public
> API, restores a VEX justification the audit found had been rewritten, makes an
> already-intended cache policy structural, and synchronises governance records.
> It does not touch the cryptographic design.

### What this round changed

| CR | Finding | Resolution |
| --- | --- | --- |
| **CR-05** | `CVE-2026-8376` was restated as `vulnerable_code_not_in_execute_path` ("Perl is never executed"), a semantic regression from the owner-approved WO-002 disposition `vulnerableCodePresent: true` + `vulnerable_code_cannot_be_controlled_by_adversary`. | Semantics restored. "Perl is never executed" retained **only** as explicitly-labelled secondary defence-in-depth. A mechanical gate now **throws** before writing output if any of the 25 rows diverges from the accepted record — verified by two negative controls. |
| **CR-06** | `@polyhunter/db/server/vault` re-exported `openSecret`, `sealSecret`, `VaultKeyring`, keyring resolvers and helpers, and `packages/db/package.json` published `./server/vault/envelope` and `./server/vault/keyring` — a generic raw-decrypt side door outside the audited boundary. | Public surface narrowed to `createSecretVault`, the `SecretVault`/`RotateOutcome`/`SecretVaultOptions` types, two type-only re-exports and the two non-sensitive configuration variable **names**. Both subpath exports removed. Crypto tests moved to test-only relative imports. A new workspace-boundary test fails if a raw primitive becomes publicly exportable again. |
| **CR-07** | `errorResponse()` could emit a response with no cache directive, leaving the policy to framework defaults on every non-success status. | `no-store` is now a **mandatory default** applied inside the two response factories, with the mandatory keys merged last so no call site can downgrade it. `Pragma: no-cache` and `Expires: 0` added for legacy intermediaries. 20 new tests covering 400/403/404/500/503, 401/403 access refusals and the CSRF 403. |
| **CR-08** | Governance records were stale: PR body, test counts, artifact digest, VEX state, Work Order lifecycle header. | Real PR #39 body updated via `gh`; Work Order header moved to `EXECUTED / READY_FOR_INDEPENDENT_AUDIT`; evidence, checkpoint delta and receipts synchronised with the new digest. `.engineering/CHECKPOINT.json` **untouched**. |

The previous round's claim that a forged context is structurally refused remains
**withdrawn**; that behaviour is proven by the CR-02 tests, not asserted.

---

## 1. PREFLIGHT

Every PREFLIGHT item was GREEN before the first mutation.

| Check | Expected | Observed |
| --- | --- | --- |
| Branch checked out from origin | `feat/ph-m01-encrypted-secret-vault` | yes |
| merge-base == locked base | `af6235d…` | `af6235d…` (exact) |
| Context Lock fingerprints | 30/30 OK via `git hash-object` | 30/30 OK |
| PR #37 | `state=MERGED` | MERGED (2026-10-06T12:59:20Z) |
| Validate run #68 | SUCCESS | SUCCESS |
| CHECKPOINT `phase` | `M01_INCREMENT_IMPLEMENTED` | match |
| CHECKPOINT `stopState` | `STOP_AFTER_PH_M01_WO_002` | match |
| CHECKPOINT `nextLegalStage` | `AWAIT_OWNER_DIRECTION` | match |
| `liveTradingAuthorized` | `false` | `false` |
| CHECKPOINT blob | `6c823956bd6013b51a6327718c8260acd5e39ef5` | match |

Re-verified after all edits — see receipt `09-context-lock-reverification.txt`:
**frozenSources 17/17 byte-identical** (so no `BLOCKED_STALE_CONTEXT`), and the only
4 mutated runtime fingerprints are the exact surfaces this Work Order was admitted to
change.

---

## 2. CRYPTOGRAPHIC PROTOCOL

Exclusive use of the Node built-in `node:crypto` module. **No third-party crypto
dependency was added** and no cryptographic primitive was implemented in-house.
`package-lock.json` is byte-identical to the locked base.

| Parameter | Value | Anchor |
| --- | --- | --- |
| Algorithm | AES-256-GCM | key exactly 32 bytes, enforced |
| Key object | `createSecretKey` → `KeyObject` (`type=secret`, symmetric) | preferred form required by the brief |
| Nonce / IV | 12 random bytes from `crypto.randomBytes(12)` | NIST SP 800-38D §5.2.1.1 (96-bit IV) |
| Auth tag | 16 bytes, `authTagLength: 16` passed explicitly | SP 800-38D §5.2.1.2 (t ∈ {128,…}) |
| Nonce source | RBG with ≥96-bit random field | SP 800-38D §8.2.2 |
| Nonce uniqueness | enforced per key by the DB, plus retry | SP 800-38D §8.2 |

### AAD — mandatory binding

The AAD binds exactly these five values, serialized as a fixed-order JSON array of five
strings (deterministic and unambiguous — no key-order or separator ambiguity):

```
polyhunter-secret-envelope-v1 | secretId | tenantId | purpose | keyVersion
```

A ciphertext transplanted to another tenant, `secretId`, `purpose` or `keyVersion`
therefore fails authentication, because the receiving party reconstructs the AAD from
its own authoritative values and the tag no longer verifies. Proven two ways in
`packages/db/tests/secret-vault.integration.test.ts`:

- re-pointing tenant A's row at tenant B → `SECRET_INTEGRITY_FAILURE`, then restored;
- physically copying the envelope bytes onto another tenant's row → `SECRET_INTEGRITY_FAILURE`.

---

## 3. KEYRING CONTRACT (server-only)

Two environment variables, consulted only inside the guarded
`packages/db/src/server/vault/keyring.ts`:

- `POLYHUNTER_SECRET_ACTIVE_KEY_VERSION` — the canonical version used for writes and rotation targets;
- `POLYHUNTER_SECRET_KEYRING_JSON` — `{"<keyVersion>": "<base64 raw 32-byte AES key>"}`.

**NUNCA use: `NEXT_PUBLIC_*` para key material.** Next.js inlines every `NEXT_PUBLIC_*`
variable into the browser bundle; the keyring is deliberately not under that prefix, and
no `NEXT_PUBLIC_SECRET` / `NEXT_PUBLIC_KEYRING` name exists anywhere (asserted in
`tests/secret-material-containment.test.ts`).

**Fail-closed on 12 malformed-keyring shapes**, each proven by a dedicated integration
test: invalid JSON, non-object keyring, empty keyring, non-canonical key version,
non-string value, non-strict base64 (decode-then-re-encode round trip), wrong decoded
key length, absent active version, active version absent from the keyring, unknown
version lookup (`KEY_VERSION_UNAVAILABLE`), and more. Every path raises the single
generic `VAULT_UNAVAILABLE`; no value, key or keyring text is ever included in an error.

**`remove()` consults the keyring too.** Deleting needs no key material, but an
unconfigured vault must fail closed for *every* operation — otherwise a delete would
succeed while the rest of the vault reported unavailable, which is a confusing partial
outage.

`.env.example` contains only the variable **names** with empty placeholders. Local Docker
starts healthy with no keyring; proven both ways in receipts 03 and 06.

---

## 4. DATABASE

`packages/db/drizzle/0002_encrypted_secrets.sql` creates `encrypted_secrets`, verified
as actually created in the live PostgreSQL 17 database (receipt `08`):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `tenant_id` | `uuid` | explicit FK → `tenants(id)`, `ON DELETE CASCADE` |
| `purpose` | `varchar(64)` | |
| `ciphertext` | `bytea` | |
| `nonce` | `bytea` | |
| `auth_tag` | `bytea` | |
| `key_version` | `varchar(32)` | |
| `created_at` / `updated_at` | `timestamptz` | |
| `rotated_at` | `timestamptz` | nullable |

Constraints, all verified against the live database:

```
encrypted_secrets_nonce_length             CHECK (octet_length(nonce) = 12)
encrypted_secrets_auth_tag_length          CHECK (octet_length(auth_tag) = 16)
encrypted_secrets_ciphertext_not_empty     CHECK (octet_length(ciphertext) > 0)
encrypted_secrets_purpose_canonical        CHECK (purpose ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$' AND length(purpose) >= 2)
encrypted_secrets_key_version_canonical    CHECK (key_version ~ '^[a-z0-9][a-z0-9_-]{0,31}$')
encrypted_secrets_key_version_nonce_unique UNIQUE (key_version, nonce)
```

The `UNIQUE (key_version, nonce)` index is the **second, database-level barrier against
nonce reuse**, independent of the application retry loop.

Migrations were applied twice in a row: the second run is a no-op, not an error.

**Não criar: `trading_accounts` nem qualquer schema de Polymarket.** Verified by query
against `information_schema.tables`: **0** tables matching `%polymarket%`, `%trading%`
or `%wallet%`.

---

## 5. AUTHORIZATION

> **REWRITTEN for audit CR-02.** The previous text of this section asserted that
> "a forged context is structurally refused", justified by a shape check on
> `context.role` followed by a membership-existence probe. That assertion was
> wrong in a way an auditor would be right to reject: the shape check decided the
> capability and the probe merely confirmed a row existed, so a caller-supplied
> `role` field was effectively the authority. It is withdrawn. The behaviour it
> described is now *tested*, not asserted, and the authority is the database.

### The rule

A capability decision is taken **only** from the current authoritative
`tenant_memberships.role` row in PostgreSQL. `context.role` carries no authority;
it is used only as a consistency assertion, and **any divergence fails closed**.

Four things must hold simultaneously, all read inside the same transaction that
performs the mutation:

1. the authenticated user exists and is `ACTIVE`;
2. the tenant exists and is `ACTIVE`;
3. the membership exists and is `ACTIVE` (not `invoked`, `suspended`, deleted);
4. the `role` read is the **current** one, held under a row lock.

### Capability matrix

| Capability | `owner` | `admin` | `member` | `platform_admin` without current tenant owner/admin |
| --- | --- | --- | --- | --- |
| `secret:metadata` | allow | allow | **DENY** | **DENY** |
| `secret:write` | allow | allow | **DENY** | **DENY** |
| `secret:delete` | allow | allow | **DENY** | **DENY** |
| `secret:rotate` | allow | allow | **DENY** | **DENY** |

`platform_admin` alone is denied — platform scope does not imply tenant scope.

### How TOCTOU is closed (SEC-022)

The role probe runs inside the vault's own transaction and ends with

```sql
FOR SHARE OF ph_membership
```

`FOR SHARE` blocks any concurrent `UPDATE tenant_memberships SET role = ...` for
the lifetime of that transaction. This is a **database property**, so it also
holds against a second vault process in another container — which an in-process
mutex could never provide, and which CR-02 explicitly forbade. `OF ph_membership`
restricts the lock to the membership row, so `users` and `tenants` are read-only
and no deadlock with tenant administration can arise.

All seven operations take the lock in the same order (membership `SHARE` → secret
row `UPDATE`/`FOR UPDATE`), so lock ordering is consistent and concurrent
rotations still serialize correctly rather than deadlocking.

Every mutation authorizes as the **first statement** inside its transaction —
before the row lock, before any read of secret material.

### Mandatory tests — all against real PostgreSQL

`packages/db/tests/secret-vault.integration.test.ts`, describe block
`authoritative role (audit CR-02)`, 5 tests. Each drives **all seven** operations
(`listMetadata`, `getMetadata`, `create`, `replace`, `remove`, `rotate`,
`withDecryptedSecret`):

| Test | Adversary | Required result | Actual |
| --- | --- | --- | --- |
| forged `owner` over a real `member` membership | structurally valid context, same user + tenant, `role: "owner"` | every op `SECRET_FORBIDDEN` | PASS |
| forged `admin` over a real `member` membership | as above with `role: "admin"` | every op `SECRET_FORBIDDEN` | PASS |
| stale downgrade | context resolved as owner/admin, membership changed to `member` **before** the vault call | every op denies on the NEW role, with no context re-issuance | PASS |
| role mismatch, both directions | DB says `member`, context says `owner`; and the reverse | no privilege widening in either direction | PASS |
| platform role | `platform_admin` with no current owner/admin tenant membership | continues to `DENY` | PASS |

The forged-context tests are built so the forged context points at a tenant that
contains a **genuine encrypted row** the caller must not be able to read — the
test would fail loudly if the forged context could read it, rather than passing
because the tenant was empty.

Access is revoked on the **next authoritative request** after any of: suspended
user, suspended membership, suspended tenant. Also covered: `invoked` and deleted
membership.

---

## 6. API

Minimal surface, masked. `GET /api/secrets`, `POST /api/secrets`,
`GET|PUT|DELETE /api/secrets/[id]`, `POST /api/secrets/[id]/rotate`.

Metadata may carry `id`, `purpose`, `configured`, timestamps and non-sensitive rotation
status. The projection is an **allow-list applied field by field**, so a widened upstream
object cannot leak through.

**PROIBIDO retornar: plaintext; ciphertext; nonce; auth tag; key; keyring; access token;
refresh token; comprimento do secret; last4/suffix derivado do secret.** All enforced.

- **No HTTP GET returns plaintext** — there is no plaintext-read endpoint at all; the
  service contract is asserted not to contain `withDecryptedSecret` or `getPlaintextSecret`.
- Write responses are masked; no mutation echoes the request body.
- Every response is `no-store` — see the CR-07 subsection below, which is where this
  stopped being a convention and became a mandatory default.
- Same-origin CSRF guard on all 4 mutations: 6 cross-origin values plus a missing `Origin`
  header are all rejected with 403 `cross_origin_rejected` before the service is touched;
  the trusted origin is accepted. `GET` requires no origin.

### `Cache-Control: no-store` on every status (audit CR-07)

**The defect.** `NO_STORE_HEADERS` existed but was passed at eleven separate call
sites, and `errorResponse()` — the helper every non-success status goes through —
took headers as an *optional* argument and emitted the response without them when
none were given. `VAULT_UNAVAILABLE`, `SECRET_FORBIDDEN`, `SECRET_NOT_FOUND`,
`SECRET_INTEGRITY_FAILURE` and `INVALID_SECRET_INPUT` could therefore reach a
client with no cache directive at all, leaving the policy resting on whatever
Next.js or an intermediary defaults to. A cached error is not a lesser problem
than a cached success: a 404 is an existence oracle and a 503 can carry a reason.

**The fix is structural, not a convention.** Two factories now exist and every
response in the file goes through one of them:

- `jsonResponse(body, status, headers?)` — merges the mandatory set with the
  caller's, **mandatory keys last**, so a call site cannot downgrade the policy by
  passing its own `Cache-Control`;
- `errorResponse(code, headers?)` — delegates to `jsonResponse`.

All 11 former direct `NextResponse.json` call sites were converted, so there is no
longer any path that constructs a response without the header. The set is
`Cache-Control: no-store`, plus `Pragma: no-cache` and `Expires: 0` so an HTTP/1.0
intermediary or a legacy cache predating RFC 9111 §5.2.2.5 cannot hold a copy
either. None of the three values carries secret material.

**Tests added — 20, in `tests/secret-vault-http.test.ts`.** All seven frozen error
codes are driven through the handler and each must carry `Cache-Control: no-store`:
`INVALID_SECRET_INPUT` 400, `SECRET_FORBIDDEN` 403, `SECRET_NOT_FOUND` 404,
`SECRET_INTEGRITY_FAILURE` 500, plus `VAULT_UNAVAILABLE`,
`KEY_VERSION_UNAVAILABLE` and `NONCE_COLLISION` at 503. Beyond those: the 400
raised by input validation, a single-secret `GET` that finds nothing, the
cross-tenant not-found (byte-identical to the absent-id response, header included,
so the 404 cannot become an oracle), the 401 and 403 access refusals, and the
cross-origin CSRF refusal.

Each case additionally asserts the body is still free of plaintext and envelope
material. For the 503 codes the check is structural rather than textual, and the
reason is recorded rather than hidden: the frozen `NONCE_COLLISION` message
legitimately contains the word "nonce", so a substring test would have failed for
the wrong reason. The assertion is therefore that the body has exactly two keys,
neither of which is an envelope field name.

Verified live against the running stack as well:

```
GET /api/secrets                      -> 401   cache-control: no-store
GET /api/secrets/<uuid>               -> 401   cache-control: no-store
POST /api/secrets/<uuid>/rotate (bad origin) -> 403   cache-control: no-store
```

### The vault's PUBLIC API surface (audit CR-06)

**The defect.** `@polyhunter/db/server/vault` re-exported `openSecret`,
`sealSecret`, `randomNonceSource`, `secretEnvelopeAad`, `VaultKeyring`,
`parseVaultKeyring`, `readVaultKeyringFromEnvironment`, `isVaultKeyringConfigured`
and `keyringEnvironmentVariables`, and `packages/db/package.json` published
`./server/vault/envelope` and `./server/vault/keyring` as first-class subpaths.
Any consumer — the web app, the worker, or anything added later — could import a
generic decrypt function or a bare keyring and open a ciphertext without tenant
authorization, without a purpose scope and without the `withDecryptedSecret`
lifecycle. "Server-only" is not a mitigation here: every Node process in this
system is a server.

**The surface now, and why each member is there.**

| Public member | Kind | Why it is legitimately public |
| --- | --- | --- |
| `createSecretVault` | runtime | The single construction entry point. |
| `SecretVault` | type | The facade's shape. |
| `RotateOutcome` | type | Return shape of `rotate`. |
| `SecretVaultOptions` | type | The option object of `createSecretVault`. |
| `KeyringConfiguration` | **type only** | Names the option's shape. A type carries no runtime capability. |
| `NonceSource` | **type only** | Injectable only so tests can force a nonce collision. |
| `ACTIVE_KEY_VERSION_ENV`, `KEYRING_JSON_ENV` | runtime (strings) | The two configuration variable **names**. Non-sensitive by construction, and the web service layer needs them to read the environment. |

**Removed from the public surface:** `openSecret`, `sealSecret`,
`randomNonceSource`, `secretEnvelopeAad`, `SealedEnvelope`, `assertProtocolNonce`,
`assertSecretPlaintextBytes`, `VaultKeyring`, `parseVaultKeyring`,
`readVaultKeyringFromEnvironment`, `isVaultKeyringConfigured`,
`keyringEnvironmentVariables` — and the two package subpaths
`./server/vault/envelope` and `./server/vault/keyring` were deleted from
`packages/db/package.json` entirely.

The product's plaintext path is unchanged and remains exactly one thing:
`withDecryptedSecret(context, purposeScopedHandle, callback)`, with tenant scope,
purpose scope and a `finally` that zeroes the buffer.

**Tests may not widen the API.** `tests/secret-vault-crypto.test.ts` needs the raw
envelope and keyring internals, and it now reaches them by **relative path**
(`../packages/db/src/server/vault/{envelope,keyring}.ts`) rather than through a
package subpath. No production export was added to make a test convenient;
`NÃO amplie a API de produção somente para facilitar testes`.

**A regression test that fails if the door reopens.** `tests/workspace-boundaries.test.ts`
gained a `vault public surface` block with three tests:

1. `no envelope or keyring subpath from the db package` — inspects
   `packages/db/package.json`, requires every export key to match
   `^\./server[a-z/-]*$`, forbids `envelope`/`keyring` anywhere in a subpath name,
   and additionally requires the `./server/vault` target to be exactly
   `./src/server/vault/index.ts` — so the door cannot be reopened under an
   innocuous subpath name by pointing it at `envelope.ts` instead.
2. `no raw decrypt or keyring resolver from the vault entry` — **dynamically
   imports** the vault entry and pins the entire runtime export list to
   `ACTIVE_KEY_VERSION_ENV`, `KEYRING_JSON_ENV`, `createSecretVault`, after
   asserting each forbidden name is absent. A type-only export compiles away; if
   one ever became a value, this list would change and the test would fail.
3. `gives the product exactly one plaintext path, and it is scoped` — no
   production file outside the vault may even name `openSecret`, `sealSecret`,
   `parseVaultKeyring` or `readVaultKeyringFromEnvironment`, and the vault entry
   must not declare a `getPlaintextSecret` accessor (comment lines are stripped
   first, because the vault's own documentation names it in order to say it does
   not exist).

The exact-export-list assertion in the first test of that file was updated from six
subpaths to four.

### Single-record metadata read — `GET /api/secrets/[id]` (audit CR-03)

New in this round. Metadata only, via `service.getMetadata()`, through the **same**
allow-list as the collection route. The response may contain exactly:

`id` · `purpose` · `configured` · `createdAt` · `updatedAt` · `rotatedAt` · `rotation`

It never contains plaintext, ciphertext, nonce, auth tag, key version, key
material, secret length, or `last4`.

**No cross-tenant existence oracle.** `getMetadata` returns `null` for both a
genuinely absent id and another tenant's id, so the HTTP layer cannot tell the two
apart even in principle. The unit test asserts the two responses are
**byte-identical** — same 404 status, same body, same `Cache-Control` — and that
the id itself is never echoed back, so a probe learns nothing from the body.

Authorization for this route is the vault-side check from section 5: a `member`
is refused, and a `platform_admin` without a current owner/admin tenant membership
is refused.

Tested in two places:
- `tests/secret-vault-http.test.ts` — 7 tests, including a hostile service that
  tries to smuggle envelope fields through a widened metadata object (the
  projection still drops them), and an unrecognized-throw case that must not leak
  `ECONNREFUSED` or `encrypted_secrets`.
- `packages/db/tests/secret-vault.integration.test.ts` — 3 tests against real
  PostgreSQL: exact allow-list, cross-tenant silence, member + platform-admin denial.

A nonexistent secret uses the sanitized contract already adopted: 404
`SECRET_NOT_FOUND` with the frozen generic message.

### Error policy — sanitized codes only

`VAULT_UNAVAILABLE`, `SECRET_NOT_FOUND`, `SECRET_FORBIDDEN`, `SECRET_INTEGRITY_FAILURE`,
`KEY_VERSION_UNAVAILABLE`, `NONCE_COLLISION`, `INVALID_SECRET_INPUT`.

Six unrecognized throws — including a raw `ECONNRESET` carrying
`connect ECONNRESET 10.0.0.5:5432` — all collapse to `VAULT_UNAVAILABLE`. Raw Node/OpenSSL
errors never reach a client.

---

## 7. INTERNAL SECRET CONSUMPTION

**Não crie: `getPlaintextSecret(): string`.** No such accessor exists anywhere in the
product code (asserted by a source-wide scan).

The only consumption path is server-only
`withDecryptedSecret(context, handle, callback)`. The callback receives a `Buffer`/`Uint8Array`
for the duration of the operation only, and `plaintextBuffer.fill(0)` runs in a `finally`
on both the success and the throw path. Purpose-scoped: a handle for one purpose cannot
be used to read another, and a tenant mismatch raises `SECRET_FORBIDDEN`.

**Não alegue que JavaScript garante limpeza total da heap.** Zeroing the buffer is
best-effort; the OpenSSL copy inside a `KeyObject` cannot be zeroed from JavaScript. That
limitation is stated in the code rather than papered over.

No Polymarket module consumes secrets in this Work Order.

---

## 8. NONCE COLLISION

Production uses `randomBytes(12)`. On a `UNIQUE (key_version, nonce)` violation the
vault detects it, generates a fresh nonce and retries, with `MAX_NONCE_ATTEMPTS = 3`;
exhaustion raises `NONCE_COLLISION` and fails closed. **A reused nonce is never persisted.**

Tests inject a deterministic nonce source:

- collision → retry → **success**, forced against a nonce actually stored in the database
  under the active key;
- repeated collision → bounded failure with `expect(draws).toBe(3)`.

### Bug found and fixed during execution

`isNonceCollisionViolation` originally inspected only the thrown error. **drizzle wraps
driver errors in `DrizzleQueryError`, whose own `code`/`constraint` are absent and whose
`cause` is the real `pg` error.** The detector therefore missed every genuine collision
and surfaced it as an unhandled failure instead of retrying — two tests caught it. The fix
walks the `cause` chain to a bounded depth of 4.

The **constraint name** is matched, not just SQLSTATE `23505`: that code alone would also
catch the primary key and every other unique index, and retrying on those would be a
silent infinite loop rather than a nonce retry.

---

## 9. ROTATION AND CONCURRENCY

Single-record rotation, using PostgreSQL row locking as the authority (**not** an
in-memory mutex): `SELECT … FOR UPDATE … LIMIT 1` locks the row, then one atomic
`UPDATE` writes ciphertext, nonce, auth tag, `key_version` and `rotated_at` together.

Flow: authorize owner/admin → lock the row → detect `already_current` → fetch the old key
by `key_version` → decrypt → encrypt with the ACTIVE key → fresh nonce → new tag →
atomic update → set `rotated_at`. `id`, `tenant_id`, `purpose` and `created_at` are
preserved. Temporary plaintext is zeroed in `finally`.

- `already_current` returns **without materializing plaintext** and leaves the bytes and
  timestamps byte-stable.
- Missing old key → **FAIL CLOSED**.
- Corrupted ciphertext / tag / AAD → **FAIL CLOSED without overwriting the row**
  (verified by byte-for-byte snapshot comparison).

### Concurrency, all proven against a real database

| Race | Attempts | Result |
| --- | --- | --- |
| rotate × rotate | 2 | serialized; never mixes envelope metadata |
| update × rotate | 5 | consistent |
| delete × rotate | 4 | deterministic, no resurrection |
| 8 parallel creates | 8 | no nonce reuse under the active key |

No race can produce a ciphertext from one key version paired with another version's nonce
or tag, because every field moves in a single atomic statement under a row lock.

---

## 10. TEST RESULTS

### Unit (host) — `npm test`

| Suite | Tests |
| --- | --- |
| `route-handler-security.test.ts` | 33 |
| `secret-vault-crypto.test.ts` | 26 |
| `identity-rbac-adversarial.test.ts` | 21 |
| `auth-cache-headers.test.ts` | 16 |
| `secret-vault-http.test.ts` | 35 |
| `app-origin-csrf.test.ts` | 43 |
| `workspace-boundaries.test.ts` | 8 |
| `secret-material-containment.test.ts` | 3 |
| `environment-example.test.ts` | 2 |
| `fixed-clock.test.ts` | 2 |
| **Total** | **189 passed / 10 files** |

This round: `secret-vault-http.test.ts` grew 15 → 35 for the CR-07 cache policy
(all seven frozen codes plus the access and CSRF refusals, and the
cannot-be-downgraded case), and `workspace-boundaries.test.ts` grew 5 → 8 for the
CR-06 public-surface regression tests. `secret-vault-crypto.test.ts` is unchanged
at 26 tests; only its import specifiers moved off the removed package subpaths.

### Integration (inside the web container, real PostgreSQL 17) — 51/51

| Suite | Tests | Covers |
| --- | --- | --- |
| `secret-vault.integration.test.ts` | 37 | this Work Order (incl. 5 CR-02 + 3 CR-03) |
| `identity-rbac.integration.test.ts` | 10 | **WO-002 regression** |
| `tenancy.integration.test.ts` | 4 | **WO-001 regression** |

### `npm run validate` — end to end, exit 0

lint clean · format clean · typecheck clean · 189 tests · Next.js 16.3.8 production
build listing `/api/secrets`, `/api/secrets/[id]`, `/api/secrets/[id]/rotate` ·
**found 0 vulnerabilities**.

`npm ci` was run explicitly on the host; this is safe because `node_modules` is **not**
bind-mounted into the containers. See section 11.5 for the hermeticity proof that
no step depends on a pre-existing `packages/**/dist`.

### Adversarial coverage

GCM roundtrip · same plaintext → different nonce and ciphertext · tampered
ciphertext/tag/nonce · tampered tenant AAD · tampered purpose · tampered `secretId` ·
tenant A/B swap · wrong key · unknown key version · malformed keyring (12 shapes) ·
wrong key length · missing active key · member denial (all 7 operations) ·
`platform_admin`-only denial · **forged `owner` context over a real member
membership (CR-02)** · **forged `admin` context (CR-02)** · **stale downgrade after
context resolution (CR-02)** · **role mismatch in both directions (CR-02)** ·
tenant A reaching secret B · suspended user / membership / tenant · plaintext
absent from GET · ciphertext absent from GET · masked write responses · plaintext
absent from logs, errors and stack traces · keyring absent from the client bundle ·
nonce collision retry · retry exhaustion · atomic rotation · concurrent rotation ·
update/rotate race · delete/rotate race · migrations empty and repeated · full
WO-001 + WO-002 regression · **`no-store` on every status incl. the cross-tenant
404 (CR-07)** · **a caller cannot downgrade the cache policy (CR-07)** ·
**the raw-decrypt and keyring surfaces are not publicly reachable (CR-06)** ·
**the package export map cannot reopen that door under another name (CR-06)**.

---

## 11. CONTAINMENT

**Não logue: keyring; key; plaintext; ciphertext; auth tag; nonce; request body contendo
secret.** No such logging exists; the metadata projection and every error path are
asserted free of key material.

The client-bundle scan is scoped to `apps/web/.next/static` — **the only directory a
browser downloads**. `.next/server` holds the server bundle, where the vault is supposed
to live. Both trees are scanned and the server column is used as the **positive
control**: a scan that reports zero everywhere proves the patterns are wrong, not
that the bundle is clean. Measured this round (receipt `19-client-bundle-scan.txt`):

| Pattern | `.next/static` (client) | `.next/server` (control) |
| --- | --- | --- |
| `POLYHUNTER_SECRET_KEYRING_JSON` | **0** | 2 |
| `POLYHUNTER_SECRET_ACTIVE_KEY_VERSION` | **0** | 2 |
| `polyhunter-secret-envelope-v1` | **0** | 5 |
| `createCipheriv` / `createDecipheriv` / `setAuthTag` | **0 / 0 / 0** | 2 / 2 / 2 |
| `ciphertext` | **0** | 7 |
| `openSecret` / `sealSecret` / `VaultKeyring` | **0 / 0 / 0** | 2 / 2 / 2 |
| `parseVaultKeyring` / `readVaultKeyringFromEnvironment` | **0 / 0** | 2 / 1 |
| `withDecryptedSecret` | **0** | 4 |
| `api/secrets` | **0** | 17 |
| JavaScript files | 9 (575K) | 77 (14M) |

One pattern needed correcting during the run and the correction is recorded rather
than quietly fixed: `decryptedSecret` reports 0 in **both** columns because the
vault names the member `withDecryptedSecret`. A pattern absent from the control is
a broken probe, so it was re-run under the real name.

The CR-06 narrowing strengthens this scan's meaning: `openSecret`, `sealSecret`,
`VaultKeyring`, `parseVaultKeyring` and `readVaultKeyringFromEnvironment` now
appear **only** in the server column for a second reason — they are no longer part
of any published API surface for a client chunk to reach.

All four WO-003 server files carry the `typeof window !== "undefined"` guard, asserted by
`tests/workspace-boundaries.test.ts`.

Repo-wide scan (receipt `18-secret-pattern-scan.txt` / `.json`, superseding `05`):
896 tracked files scanned. **Zero** base64 literals decoding to exactly 32 bytes —
no raw AES key, in any encoding, is committed anywhere. Two non-empty
`POLYHUNTER_SECRET_KEYRING_JSON` matches were inspected individually and both are
the variable **name** followed by `=` inside a test assertion that `.env.example`
holds an empty value. Three hits land in production source and they are the
**same pre-existing WO-002 name**, listed here rather than filtered away so the
count is not zero by construction: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, a
Supabase *publishable* key that is public by design, appearing in `.env.example`
with an empty value and as a `process.env` read in two adapter files.

The scan deliberately classifies rather than counts. The 64-character hex pattern
matches a raw AES-256 key *and* every SHA-256 digest ever recorded in an evidence
document, producing 2,683 hits of which every one is a digest field
(`planDigest`, `resultDigest`, receipt SHA-256, `package-lock.json` SHA-256 …) in
a document or a build-tooling receipt. Reporting that as a bare number would be a
number with no meaning.

`NEXT_PUBLIC_SECRET` and `NEXT_PUBLIC_KEYRING` appear in tracked source **only
as strings the containment test asserts are absent** from `.env.example` and
compose. They are forbidden names; the test is what proves no vault value can be
published to the browser under them.

---

## 11.5 BUILD HERMETICITY (audit CR-01)

> **The defect.** GitHub Actions Validate #70 failed with a missing-module error
> for `@polyhunter/db/server/vault`. The `./server/vault` export pointed at
> `./dist/server/vault/index.js`, and `npm test` runs *before* the workspace build.
> On a clean checkout there is no `dist`, so the export pointed at nothing.

### The single chosen strategy: source-first workspace exports

Every `exports` condition in every workspace package now resolves to `./src/**/*.ts`
rather than to a build output. Consumers use `.ts` specifiers, enabled by
TypeScript's `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`, and
Next.js transpiles those workspace sources itself via `transpilePackages` — for the
dev server **and** the production build.

This removes `dist` from the runtime equation entirely, which is why it is hermetic
rather than a build-ordering fix. Two alternatives were rejected:

- **Build-before-test.** Compose bind-mounts `packages/db` over any in-image
  `dist`, so this would require building inside the running container on every
  restart — and it would still leave the stale-host-`dist` trap open.
- **A Vitest-only alias.** Rejected on principle by the brief, and it would hide
  the defect from `npm run build` and from production.

**It is provably not a test-only mask:** six workspace aliases were deleted as part
of this change, so every resolution now goes through the real `exports` map.

### The clean-checkout proof (receipt `10-cr01-hermeticity.txt`)

Executed in this order, from a tree with no `packages/**/dist` anywhere:

1. all untracked `packages/**/dist` removed;
2. `npm ci` — exit 0;
3. `npm run validate` — exit 0 (189 tests, 0 vulnerabilities, production build OK);
4. `rm -rf packages/*/dist`, then Docker rebuild and `up`;
5. real `curl -i` against `/api/secrets` **and** `/api/secrets/<uuid>`;
6. migrations from an empty database, then repeated.

Results:

| Probe | Result |
| --- | --- |
| `GET /` | HTTP 200 |
| `GET /api/secrets` | 401 `{"error":"unauthenticated","reason":"provider_not_configured"}` |
| `GET /api/secrets/<uuid>` | 401, same sanitized body |
| module-resolution errors | **0** |

Without a keyring configured — and `.env.example` ships it empty — every vault
operation fails closed. The `401` above is only reachable if the route module, its
service factory and the whole `@polyhunter/db` import chain loaded successfully; a
missing build output would have surfaced as a 500 carrying a module error instead.
This state satisfies all four required contexts: clean Git checkout, `npm ci`,
`npm run validate`, Docker rebuild/up, Next dev **and** Next production build (the
production route table is reproduced in receipt `13`, section 4).

---

## 12. IMAGE AND VEX

Input artifact: `polyhunter-dev:local@sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`

### Rebuild was mandatory, not optional — and it happened twice

`Dockerfile.dev` copies `packages/db/package.json`:

```
COPY --chown=node:node packages/db/package.json packages/db/package.json
```

This Work Order added the `./server/vault` export mapping to that file, which is a
**build input change**, so the identical-digest shortcut was unavailable.

| | |
| --- | --- |
| Pre-rebuild (inherited from WO-002) | `sha256:eddda17a…` |
| After the first rebuild | `sha256:f810df3a64aa15b99e477006a39c399eb43d9b59c635376d942e89dc15cc17c8` |
| After the CR-01 fix | `sha256:8bd3e85a206492de832dd95575b0004165e7368b53427ba887547743019c22c4` |
| **Final artifact, after the CR-05..CR-08 fixes** | **`sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2`** |

CR-06 removed the `./server/vault/envelope` and `./server/vault/keyring` subpaths
from `packages/db/package.json`. That is a **third** Docker build-input change, so
the rebuild branch applied again and the digest changed. Every VEX row is
dispositioned against `aee3ad8c…`; `f810df3a…` and `8bd3e85a…` are recorded as
superseded. The brief's warning that CR-06 would force a rebuild was correct.

> **Why the digest is not invalidated by anything else this round changed.**
> `Dockerfile.dev` copies only the workspace `package.json` files,
> `package-lock.json` and `tsconfig.base.json`, then runs `npm ci`; application
> source is **bind-mounted** by compose, not baked in. So the post-build edits to
> `apps/web/app/api/secrets/handler.ts` (a formatter pass) and to the two test
> files changed no build input. This was verified on the image itself rather than
> assumed: `/workspace/packages/db/package.json` inside the running container
> carries the four-subpath export map with no envelope/keyring entry, confirming
> the CR-06 change is present in the artifact the digest names.

| Build input | Changed? |
| --- | --- |
| `package-lock.json` | **no** — sha256 `484c8cd56386b60b2013016984a84fba00379a7af5d16fa0a4a996c29d08f722`, identical to HEAD |
| root `package.json` | **no** — sha256 `746e6bedeabbc49cd68f58227d86b73dcef28feb87e43a761076aaf3e94d335e` |
| `packages/db/package.json` (`exports` map only) | **yes** — CR-06 removed two subpaths |
| `Dockerfile.dev` | no |
| compose `environment:` blocks | no |
| base image `node:24-bookworm-slim` | no |
| any dependency version | no |
| `npm audit --audit-level=high` | **0 vulnerabilities** |

### Objective equivalence on the final artifact (receipt `16`)

The premise behind each prior independent proof was **re-measured** on
`aee3ad8c…`, not assumed:

| Axis | Measurement on `aee3ad8c…` |
| --- | --- |
| exact component | Debian names (`libstdc++6`, `libgcc-s1`, `gcc-12-base`) all `12.2.0-14+deb12u1 amd64`; every npm purl version identical row for row |
| exact version | full 88-package dpkg inventory diffed against the WO-002 baseline → **0 differences** |
| architecture | `x86_64` / `amd64` |
| installed files | `libstdc++.so.6.0.30` `e7848e32…`, `node` `7fde7b8a…`, `sharp-linux-x64-0.35.5.node` `cf896cc1…`, `libvips-cpp.so.8.18.7` `4aa73553…` — all four SHA-256 **byte-identical** to the WO-002 baseline |
| runtime / reachability | `uid=1000(node)`, `CapEff: 0000000000000000`, node v24.21.0; web and worker process tables contain **no perl process** (0 executables resolving to perl) |
| WO-003 delta effect | 7 premises measured individually — see below |

Premises P1–P7, re-measured (receipt `16-objective-equivalence.txt`): P1 dependency
graph unchanged (`package.json` / `package-lock.json` SHAs, `git diff --quiet`
clean); P2 zero subprocess primitives across 75 tracked source files — the single
`exec(` is a `RegExp.prototype.exec` in a test; P3 no perl process in either
container and no perl invocation in any tracked `package.json`; P4 perl-base
compiled-module census 0 for `Archive::Tar`, `Archive::Unzip`,
`IO::Uncompress::Unzip`, `Compress::Zlib`, `Pod::Text`, with `Socket.pm` at 2 as a
deliberate non-zero control and a `perl -M<module>` loadability control that
reports `Socket → LOADS` and every vulnerable-path module → "not loadable"; P5
`ivsize=8`, `longsize=8`, `ptrsize=8`, `use64bitint=define`, `LONG_BIT=64`; P6 no
new compiled consumer of `libstdc++.so.6`; P7 caller-controlled input surface
bounded to a UUID `id`, a canonical `purpose` and a length-bounded `secret`, with
every `RegExp` built from frozen constants.

Two measurement corrections are recorded in the receipt rather than smoothed over:
the `.pm` census counts the compiled-module search path (61) in this round versus
the whole filesystem (164) in an earlier one — both correct for their own command,
and the reconciliation is written out; and P6 states plainly that
`nm`/`objdump`/`readelf` are **not installed**, so no symbol-presence claim is made
anywhere.

### VEX state machine — 25 UNDER_INVESTIGATION, 25 **proposed** NOT_AFFECTED

Scanner: `docker scout` v1.24.0, against `sha256:aee3ad8c…`.
Receipts: `14-vex-state-machine.json` / `.md`, produced by `vex-state-machine.mjs`.

| Field | Value |
| --- | --- |
| rows scanned | 82 |
| HIGH/CRITICAL rows | **25** |
| `vexStatus = UNDER_INVESTIGATION` | **25** |
| `proposedVexStatus = NOT_AFFECTED` | **25** |
| `vexStatus = AFFECTED` | **0** |
| `independentAuditor` set | **0** |
| `ownerApproval` set | **0** |
| premises altered by this delta | **0** |
| rows whose justification diverges from the accepted record | **0** |

**The executor proposes; it does not approve.** `independentAuditor` and
`ownerApproval` are `null` on every row, so no NOT_AFFECTED disposition is
registered as current approved state. Nothing was carried over from the WO-002
approvals: those were given on `eddda17a…` and expired at this digest by the
PH-SEC-VEX-POLICY expiry rule. What is preserved by reference is the prior
row-specific **analysis**, not the approval.

Prior artifact vs final artifact, compared row by row on (CVE, severity, package purl
with exact version, affected range, fixed version):

```
rows 80 -> 82 | identical 80 | added 2 | removed 0
HIGH/CRITICAL 25 -> 25
```

The 2 added rows are both **below HIGH/CRITICAL** and originate outside this
repository's dependency graph: `CVE-2026-105712` (LOW, Debian `gnupg2`/`gpgv` from the
base image) and `CVE-2026-104844` (MEDIUM, `postcss-selector-parser@7.1.4` bundled inside
npm's own `node_modules`). **Neither appears in `package-lock.json`** (grep count 0).
Their appearance indicates the scanner datasource advanced between scans, not that this
Work Order introduced a dependency. They are recorded, not suppressed.

> **Severity-source note.** Severity is parsed from `message.text`. SARIF `level` carries
> the VEX/status channel (`none`/`note`/`warning`/`error`), not the vulnerability severity.
> Reading `level` reports **0 HIGH/CRITICAL on an image that has 25** — a false "clean".
> This was caught and corrected before the reconciliation was written, and the parsing now
> lives in a real `.mjs` file that **throws** on any unrecognised severity rather than
> reporting a count derived from a broken parse. Shell-escaped inline regexes silently
> failed three times before that was fixed.

**Suppressions added: 0. Ignore rules added: 0. Severity downgrades: 0.**

### `CVE-2026-8376` — restored to the accepted disposition (audit CR-05)

**The defect.** WO-003 restated this row as `vulnerable_code_not_in_execute_path`,
resting it on "Perl is never executed". The accepted WO-002 record — reviewed by the
independent auditor and approved by the Project Owner — says something different
and stronger:

| Field | Accepted value | The WO-003 regression | Now |
| --- | --- | --- | --- |
| `vulnerableCodePresent` | `true` | *(unstated)* | **`true`** |
| `proposedJustification` | `vulnerable_code_cannot_be_controlled_by_adversary` | `vulnerable_code_not_in_execute_path` | **restored** |
| `vexStatus` | approved NOT_AFFECTED | — | `UNDER_INVESTIGATION` (new digest ⇒ expired) |
| `independentAuditor` / `ownerApproval` | approved | — | **`null`** |

**Why the weaker phrasing was wrong rather than merely different.** The accepted
proof is an architecture/arithmetic bound, not a reachability argument. The
vulnerable code IS present — `Perl_study_chunk` is the regular-expression
compilation path inside the interpreter and ships as part of
`perl-base 5.36.0-7+deb12u3`, which is installed on this artifact. What an adversary
cannot do is drive it into the overflow condition, because the advisory scopes the
defect to 32-bit (ILP32) builds and this artifact is amd64 / ELF64 with
`ivsize=8`, `longsize=8`, `ptrsize=8`, `LONG_BIT=64`. Reachability is therefore
irrelevant to the disposition — which is exactly why "Perl is never executed"
cannot carry it: that claim would become false the moment anything in the image
invoked perl, while the 32-bit-build argument holds unconditionally. Restoring the
weaker phrasing would have misstated what the accepted proof rests on.

**Secondary defence-in-depth retained, explicitly demoted.** "Perl is never
executed" is preserved in the JSON under `secondaryDefenceInDepth`, labelled *"NOT
the justification for this disposition and must not be read as one"* — the accepted
record's own instruction. Its evidence is re-measured this round: no executable in
either container resolves to perl, no tracked `package.json` invokes perl, and P2
found zero subprocess call sites.

**A gate that fails instead of restating.** `vex-state-machine.mjs` now compares
every proposed `(CVE, vulnerableCodePresent, proposedJustification)` triple against
the accepted record and **throws before writing any output** if any row diverges.
Two negative controls were run and recorded (receipt `15-cr05-negative-controls.txt`):
regressing the restore table reproduces the audit's exact finding and the gate
halts; and re-sourcing the justification from the WO-003 delta prose — the original
defect mechanism — halts identically. Both were then reverted and the script re-run
clean.

**Answer to "did any other row change its previously-approved justification":** no.
25 of 25 rows compared, **0 divergences**. The gate is what makes that a measurement
rather than a claim, and it runs on every regeneration.

### Prior evidence preserved by reference, not genericised (CR-04)

Each row carries `preservedPriorBasis` — the prior independent proof, verbatim — plus
a six-axis re-measurement and a computed `premiseAltered` flag. **`premiseAltered` is
computed from the measurements, never hard-coded**; a row whose premise cannot be
re-confirmed would emit `proposedVexStatus: null` plus a named `mandatoryAnalysisIfAltered`.

Prior evidence is indexed by CVE with **WO-008 superseding WO-007 for the two
libstdc++ rows**: WO-008's CR-01/CR-04 correction delta replaced the WO-007 argument,
so reading WO-007 for those CVEs would resurrect a proof the auditor already threw out.

**`CVE-2026-95619` keeps its specific foundation.** Its preserved basis is the accepted
**aligned-allocation / arithmetic-bound proof**, not a sentence about regexes or route
inputs. The reproduced proof records: the affected condition, the overflow formula, both
call sites with the `max_tasks` bound, the libvips/libuhdr path with lazy-loading
reachability probe-confirmed, and the arithmetic bound itself — allocation size
`sz ≤ 65519` against a `2^64−3` threshold, a margin of at least `2^48`, with the JPEG
`APP2` marker format hard-capping the length at 16 bits. The prerequisite is
*arithmetically unsatisfiable within the format*. It is reproduced verbatim in the
markdown companion so a reader can check the arithmetic, not just its conclusion.

One honest limitation is recorded rather than papered over: `nm`, `objdump` and
`readelf` are **not installed in this image**, so the symbol-presence premise was
**not re-derived**. It is carried instead by the byte-identical SHA-256 of
`libstdc++.so.6.0.30` — literally the same file the prior proofs disassembled — on
the same architecture with the same consumer set. That is a stronger statement than
a fresh symbol scan, and it is the one the evidence actually supports. No claim of
"zero exported symbols" is made anywhere.

Expiry rule: a NOT_AFFECTED disposition expires at a new image digest. This rebuild is
exactly such a case, which is why every row returns to UNDER_INVESTIGATION with only
a *proposed* status.

---

## 13. DOCKER RUNTIME

Receipts `20` (no keyring, fail-closed) and `21` (ephemeral keyring).

| | Without keyring | With ephemeral keyring |
| --- | --- | --- |
| `docker compose ps` | postgres healthy, web healthy, worker running | same |
| web `GET /` | HTTP 200 | HTTP 200 |
| `GET /api/secrets` | 401 `no-store` | — |
| `GET /api/secrets/<uuid>` | 401 `no-store` | — |
| module-resolution errors | **0** in both services | **0** |
| vault | `VAULT_UNAVAILABLE` (fail closed) | configured; create / decrypt / rotate / list / remove all exercised |

Without a keyring the rest of the app is fully healthy and only the vault is
unavailable — no operation partially succeeds.

The with-keyring probe ran **inside the container**. This round it did something
stronger than the previous round's availability check: against a real seeded owner
membership it performed `create`, `withDecryptedSecret` (the callback received the
bytes; the buffer is zeroed in a `finally`), `rotate`, `listMetadata` and `remove`,
and it attempted a **cross-tenant handle**, which was refused with
`SECRET_FORBIDDEN`. Two 32-byte keys were generated in memory and passed to
`createSecretVault` as a JavaScript value — **never through the environment, never
written to `.env`, never printed, never committed**, and the buffers were zeroed
afterwards. Because no keyring ever entered the environment there was nothing to
un-set and nothing `docker inspect` could have captured; the compose defaults were
never modified and were re-verified blank:

```
POLYHUNTER_SECRET_ACTIVE_KEY_VERSION=[]
POLYHUNTER_SECRET_KEYRING_JSON=[]
```

PostgreSQL publishes no host port, so migrations and the integration suite run
inside the web container. **The stack is left running in the no-keyring state.**

---

## 14. `git diff --check`

Clean — no whitespace or conflict errors. CRLF warnings on Windows are line-ending
normalization only.

---

## 15. SCOPE COMPLIANCE

Implemented only PH-M01-WO-003. Not implemented, per the brief's PROIBIDO list:
PH-M01-WO-004, Polymarket credential use, `trading_accounts`, any Polymarket adapter,
wallet signing, trading, market data, strategy, risk engine, M02+, cloud KMS or
Secret Manager.

`.engineering/CHECKPOINT.json` was **not** modified. PR #39 was **not** merged. The
checkpoint was **not** promoted.

---

## 16. RECEIPTS

Every superseded artifact has been moved to `receipts/superseded/`, which carries its
own README explaining what replaced it and why. Leaving a file that asserts a
**wrong disposition** next to the correct one invites a reader — or a future
executor — to pick up the wrong one.

### Current

| Receipt | Contents |
| --- | --- |
| `00-prebuild-image-identity.txt` | input artifact `sha256:eddda17a…` |
| `01-postbuild-image-identity.txt` | first rebuilt artifact `sha256:f810df3a…` + build-input delta |
| `03-docker-health-no-keyring.txt` | stack healthy, vault unavailable (first round) |
| `06-docker-health-with-keyring.txt` | configured path, keys discarded (first round) |
| `07-validation-gates.txt` | `npm ci` + `npm run validate` (first round) |
| `08-container-integration.txt` | migrations idempotent, live schema, 51/51 |
| `09-context-lock-reverification.txt` | frozenSources 17/17, base drift zero |
| `10-cr01-hermeticity.txt` | **CR-01** — clean-checkout hermeticity proof (no `dist`, `npm ci`, validate, Docker rebuild/up, live `curl` on both routes) |
| `14-postbuild-image-identity.txt` | **this round** — artifact `sha256:aee3ad8c…`, digest ancestry, why the rebuild was mandatory, build-input delta |
| `14-image-scan.sarif` / `.stderr.txt` | `docker scout cves` on `sha256:aee3ad8c…` (82 rows, 25 HIGH/CRITICAL) |
| `vex-state-machine.mjs` | the canonical re-runnable generator: severity-parsed from `message.text`, scan bound to the declared digest, CR-05 justification gate that throws on any divergence from the accepted record |
| `14-vex-state-machine.json` / `.md` | **CR-04 + CR-05** — 25 UNDER_INVESTIGATION / 25 proposed NOT_AFFECTED / 0 AFFECTED / 0 auditor / 0 owner, per-row preserved prior basis, six-axis re-measurement, `justificationIntegrity` 25 compared / 0 divergences |
| `15-cr05-negative-controls.txt` | **CR-05** — the two mutations the gate was observed to halt on, plus the tautology the first control exposed |
| `16-objective-equivalence.txt` | **CR-04** — six objective-equivalence axes + premises P1–P7 re-measured on `aee3ad8c…` |
| `17-validation-gates.txt` | **this round** — `npm audit`, `git diff --check`, migrations empty+repeat, 51/51 integration, 189 unit, `npm run validate`, and the failures hit and fixed |
| `18-secret-pattern-scan.txt` / `.json` | **this round** — 896 tracked files, classified: 0 base64 literals decoding to a 32-byte key, each non-zero-pattern hit enumerated |
| `19-client-bundle-scan.txt` | **this round** — client bundle vs server-side positive control, 0 vs non-zero across 12 patterns |
| `20-docker-health-no-keyring.txt` | **this round** — full stack healthy, vault fails closed, 0 module-resolution errors |
| `21-docker-health-with-keyring.txt` | **this round** — ephemeral in-memory keyring, real seeded membership, create/decrypt/rotate/list/remove plus a refused cross-tenant handle |

### Superseded — `receipts/superseded/` (see its README)

`02-final-image-scan.*` · `04-vex-reconciliation.{json,md}` · `reconcile-vex.mjs`
(guarded, throws without an explicit override) · `05-secret-pattern-scan.txt` ·
`11-new-image-scan.*` · `12-objective-equivalence.txt` · `13-final-validation.txt` ·
`13-cr04-vex-state-machine.{json,md}` — the last three carry the **CR-05
regression** and are retained only so the audit's finding can be read against the
artifact that contained the defect.

---

## 17. AUDIT REQUEST

`READY_FOR_FINAL_INDEPENDENT_AUDIT` — pending the CI result on the final HEAD, which
is recorded in the PR body and in the section below.

The audit target is the tip of `feat/ph-m01-encrypted-secret-vault` after the
CR-05..CR-08 commits. GitHub Actions Validate and CodeRabbit are both required to be
SUCCESS on that exact commit; the run IDs and the commit SHA are recorded in the
real PR #39 body and in the head of this document rather than duplicated here,
because a SHA written into a file invalidates itself on the next commit.

Points an auditor should weigh most heavily:

1. **`FOR SHARE OF ph_membership` is the load-bearing choice in CR-02.** It closes the
   TOCTOU window using a database property, so it holds across processes and
   containers — not merely within one Node instance. An auditor may want to test
   the downgrade race directly, against a second connection, at the exact moment
   the vault transaction holds the lock.
2. **The fail-closed rule on `role` divergence.** CR-02 permitted either "derive
   exclusively from the DB" or "fail closed". This implementation does **both**:
   it derives from the DB and then additionally denies if `context.role` disagrees.
   That is the stricter reading, chosen so privilege cannot widen in either
   direction. It is worth confirming the stricter reading does not reject a
   legitimate caller in normal operation.
3. **The drizzle `DrizzleQueryError` wrapper.** Collision detection was silently broken
   until the cause-chain walk was added. An independent check should confirm no other
   error-classification path in the vault inspects only the thrown error.
4. **The AAD reconstruction on read.** The binding is only as strong as the values the
   reader uses to rebuild it; that they come from the authoritative `TenantContext` and
   the stored row, not from caller input, is the load-bearing property.
5. **The `UNIQUE (key_version, nonce)` retry interaction.** The constraint name match,
   not SQLSTATE alone, and the bounded retry count.
6. **Buffer zeroing as best effort.** No claim of total heap cleansing is made anywhere.
7. **The source-first exports strategy (CR-01).** It removes `dist` from the runtime
   equation rather than ordering a build before a test. The proof is receipt `10`;
   the auditor should re-run it from a tree with no `packages/**/dist`.
8. **The VEX remains in proposed state.** All 25 rows are `UNDER_INVESTIGATION` with
   only a *proposed* NOT_AFFECTED. No `NOT_AFFECTED` is registered as approved, and
   no auditor or owner approval is recorded. Approving is not the executor's to do.
9. **`CVE-2026-95619` keeps its specific proof.** Its basis is the accepted
   aligned-allocation / arithmetic bound, preserved verbatim — including the
   `sz ≤ 65519` vs `2^64−3` margin of at least `2^48` and the 16-bit JPEG `APP2`
   marker cap. It was **not** replaced by a generic statement about regex or route
   inputs, which is what CR-04 forbade.
10. **`CVE-2026-8376` now states `vulnerableCodePresent: true`.** That is not a
    weakening — it is the accepted record's position, and the reason it is safe is
    the 32-bit-build scope, not reachability. An auditor should confirm this reads
    as intended and that the "Perl is never executed" text is never load-bearing.
11. **The CR-06 surface is enforced by absence, not by discipline.** The three
    `vault public surface` tests assert the *runtime* export list of the vault entry
    by importing it, and assert that no package subpath can reopen the door under
    another name. An auditor should try to defeat them — in particular by adding an
    export that a type-only re-export would mask.
12. **The CR-07 default cannot be downgraded at a call site.** The mandatory header
    keys are merged last inside `jsonResponse`, so a future route cannot re-enable
    caching by passing its own `Cache-Control`. Worth confirming the merge order is
    the only reason, i.e. that no call site reaches `NextResponse.json` directly.
13. **Two probes in this bundle reported false results and were corrected**, and both
    corrections are recorded in place rather than quietly fixed:
    - a `find` probe returned "0 perl modules in the image", which contradicted a
      separate `perl -V:ivsize` reading. Cause: shell quoting put literal quote
      characters inside the nested `find` patterns. Re-measured: `Socket.pm` present
      at 2 paths — recorded as a **non-zero control**, so a "nothing is installed"
      result can be told apart from a probe that failed — plus a `perl -M<module>`
      loadability control that reports `Socket → LOADS`. This round reports the
      compiled-module search path (61 `.pm`) rather than the whole filesystem (164);
      receipt `16` reconciles the two numbers explicitly instead of leaving them to
      look like drift.
    - `nm -D … | grep -c` returned `0`, which looked like "symbols absent". Cause:
      `nm` is not installed in the image and `2>/dev/null` hid the error. **No
      claim about symbol presence is made anywhere**; the presence premise rests on
      the byte-identical SHA-256 of `libstdc++.so.6.0.30`.
14. **The CR-05 gate was verified by two negative controls, and the first attempt
    at them FAILED to fire — which is why they exist.** An initial version of the
    gate compared a value derived from the accepted record against the accepted
    record, so it could never fail: a tautology dressed as a test. The control
    exposed it, the derivation was corrected to consult the CR-05 restore table
    first, and only then did the gate halt on both the audit's mutation and the
    original defect mechanism. Both runs are in receipt `15`. An auditor should
    re-run them: a gate nobody has watched fail is not evidence.
15. **A second defective probe, found the same way.** The client-bundle scan's
    `decryptedSecret` pattern returned 0 in the client bundle *and* 0 in the server
    control, because the vault names the member `withDecryptedSecret`. A pattern
    absent from the control is a broken probe, not a clean result. Re-run under the
    real name: 0 client / 4 server. Recorded in receipt `19`.
16. **One lint/format failure and one test timeout were hit and fixed this round**,
    and both are named in receipt `17` rather than left out: three hand-written
    files needed a formatter pass, and the runtime-export test needed an explicit
    30-second budget because its dynamic import loads `pg`, `drizzle` and the domain
    package. The second matters because a timeout there would have read as "the
    export surface is wrong" when it was not.
