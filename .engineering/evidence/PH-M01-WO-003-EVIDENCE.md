# PH-M01-WO-003 — Evidence

**Work Order:** PH-M01-WO-003 — Encrypted Secret Vault
**Branch:** `feat/ph-m01-encrypted-secret-vault`
**PR:** #39 (Draft)
**Issue:** #38
**Locked base:** `af6235d2164171985af6152ba03835826ace3cdb`
**Execution HEAD at evidence time:** `600096e0d96a97ded55f01d593cbd8ce3ec9945f`
**Executor:** Codex (sole implementation/test/CI/migration executor)
**Date:** 2026-10-05 / 2026-10-06

**STOP STATE: `READY_FOR_INDEPENDENT_AUDIT`**

`liveTradingAuthorized` remains `false`. No order was placed, no signing authority
exercised, no credential handled, and no Polymarket surface touched.

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

Explicit domain capabilities, checked on the current authoritative `TenantContext` with
membership validation on every operation:

| Capability | `owner` | `admin` | `member` | `platform_admin` alone |
| --- | --- | --- | --- | --- |
| `secret:metadata` | allow | allow | **DENY** | **DENY** |
| `secret:write` | allow | allow | **DENY** | **DENY** |
| `secret:delete` | allow | allow | **DENY** | **DENY** |
| `secret:rotate` | allow | allow | **DENY** | **DENY** |

`platform_admin` alone is denied — platform scope does not imply tenant scope. A forged
context is structurally refused.

Access is revoked on the **next authoritative request** after any of: suspended user,
suspended membership, suspended tenant. Also covered: `invited` and deleted membership.

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
- Every response is `no-store`.
- Same-origin CSRF guard on all 4 mutations: 6 cross-origin values plus a missing `Origin`
  header are all rejected with 403 `cross_origin_rejected` before the service is touched;
  the trusted origin is accepted. `GET` requires no origin.

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
| `secret-vault-http.test.ts` | 15 |
| `app-origin-csrf.test.ts` | 43 |
| `workspace-boundaries.test.ts` | 5 |
| `secret-material-containment.test.ts` | 3 |
| `environment-example.test.ts` | 2 |
| `fixed-clock.test.ts` | 2 |
| **Total** | **166 passed / 10 files** |

### Integration (inside the web container, real PostgreSQL 17) — 43/43

| Suite | Tests | Covers |
| --- | --- | --- |
| `secret-vault.integration.test.ts` | 29 | this Work Order |
| `identity-rbac.integration.test.ts` | 10 | **WO-002 regression** |
| `tenancy.integration.test.ts` | 4 | **WO-001 regression** |

### `npm run validate` — end to end, exit 0

lint clean · format clean · typecheck clean · 166 tests · Next.js 16.3.8 production build
listing `/api/secrets`, `/api/secrets/[id]`, `/api/secrets/[id]/rotate` ·
**found 0 vulnerabilities**.

`npm ci` was run explicitly on the host; this is safe because `node_modules` is **not**
bind-mounted into the containers.

### Adversarial coverage

GCM roundtrip · same plaintext → different nonce and ciphertext · tampered
ciphertext/tag/nonce · tampered tenant AAD · tampered purpose · tampered `secretId` ·
tenant A/B swap · wrong key · unknown key version · malformed keyring (12 shapes) ·
wrong key length · missing active key · member denial (all 6 operations) ·
`platform_admin`-only denial · forged context · tenant A reaching secret B · suspended
user / membership / tenant · plaintext absent from GET · ciphertext absent from GET ·
masked write responses · plaintext absent from logs, errors and stack traces · keyring
absent from the client bundle · nonce collision retry · retry exhaustion · atomic
rotation · concurrent rotation · update/rotate race · delete/rotate race · migrations
empty and repeated · full WO-001 + WO-002 regression.

---

## 11. CONTAINMENT

**Não logue: keyring; key; plaintext; ciphertext; auth tag; nonce; request body contendo
secret.** No such logging exists; the metadata projection and every error path are
asserted free of key material.

The client-bundle scan is scoped to `apps/web/.next/static` — **the only directory a
browser downloads**. `.next/server` holds the server bundle, where the vault is supposed
to live; scanning it would assert the opposite of what this Work Order requires. Scanned
**while a keyring was configured**, so a leak would have surfaced: 9 client chunks,
**0** matches for `POLYHUNTER_SECRET_KEYRING_JSON`,
`POLYHUNTER_SECRET_ACTIVE_KEY_VERSION`, `polyhunter-secret-envelope-v1`, `createSecretKey`
and any 32-byte base64 literal.

All four WO-003 server files carry the `typeof window !== "undefined"` guard, asserted by
`tests/workspace-boundaries.test.ts`.

Repo-wide scan (receipt `05-secret-pattern-scan.txt`): only variable **names** appear;
no 32-byte base64 literal in non-test source; `.env.example` values empty; no keyring
value committed to history.

---

## 12. IMAGE AND VEX

Input artifact: `polyhunter-dev:local@sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`

