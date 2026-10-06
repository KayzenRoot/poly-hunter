# PH-M01-WO-003 — CODEX EXECUTION BRIEF

Repository: KayzenRoot/poly-hunter
Branch: `feat/ph-m01-encrypted-secret-vault`
Base: `main@af6235d2164171985af6152ba03835826ace3cdb`
Issue: #38
Risk: HIGH_ASSURANCE / SECRETS

## READ FIRST

1. `.engineering/work-orders/PH-M01-WO-003.md`
2. `.engineering/context-locks/PH-M01-WO-003.json`
3. `.engineering/modules/PH-M01-IDENTITY-TENANCY-SECRETS.md`
4. `.engineering/SECURITY.md`
5. `.engineering/ARCHITECTURE.md`
6. `.engineering/DATA-MODEL.md`
7. `.engineering/TEST-BENCHMARK-PLAN.md`
8. ADR-0004, ADR-0005, ADR-0007
9. PH-M01-WO-002 implementation and evidence as regression authority

## PREFLIGHT

Before mutation:
- verify branch and exact merge-base;
- verify Context Lock fingerprints;
- verify PR #37 is merged;
- verify canonical checkpoint is `STOP_AFTER_PH_M01_WO_002 / AWAIT_OWNER_DIRECTION`;
- verify main post-merge Validate #68 succeeded;
- re-check Node.js 24 crypto docs and current NIST SP 800-38D status;
- verify no third-party crypto dependency is needed.

If merge-base/frozen source drift:
`BLOCKED_STALE_CONTEXT`.

## CRYPTO IMPLEMENTATION

Use Node.js built-in crypto only.

Required:
- `aes-256-gcm`;
- 32-byte AES key;
- 12-byte random nonce from `randomBytes(12)`;
- 16-byte auth tag;
- explicit `authTagLength: 16`;
- `createSecretKey` / KeyObject preferred;
- deterministic AAD binding:
  `["polyhunter-secret-envelope-v1", secretId, tenantId, purpose, keyVersion]`;
- `setAAD()` before update/final;
- set auth tag before decrypt final;
- any authentication failure fails closed.

No custom primitive.
No deterministic nonce.
No nonce from time/tenant/id alone.

## KEYRING

Server-only:
- `POLYHUNTER_SECRET_ACTIVE_KEY_VERSION`
- `POLYHUNTER_SECRET_KEYRING_JSON`

The JSON maps canonical key version -> base64 raw 32-byte AES key.

Requirements:
- exact base64 decode;
- every decoded key exactly 32 bytes;
- active key exists;
- malformed/missing config fails closed;
- blank config does NOT prevent base Docker startup;
- vault operations return sanitized unavailable state if config absent;
- no key/value in logs/errors/evidence/client bundle;
- no NEXT_PUBLIC secret variable.

Use injected deterministic keyrings in tests.

## DATABASE

Add only `encrypted_secrets` and its migration.

Required columns:
- id
- tenant_id
- purpose
- ciphertext
- nonce
- auth_tag
- key_version
- created_at
- updated_at
- rotated_at

Required DB constraints:
- tenant FK + explicit delete/update behavior;
- bounded canonical purpose;
- bounded canonical key_version;
- nonce length 12;
- auth_tag length 16;
- ciphertext nonempty;
- unique `(key_version, nonce)`.

Do not create trading_accounts.
Do not add provider-specific credential fields.

## AUTHORIZATION

Use verified current session + freshly resolved TenantContext.

Only owner/admin may:
- list secret metadata;
- write/create;
- replace/update;
- delete;
- rotate.

Member: DENY.

platform_admin alone: DENY tenant secret access.

Extend tenant capability matrix explicitly if needed.

Every persistence mutation/read must stay tenant-scoped and revalidate active membership/user/tenant state.

## PUBLIC API

Minimal routes only. No dashboard.

Allowed responses:
- id
- purpose
- configured=true
- timestamps
- non-sensitive rotation status

Forbidden responses:
- plaintext
- ciphertext
- nonce
- auth tag
- key version if unnecessary
- keyring/key material
- secret length
- secret suffix/last4
- auth/session token

No plaintext GET endpoint.

## INTERNAL CONSUMPTION

Create a server-only purpose-scoped handle/callback path.

Preferred:
`withDecryptedSecret(context, handle, callback)`

Properties:
- callback gets Buffer/Uint8Array;
- plaintext exists only for callback duration;
- best-effort zero buffer in finally;
- no generic serialize/get-plaintext API;
- no Polymarket caller in this Work Order.

## NONCE COLLISION DEFENSE

Production nonce source is crypto.randomBytes(12).

Database unique `(key_version, nonce)` is mandatory.

On unique collision:
- retry with fresh nonce;
- use a small fixed max retry count;
- if exhausted, fail closed with sanitized NONCE_COLLISION;
- never reuse the collided envelope.

Test with injected deterministic nonce source:
- collision once then success;
- repeated collision -> bounded failure;
- no DB row with reused nonce.

## ROTATION

Implement safe single-record re-encryption.

