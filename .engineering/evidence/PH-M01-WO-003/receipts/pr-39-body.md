# PH-M01-WO-003 — Encrypted Secret Vault

Server-only encrypted secret vault. AES-256-GCM envelopes in PostgreSQL, a fail-closed
server-only keyring, tenant-bound authorization, a masked HTTP surface, atomic key
rotation and nonce-collision handling.

**STOP STATE: `READY_FOR_FINAL_INDEPENDENT_AUDIT`**

## Correction round CR-05..CR-08 (independent review `5431841905`)

Review `5431841905` (raised against HEAD `a55ef185b135f2ab8e7593989e63c90f5be2af49`)
closed CR-01..CR-04 and required four more corrections. All four are addressed.
**The AES-256-GCM architecture remains accepted and was not revisited.**

| CR | Finding | Resolution |
| --- | --- | --- |
| **CR-05** | `CVE-2026-8376` had been restated as `vulnerable_code_not_in_execute_path` ("Perl is never executed") — a semantic regression from the owner-approved WO-002 disposition. | Restored to `vulnerableCodePresent: true` + `vulnerable_code_cannot_be_controlled_by_adversary`, resting on the 32-bit-build arithmetic bound. "Perl is never executed" demoted to explicitly-labelled secondary defence-in-depth. A mechanical gate now **throws** before writing output if any of the 25 rows diverges from the accepted record; both failure modes reproduced as negative controls. |
| **CR-06** | The public package surface exposed raw decrypt/keyring capabilities (`openSecret`, `sealSecret`, `VaultKeyring`, keyring resolvers) and the `./server/vault/envelope` + `./server/vault/keyring` subpaths — a generic side door around the audited `withDecryptedSecret` boundary. | Public surface narrowed to `createSecretVault`, the `SecretVault`/`RotateOutcome`/`SecretVaultOptions` types, two **type-only** re-exports and the two configuration variable **names**. Both subpaths deleted from `packages/db/package.json`. Crypto tests import internals by relative path. New workspace-boundary regression tests fail if the door reopens — including under an innocuously-named subpath. |
| **CR-07** | `errorResponse()` could emit a 400/401/403/404/500/503 with no explicit cache directive, leaving the policy to framework/intermediary defaults. | `Cache-Control: no-store` is a **mandatory default** merged last inside the two response factories; every former `NextResponse.json` call site converted; `Pragma: no-cache` + `Expires: 0` added. 20 new tests cover all seven frozen codes, the validation 400, single-GET not-found, cross-tenant not-found (byte-identical), 401/403 refusals and the CSRF 403. |
| **CR-08** | Governance records (real PR body, test counts, artifact digest, VEX state, Work Order header) were stale and contradicted the final artifact. | This body synchronised with the exact heads, artifact `aee3ad8c…`, CI runs, counts, migration/Docker/scan status and the proposed VEX state; Work Order header moved to `EXECUTED / READY_FOR_INDEPENDENT_AUDIT`; evidence bundle, checkpoint delta and receipts regenerated for the new digest. `.engineering/CHECKPOINT.json` **untouched**. |

## Execution HEAD

