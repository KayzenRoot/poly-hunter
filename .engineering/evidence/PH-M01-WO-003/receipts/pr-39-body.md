# PH-M01-WO-003 — Encrypted Secret Vault

Server-only encrypted secret vault. AES-256-GCM envelopes in PostgreSQL, a fail-closed server-only keyring, tenant-bound authorization, a masked HTTP surface, atomic key rotation and nonce-collision handling.

**STOP STATE: `READY_FOR_INDEPENDENT_AUDIT`**

## Execution HEAD

| | |
| --- | --- |
| Code under audit | `b6ae3fca49da3e037b9e7632756e6e0fca4b1f80` |
| Branch | `feat/ph-m01-encrypted-secret-vault` |
| Base | `main@af6235d2164171985af6152ba03835826ace3cdb` |
| Merge-base | `af6235d2164171985af6152ba03835826ace3cdb` — exact, zero drift |

## Migration

`packages/db/drizzle/0002_encrypted_secrets.sql` creates `encrypted_secrets`, verified as actually created in the live PostgreSQL 17 database:

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

`UNIQUE (key_version, nonce)` is the second, database-level barrier against nonce reuse. Migrations applied twice — the second run is a no-op, not an error. **No `trading_accounts`, no Polymarket schema**: `information_schema.tables` returns **0** tables matching `%polymarket%`, `%trading%` or `%wallet%`.

## Crypto protocol

`node:crypto` only. No third-party crypto dependency; `package-lock.json` is byte-identical to the locked base. No primitive implemented in-house.

| Parameter | Value | Anchor |
| --- | --- | --- |
| Algorithm | AES-256-GCM | key exactly 32 bytes, enforced |
| Key object | `createSecretKey` → `KeyObject` (`type=secret`) | preferred form required by the brief |
| Nonce / IV | 12 bytes from `crypto.randomBytes(12)` | NIST SP 800-38D §5.2.1.1 |
| Auth tag | 16 bytes, `authTagLength: 16` **passed explicitly** | SP 800-38D §5.2.1.2 |
| Nonce source | RBG, ≥96-bit random field | SP 800-38D §8.2.2 |
| Nonce uniqueness | per key, DB-enforced + retry | SP 800-38D §8.2 |

**AAD** binds exactly `polyhunter-secret-envelope-v1`, `secretId`, `tenantId`, `purpose`, `keyVersion`, serialized as a fixed-order JSON array of five strings.

## Keyring contract

- `POLYHUNTER_SECRET_ACTIVE_KEY_VERSION` — version used for writes and rotation targets
- `POLYHUNTER_SECRET_KEYRING_JSON` — `{"<keyVersion>": "<base64 raw 32-byte AES key>"}`

**NUNCA use: `NEXT_PUBLIC_*` para key material.** Next.js inlines every `NEXT_PUBLIC_*` into the browser bundle; no `NEXT_PUBLIC_SECRET` / `NEXT_PUBLIC_KEYRING` exists anywhere.

Fails closed on **12** malformed-keyring shapes, each with a dedicated integration test. Every path raises the single generic `VAULT_UNAVAILABLE`; no value, key or keyring text ever enters an error. `remove()` consults the keyring too, so an unconfigured vault reports unavailable for **every** operation rather than partially.

`.env.example` carries only variable **names** with empty placeholders.

## API

`GET /api/secrets`, `POST /api/secrets`, `GET|PUT|DELETE /api/secrets/[id]`, `POST /api/secrets/[id]/rotate`.

**PROIBIDO retornar: plaintext; ciphertext; nonce; auth tag; key; keyring; access token; refresh token; comprimento do secret; last4/suffix derivado do secret.** All enforced via a field-by-field allow-list projection.

- **No HTTP GET returns plaintext** — no plaintext-read endpoint exists; the contract is asserted not to contain `withDecryptedSecret` or `getPlaintextSecret`
- Write responses masked; no mutation echoes the request body
- All responses `no-store`
- Same-origin CSRF guard on all 4 mutations: 6 cross-origin values plus a missing `Origin` → 403 `cross_origin_rejected` before the service is touched

