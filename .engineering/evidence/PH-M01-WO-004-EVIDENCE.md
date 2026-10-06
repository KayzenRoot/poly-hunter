# PH-M01-WO-004 — M01 Security Acceptance — Evidence

**Work Order:** PH-M01-WO-004 — M01 Security Acceptance
**Branch:** `feat/ph-m01-security-acceptance`
**PR:** #41 (Draft — **not merged**)
**Issue:** #40
**Base / merge-base:** `main@895e4bf2221b9fd7e335f0dd348be05f851fccde` (verified exact)
**Acceptance target:** the combined WO-001 + WO-002 + WO-003 implementation as a
system; this Work Order adds **no product capability**.
**FINAL artifact (single candidate, audit CR-03):**
`polyhunter-dev:local@sha256:6a7c210bcbad1f59a0b86e9d1b6e1b2a7eb51f018d6c229c4180cd78c2240c60`
**Superseded artifact:** `sha256:aee3ad8c…` (CR-05..CR-10; its owner approvals are
historical only). Earlier: `8bd3e85a…`, `f810df3a…`, `eddda17a…`.
**Date:** 2026-10-06 / 2026-10-07

**STOP STATE: `READY_FOR_FINAL_M01_INDEPENDENT_AUDIT`**

`liveTradingAuthorized` remains `false`. PR #41 is not merged, the checkpoint is not
promoted, no owner approval is requested, and no PH-M02 surface was touched.

---

## 0. PREFLIGHT (deterministic, all green)

| Check | Expected | Observed |
| --- | --- | --- |
| Branch | `feat/ph-m01-security-acceptance` | checked out from origin |
| Merge-base vs `origin/main` | `895e4bf…` | `895e4bf…` (exact) |
| Context Lock fingerprints | workOrder + 17 frozenSources + 8 runtimeFingerprints | **26/26 OK** at round start (`git hash-object`) |
| CHECKPOINT | `STOP_AFTER_PH_M01_WO_003 / AWAIT_OWNER_DIRECTION` | match |
| PR #39 | MERGED as `895e4bf…` | MERGED, mergeCommit matches |
| main Validate #88 | SUCCESS on `895e4bf` | run `37518179390`, SUCCESS |
| JEV MCP | healthy, live inventory | `[jev-mcp] ready — model jev-latest`; 12 tools (receipt `10`) |

---

## 1. AUDIT CR-01..CR-04 — WHAT CHANGED IN THIS CORRECTION ROUND

| CR | Finding | Resolution |
| --- | --- | --- |
| **CR-01** | The recovery harness transported K1/K2/CANARY through `node -e … "$K1" "$K2" "$CANARY"` — process argv — while its own header claimed stdin-only. | The payload is now emitted by the **shell-builtin `printf`** and piped into the container's stdin; no child process ever receives the values as argv or env. A deterministic gate (`harness/verify-no-argv-secrets.sh`) enforces the discipline — its **self-test must and does detect the historical pattern** before the real files are allowed to pass. The complete drill was re-run with the gate in front; receipt `01` regenerated. |
| **CR-02** | The database canary proof JSON-stringified rows; Node `Buffer.toJSON()` means a BYTEA can serialize as `{type:"Buffer",data:[…]}` and the raw bytes were never compared — a false-pass. | The scan now derives table/column metadata from `information_schema` and inspects **values before any serialization**: buffers by raw byte equality and byte-subsequence `.includes()`; strings directly; JSON/JSONB as text. A **negative control** inserts the canary's UTF-8 bytes into `encrypted_secrets.ciphertext` (a real BYTEA column) and proves the scanner reports a hit; the fixture is removed and the normal encrypted-secret path must then be clean — which also proves ciphertext does not contain the plaintext bytes. The WO-003-era `never persists plaintext in any column` test was hardened the same way. |
| **CR-03** | Acceptance ran on a pre-existing image while a separate rebuild produced a different digest; the runtime artifact was not the freshly built one, and the base tag was mutable. | `Dockerfile.dev` now pins the Node base **by immutable digest** (`node:24-bookworm-slim@sha256:d6aa754f…`). The clean build **IS** the final candidate: it is tagged, Compose runs it with `--no-build`, and the **web and worker container image ids are asserted equal to the recorded candidate** (`6a7c210b…`). Docker Scout scans that exact digest; every HIGH/CRITICAL row was **reset to UNDER_INVESTIGATION**; all 24 prior technical bases were re-measured (receipt `09`); the acceptance matrix is re-bound to the final digest. |
| **CR-04** | The secret-scan receipt covered a 7-file sub-delta, not the complete PR diff at the exact tip. | The scan now covers **every changed file of the complete PR #41 diff** (25 files: admission docs, context lock, brief, Work Order, evidence bundle, delta, harnesses, receipts, SARIF, state machine, tests, Dockerfile), plus a **self-scan of its own receipt** in a second pass. Client-bundle scan re-run and clean. Receipt `04`, bound to the head via the PR body. |

