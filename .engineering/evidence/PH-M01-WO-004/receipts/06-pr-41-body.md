# PH-M01-WO-004 — M01 Security Acceptance

Security acceptance for the PH-M01 module (identity, tenancy, secrets). **No product
capability is added** — this round proves the combined WO-001 + WO-002 + WO-003
implementation satisfies the frozen PH-M01 security boundary as a system, at the exact
head and against the exact artifact.

**STOP STATE: `READY_FOR_FINAL_M01_INDEPENDENT_AUDIT`** — after the audit CR-01..CR-04
correction round (review `5434141055`).

## Execution HEAD

| | |
| --- | --- |
| Audit target (tests + harness + evidence) | `f0fa34e70d0ff19f91d4e1db83375b644bd73e4c` |
| GitHub Actions Validate | run `37530158202` — **SUCCESS**, `Node 24 validation` job green |
| CodeRabbit | **success** on the same commit (review skipped while the PR is a draft — its configured behavior, status green) |
| Branch / base / merge-base | `feat/ph-m01-security-acceptance` / `main@895e4bf2221b9fd7e335f0dd348be05f851fccde` (exact) |
| **FINAL artifact (single candidate)** | `polyhunter-dev:local@sha256:6a7c210bcbad1f59a0b86e9d1b6e1b2a7eb51f018d6c229c4180cd78c2240c60` |
| Pinned base | `node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20` |
| Superseded artifact | `sha256:aee3ad8c…` (CR-05..CR-10; its owner approvals are historical only) |

**Preflight, all green:** Context Lock fingerprints **26/26 OK**; checkpoint
`STOP_AFTER_PH_M01_WO_003 / AWAIT_OWNER_DIRECTION`; PR #39 merged as `895e4bf…`; main
Validate #88 SUCCESS; JEV MCP healthy with its live inventory recorded (receipts `05`,
`10`).

## CR-01..CR-04 — the correction round

| CR | Finding | Resolution |
| --- | --- | --- |
| **CR-01** | The recovery harness placed K1/K2/CANARY in process argv (`node -e … "$K1" "$K2" "$CANARY"`) while claiming stdin-only. | Payload now emitted by the shell-builtin `printf` and piped to the container's **stdin**; no child ever receives the values as argv/env. A deterministic gate (`harness/verify-no-argv-secrets.sh`) enforces the discipline — **its self-test is observed to detect the historical pattern** before the real files pass. Full drill re-run; receipt `01` regenerated. |
| **CR-02** | The DB canary proof JSON-stringified rows; `Buffer.toJSON()` meant raw BYTEA bytes were never compared — a false-pass. | Columns derived from `information_schema`; values inspected **before any serialization** (raw byte equality + byte-subsequence `.includes()`, direct string checks). A **negative control** inserts canary UTF-8 bytes into a real BYTEA column and the scanner **must** report a hit; after removal the encrypted-secret path is clean — which also proves ciphertext carries no plaintext bytes. The WO-003-era column test was hardened the same way. |
| **CR-03** | Acceptance ran a pre-existing image, not the rebuild; two digests existed; base tag was mutable. | Base **pinned by immutable digest**; the clean build **IS** the runtime (compose `--no-build`; web+worker image ids **asserted equal** to the candidate); Scout scans that digest; **VEX reset** on the new digest; all bases re-measured; matrix re-bound. |
| **CR-04** | Secret scan covered a 7-file sub-delta, not the complete PR diff at the tip. | Scan now covers **all 25 changed files of PR #41** plus a **self-scan of its own receipt**: 0 keyring values, 0 base64-32-byte literals; client bundle still 0 across 15 patterns vs a non-zero server control. Receipt `04`. |

## FINAL artifact — one image for everything (CR-03)