Required behavior:
1. authorize current tenant owner/admin;
2. lock authoritative secret row;
3. if already active key: explicit already_current result;
4. require old key version in keyring;
5. decrypt old envelope using recorded metadata/AAD;
6. encrypt under active key with fresh nonce;
7. update envelope + key_version + updated_at + rotated_at atomically;
8. preserve id/tenant/purpose/created_at;
9. zero temporary plaintext buffer in finally;
10. corruption/missing key/concurrency failure leaves old row intact.

No bulk rotation daemon.

## CONCURRENCY

Prove:
- concurrent write/rotate cannot produce mismatched ciphertext/nonce/tag/keyVersion;
- two rotations serialize safely;
- delete vs rotate/update fails deterministically without resurrecting a deleted secret.

Use DB row lock / transaction semantics rather than in-process mutex as authority.

## REDACTION

Never log request body/value/keyring/envelope material.

Sanitize errors:
- VAULT_UNAVAILABLE
- SECRET_NOT_FOUND
- SECRET_FORBIDDEN
- SECRET_INTEGRITY_FAILURE
- KEY_VERSION_UNAVAILABLE
- NONCE_COLLISION
- INVALID_SECRET_INPUT

HTTP/client sees code + generic message only.

Do not expose raw Node/OpenSSL error strings.

## TESTS

Mandatory adversarial coverage:
- roundtrip;
- fresh nonce / different ciphertext;
- tamper ciphertext/tag/nonce;
- tenant AAD swap;
- purpose swap;
- record-id swap;
- wrong key;
- unknown old key;
- malformed keyring;
- wrong key length;
- missing active version;
- member denial;
- platform_admin-only denial;
- tenant A -> B isolation;
- suspension/revocation immediate failure;
- metadata-only API;
- no plaintext HTTP read;
- masked write response;
- secret absent from logs/errors/snapshots;
- key absent from bundle/build artifacts;
- nonce collision retry/exhaustion;
- rotation atomicity;
- rotation concurrency;
- update/rotate race;
- delete/rotate race;
- migration from empty DB and repeat path;
- WO-001/002 regression.

## LOCAL DOCKER

Without keyring:
- postgres healthy;
- web HTTP 200;
- worker running;
- vault endpoints fail closed/unavailable.

With TEST-ONLY local keyring:
- exercise write/list/update/delete/rotate;
- never commit the test key.

If Compose changes only to pass server-only env variables, prove no secret default/value enters the file.

## SECURITY / VEX

Entering artifact:
`polyhunter-dev:local@sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`

Entering state:
25/25 NOT_AFFECTED.

No third-party crypto dependency is expected.

If any image build input/dependency changes:
- rebuild exact image;
- scan exact digest;
- prior artifact approvals expire per policy.

If digest stays identical:
- produce VEX delta-revalidation of every prior proof assumption affected by new source;
- specifically re-run app-source reachability checks used by prior rows;
- if any assumption changed, return that row to UNDER_INVESTIGATION.

Any new HIGH/CRITICAL:
`UNDER_INVESTIGATION` and BLOCK.

No suppression/ignore/severity downgrade.

## VALIDATION

Run:
- npm ci
- npm run validate
- npm audit --audit-level=high
- DB migrations from empty
- repeat/disposable DB tests
- full integration suite
- secret-vault adversarial suite
- git diff --check
- secret-pattern scan
- client-bundle key/secret scan
- Docker Compose config/up/health
- web HTTP 200
- worker running
- PostgreSQL healthy
- exact final image identity + scan/VEX reconciliation

Leave Docker running at STOP CONDITION when local environment is available.

## EVIDENCE

Create:
- `.engineering/evidence/PH-M01-WO-003-EVIDENCE.md`
- receipts under `.engineering/evidence/PH-M01-WO-003/`
- `.engineering/checkpoint-deltas/PH-M01-WO-003.md` as `PROPOSED / NOT_PROMOTED`

Evidence must bind exact base/head and include:
- crypto source check;
- keyring parser/config proof;
- envelope/AAD protocol;
- migration hash;
- authorization matrix;
- tamper/cross-tenant tests;
- nonce collision proof;
- rotation/concurrency proof;
- redaction/client-bundle proof;
- Docker evidence;
- exact artifact/VEX delta;
- CI/scans.

## PR

Update PR #39 with:
- exact execution head;
- schema/migration;
- API surface;
- crypto contract;
- test counts;
- rotation evidence;
- Docker state;
- final artifact digest;
- security/VEX state;
- STOP state.

## PROHIBITED

Do not implement:
- PH-M01-WO-004;
- Polymarket secret usage;
- trading_accounts;
- wallet/session signing;
- Polymarket adapter;
- trading;
- market data;
- M02+;
- cloud KMS/secret manager integration.

Do not merge PR #39.
Do not promote canonical checkpoint.

## STOP

If all requirements and security gates pass:
`READY_FOR_INDEPENDENT_AUDIT`

If any secret leak, crypto ambiguity, rotation uncertainty, cross-tenant uncertainty or HIGH/CRITICAL remains:
`BLOCKED_UNRESOLVED`

If context drift:
`BLOCKED_STALE_CONTEXT`

Final report in Brazilian Portuguese.
