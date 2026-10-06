# PH-M01-WO-003 — Encrypted Secret Vault

Server-only encrypted secret vault. AES-256-GCM envelopes in PostgreSQL, a fail-closed server-only keyring, tenant-bound authorization, a masked HTTP surface, atomic key rotation and nonce-collision handling.

**STOP STATE: `READY_FOR_INDEPENDENT_AUDIT`**

## Corrections in this round

Independent audit review `5430901717` raised CR-01..CR-04 against HEAD
`96dd096f23bf5fa9bded63b159b5fcacd94ab301`. All four are addressed below.
**The AES-256-GCM architecture was accepted and was not revisited.**

| CR | Finding | Resolution |
| --- | --- | --- |
| **CR-01** | Clean checkout failed: `./server/vault` resolved to `./dist/server/vault/index.js`, and `npm test` runs before any build. | Source-first workspace exports — see "Build hermeticity" below. |
| **CR-02** | Authorization used `context.role` as the capability authority. | The decision now derives **only** from `tenant_memberships.role` in PostgreSQL, inside the mutation's own transaction. |
| **CR-03** | `GET /api/secrets/[id]` was missing. | Implemented, metadata-only, no cross-tenant existence oracle. |
| **CR-04** | The VEX registered `NOT_AFFECTED` as current approved state. | Replaced with a proposed-state machine. All 25 rows are `UNDER_INVESTIGATION`. |

## Build hermeticity (CR-01)

**One strategy: source-first workspace exports.** Every `exports` condition in every
workspace package resolves to `./src/**/*.ts`, never a build output. Consumers use `.ts`
specifiers (TypeScript `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`);
Next.js transpiles the workspace sources itself via `transpilePackages`, for the dev
server **and** the production build.

This removes `dist` from the runtime equation entirely, which is why it is hermetic
rather than a build-ordering fix. Two alternatives were rejected: build-before-test
(Compose bind-mounts `packages/db` over any in-image `dist`, so it would require
building inside the running container on every restart and still leaves the stale-host
trap open), and a Vitest-only alias (a test-only mask by definition, which CR-01
forbids).

**It is not a test-only mask:** six workspace aliases were deleted, so every resolution
goes through the real `exports` map.

Proven from a tree with no `packages/**/dist` anywhere: `npm ci` → exit 0 →
`npm run validate` → exit 0 (173 tests, 0 vulnerabilities, production build OK) →
`rm -rf packages/*/dist` → Docker rebuild and `up` → real request to `/api/secrets`
**and** `/api/secrets/<uuid>`. Both returned the sanitized
`401 {"error":"unauthenticated","reason":"provider_not_configured"}` with **zero**
module-resolution errors.

## Authorization (CR-02)

A capability decision is taken **only** from the current authoritative
`tenant_memberships.role` in PostgreSQL. `context.role` carries no authority; it is a
consistency assertion, and **any divergence fails closed** — so privilege cannot widen
in either direction.

| Capability | `owner` | `admin` | `member` | `platform_admin` without current tenant owner/admin |
| --- | --- | --- | --- | --- |
| `secret:metadata` / `secret:write` / `secret:delete` / `secret:rotate` | allow | allow | **DENY** | **DENY** |

**TOCTOU is closed by the database, not by a mutex.** The role probe runs inside the
vault's own transaction and ends with `FOR SHARE OF ph_membership`, which blocks a
concurrent `UPDATE tenant_memberships SET role` for the life of that transaction. That
is a database property, so it holds against a second vault process in another container
— something an in-memory mutex could never provide, and which CR-02 explicitly forbade.
`OF ph_membership` restricts the lock to that one row, so `users`/`tenants` stay
read-only and no deadlock with tenant administration arises. All seven operations take
the lock in the same order, so concurrent rotations still serialize on the secret row
instead of deadlocking. Every mutation authorizes as the **first statement** inside its
transaction, before the row lock and before any secret material is read.

Five mandatory tests against real PostgreSQL, each driving **all seven** operations:

| Adversary | Required | Result |
| --- | --- | --- |
| forged `owner` context over a real `member` membership | every op `SECRET_FORBIDDEN` | PASS |
| forged `admin` context over a real `member` membership | every op `SECRET_FORBIDDEN` | PASS |
| stale downgrade after context resolution | every op denies on the **new** role | PASS |
| role mismatch, both directions | no privilege widening either way | PASS |
| `platform_admin` with no current owner/admin membership | continues to `DENY` | PASS |

The forged-context tests point at a tenant containing a **genuine encrypted row** the
caller must not read, so the test would fail loudly rather than pass on an empty tenant.

> **Withdrawn claim.** An earlier version of this PR asserted that "a forged context is
> structurally refused". That assertion was not supported — the shape check decided the
> capability. It is withdrawn and replaced by the tests above.

## Execution HEAD

| | |
| --- | --- |
| Branch | `feat/ph-m01-encrypted-secret-vault` |
| Base | `main@af6235d2164171985af6152ba03835826ace3cdb` |
| Merge-base | `af6235d2164171985af6152ba03835826ace3cdb` — exact, zero drift |
| Artifact | `sha256:8bd3e85a206492de832dd95575b0004165e7368b53427ba887547743019c22c4` |

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