| | |
| --- | --- |
| Audit target (code + tests + evidence) | `7511ec76a545154999d4b419f01529163898daa3` — contains the code commit `025ff1eb87cf2b904e68f0106b7e75cbda2ca7b7` |
| GitHub Actions Validate | run `37507882222` — **SUCCESS**, `Node 24 validation` job green |
| CodeRabbit | **success** on the same commit (review skipped while the PR is a draft — CodeRabbit's configured behavior, status green) |
| Branch | `feat/ph-m01-encrypted-secret-vault` |
| Base | `main@af6235d2164171985af6152ba03835826ace3cdb` |
| Merge-base | `af6235d2164171985af6152ba03835826ace3cdb` — exact, zero drift |
| Artifact | `polyhunter-dev:local@sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2` |
| Superseded artifacts | `sha256:8bd3e85a…` (CR-01..CR-04 round), `sha256:f810df3a…` (first rebuild), `sha256:eddda17a…` (inherited from WO-002) |

**The rebuild was mandatory.** `Dockerfile.dev` copies `packages/db/package.json`, and
CR-06 removed the two vault subpaths from that file — a Docker build input. So this
round applies the rebuild branch: new digest, fresh `docker scout` scan, full VEX
revalidation against `aee3ad8c…`. Unchanged across all three rebuilds:
`package-lock.json`, root `package.json`, `Dockerfile.dev`, base image
`node:24-bookworm-slim`, every dependency version. Verified on the image itself:
`/workspace/packages/db/package.json` inside the running container carries the
four-subpath export map with no envelope/keyring entry.

Any commit after the audit target is **documentation-only** (recording the CI result
itself) and carries its own green run, kept current in this section.

**Other checks on this HEAD, recorded not suppressed:** Socket Security — pass.
SonarCloud Code Analysis — **failure, pre-existing**: it fails identically on the
previously audited heads (`a55ef18`, `59ae44b`) on "New Code" ratings, with the same 10
issue instances (list recorded in the checkpoint delta). Two worth naming: one hit is
the local-dev `POSTGRES_PASSWORD` line transcribed inside a *superseded* receipt
(explicitly labelled non-production, untracked `.env` source), and the "critical" sort
rule is `Object.keys(...).sort()` on canonical key versions — default sort is UTF-16
order, which is deterministic, while the rule's suggested `localeCompare` would make it
locale-dependent. None of the 10 is introduced by this round; none is a tenant secret.

## CR-05 — `CVE-2026-8376` restored to the accepted disposition

| Field | Accepted WO-002 value | The WO-003 regression | Now |
| --- | --- | --- | --- |
| `vulnerableCodePresent` | `true` | *(unstated)* | **`true`** |
| `proposedJustification` | `vulnerable_code_cannot_be_controlled_by_adversary` | `vulnerable_code_not_in_execute_path` | **restored** |
| `vexStatus` | approved NOT_AFFECTED | — | `UNDER_INVESTIGATION` (new digest ⇒ expired) |
| `independentAuditor` / `ownerApproval` | approved | — | **`null`** |

The accepted proof is an **architecture/arithmetic bound, not a reachability argument**.
The vulnerable code IS present — `Perl_study_chunk` ships in `perl-base 5.36.0-7+deb12u3`
on this artifact. What an adversary cannot do is DRIVE IT INTO THE OVERFLOW CONDITION,
because the advisory scopes the defect to 32-bit ILP32 builds and this artifact is
amd64 / ELF64 with `ivsize=8`, `longsize=8`, `ptrsize=8`, `LONG_BIT=64`. Reachability is
therefore irrelevant to the disposition — which is why "Perl is never executed" cannot
carry it: that claim would expire the moment anything in the image invoked perl.

**A gate that fails instead of restating.** `vex-state-machine.mjs` compares every
proposed `(CVE, vulnerableCodePresent, proposedJustification)` triple against the
accepted record and **throws before writing any output** on any divergence. Negative
controls (receipt `15`, re-verified this round in receipt `22`): the audit's exact
mutation and the historical defect mechanism both halt the script. **Answer to "did any
other row change its justification": no — 25 compared, 0 divergences.**

## CR-06 — the public vault surface, enforced by absence

| Public member | Kind | Why it is legitimately public |
| --- | --- | --- |
| `createSecretVault` | runtime | The single construction entry point. |
| `SecretVault` · `RotateOutcome` · `SecretVaultOptions` | types | The facade and its option/return shapes. |
| `KeyringConfiguration` · `NonceSource` | **type-only** | Name the option shapes; a type carries no runtime capability. |
| `ACTIVE_KEY_VERSION_ENV` · `KEYRING_JSON_ENV` | runtime (strings) | The two configuration variable **names** — non-sensitive by construction. |

**Removed from the public surface:** `openSecret`, `sealSecret`, `randomNonceSource`,
`secretEnvelopeAad`, `SealedEnvelope`, `assertProtocolNonce`,
`assertSecretPlaintextBytes`, `VaultKeyring`, `parseVaultKeyring`,
`readVaultKeyringFromEnvironment`, `isVaultKeyringConfigured`,
`keyringEnvironmentVariables` — and the `./server/vault/envelope` +
`./server/vault/keyring` subpaths are gone from `packages/db/package.json` entirely.

Three regression tests in `tests/workspace-boundaries.test.ts` fail if the door
reopens: the export map must match `^\./server[a-z/-]*$` with no `envelope`/`keyring`
name **and** the `./server/vault` target must be exactly `./src/server/vault/index.ts`
(so the door cannot reopen under an innocuous name by pointing at `envelope.ts`); the
vault entry's **entire runtime export list** is pinned by dynamic import; and no
production file outside the vault may even name a raw primitive. Tests reach internals
by relative path — the production API was not widened for test convenience.

**The plaintext path remains exactly one thing:** `withDecryptedSecret(context,
purposeScopedHandle, callback)` — tenant scope, purpose scope, buffer zeroed in a
`finally` (best-effort; no claim of total heap cleansing, and the OpenSSL copy inside a
`KeyObject` cannot be zeroed from JavaScript).

## CR-07 — `Cache-Control: no-store` is a mandatory default

**The defect.** `NO_STORE_HEADERS` was passed at eleven individual call sites, and
`errorResponse()` — the helper every non-success goes through — treated headers as
*optional*. `VAULT_UNAVAILABLE`, `SECRET_FORBIDDEN`, `SECRET_NOT_FOUND`,
`SECRET_INTEGRITY_FAILURE` and `INVALID_SECRET_INPUT` could reach a client with no cache
directive at all. A cached error is not a lesser problem than a cached success: a 404 is
an existence oracle and a 503 can carry a reason.

**The fix is structural.** Two factories — `jsonResponse(body, status, headers?)` and
`errorResponse(code, headers?)` — are now the only way a response is constructed, and
the mandatory keys are merged **last**, so no call site can downgrade the policy by
supplying its own `Cache-Control`. `Pragma: no-cache` and `Expires: 0` cover HTTP/1.0
intermediaries and legacy caches predating RFC 9111 §5.2.2.5.

20 tests cover: all seven frozen codes (`INVALID_SECRET_INPUT` 400, `SECRET_FORBIDDEN`
403, `SECRET_NOT_FOUND` 404, `SECRET_INTEGRITY_FAILURE` 500, `VAULT_UNAVAILABLE` /
`KEY_VERSION_UNAVAILABLE` / `NONCE_COLLISION` 503), the validation 400, the single-GET
not-found, the cross-tenant not-found (asserted **byte-identical** to the absent-id
response, header included), the 401 and 403 access refusals, and the CSRF 403 — each
asserting the body carries no plaintext or envelope material. Verified live against the
running stack as well.

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

Migrations applied twice — the second run is a **no-op, not an error**. Live schema
after both runs: `encrypted_secrets, identity_links, platform_roles,
tenant_memberships, tenants, users`; `drizzle.__drizzle_migrations = 3`.
**No `trading_accounts`, no Polymarket schema**: `information_schema.tables` returns 0
tables matching `%polymarket%`, `%trading%` or `%wallet%`.

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

**Error policy:** `VAULT_UNAVAILABLE`, `SECRET_NOT_FOUND`, `SECRET_FORBIDDEN`,
`SECRET_INTEGRITY_FAILURE`, `KEY_VERSION_UNAVAILABLE`, `NONCE_COLLISION`,
`INVALID_SECRET_INPUT`. Six unrecognized throws — including a raw `ECONNRESET`
carrying `connect ECONNRESET 10.0.0.5:5432` — all collapse to `VAULT_UNAVAILABLE`.

**Authorization:** capability is decided ONLY from the current
`tenant_memberships.role` in PostgreSQL, inside the mutation's own transaction, under
`FOR SHARE OF ph_membership` (closes TOCTOU as a database property, not an in-memory
mutex). Any divergence from `context.role` fails closed in both directions.
`member` and bare `platform_admin` are denied every `secret:*` capability.

## Test counts

| Suite | Result |
| --- | --- |
| Unit (host) | **189 passed / 10 files** (`secret-vault-http` 15 → 35 for CR-07; `workspace-boundaries` 5 → 8 for CR-06) |
| Integration in container, real PostgreSQL 17 | **51/51** — 37 secret-vault, 10 identity-RBAC (**WO-002 regression**), 4 tenancy (**WO-001 regression**) |
| `npm run validate` | exit 0 — lint, format, typecheck clean; Next.js 16.3.8 production build; **0 audit vulnerabilities** |

`npm audit --audit-level=high`: 0. `git diff --check`: clean.

## VEX on the final digest `aee3ad8c…`

`docker scout` v1.24.0, unfiltered. 82 rows scanned, **25 HIGH/CRITICAL**:

| Field | Value |
| --- | --- |
| `vexStatus = UNDER_INVESTIGATION` | **25** |
| `proposedVexStatus = NOT_AFFECTED` | **25** |
| `vexStatus = AFFECTED` | **0** |
| `independentAuditor` set | **0** |
| `ownerApproval` set | **0** |
| premises altered by this delta | 0 (each premise individually re-measured) |
| rows diverging from the accepted WO-002 record | 0 |

**The executor proposes; it does not dispose.** No NOT_AFFECTED is registered as
current approved state; every row carries `independentAuditor: null` and
`ownerApproval: null`. The WO-002 approvals were given on `eddda17a…` and **expired at
this digest** by the expiry rule — what is preserved by reference is the prior
row-specific analysis, never the approval.

Objective equivalence on `aee3ad8c…`: the 88-package dpkg inventory diffs to **zero**
against the WO-002 baseline; `libstdc++.so.6.0.30`, `node`, `sharp-linux-x64-0.35.5.node`
and `libvips-cpp.so.8.18.7` are **byte-identical** by SHA-256; architecture and runtime
unchanged. The 2 added rows (vs WO-002) are below HIGH/CRITICAL and outside this
repository's dependency graph (base-image `gnupg2`, npm-bundled
`postcss-selector-parser`) — recorded, not suppressed. Suppressions/ignore
rules/downgrades: **0**.