Error codes: `VAULT_UNAVAILABLE`, `SECRET_NOT_FOUND`, `SECRET_FORBIDDEN`, `SECRET_INTEGRITY_FAILURE`, `KEY_VERSION_UNAVAILABLE`, `NONCE_COLLISION`, `INVALID_SECRET_INPUT`. Six unrecognized throws — including a raw `ECONNRESET` carrying `connect ECONNRESET 10.0.0.5:5432` — all collapse to `VAULT_UNAVAILABLE`. Raw Node/OpenSSL errors never reach a client.

## Authorization

| Capability | `owner` | `admin` | `member` | `platform_admin` alone |
| --- | --- | --- | --- | --- |
| `secret:metadata` / `secret:write` / `secret:delete` / `secret:rotate` | allow | allow | **DENY** | **DENY** |

Platform scope does not imply tenant scope. Revoked on the **next authoritative request** after a suspended user, membership or tenant.

**Não crie: `getPlaintextSecret(): string`.** The only path is server-only `withDecryptedSecret(context, handle, callback)`, which zeroes the buffer in a `finally`. **Não alegue que JavaScript garante limpeza total da heap** — zeroing is best effort and the OpenSSL copy inside a `KeyObject` cannot be zeroed from JS.

## Test counts

| Suite | Result |
| --- | --- |
| Unit (host) | **166 passed / 10 files** |
| Integration in container, real PostgreSQL 17 | **43/43** — 29 secret-vault, 10 identity-RBAC (**WO-002**), 4 tenancy (**WO-001**) |
| `npm run validate` | exit 0 — lint, format, typecheck clean; Next.js 16.3.8 build; **0 audit vulnerabilities** |

## Tamper evidence

GCM roundtrip · same plaintext → different nonce and ciphertext · tampered ciphertext / tag / nonce · tampered tenant AAD · tampered purpose · tampered `secretId` · tenant A/B swap · wrong key · unknown key version (`KEY_VERSION_UNAVAILABLE`) · malformed keyring (12 shapes) · wrong key length · missing active key · envelope transplanted onto another tenant's row → `SECRET_INTEGRITY_FAILURE` · plaintext absent from GET · ciphertext absent from GET · masked write responses · plaintext absent from logs, errors and stack traces · keyring absent from the client bundle.

## Nonce collision evidence

Production uses `randomBytes(12)`. On a `UNIQUE (key_version, nonce)` violation the vault generates a fresh nonce and retries, bounded at `MAX_NONCE_ATTEMPTS = 3`; exhaustion raises `NONCE_COLLISION`. **A reused nonce is never persisted.**

- collision → retry → **success**, forced against a nonce actually stored under the active key
- repeated collision → bounded failure, `expect(draws).toBe(3)`

**Bug found while proving this:** drizzle wraps driver errors in `DrizzleQueryError`, whose own `code`/`constraint` are absent and whose `cause` is the real `pg` error — so the detector missed every genuine collision. Fixed by walking the cause chain, matching the **constraint name** rather than SQLSTATE `23505` alone (which would also catch the PK and every other unique index, turning a nonce retry into a silent infinite loop).

## Rotation and concurrency evidence

Single-record rotation using PostgreSQL `SELECT … FOR UPDATE` — **not** an in-memory mutex. Lock, then one atomic `UPDATE` moving ciphertext, nonce, auth tag, `key_version` and `rotated_at` together. `id`, `tenant_id`, `purpose`, `created_at` preserved; temporary plaintext zeroed in `finally`.

| Race | Attempts | Result |
| --- | --- | --- |
| rotate × rotate | 2 | serialized, never mixes envelope metadata |
| update × rotate | 5 | consistent |
| delete × rotate | 4 | deterministic, no resurrection |
| 8 parallel creates | 8 | no nonce reuse under the active key |

`already_current` returns without materializing plaintext and leaves bytes and timestamps stable. Missing old key → **FAIL CLOSED**. Corrupted ciphertext/tag/AAD → **FAIL CLOSED without overwriting the row** (byte-for-byte snapshot comparison).

## Docker status

`docker compose config` OK · web `GET /` **HTTP 200** · PostgreSQL **healthy** · worker **running** — proven **both without a keyring** (vault `VAULT_UNAVAILABLE`, rest of the app healthy) and **with** an ephemeral two-key keyring probed inside the container against the real keyring module.