### Single-record metadata read (CR-03)

New in this round: `GET /api/secrets/[id]`, metadata only, via `service.getMetadata()` and
the **same** allow-list as the collection route. The response carries exactly
`id`, `purpose`, `configured`, `createdAt`, `updatedAt`, `rotatedAt`, `rotation` — never
plaintext, ciphertext, nonce, auth tag, key version, key material, length or `last4`.

**No cross-tenant existence oracle.** `getMetadata` returns `null` for both a genuinely
absent id and another tenant's id, so the HTTP layer cannot distinguish them even in
principle; the test asserts the two responses are **byte-identical** (same 404, same body,
same `Cache-Control`) and that the id is never echoed. A `member` is refused, and so is a
`platform_admin` without a current owner/admin tenant membership.

Covered by 7 unit tests (including a hostile service trying to smuggle envelope fields
through a widened object — the projection still drops them) and 3 integration tests
against real PostgreSQL.

Error codes: `VAULT_UNAVAILABLE`, `SECRET_NOT_FOUND`, `SECRET_FORBIDDEN`, `SECRET_INTEGRITY_FAILURE`, `KEY_VERSION_UNAVAILABLE`, `NONCE_COLLISION`, `INVALID_SECRET_INPUT`. Six unrecognized throws — including a raw `ECONNRESET` carrying `connect ECONNRESET 10.0.0.5:5432` — all collapse to `VAULT_UNAVAILABLE`. Raw Node/OpenSSL errors never reach a client.

**Não crie: `getPlaintextSecret(): string`.** The only path is server-only `withDecryptedSecret(context, handle, callback)`, which zeroes the buffer in a `finally`. **Não alegue que JavaScript garante limpeza total da heap** — zeroing is best effort and the OpenSSL copy inside a `KeyObject` cannot be zeroed from JS.

## Test counts

| Suite | Result |
| --- | --- |
| Unit (host) | **173 passed / 10 files** |
| Integration in container, real PostgreSQL 17 | **51/51** — 37 secret-vault, 10 identity-RBAC (**WO-002**), 4 tenancy (**WO-001**) |
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

Client bundle, scanned against a **real production build** (a `next dev` server emits no
client chunks, so scanning there would prove nothing): 9 chunks, **0** matches for the
keyring variables, `createCipheriv`/`createDecipheriv`/`setAuthTag`, `authTag`,
`ciphertext`, or any `api/secrets` reference. The same patterns **do** appear in
`.next/server` — the positive control proving the scan can detect them. **Stack left
running in the no-keyring state.**

## Artifact digest

| | |
| --- | --- |
| Input artifact | `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c` |
| First rebuild (**superseded**) | `sha256:f810df3a64aa15b99e477006a39c399eb43d9b59c635376d942e89dc15cc17c8` |
| **Final artifact** | **`sha256:8bd3e85a206492de832dd95575b0004165e7368b53427ba887547743019c22c4`** |

**The rebuild branch was mandatory — and applied twice.** `Dockerfile.dev` copies
`packages/db/package.json`. This Work Order added the `./server/vault` export mapping
(a build input change), and CR-01 changed the same file again so that `exports` resolves
to `./src` rather than a build output. Both are Docker **build inputs**, so the
identical-digest shortcut was unavailable each time.

Unchanged across both rebuilds: `package-lock.json` (sha256 `484c8cd5…`), root
`package.json` (sha256 `746e6bed…`), `Dockerfile.dev`, base image
`node:24-bookworm-slim`, every dependency version. `npm audit --audit-level=high` →
**0 vulnerabilities**.

## VEX state

`docker scout` v1.24.0, against the final artifact. The artifact is new, so no
disposition could be carried forward by reference.

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

**This is the state CR-04 requires, and it is deliberate.** The executor proposes
dispositions; it does not approve them. No NOT_AFFECTED is registered as current approved
state — `independentAuditor` and `ownerApproval` are `null` on every row. Approving is
the auditor's and the owner's act alone.

Row-by-row, prior artifact vs final: **80 rows identical, 2 added, 0 removed;
HIGH/CRITICAL 25 → 25.**

The 2 added rows are **below HIGH/CRITICAL** and originate outside this repository's dependency graph — `CVE-2026-105712` (LOW, Debian `gnupg2`/`gpgv` from the base image) and `CVE-2026-104844` (MEDIUM, `postcss-selector-parser@7.1.4` bundled inside npm's own `node_modules`). **Neither appears in `package-lock.json`** (grep count 0). Their appearance indicates the scanner datasource advanced between scans, not that this Work Order added a dependency. Recorded, not suppressed.

**Suppressions added: 0. Ignore rules: 0. Severity downgrades: 0.**

> Severity is parsed from `message.text`. SARIF `level` carries the VEX/status channel, not vulnerability severity — reading `level` reports **0 HIGH/CRITICAL on an image that has 25**. The parsing now lives in a real `.mjs` file that **throws** on any unrecognised severity rather than reporting a count from a broken parse; shell-escaped inline regexes silently failed three times before that.