### Rebuild was mandatory, not optional

`Dockerfile.dev` copies `packages/db/package.json`:

```
COPY --chown=node:node packages/db/package.json packages/db/package.json
```

This Work Order added the `./server/vault` export mapping to that file. That is a **build
input change**, so the identical-digest shortcut was unavailable and the brief's rebuild
branch applied.

| | |
| --- | --- |
| Pre-rebuild | `sha256:eddda17a…` (receipt `00`) |
| **Post-rebuild** | **`sha256:f810df3a64aa15b99e477006a39c399eb43d9b59c635376d942e89dc15cc17c8`** (receipt `01`) |
| `package-lock.json` | unchanged |
| `Dockerfile.dev` | unchanged |
| base image `node:24-bookworm-slim` | unchanged |
| all dependency versions | unchanged |
| `npm audit --audit-level=high` | **0 vulnerabilities** |

`compose.yaml` changed only inside the web service `environment:` block, which is not a
build input.

### VEX reconciliation — 25/25 re-proven

Scanner: `docker scout` v1.24.0. Because the artifact is new, no disposition could be
carried forward by reference; each was re-proven (receipt `04`).

| Outcome | Count |
| --- | --- |
| NOT_AFFECTED | **25** |
| UNDER_INVESTIGATION | **0** |
| AFFECTED | **0** |

Prior artifact vs new artifact, compared row by row on (CVE, severity, package purl with
exact version, affected range, fixed version):

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
> This was caught and corrected before the reconciliation was written.

**Suppressions added: 0. Ignore rules added: 0. Severity downgrades: 0.**

Expiry rule: a NOT_AFFECTED disposition expires at a new image digest. Any later rebuild
returns every row to UNDER_INVESTIGATION pending re-proof.

---

## 13. DOCKER RUNTIME

Receipts `03` (no keyring) and `06` (with keyring, then keys discarded).

| | Without keyring | With ephemeral keyring |
| --- | --- | --- |
| `docker compose config` | OK | OK |
| web `GET /` | HTTP 200 | HTTP 200 |
| PostgreSQL | healthy | healthy |
| worker | running | running |
| vault | `VAULT_UNAVAILABLE` (fail closed) | configured, `k1`+`k2` resolve |

Without a keyring the rest of the app is fully healthy and only the vault is unavailable.

The with-keyring probe ran **inside the container against the real keyring module** and
asked only for the `KeyObject` type, never the key bytes. Two 32-byte keys were generated
in memory and passed as environment variables: **never written to `.env`, never printed,
never committed.** They were discarded by recreating the containers with the blank
compose defaults, which was then re-verified:

```
POLYHUNTER_SECRET_ACTIVE_KEY_VERSION=[<unset>]
POLYHUNTER_SECRET_KEYRING_JSON=[<unset>]
isVaultKeyringConfigured(cfg) = false
readVaultKeyringFromEnvironment() -> VAULT_UNAVAILABLE
```

PostgreSQL publishes no host port, so migrations and the integration suite run inside the
web container. **The stack is left running in the no-keyring state.**

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

| Receipt | Contents |
| --- | --- |
| `00-prebuild-image-identity.txt` | input artifact `sha256:eddda17a…` |
| `01-postbuild-image-identity.txt` | rebuilt artifact `sha256:f810df3a…` + build-input delta |
| `02-final-image-scan.sarif` | `docker scout cves` on the new artifact (82 rows) |
| `02-final-image-scan.stderr.txt` | scanner progress log |
| `03-docker-health-no-keyring.txt` | stack healthy, vault unavailable |
| `04-vex-reconciliation.json` / `.md` | 25 dispositions re-proven, 0 under investigation |
| `reconcile-vex.mjs` | the reconciliation script (re-runnable) |
| `05-secret-pattern-scan.txt` | repo-wide secret-pattern scan |
| `06-docker-health-with-keyring.txt` | configured path, then keys discarded |
| `07-validation-gates.txt` | `npm ci` + `npm run validate` |
| `08-container-integration.txt` | migrations idempotent, live schema, 43/43 |
| `09-context-lock-reverification.txt` | frozenSources 17/17, base drift zero |

---

## 17. AUDIT REQUEST

`READY_FOR_INDEPENDENT_AUDIT`.

Points an auditor should weigh most heavily:

1. **The drizzle `DrizzleQueryError` wrapper.** Collision detection was silently broken
   until the cause-chain walk was added. An independent check should confirm no other
   error-classification path in the vault inspects only the thrown error.
2. **The AAD reconstruction on read.** The binding is only as strong as the values the
   reader uses to rebuild it; that they come from the authoritative `TenantContext` and
   the stored row, not from caller input, is the load-bearing property.
3. **The `UNIQUE (key_version, nonce)` retry interaction.** The constraint name match,
   not SQLSTATE alone, and the bounded retry count.
4. **Buffer zeroing as best effort.** No claim of total heap cleansing is made anywhere.
5. **The rebuild branch.** `packages/db/package.json` is a Docker build input; the
   identical-digest shortcut was correctly unavailable.