**Scan↔artifact binding (found and fixed this round).** docker scout 1.24.0's SARIF
contains **no image identity** at all, so the first revision of the binding check
passed *vacuously*; it now requires the scout stderr receipt to name the declared digest
or it refuses to write output — and it was observed to fail (negative control A,
receipt `22`). Structural evidence: a **digest-pinned re-scan**
(`polyhunter-dev@sha256:aee3ad8c…`, not the tag) whose SARIF is **byte-identical**
(`md5 f30da92d3318b5b0a4eba98b6d7dd01e`) to the committed scan.

**`CVE-2026-95619` keeps its specific proof:** the accepted aligned-allocation /
arithmetic-bound analysis (allocation `sz ≤ 65519` vs a `2^64−3` threshold — margin
≥ `2^48` — with the 16-bit JPEG `APP2` marker capping ICC length), reproduced verbatim
per row, not paraphrased into a generic reachability sentence. One honest limitation is
recorded: `nm`/`objdump`/`readelf` are not installed in this image, so no
symbol-presence claim is made anywhere; that premise rests on the byte-identical
SHA-256 of the same shipped file the prior proofs disassembled.

## Docker and scans

- Stack: PostgreSQL healthy, web HTTP 200, worker running, **0 module-resolution
  errors** in either service; `/api/secrets` and `/api/secrets/<uuid>` resolve.
