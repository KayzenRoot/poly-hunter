# PH-SEC-WO-008 — Evidence Bundle

**Work Order:** PH-SEC-WO-008 — final two libstdc++ blocker resolution
**Branch:** `security/ph-m01-libstdcpp-final-two` · **PR:** #35 (base = parent `feat/ph-m01-tenancy-persistence`)
**Risk class:** HIGH_ASSURANCE / SECURITY_BLOCKER_RESOLUTION
**Revision:** post **Correction Deltas CR-01…CR-06** — CR-01/CR-02(ABI)/CR-03 ACCEPTED by re-audit; CR-04 resolved via PATH A; CR-05 = canonical-evidence consistency; CR-06 = 102010 runtime-state sentence removed + head semantics (`contentHead`/`closureHead`) corrected.
**Result:** `READY_FOR_INDEPENDENT_AUDIT` — both CVE-2026-102010 and CVE-2026-95619 carry evidence-complete **proposed** `NOT_AFFECTED` dispositions. The executor proposes only; independent audit and explicit owner approval for the exact artifact remain mandatory per ADR-0007.

Executor: Codex. No disposition here is approved by this Work Order. PH-M01-WO-002 was **not** started and PR #15 was **not** merged.

---

## 0. Correction history

| Finding | Defect found | Correction | Status |
|---|---|---|---|
| **CR-01** | CVE-2026-102010 presence was claimed from byte strings / dynsym absence, and asserted that an inlined instantiation "would still require mangled names or distinctive strings" — false for optimized C++. | Presence disproven at **source level** for every compiled C++ consumer, each mapped to its exact shipped version; false claim removed; pb_ds header/dev-package absence recorded. | ACCEPTED by re-audit |
| **CR-02** | libvips call site was decoded as `mov esi,4 (size=4)` — wrong ABI. | Corrected: **RSI = alignment** (4), **RDI = size** (from R12 = `rsi − 0xe`, data-derived). "Constant size 4" withdrawn. | ABI ACCEPTED by re-audit |
| **CR-03** | Node v24.21.0 source provenance cited in prose only. | 10 immutable Node v24.21.0 source receipts added, included in SHA256SUMS. | ACCEPTED by re-audit |
| **CR-04** | Point-in-time `/proc/<pid>/maps` cannot prove sharp/libvips unreachability: Next.js 16.3.8 lazily `require('sharp')` on the first valid `/_next/image` request. | Runtime-unreachability **WITHDRAWN and FALSIFIED** by a safe local probe; branch resolved via **PATH A**: exact callsite mapping to `IccHelper::readIccColorGamut` (libultrahdr v2.0.2) + mathematical JPEG-marker-cap bound. | resolved (PATH A) |
| **CR-05** | Canonical evidence still carried stale runtime-unreachability text contradicting the accepted proof; preflight was bound to a stale HEAD. | All VEX JSON/MD/Evidence fields rewritten so the justification rests exclusively on the two mathematical bounds; unreachability retained only as `WITHDRAWN / FALSIFIED BY CR-04 PROBE` history; preflight executed against `contentHead`. | applied |
| **CR-06** | (A) CVE-2026-102010 row still carried a runtime-loaded-state sentence. (B) Preflight wording implied an impossible self-referential receipt. | (A) Sentence removed — the 102010 disposition rests exclusively on source-level absence + header/dev-package absence. (B) Explicit `contentHead`/`closureHead` semantics documented; no receipt claims to contain its own final SHA. | this revision |

---

## 1. Scope and authorisation boundary

Evidence-only. Nothing in the product, dependencies, runtime configuration or data model was changed.

| Prohibited by the Work Order | Observed |
|---|---|
| Product / domain / schema / migration / TenantContext / Supabase Auth / secret vault / Polymarket / trading changes | none |
| Dockerfile or Compose mutation | none — `Dockerfile.dev` (blob `7bb79d3b`) and `compose.yaml` (blob `8158fca1`) untouched |
| Package manifest / lockfile / dependency / base-image mutation | none — `package.json` (blob `33b4308b`) and `package-lock.json` (blob `5c36ff1b`) untouched |
| Target artifact mutation | none — read-only inspection (`docker run --network none`, `docker create`/`docker cp`); CR-04 probe files were created and removed **inside the running container only** |
| Scanner suppression, ignore, waiver, accepted-risk, severity downgrade | none |
| Self-approval of `NOT_AFFECTED` | none — auditor and owner fields are `PENDING` |
| `PH-M01-WO-002` start / PR #15 merge | neither |