The ephemeral keys were generated in memory and passed as environment variables: **never written to `.env`, never printed, never committed.** They were discarded by recreating the containers with the blank compose defaults, and their absence was re-verified:

```
POLYHUNTER_SECRET_ACTIVE_KEY_VERSION=[<unset>]
POLYHUNTER_SECRET_KEYRING_JSON=[<unset>]
isVaultKeyringConfigured(cfg) = false
readVaultKeyringFromEnvironment() -> VAULT_UNAVAILABLE
```

Client bundle (`.next/static`, the only browser-downloaded directory) scanned **while a keyring was configured**: 9 chunks, **0** matches for the keyring variables, the envelope label, `createSecretKey` or any 32-byte base64 literal. **Stack left running in the no-keyring state.**

## Artifact digest

| | |
| --- | --- |
| Input artifact | `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c` |
| **Output artifact** | **`sha256:f810df3a64aa15b99e477006a39c399eb43d9b59c635376d942e89dc15cc17c8`** |

**The rebuild branch was mandatory.** `Dockerfile.dev` copies `packages/db/package.json`, and this Work Order added the `./server/vault` export mapping to it — a build input change, so the identical-digest shortcut was unavailable.

Unchanged: `package-lock.json`, `Dockerfile.dev`, base image `node:24-bookworm-slim`, every dependency version. `npm audit --audit-level=high` → **0 vulnerabilities**. `compose.yaml` changed only in the web service `environment:` block, which is not a build input.

## VEX state

`docker scout` v1.24.0. Because the artifact is new, **no disposition could be carried forward by reference** — all 25 were re-proven.

| Outcome | Count |
| --- | --- |
| NOT_AFFECTED | **25** |
| UNDER_INVESTIGATION | **0** |
| AFFECTED | **0** |

Row-by-row, prior artifact vs new: **80 rows identical, 2 added, 0 removed; HIGH/CRITICAL 25 → 25.**

The 2 added rows are **below HIGH/CRITICAL** and originate outside this repository's dependency graph — `CVE-2026-105712` (LOW, Debian `gnupg2`/`gpgv` from the base image) and `CVE-2026-104844` (MEDIUM, `postcss-selector-parser@7.1.4` bundled inside npm's own `node_modules`). **Neither appears in `package-lock.json`** (grep count 0). Their appearance indicates the scanner datasource advanced between scans, not that this Work Order added a dependency. Recorded, not suppressed.

**Suppressions added: 0. Ignore rules: 0. Severity downgrades: 0.**

> Severity is parsed from `message.text`. SARIF `level` carries the VEX/status channel, not vulnerability severity — reading `level` reports **0 HIGH/CRITICAL on an image that has 25**. Caught and corrected before the reconciliation was written.

Expiry: a NOT_AFFECTED disposition expires at a new image digest.

## Stop state

**`READY_FOR_INDEPENDENT_AUDIT`**

- `.engineering/CHECKPOINT.json` **untouched** — blob `6c823956bd6013b51a6327718c8260acd5e39ef5`, `phase=M01_INCREMENT_IMPLEMENTED`, `stopState=STOP_AFTER_PH_M01_WO_002`, `nextLegalStage=AWAIT_OWNER_DIRECTION`
- Checkpoint delta submitted as **PROPOSED / NOT_PROMOTED**
- `liveTradingAuthorized` remains **`false`** — no order placed, no signing authority, no credential handled, no Polymarket surface touched
- This PR is **not merged** and is to remain Draft

### For the independent auditor

1. **The drizzle `DrizzleQueryError` cause chain** — confirm no other error-classification path in the vault inspects only the thrown error.
2. **AAD reconstruction on read** — the binding is only as strong as the values the reader rebuilds it from; that they come from the authoritative `TenantContext` and the stored row, not caller input, is load-bearing.
3. **The `(key_version, nonce)` retry interaction** — constraint-name match, not SQLSTATE alone, and the bounded count of 3.
4. **Buffer zeroing as best effort** — no claim of total heap cleansing anywhere.
5. **The rebuild branch** — `packages/db/package.json` is a Docker build input; the identical-digest shortcut was correctly unavailable.

Context Lock re-verified after all edits: **frozenSources 17/17 byte-identical** (no stale context); the only 4 mutated runtime fingerprints are the surfaces this Work Order was admitted to change.