The clean build (`sha256:6a7c210b…`, pinned base) is: the Compose runtime (containers
asserted), the subject of the HTTP/vault/module probes, the Docker Scout scan target,
and the digest the acceptance matrix and the VEX proposal bind to. Probes: `/` 200;
`/api/secrets` and `/api/secrets/<uuid>` 401 with `no-store`; `/api/me` 401;
`/auth/login` 200; postgres healthy; worker running; **0 module errors**; vault
**FAIL-CLOSED without a keyring** and the admitted path working with an ephemeral
in-process keyring (incl. a refused cross-tenant handle) — 9/9 checks.

## VEX on the FINAL digest (reset — proposal only)

Fresh Scout scan of `6a7c210b…`: **81 rows / 24 HIGH/CRITICAL**. One row removed vs
the superseded scan: `CVE-2026-103111` (pcre2) — absent because the pinned base ships
`libpcre2-8-0 10.42-1+deb12u2`; **fixed by artifact update, reconciled honestly, no
suppressions**. State machine: **24 UNDER_INVESTIGATION / 24 proposed NOT_AFFECTED /
0 AFFECTED / 0 independent-auditor approvals / 0 owner approvals**; 24 compared /
0 divergences vs the canonical WO-002 record. Premises re-measured: dpkg inventory
differs from the WO-002 baseline by exactly two package updates; `node`,
`libstdc++.so.6.0.30`, `sharp`, `libvips` are **byte-identical**; perl bitness
unchanged.

## Acceptance matrix — 37 obligations, 37 PASS (re-bound to the final digest)

`acceptance-matrix.json` maps every obligation A..L (cross-tenant · privilege
escalation · session/tenant selection · authorization concurrency · envelope
adversarial · canary containment · recovery · rotation · migrations · clean Docker ·
static gates/scans · VEX) to a named test or receipt. Suites on the correction delta:
unit **189/189** (validate exit 0, 0 vulnerabilities); PostgreSQL integration
**66/66** (39 vault incl. the hardened plaintext scan and the CR-09 window, 13
acceptance incl. the BYTEA negative control, 10 identity-RBAC, 4 tenancy).

## JEV MCP (real local server, mandatory) — receipt `10`

Live health + 12-tool inventory recorded; six bounded calls: delta classification of
the complete PR diff (**zero PRODUCT_CODE**; the single DOCKER_BUILD_INPUT is
`Dockerfile.dev`), VEX semantic comparison (**24/24 CONSISTENT** on the final digest),
evidence rerank, diff pre-review, final gate (**6/6 claims verified / 0 contradicted /
0 unsupported**; two flagged `needs_review` on confidence only). Escalations preserved
and resolved deterministically; the large-diff truncation is a stated caveat; no
secrets were sent; nothing was approved or suppressed from JEV output.

## Stop state

- `.engineering/CHECKPOINT.json` **untouched** (blob
  `81c3a1421d5c1ca301cc5daaff3d9d297a9201aa`); checkpoint delta
  (`checkpoint-deltas/PH-M01-WO-004.md`) remains **PROPOSED / NOT_PROMOTED**,
  proposing `phase=M01_IMPLEMENTATION_COMPLETE`, `stopState=STOP_AFTER_PH_M01_WO_004`,
  `completedThroughModule=PH-M01` on promotion by the owner after audit.
- PR #41 **not merged**, remains draft. No owner approval requested. No PH-M02 work.
- `liveTradingAuthorized` remains **`false`**.

### For the independent auditor

1. Re-run the CR-01 gate (its self-test must fail on the historical pattern) and the
   CR-02 BYTEA negative control (the scanner must hit while the fixture exists).
2. Re-derive the single-artifact chain: build-input hashes, pinned base digest,
   `docker inspect` image-id equality, and the Scout scan of exactly that digest.
3. Confirm `CVE-2026-103111` is absent because `libpcre2-8-0` is now `deb12u2` —
   receipt `09` — and that the VEX carries no suppression.
4. Re-run the CR-04 scan over PR #41's complete file set and the acceptance suite's
   attacks (cross-tenant matrix, forged roles, selector confusion, lock-health probe).