---

## 2. PREFLIGHT

Receipt: [`receipts/preflight-reconciliation.json`](PH-SEC-WO-008/receipts/preflight-reconciliation.json) — executed against **`contentHead` = `02e9f96a28eda91bf3d4a8bd813df1e76315e178`** and recorded in the receipt (14/14 PASS; see §9 for the `contentHead`/`closureHead` semantics).

Checks revalidated: branch = `security/ph-m01-libstdcpp-final-two`; parent head `5cf4c2ffe7b5365ca4941253f92b612f0322a83d` is ancestor of HEAD; PR #15 OPEN+DRAFT+unmerged at parent head; PR #35 open; all 19 Context Lock `criticalSources` fingerprints; image digest `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`; locked SARIF blob `d3999a5664ec91e2b555d468b6e85c8d04aaabe9`; exactly 22 error-level rows / 22 distinct CVEs; WO-007 20 owner-approved NOT_AFFECTED unexpired, exactly CVE-2026-102010 and CVE-2026-95619 unresolved; Go HIGH/CRITICAL = 0; CISA KEV (2026.10.04, neither CVE in KEV) + FIRST EPSS (2026-10-05) snapshots; Node 24.21.0 identity; SHA256SUMS verify; `git diff --check` clean.

### Target artifact identity

```
image_ref=polyhunter-dev:local
image_id=sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3
os=Debian GNU/Linux 12 (bookworm)  base=node:24-bookworm-slim
node=v24.21.0  v8=13.6.233.17-node.53
libstdc++=libstdc++.so.6.0.30 (libstdc++6 12.2.0-14+deb12u1)
glibc=2.36-9+deb12u14
installed gcc packages: libstdc++6 + gcc-12-base ONLY (no libstdc++-12-dev, no headers, no compiler)
next=16.3.8  sharp=0.35.5 (optional dep of next; used by the /_next/image optimizer)
node links libstdc++.so.6 => /lib/x86_64-linux-gnu/libstdc++.so.6.0.30
```

---

## 3. Upstream fix commits (read and preserved)

Fetched directly from `https://gcc.gnu.org/git/gcc.git` by SHA (shallow fetch). Receipts in `receipts/upstream/`.

| CVE | Commit | Author / date | What the fix does |
|---|---|---|---|
| CVE-2026-102010 | `aaa8351f4d2e636f9680a1f0a8ebc2f0a60611e6` | Jonathan Wakely, 2026-09-25 | Adds `m_a_entries = new_entries;` in `__gnu_pbds detail::binary_heap erase_if` (PR libstdc++/127656). |
| CVE-2026-95619 | `59d235ffa5a69231eb42e5290d52dc8c90d28b7a` | Jonathan Wakely, 2026-09-23 | `__builtin_add_overflow(sz, al - 1, &sz)` guard for the C11 rounding in `new_opa.cc`; wrapped sizes throw `bad_alloc`. |

---

## 4. Compiled C++ consumer set (complete enumeration)

Method: whole-image scan for ELF files that `DT_NEEDED` `libstdc++.so.6`, including `.node` addons and apt method helpers.

| Consumer | Version | Reachable/executed in local-dev runtime? |
|---|---|---|
| `/usr/local/bin/node` (equiv. nodejs) | v24.21.0 / V8 13.6.233.17-node.53 | **yes** (web + worker) |
| apt frontends + `libapt-pkg`/`libapt-private` + `apt-*` helpers | apt 2.6.1 | no aligned-new references; not executed by compose |
| `libvips-cpp.so.8.18.7` (sharp-libvips 1.3.4) | libvips 8.18.7 + bundled uhdr 2.0.2 | **yes — lazily loaded** on the first valid `/_next/image` request (probe-confirmed) |
| `sharp-linux-x64-0.35.5.node` (sharp 0.35.5) | sharp 0.35.5 | **yes — lazily loaded** (same probe); zero aligned-new references |

