# PH-M01-WO-004 — M01 Security Acceptance

Security acceptance for the PH-M01 module (identity, tenancy, secrets). **No product
capability is added** — this round proves the combined WO-001 + WO-002 + WO-003
implementation satisfies the frozen PH-M01 security boundary as a system, at the exact
head and against the exact artifact.

**STOP STATE: `READY_FOR_FINAL_M01_INDEPENDENT_AUDIT`**

## Execution HEAD

| | |
| --- | --- |
| Audit target (tests + harness + evidence) | `7c0bc3cdcd6866ccac65d64190b1a3f721fcaae5` |
| GitHub Actions Validate | run `37524007826` — **SUCCESS**, `Node 24 validation` job green |
| CodeRabbit | **success** on the same commit (review skipped while the PR is a draft — its configured behavior, status green) |
| Branch / base / merge-base | `feat/ph-m01-security-acceptance` / `main@895e4bf2221b9fd7e335f0dd348be05f851fccde` (exact) |
| Artifact of record | `polyhunter-dev:local@sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2` — **unchanged this round** |
| Entering VEX | 25 NOT_AFFECTED / 0 UNDER_INVESTIGATION / 0 AFFECTED, independent audit + owner approval bound to that exact digest |

**Preflight, all green:** Context Lock fingerprints **26/26 OK** (`git hash-object`);
checkpoint `STOP_AFTER_PH_M01_WO_003 / AWAIT_OWNER_DIRECTION`; PR #39 merged as
`895e4bf…`; main Validate #88 SUCCESS; JEV MCP healthy with its live inventory
recorded (receipt `05`).

## Acceptance matrix — 37 obligations, 37 PASS

`.engineering/evidence/PH-M01-WO-004/acceptance-matrix.json` maps every obligation
(A cross-tenant · B privilege escalation · C session/tenant selection · D
authorization concurrency · E envelope adversarial · F canary containment · G recovery ·
H rotation · I migrations · J clean Docker · K static gates/scans · L VEX) to a named
test or receipt with result, execution head, artifact, residual gap and reviewer state.
No row is PASS without concrete evidence.

**New acceptance suite** (`packages/db/tests/m01-acceptance.integration.test.ts`, 12
tests, real PostgreSQL 17): the full cross-tenant 7-operation matrix with a
byte-identical after-snapshot of the other tenant's row and no existence oracle; direct
id substitution and malformed/purpose-scoped handles; every forged role pair at every
vault surface; provider-input role injection (platform role only from persisted rows);
row/status revocation on the next operation; selector/status resolution with no
default-tenant fallback; one user switching between two valid tenants without
contamination; a lock-health probe (interleaved rotations + role flips + reads, no
40P01 cycle, deterministic end state); and a **runtime-only canary** proven absent from
console output, error text, metadata, **every column of every table**, and **every file
of the working tree**.

**Suites:** unit **189/189** (`npm run validate` exit 0, production build OK, **0 audit
vulnerabilities**); PostgreSQL integration **65/65** — 39 secret-vault (incl. the CR-09
two-connection authority window), 12 acceptance, 10 identity-RBAC (WO-002 regression),
4 tenancy (WO-001 regression). `git diff --check` clean.

## Recovery / rotation drill (disposable database, ephemeral keys)

Receipt `01`: empty DB → migrations (repeat **no-op**) → two-tenant seed via the Vault
→ `pg_dump -Fc` → **DROP DATABASE** → fresh DB → `pg_restore` → re-migrate no-op →
post-restore isolation (tenant B sees `null`; unmapped context `SECRET_FORBIDDEN`),
metadata intact, **authorized callback decrypts the canary** with ephemeral v1,
envelope hash byte-stable → with **k1 absent**, decrypt fails closed
`KEY_VERSION_UNAVAILABLE` and the row is unchanged → re-introduce k1, active **v2**,
rotate: envelope hash **changes**, identity metadata **stable**, a **k2-only** keyring
decrypts the rotated envelope → cleanup. Keys and canary travelled over exec **stdin**
only; nothing was persisted, printed or committed.

## Clean Docker acceptance

Receipt `02`: no stale outputs; `npm ci`; compose down/up on the canonical image;
healthy stack (postgres + web healthy, worker running); `GET /` 200; `/api/secrets`
and `/api/secrets/<uuid>` 401 with `Cache-Control: no-store`; `/api/me` 401; **0
module-resolution errors**. Vault probes (in-process keys): **no keyring → FAIL
CLOSED** (`VAULT_UNAVAILABLE` for every operation, app healthy) and the ephemeral-keyring
admitted path end-to-end incl. a **refused cross-tenant handle** — 9/9 checks.

**Recorded, not hidden:** a rebuild of the *same* inputs produced a different image id
(`40782d8c…` vs canonical `aee3ad8c…`) — the Docker recipe is not bit-reproducible. No
build input changed, the canonical tag/digest were never re-pointed, and the artifact
of record with its VEX approvals is unaffected.

## Static gates and exact-artifact reconciliation

Receipt `03`: client bundle **0 across 15 patterns** vs a non-zero server-side control;
delta secret scan clean; P2 re-measured (56 tracked source files, **0** subprocess
primitives — the new suite itself contains none). A **fresh `docker scout` scan is
byte-identical** to the committed WO-003 scan (`md5 f30da92d…`): 82 rows, **0 added,
0 removed, 25 HIGH/CRITICAL**. **No Docker build input changed in WO-004**, so no
artifact-delta event occurs and the entering approvals stand.

## JEV MCP (mandatory) — receipt `05`

Executed through the real local server: health + 12-tool inventory discovered and
recorded; six bounded calls — obligation→evidence classification (**36/37
EVIDENCE_SPECIFIC**; it flagged row L3 as `EVIDENCE_WEAK` because its citation pointed
at a document that did not yet exist, and L3 was **corrected** to cite the existing
machine-readable `suppressionPolicy` block), evidence rerank, three bounded claims
**verified** (0.93 / 0.99 / 1.00), a diff pre-review, and a final gate that first
reported one **unsupported** claim (the per-file test breakdown was missing from the
supplied evidence) and on the corrected evidence returned **6/6 verified / 0
contradicted / 0 unsupported**. Both gate runs are recorded. The review halves escalated
conservatively on `safe_to_apply` — advisory only, never treated as an approval. No
secrets, canary, keys or tokens were sent to JEV.

## Stop state

- `.engineering/CHECKPOINT.json` **untouched** (blob
  `81c3a1421d5c1ca301cc5daaff3d9d297a9201aa`); checkpoint delta
  (`checkpoint-deltas/PH-M01-WO-004.md`) submitted as **PROPOSED / NOT_PROMOTED**,
  proposing `phase=M01_IMPLEMENTATION_COMPLETE`, `stopState=STOP_AFTER_PH_M01_WO_004`,
  `completedThroughModule=PH-M01` on promotion by the owner after audit.
- PR #41 **not merged**, remains draft. No owner approval requested. No PH-M02 work.
- `liveTradingAuthorized` remains **`false`**.

### For the independent auditor

1. Re-run the acceptance suite and try to defeat the matrix: another route to the other
   tenant's row, another selector shape, a context the repositories should refuse.
2. From the harness sources, confirm no path can persist keys/canary, then re-run the
   drill and compare the envelope-hash transitions (`d3979b01…` before rotation).
3. Decide whether the D2 lock-health probe adds enough beyond the deterministic CR-09
   window tests, and whether the rebuild non-reproducibility warrants a follow-up.
4. Re-derive the artifact identity chain: build-input diff, `docker inspect`, fresh
   scan. If any build input is found changed, the VEX must be reset.