## 2. ACCEPTANCE RESULTS (obligations A–L)

Machine-readable matrix: **`.engineering/evidence/PH-M01-WO-004/acceptance-matrix.json`**
— 37 rows (A1..L3), each with a named test or receipt, the FINAL artifact digest,
residual gaps and `PENDING_INDEPENDENT_AUDIT` reviewer state. Rows F/G/H/J/K/L were
re-bound to the regenerated receipts of this round.

New acceptance suite (`packages/db/tests/m01-acceptance.integration.test.ts`, 13
tests on real PostgreSQL 17): the cross-tenant 7-operation matrix with a
byte-identical after-snapshot and no existence oracle; ids are not authority; forged
role pairs at every surface; provider-input role injection; revocation on the next
operation; selector/status resolution without fallback; two-tenant switching without
contamination; the lock-health probe; the **raw-byte canary scan**; and the **BYTEA
negative control**.

**Suites after the corrections:** unit **189/189** (`npm run validate` exit 0,
production build OK, **0 audit vulnerabilities**); PostgreSQL integration **66/66** —
39 secret-vault (incl. the hardened plaintext scan and the CR-09 window), 13
m01-acceptance, 10 identity-RBAC, 4 tenancy. `git diff --check` clean.

## 3. RECOVERY / ROTATION DRILL (CR-01 regenerated) — receipt `01`

The full cycle re-ran with the argv gate at the front: **empty DB → migrations
(repeat no-op) → two-tenant seed via the Vault → `pg_dump -Fc` → DROP → fresh DB →
`pg_restore` → re-migrate no-op → post-restore isolation (tenant B sees `null`;
unmapped context `SECRET_FORBIDDEN`), metadata intact, authorized callback decrypts the
canary, envelope hash byte-stable → k1 absent fails closed `KEY_VERSION_UNAVAILABLE`
with the row intact → re-introduce k1, active v2, rotate (envelope hash changes,
identity stable) → k2-only keyring decrypts → cleanup.** Keys and canary travelled in
shell memory and over the stdin pipe only. The gate transcript leads the receipt,
including its self-test.

## 4. FINAL ARTIFACT ACCEPTANCE (CR-03) — receipt `02`

One artifact: **`sha256:6a7c210bcbad1f59a0b86e9d1b6e1b2a7eb51f018d6c229c4180cd78c2240c60`**,
built from the clean tree with the pinned base
(`node@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20`).
Build-input hashes are recorded in the receipt; `Dockerfile.dev` changed (the pin) and
is the only build input that did. Compose then ran the candidate with `--no-build`:
**web and worker image ids equal the candidate** (asserted). Probes on the candidate:
`GET /` 200; `/api/secrets` and `/api/secrets/<uuid>` 401 with
`Cache-Control: no-store`; `/api/me` 401; `/auth/login` 200; postgres healthy; worker
running; **0 module-resolution errors**. Vault: **no keyring → FAIL CLOSED**
(`VAULT_UNAVAILABLE` for every operation); ephemeral in-process keyring → admitted path
end-to-end incl. a refused cross-tenant handle (9/9 checks).

**The prior "reproducibility" observation is closed by construction:** there is no
longer a second image; the clean build is the runtime artifact and the base is pinned
by digest, so future clean builds cannot silently follow a moving tag. Bit-for-bit
reproducibility of two independent builds is still not claimed and is not required.

## 5. FINAL-DIGEST VEX (CR-03 reset) — receipts `07`, `08`, `09`

Fresh `docker scout` scan of the final digest (`07-final-image-scan.sarif`,
stderr naming the digest): **81 rows, 24 HIGH/CRITICAL**. Versus the superseded scan:
rows 82 → 81, identical 81, added 0, **removed 1** — `CVE-2026-103111` (pcre2) is
absent because the pinned base ships `libpcre2-8-0 10.42-1+deb12u2`; the vulnerable
`deb12u1` is no longer installed. **A fix by artifact update, reconciled honestly —
suppression counters stay at zero.**

State machine on the final digest (`08-vex-state-machine.json`, generator committed as
`state-machine.mjs`): **24 UNDER_INVESTIGATION / 24 proposed NOT_AFFECTED / 0 AFFECTED
/ 0 independent-auditor approvals / 0 owner approvals**, `premisesAltered: 0`,
`justificationIntegrity: 24 compared / 0 divergences` against the canonical WO-002
record. Premise revalidation (`09`): the 88-package dpkg inventory differs from the
WO-002 baseline by exactly two updates (`libpcre2-8-0` u1→u2, `tzdata` 2026b→2026c);
`/usr/local/bin/node`, `libstdc++.so.6.0.30`, `sharp-linux-x64-0.35.5.node` and
`libvips-cpp.so.8.18.7` are **byte-identical** to the baseline; perl bitness unchanged
(`ivsize=8`, `longsize=8`, `ptrsize=8`, `use64bitint=define`); node v24.21.0.