### Prior proofs preserved, not genericised

Each row carries the prior independent proof **verbatim** plus a six-axis re-measurement
(exact component, exact version, architecture, installed-file SHA-256s, runtime and
reachability premise, and whether this delta alters it). `premiseAltered` is **computed**
from those measurements, never hard-coded.

- **Objective equivalence on `8bd3e85a…`:** the full **88-package dpkg inventory diffs to
  zero** against the WO-002 baseline, and all four native artifacts — `libstdc++.so.6.0.30`,
  `node`, `sharp-linux-x64-0.35.5.node`, `libvips-cpp.so.8.18.7` — are **byte-identical**
  by SHA-256.
- **`CVE-2026-95619` keeps its specific foundation:** the accepted **aligned-allocation /
  arithmetic-bound proof**, including the `sz ≤ 65519` vs `2^64−3` threshold (margin
  ≥ `2^48`) and the 16-bit JPEG `APP2` marker cap that makes the prerequisite
  arithmetically unsatisfiable. It was **not** replaced by a generic statement about regex
  or route inputs — precisely what CR-04 forbade.
- WO-008 supersedes WO-007 for the two libstdc++ rows, so reading WO-007 would resurrect a
  proof the auditor already threw out.
- **One honest limitation:** `nm`/`objdump`/`readelf` are **not installed in this image**,
  so the symbol-presence premise was **not re-derived**. It is carried by the byte-identical
  SHA-256 of `libstdc++.so.6.0.30` — the same file the prior proofs disassembled. **No
  claim about symbol presence is made anywhere.**

Expiry: a NOT_AFFECTED disposition expires at a new image digest. This rebuild is exactly
such a case, which is why every row returns to UNDER_INVESTIGATION with only a *proposed*
status.

## Stop state

**`READY_FOR_INDEPENDENT_AUDIT`**

- **GitHub Actions Validate is SUCCESS on this branch.** The audit target is the commit
  carrying the code and evidence changes, `59ae44b6272b46a0a5d3a04b50babb73405fa5f7`,
  validated by run `37497134253`, all 12 steps of `Node 24 validation` green. Every commit
  after it is documentation-only (recording the CI result itself) and each was separately
  validated green: `87f80dc…` → run `37497479624`, `874be61…` → run `37497732713`. These
  runs double as independent CR-01 proofs: the runner does a clean Git checkout and runs
  the gates with no `packages/**/dist`, which is exactly the state that failed Validate #70
  (`37487821234`, head `96dd096f`).
- `.engineering/CHECKPOINT.json` **untouched** — blob `6c823956bd6013b51a6327718c8260acd5e39ef5`, `phase=M01_INCREMENT_IMPLEMENTED`, `stopState=STOP_AFTER_PH_M01_WO_002`, `nextLegalStage=AWAIT_OWNER_DIRECTION`
- Checkpoint delta submitted as **PROPOSED / NOT_PROMOTED**
- `liveTradingAuthorized` remains **`false`** — no order placed, no signing authority, no credential handled, no Polymarket surface touched
- This PR is **not merged** and is to remain Draft

### For the independent auditor

1. **`FOR SHARE OF ph_membership` as the TOCTOU control (CR-02)** — verify it blocks a concurrent `UPDATE tenant_memberships SET role` for the life of the vault transaction, and that it holds against a **second connection**. That is the property an in-process mutex cannot provide.
2. **The fail-closed rule on `role` divergence (CR-02)** — CR-02 allowed deriving exclusively from the DB *or* failing closed; this does both. Confirm the stricter reading rejects no legitimate caller.
3. **The source-first exports strategy (CR-01)** — re-run the clean-checkout proof from a tree with no `packages/**/dist` and confirm both routes resolve without a module error.
4. **The VEX is in proposed state (CR-04)** — confirm no row carries a NOT_AFFECTED current status and that `independentAuditor`/`ownerApproval` are null throughout.
5. **`CVE-2026-95619`'s specific proof** — its basis must remain the aligned-allocation arithmetic bound, not a generic reachability sentence.
6. **The drizzle `DrizzleQueryError` cause chain** — confirm no other error-classification path in the vault inspects only the thrown error.
7. **AAD reconstruction on read** — the binding is only as strong as the values the reader rebuilds it from; that they come from the authoritative `TenantContext` and the stored row, not caller input, is load-bearing.
8. **The `(key_version, nonce)` retry interaction** — constraint-name match, not SQLSTATE alone, and the bounded count of 3.
9. **Buffer zeroing as best effort** — no claim of total heap cleansing anywhere.
10. **Two probes that reported false results were corrected, and both corrections are recorded rather than quietly applied**: a `find` census that first reported "0 perl modules" from shell-quoting damage (correct: 164 `.pm`, `Socket.pm` at 2 paths, kept as a non-zero control), and an `nm` symbol scan returning `0` because `nm` is not installed in the image.

Context Lock re-verified after all edits: **frozenSources 17/17 byte-identical** (no stale context); the only 4 mutated runtime fingerprints are the surfaces this Work Order was admitted to change.