Reachability of sharp/libvips is proven by the CR-04 probe (`receipts/cr04-probe/`), not assumed: Next.js 16.3.8 exposes `/_next/image` with the default loader (`apps/web/next.config.ts` sets no `images.unoptimized` and no custom loader), and `handleNextImageRequest -> imageOptimizer -> optimizeImage -> getSharp -> require('sharp')` loads sharp lazily on the first valid request.

---

## 5. CVE-2026-102010 — proposed `NOT_AFFECTED / vulnerable_code_not_present`

**Vulnerable operation (exact fix diff):** `__gnu_pbds detail::binary_heap::erase_if(Pred)` frees the old entry storage but leaves `m_a_entries` dangling — use-after-free. Affected API is `__gnu_pbds::priority_queue` with `binary_heap_tag` (`<ext/pb_ds/priority_queue.hpp>`). **Not** `std::priority_queue`.

### 5.1 Component level: the vulnerable header is not installed
Only `libstdc++6` + `gcc-12-base` are installed — no `libstdc++-12-dev`, no `/usr/include/c++`, no compiler, no `ext/pb_ds` tree. The artifact cannot compile the vulnerable header; presence would require a pre-built instantiation in a shipped consumer. Receipt: `receipts/cr01-pbds-header-and-dev-package.txt`.

### 5.2 Source-level absence for every compiled consumer (dispositive)
A binary cannot contain an instantiation of a template its source never referenced — inlined or not — so source-level absence at the exact shipped version is dispositive and independent of symbols/strings:

| Consumer (exact shipped binary) | Exact source, mapped | pb_ds / `__gnu_pbds` / `binary_heap` / `erase_if` |
|---|---|---|
| node v24.21.0 | `nodejs/node` @ `955266bfdd854cd280dffd47548673914484e4c0` | **none** (src/ and deps/) |
| apt 2.6.1 (frontends, libapt, helpers) | `salsa.debian.org/apt-team/apt` @ `a626a66fece0a7d680e40b9e35b66e29fe9ae12c` | **none**; no `<ext/...>` includes |
| libvips 8.18.7 (`libvips-cpp.so.8.18.7`) | `libvips/libvips` @ `24ad4d042940e6bf99a68871ba886ca8847c9c82` | **none**; no `<ext/...>` includes |
| libvips-cpp bundled C++ deps | highway 1.4.0 `2607d3b5...`; libultrahdr 2.0.2 `e5f5a022...`; harfbuzz 14.5.0 `863d3f77...`; libheif 1.23.5 `413e2a87...` | **none** (remaining deps are C libraries) |
| sharp 0.35.5 addon | `lovell/sharp` @ `51a990faa26ade5586a4934ac9673c98d8893326` | **none**; no `alignas` |

Receipts: `receipts/cr01-source-provenance/`, `receipts/cr03-node-source/cr03-pbds-search.txt`; consolidated: `receipts/cr01-cve-2026-102010-presence-proof.json`.

**Verdict:** `vulnerableCodePresent = false` — proposed `NOT_AFFECTED / vulnerable_code_not_present`.

---

## 6. CVE-2026-95619 — proposed `NOT_AFFECTED / vulnerable_code_cannot_be_controlled_by_adversary`

**Vulnerable code presence (confirmed, vulnerable variant):** the shipped `libstdc++.so.6.0.30` exports `_ZnwmSt11align_val_t`/`_ZnamSt11align_val_t`, imports glibc `aligned_alloc` (no `posix_memalign`), and `_ZnwmSt11align_val_t` byte-decodes to the C11 rounding `(sz + al - 1) & ~(al - 1)` followed by a call to `aligned_alloc`. `node` links and maps this `.so`. Presence is not in dispute; the row turns on reachability and attacker control.

**Exact overflow arithmetic (64-bit `size_t`):** the gcc-12 rounding wraps iff `sz + align - 1 >= 2^64`, i.e. `sz >= 2^64 - (align - 1)`. For `align = 64`: `sz >= 2^64 - 63`. For `align = 4`: `sz >= 2^64 - 3 = 18446744073709551613`.

**Two reachable call paths exist; both carry hard source/type-level bounds.**