## 6. STATIC GATES, SCANS, EXACT-HEAD EVIDENCE (CR-04) — receipts `03`, `04`

`npm run validate` exit 0 (189 unit, 0 vulnerabilities); `npm audit --audit-level=high`
0; `git diff --check` clean. Client bundle: **0 across 15 patterns** in `.next/static`
vs a **non-zero server-side control** (fresh production build). **Complete-diff secret
scan (CR-04)**: every changed file of PR #41 — 25 files — plus a self-scan pass that
includes the receipt itself: **0 keyring values, 0 base64-32-byte literals, no
NEXT_PUBLIC secret names**; every file listed with size and result. P2 re-measured:
56 tracked source files, 0 subprocess primitives.

## 7. JEV MCP EXECUTION (mandatory) — receipt `10`

The real local server was confirmed healthy; the live 12-tool inventory was discovered
and recorded; six bounded calls were made and logged with purposes, results and token
usage: delta classification of the complete PR diff (**zero PRODUCT_CODE**; the one
DOCKER_BUILD_INPUT is `Dockerfile.dev`), VEX semantic comparison (**24/24
CONSISTENT** on the final digest), minimum-evidence rerank, the diff pre-review and the
final gate (**6/6 claims verified, 0 contradicted, 0 unsupported**; two flagged
`needs_review` on confidence only). Both review halves and the gate escalated
conservatively on `safe_to_apply`; the large-diff truncation is recorded as a caveat.
Escalations were resolved deterministically (the CR-01 self-test and the CR-02
negative control are mechanical proofs). No secrets were sent.

## 8. RECEIPTS

| Receipt | Contents |
| --- | --- |
| `01-recovery-rotation-drill.txt` | **CR-01 regenerated** — argv gate (with failing self-test) + the full disposable backup/destroy/restore + v1→v2 rotation transcript |
| `02-docker-clean-acceptance.txt` | **CR-03 regenerated** — single final candidate: build, build-input hashes, pinned base, compose `--no-build`, image-id assertions, HTTP/vault/module probes |
| `03-static-gates-scans.txt` | validate/audit/diff-check, bundle scan with positive control, P2 recount (first WO-004 round; the CR-04 scope lives in receipt `04`) |
| `04-full-diff-secret-scan.txt` | **CR-04** — complete PR #41 diff (25 files) + self-scan + client bundle |
| `05-jev-mcp-execution.txt` | first WO-004 round's JEV calls (history) |
| `06-pr-41-body.md` | the PR body of the first WO-004 round (history; the real body is updated per round) |
| `07-final-image-scan.sarif` / `.stderr.txt` | fresh Docker Scout scan of the FINAL digest |
| `08-vex-state-machine.json` / `.md` | **VEX reset on the final digest** — 24 UI / 24 proposed / 0 / 0 |
| `09-premise-revalidation.txt` | dpkg diff (2 updates), native hashes identical, P1/P2, build-input hashes |
| `10-jev-mcp-execution-cr01-04.txt` | **this round's JEV execution** |
| `state-machine.mjs` | the generator for receipt 08 (CR-05/CR-10 gates intact) |
| `harness/verify-no-argv-secrets.sh` | **CR-01** deterministic gate (self-test + real files) |
| `harness/recovery-rotation-drill.sh`, `harness/drill-vault.mjs` | the drill (payload via builtin printf → stdin only) |
| `harness/docker-acceptance.sh`, `harness/docker-probe.mjs` | the single-artifact acceptance and its in-process-key probes |
| `acceptance-matrix.json` | 37 rows re-bound to the final digest |

## 9. AUDIT REQUEST

`READY_FOR_FINAL_M01_INDEPENDENT_AUDIT`.

The audit target is the tip of `feat/ph-m01-security-acceptance` after this round's
commits; GitHub Actions Validate and CodeRabbit must be SUCCESS on that exact commit,
and the run IDs and SHAs are recorded in the real PR #41 body (a SHA written into a
file cannot name the commit that carries the file).

Points an auditor should weigh most heavily:

1. **The CR-01 gate is itself verified** — its self-test must fail on the historical
   argv pattern; re-run it and then re-check the orchestrator by eye for any other
   argv/env path (the gate's pattern list is in the script).
2. **The CR-02 negative control is the proof** — re-run the acceptance suite and
   confirm the BYTEA fixture produces a scanner hit before removal, and that the raw
   byte `.includes()` is what fires.
3. **The single-artifact claim** — re-run `docker compose ps` plus `docker inspect` and
   confirm the containers' image ids equal `6a7c210b…`; re-derive the build-input
   hashes and the pinned base digest.
4. **The VEX reset and the removed row** — confirm 24 UI / 24 proposed on the final
   digest and that `CVE-2026-103111` is absent because `libpcre2-8-0` is now
   `deb12u2` (receipt `09`), not because anything was suppressed.
5. **The complete-diff scan** — re-run the CR-04 scan over PR #41's full file set and
   confirm it covers test/harness/evidence/governance files, not just product paths.