- **Without a keyring: FAIL CLOSED.** Every vault operation reports
  `VAULT_UNAVAILABLE`; the rest of the app is fully healthy.
- With an **ephemeral, test-only keyring** generated in memory inside one container
  process (never written to `.env`, compose, a file, evidence or a log; buffers zeroed
  after): `create` → `withDecryptedSecret` (callback received the bytes; buffer zeroed
  in `finally`) → `rotate` (`already_current`) → `listMetadata` → `remove`, plus a
  **cross-tenant handle refused with `SECRET_FORBIDDEN`**. Stack left running in the
  no-keyring state.
- Repo-wide secret scan: 896 tracked files, **0** base64 literals decoding to a 32-byte
  key; the two `POLYHUNTER_SECRET_KEYRING_JSON` matches are the variable NAME inside
  test assertions that the value is empty.
- Client bundle vs server-side positive control across 12 patterns: **0** in
  `.next/static` (the only directory a browser downloads) against non-zero in
  `.next/server`. A pattern that returned 0 in both trees was caught and re-run under
  its real name — a probe absent from the control is a broken probe.

## Stop state

- `.engineering/CHECKPOINT.json` **untouched** (blob `6c823956bd6013b51a6327718c8260acd5e39ef5`);
  checkpoint delta submitted as **PROPOSED / NOT_PROMOTED**.
- PR #39 **not merged**, remains draft. No owner approval requested. No PH-M01-WO-004.
- `liveTradingAuthorized` remains **`false`** — no order placed, no signing authority,
  no credential handled, no Polymarket surface touched.

### For the independent auditor

1. Re-run the two negative controls (receipts `15`, `22`) — in particular the CR-05
   gate and the scan↔artifact binding, which was vacuous in its first revision.
2. Try to defeat the CR-06 surface tests: add an export a type-only re-export would
   mask, or re-point `./server/vault` at `envelope.ts` under the same subpath name.
3. Confirm the CR-07 mandatory keys merge last and that no call site constructs a
   response outside the two factories.
4. `CVE-2026-8376`: confirm the restored semantics read as intended and that "Perl is
   never executed" is never load-bearing.
5. `CVE-2026-95619`: confirm the basis is the arithmetic bound, not a generic sentence.
6. `FOR SHARE OF ph_membership` (CR-02) and the buffer-zeroing best-effort limitation —
   both stated plainly in the evidence bundle, section 17.