### 6.1 node/V8 — bounded
One aligned-new import (`_ZnamSt11align_val_t`, dynsym[532], PLT stub `0x747010`), exactly 2 call sites, both in `OptimizingCompileTaskExecutor::EnsureInitialized()` — `OwnedVector<OptimizingCompileTaskState>::New(max_tasks)` — `operator new[](max_tasks*64, align_val_t(64))` (`alignas(PROCESSOR_CACHE_LINE_SIZE)` = 64). `max_tasks` = `v8_flags.concurrent_turbofan_max_threads` (DEFINE_UINT, default 4, startup-only) or clamped worker-thread count — at least 2^27 below the threshold, not influenceable from JavaScript. CR-03 receipts: `receipts/cr03-node-source/`.

### 6.2 libvips/libuhdr — reachable, attacker-influenced size, arithmetically impossible overflow (CR-04 PATH A)

**Reachability is established, not denied.** The CR-04 probe (benign `GET /_next/image?url=%2Ficc-test.jpg&w=64&q=75`, locally generated 297-byte JPEG with an `ICC_PROFILE` APP2 marker; HTTP 200) mapped `sharp-linux-x64.node` (5 segments) and `libvips-cpp.so.8.18.7` (4 segments) into the running next-server (before: 0/0). The prior runtime-unreachability theory was **WITHDRAWN / FALSIFIED BY CR-04 PROBE** and survives only as history in `libvipsBranchResolution.runtime_unreachability_WITHDRAWN`.

The branch is closed by the mathematical PATH A proof:

| Step | Proof |
|---|---|
| Callsite identity | `0x403ab3` (verified PLT `0x1f20` -> GOT `0x116be48` -> `dynsym[532] = _ZnamSt11align_val_t`; ABI: RSI = alignment = 4, RDI = size = R12 = `rsi - 0xe`) = `IccHelper::readIccColorGamut`, **libultrahdr v2.0.2** (`lib/src/icc.cpp:657`, commit `e5f5a022...`), statically linked into `libvips-cpp.so.8.18.7` |
| Identification evidence | `ICC_PROFILE` magic (`icc.h:80`); `0xe` = `kICCIdentifierSize` 14 (`icc.h:83`); entry guard `icc_size >= 146` (`icc.cpp:644` = binary `cmp rsi,0x91/jbe`); tags gXYZ/bXYZ/cicp (`icc.h:108-115`); `alignof(ICCHeader) = 4`; referenced `.rodata` tables are exactly the kBT709/kDisplayP3/kBT2020 colorant matrices (`icc.h:128-142`) |
| Size provenance | `icc_size` = `JpegDecoderHelper::getICCSize()` = `mICCBuffer.size()`, filled from the **first JPEG APP2 marker** whose payload starts with `ICC_PROFILE\0` (`jpegdecoderhelper.cpp:238-239, 119-139`) — **attacker-controlled** image content |
| Hard upper bound | mozjpeg `jdmarker.c save_marker()` reads the marker length via `INPUT_2BYTES` (16-bit big-endian, max 65535), subtracts 2, caps at the 0xFFFF save limit — **`icc_size <= 65533`** (mozjpeg commit `0826579` = `versions.json`); no underflow (`icc.cpp:644`) — **`sz <= 65519`** |
| Conclusion | overflow requires `sz >= 2^64 - 3`; max feasible `sz = 65519` — **margin at least 2^48**; all arithmetic on 64-bit `size_t`, no narrowing — **arithmetically impossible** |

**Verdict:** both reachable aligned-new call paths carry hard, source/type-level bounds (node at least 2^27 below; libvips at least 2^48 below). Proposed `NOT_AFFECTED / vulnerable_code_cannot_be_controlled_by_adversary`.

---

## 7. Method and disclosed limitations

- **Tooling:** the image ships no binutils and no python3; ELF parsing, PLT/relocation resolution and disassembly were done on the host with Python + capstone over binaries extracted verbatim from the digest-pinned image (`receipts/extracted/`).
- **CR-04 handling:** runtime-unreachability is withdrawn history. Reachability of sharp/libvips is affirmed and proven by probe; safety rests on the JPEG marker-format cap.
- **CR-01 inlined code:** no reliance on symbol/string absence; proof is source-level absence at exact consumer versions.
- **Bound scope:** the libvips bound is a property of the JPEG marker format (16-bit length). A future consumer passing an attacker-controlled size from a format without a hard length cap would require re-analysis (expiry trigger below).

---

## 8. Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | CR-01: presence proof on source-level absence; false inlined-string claim removed; header/dev-package absence recorded | **MET** (accepted by re-audit) |
| 2 | CR-02: ABI re-decoded; size traced | **MET** (ABI accepted by re-audit) |
| 3 | CR-03: immutable Node/V8 source receipts in SHA256SUMS | **MET** (accepted by re-audit) |
| 4 | CR-04: unreachability withdrawn (probe-falsified); PATH A mathematical bound for the reachable libvips path | **MET** |
| 5 | CR-05/CR-06: canonical evidence internally consistent; no stale runtime-unreachability justification; deterministic preflight executed against `contentHead` with receipt-only `closureHead` semantics independently verified | **MET** |
| 6 | VEX JSON/MD, Evidence Bundle, receipts, SHA256SUMS regenerated | **MET** |
| 7 | Preflight/Context Lock/parent/image/SARIF re-run on the same parent/image | **MET** |
| 8 | No product/runtime/dependency mutation; no suppression | **MET** |

---

## 9. Preflight and head semantics (CR-05C / CR-06B)

Two distinct heads are used, and no receipt claims to contain its own final commit SHA:

- **`contentHead = 02e9f96a28eda91bf3d4a8bd813df1e76315e178`** — the commit against which the deterministic preflight was executed. The receipt (`receipts/preflight-reconciliation.json`) records this `head` and was **14/14 PASS**: branch, parent `5cf4c2f` ancestry, PR #15 OPEN+DRAFT+unmerged, Context Lock 19/19 fingerprints, artifact digest, locked SARIF blob, 22/22 reconciliation, WO-007 20 approved rows, Go = 0, KEV/EPSS, Node 24.21.0 identity, SHA256SUMS verify, `git diff --check` clean.
- **`closureHead = d7aed91ed86724ee5f710691c19afaca74523209`** — the receipt-only closure commit immediately after `contentHead`, containing exactly two evidence files: `receipts/preflight-reconciliation.json` and `SHA256SUMS.txt`. The independent auditor verified that `closureHead` is exactly one commit ahead of `contentHead` and that the closure delta touches only those two files.

In other words: deterministic preflight was executed against `contentHead`; a receipt-only closure commit then recorded that result and regenerated `SHA256SUMS`. No self-referential receipt loop exists or is attempted.

---

## 10. Bundle index (CR-04/CR-05 additions)

```
PH-SEC-WO-008/
  SHA256SUMS.txt                                  (regenerated; includes cr04/cr05 receipts)
  analysis/
    build_vex.py                                  (single source of truth for VEX.json)
    cr04_*                                        callsite/strings/r12/caller/mozjpeg scripts
    cr05a_fix_vex_json.py                         CR-05A stale-field rewrite script
  receipts/
    cr04-libvips-callsite-source-mapping.json     PATH A consolidated proof
    cr04-uhdr-source/                             libultrahdr v2.0.2 provenance + exact excerpts
    cr04-mozjpeg-marker-cap.txt                   JPEG 16-bit marker length cap (save_marker)
    cr04-libjpeg-identity.txt                     mozjpeg/libjpeg-turbo identity in the binary
    cr04-next-image-route-analysis.json           Next 16.3.8 route + probe conclusion
    cr04-probe/                                   before/after /proc maps, probe image, summary
    cr02-libvips-*.json/.txt                      (superseded receipts kept with withdrawal notes)
    cr03-node-source/                             immutable Node v24.21.0 receipts
```

---

## 11. Result

**`READY_FOR_INDEPENDENT_AUDIT`** (proposed dispositions; not approved by the executor).

- **CVE-2026-102010** — proposed `NOT_AFFECTED / vulnerable_code_not_present`: source-level absence at exact consumer versions + component-level header/dev-package absence.
- **CVE-2026-95619** — proposed `NOT_AFFECTED / vulnerable_code_cannot_be_controlled_by_adversary`: node path bounded at least 2^27 below the threshold; libvips/libuhdr path reachable and attacker-influenced within the JPEG format, but hard-capped at `icc_size <= 65533` / `sz <= 65519` vs the `2^64 - 3` threshold — arithmetically impossible. Runtime-unreachability appears only as withdrawn/falsified history.

Both rows remain **absolute blockers** for PR #15 until independently audited and explicitly owner-approved for `polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`. PH-M01-WO-002 not started; PR #15 not merged.