# PH-SEC-WO-008 — Evidence Bundle

**Work Order:** PH-SEC-WO-008 — final two libstdc++ blocker resolution
**Branch:** `security/ph-m01-libstdcpp-final-two` · **PR:** #35 (base = parent `feat/ph-m01-tenancy-persistence`)
**Risk class:** HIGH_ASSURANCE / SECURITY_BLOCKER_RESOLUTION
**Result:** `READY_FOR_INDEPENDENT_AUDIT` — both CVE-2026-102010 and CVE-2026-95619 carry evidence-complete **proposed** `NOT_AFFECTED` dispositions. Under ADR-0007/PH-SEC-VEX-POLICY the executor proposes only; independent audit and explicit owner approval for the exact artifact remain mandatory before these rows stop blocking PR #15.

Executor: Codex. No disposition here is approved by this Work Order. PH-M01-WO-002 was **not** started and PR #15 was **not** merged.

---

## 1. Scope and authorisation boundary

Evidence-only. Nothing in the product, dependencies, runtime configuration or data model was changed.

| Prohibited by the Work Order | Observed |
|---|---|
| Product / domain / schema / migration / TenantContext / Supabase Auth / secret vault / Polymarket / trading changes | none |
| Dockerfile or Compose mutation | none — `Dockerfile.dev` (blob `7bb79d3b`) and `compose.yaml` (blob `8158fca1`) untouched |
| Package manifest / lockfile / dependency / base-image mutation | none — `package.json` (blob `33b4308b`) and `package-lock.json` (blob `5c36ff1b`) untouched |
| Target artifact mutation | none — image inspected read-only via `docker run --network none` and `docker create`/`docker cp` extraction |
| Scanner suppression, ignore, waiver, accepted-risk, severity downgrade | none |
| Self-approval of `NOT_AFFECTED` | none — auditor and owner fields are `PENDING` |
| `PH-M01-WO-002` start | not started |
| PR #15 merge | not merged |
| Exploit execution against external systems | none — only local static/binary analysis |

---

## 2. PREFLIGHT

Reconciliation receipt: [`receipts/preflight-reconciliation.json`](PH-SEC-WO-008/receipts/preflight-reconciliation.json) — **15/15 PASS**.

| # | Check | Result | Detail |
|---|---|---|---|
| P1 | Branch is `security/ph-m01-libstdcpp-final-two` | PASS | — |
| P1 | Parent head `5cf4c2ffe7b5365ca4941253f92b612f0322a83d` is ancestor of HEAD; HEAD = parent + 3 WO-008 planning commits only (`55a0089`, `1f439e3`, `ad0f599`) | PASS | merge-base with canonical main `64ec83d0` = `e1237cda` |
| P1 | PR #15 OPEN, DRAFT, unmerged at parent head | PASS | `gh pr view 15`: state OPEN, isDraft true, mergedAt null, headRefOid `5cf4c2ff` |
| P2 | PR #35 exists on this branch | PASS | state OPEN, head `ad0f5994` |
| P3 | All Context Lock `criticalSources` fingerprints | PASS | 19/19 blobs matched (9 on canonical main `64ec83d0`; parent artifacts at parent head). Logical-path map recorded in the receipt: `parent:locked-sarif` → `.engineering/evidence/PH-SEC-WO-005/validation/polyhunter-dev-final.sarif`; WO-007 deliverables at `.engineering/evidence/` root; WO-007 context lock at `.engineering/context-locks/PH-SEC-WO-007.json` |
| P4 | Exact target image digest | PASS | `polyhunter-dev:local` = `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` |
| P4 | Locked SARIF fingerprint | PASS | blob `d3999a5664ec91e2b555d468b6e85c8d04aaabe9` |
| P5 | Exactly 22 HIGH/CRITICAL, 22 distinct CVEs | PASS | 22 error-level rows in locked SARIF; 76 results total |
| P6 | 20 owner-approved WO-007 NOT_AFFECTED rows remain artifact-bound and unexpired | PASS | WO-007 VEX summary (20 NOT_AFFECTED / 2 UNDER_INVESTIGATION) + owner approval receipt (2026-10-05, this exact digest) re-read at execution time; no component/version drift (same locked SARIF blob, same digest) |
| P6 | Exactly CVE-2026-102010 and CVE-2026-95619 unresolved | PASS | both in the 22; all other 20 approved |
| P6 | Original 35 Go HIGH/CRITICAL remain zero | PASS | 0 Go/golang rules in locked SARIF at any severity |
| P7 | CISA KEV snapshot | PASS | catalogVersion `2026.10.04`; **neither target CVE in KEV** (1734 entries scanned) — `receipts/cisa-kev-wo008.json` |
| P7 | FIRST EPSS snapshot | PASS | 2026-10-05: 102010 = 0.0025/0.1479; 95619 = 0.00363/0.2790 — `receipts/first-epss-wo008.json` |
| P8 | Node/V8/libstdc++ identities captured before source analysis | PASS | `receipts/artifact-identity.txt` |

No drift: any drift would have forced `BLOCKED_STALE_CONTEXT`.

### Target artifact identity

```
image_ref=polyhunter-dev:local
image_id=sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3
os=Debian GNU/Linux 12 (bookworm)  base=node:24-bookworm-slim
node=v24.21.0  v8=13.6.233.17-node.53  (process.versions receipt)
libstdc++=libstdc++.so.6.0.30 (libstdc++6 12.2.0-14+deb12u1)
glibc=2.36-9+deb12u14
node links libstdc++.so.6 => /lib/x86_64-linux-gnu/libstdc++.so.6.0.30 (ldd)
```

Receipt: [`receipts/artifact-identity.txt`](PH-SEC-WO-008/receipts/artifact-identity.txt).

---

## 3. Upstream fix commits (read and preserved)

Both commits were fetched directly from the authoritative `https://gcc.gnu.org/git/gcc.git` repository by SHA (shallow fetch), not from scanner prose. Receipts in `receipts/upstream/`.

| CVE | Commit | Author / date | What the fix does |
|---|---|---|---|
| CVE-2026-102010 | `aaa8351f4d2e636f9680a1f0a8ebc2f0a60611e6` | Jonathan Wakely, 2026-09-25 | Adds `m_a_entries = new_entries;` in `__gnu_pbds detail::binary_heap erase_if` after the reallocation (use-after-free: `m_a_entries` left dangling). File: `libstdc++-v3/include/ext/pb_ds/detail/binary_heap_/erase_fn_imps.hpp` (PR libstdc++/127656). |
| CVE-2026-95619 | `59d235ffa5a69231eb42e5290d52dc8c90d28b7a` | Jonathan Wakely, 2026-09-23 | Replaces `using ::aligned_alloc` with a checked `__gnu_cxx::aligned_alloc`; `__builtin_add_overflow(sz, al - 1, &sz)` before the C11 rounding `(sz + al - 1) & ~(al - 1)`; equivalent checks for the Wine `_aligned_malloc` and malloc-fallback branches; wrapped sizes now throw `bad_alloc`. File: `libstdc++-v3/libsupc++/new_opa.cc` (Red Hat bug 2537811 per locked scanner evidence). |

Receipts: `cve-2026-102010-commit-meta.txt`, `cve-2026-102010-binary_heap.diff`, `cve-2026-102010-erase_fn_imps-vulnerable.hpp` (vulnerable version), `cve-2026-95619-commit-meta.txt`, `cve-2026-95619-new_opa.diff`, `cve-2026-95619-new_opa-vulnerable.cc` (vulnerable version, parent `d5f892fb`).

---

## 4. Compiled C++ consumer set (complete enumeration)

Method: filesystem-wide scan inside the exact image for references to `libstdc++.so.6`, cross-checked with `ldd` on every ELF binary in `/bin`, `/usr/bin`, `/sbin`, `/usr/sbin`, `/usr/local/bin` (full ELF inventory receipt). **The complete set of compiled C++ consumers is:**

| Consumer | Kind | align_val_t references | pb_ds references |
|---|---|---|---|
| `/usr/local/bin/node` (≡ `nodejs`) | executable, running | imports `_ZnamSt11align_val_t` (1 PLT entry, 2 call sites) | **0** |
| `/usr/bin/apt`, `apt-get`, `apt-cache` (libapt frontends) | executables, not run by compose | **0** | **0** |
| `libapt-pkg.so.6.0.0`, `libapt-private.so.0.0.0` | libraries | **0** | **0** |
| `libvips-cpp.so.8.18.7` (sharp 0.35.5 bundle) | library, **loaded by no running process** (see §7.2) | imports `_ZnamSt11align_val_t` (1 call site, constant size) | **0** |
| `libstdc++.so.6.0.30` | the library itself | defines the operators | **0** (`__gnu_pbds` is header-only; no instantiations) |

Receipts: `receipts/elf-inventory.txt`, `receipts/libstdcxx-consumers.txt`, `receipts/libstdcxx-consumers-final.txt`, `receipts/libstdcxx-consumer-set.json`, `receipts/dynsym-align-val-analysis.json`.

---

## 5. CVE-2026-102010 — analysis

**Vulnerable operation (from the exact fix diff):** `__gnu_pbds detail::binary_heap::erase_if(Pred)` frees the old entry storage but leaves `m_a_entries` dangling → use-after-free on any subsequent heap operation. Affected API is `__gnu_pbds::priority_queue` with the `binary_heap_tag` policy (`<ext/pb_ds/priority_queue.hpp>`) — a non-standard GNU extension. **Not** `std::priority_queue` (which has no `erase_if`); the SARIF prose "binary-heap priority_queue" refers to the pb_ds container.

**Presence analysis (positive absence at consumer level — not a `.dynsym` miss in libstdc++.so):**

1. The vulnerable code is a header-only template instantiated only into consumers that include and use pb_ds.
2. Every compiled C++ consumer in the artifact (§4) was audited: **zero** `pb_ds`/`binary_heap` byte strings (probe receipts), **zero** `__gnu_pbds`/`binary_heap` dynsym entries (host-parsed ELF64 `.dynsym` with parser reading the exact shipped binaries), **zero** `stl_heap` strings in node.
3. Node's `priority_queue` strings are all the JavaScript module `lib/internal/priority_queue.js` — unrelated.
4. The Node.js v24.21.0 source tree (exact tag) contains no `ext/pb_ds` include anywhere in `src/` or `deps/`.

The CR-04 objection (templates may be inlined into compiled consumers, so library symbol absence proves nothing) is satisfied: the audit reads the **consumer binaries themselves**, and an inlined instantiation would still require its mangled names or at least the distinctive `__gnu_pbds` strings in that binary — none exist. There is no executable page in this artifact containing the vulnerable code.

**Verdict:** `vulnerableCodePresent = false` → proposed `NOT_AFFECTED / vulnerable_code_not_present`.

---

## 6. CVE-2026-95619 — analysis

**Vulnerable code presence (confirmed, and confirmed to be the vulnerable variant):** the shipped `libstdc++.so.6.0.30` exports `_ZnwmSt11align_val_t`/`_ZnamSt11align_val_t` and imports glibc `aligned_alloc` (no `posix_memalign` import). Byte-level decode of `_ZnwmSt11align_val_t` (`receipts/libstdcxx-opnew-align-body.hex`) shows the C11 rounding sequence `lea rax,[rbx+rbp-1]; neg rbp; and rbp,rax` — exactly the `(sz + align - 1) & ~(align - 1)` computation the upstream fix guards with `__builtin_add_overflow` — followed by a call to `aligned_alloc`. The posix_memalign preference (PR 113258) is **not** compiled in for gcc 12.2.0-14+deb12u1. `node` links this `.so`. Presence is therefore not in dispute; the row turns on reachability and attacker control.

**Exact overflow arithmetic/threshold (64-bit `size_t`):**

```
rounded = (sz + align - 1) & ~(align - 1)
overflow iff sz + align - 1 >= 2^64
        iff sz >= 2^64 - (align - 1)
align=64 (the artifact's only aligned caller)  =>  sz >= 2^64 - 63 = 18446744073709551553
a wrapped call allocates (sz + 63) mod 64 bytes and returns a valid non-null pointer
```

**Call-path analysis (exhaustive, on the exact shipped binary):**

1. `node` imports exactly one aligned operator: `_ZnamSt11align_val_t` — 1 JUMP_SLOT relocation (GOT `0x6b55608`), 1 PLT stub (`0x747010`).
2. Exactly **2 call sites** reference that stub: vaddrs `0xd7201e` and `0xd72164`, both inside `v8::internal::OptimizingCompileTaskExecutor::EnsureInitialized()` (`_ZN2v88internal29OptimizingCompileTaskExecutor17EnsureInitializedEv`, 0xd71fc0..0xd72316).
3. Source mapping at exact tag **v24.21.0** (commit `955266bfdd854cd280dffd47548673914484e4c0`): `optimizing-compile-dispatcher.cc:141-142` — `base::OwnedVector<OptimizingCompileTaskState>::New(max_tasks)` → `std::make_unique<OptimizingCompileTaskState[]>(max_tasks)` → `operator new[](max_tasks * 64, align_val_t(64))` (`OptimizingCompileTaskState` is `alignas(PROCESSOR_CACHE_LINE_SIZE)`, `PROCESSOR_CACHE_LINE_SIZE = 64`).
4. **Bound proof:** `max_tasks = v8_flags.concurrent_turbofan_max_threads` (DEFINE_UINT, **default 4**, startup-only) or `NumberOfWorkerThreads()` when the flag is 0 (node clamps to `uv_available_parallelism() − 1`, min 1; V8's own platform clamps to 16). `n` is a small bounded integer; `n · 64 ≤ ~2^37` — **≥ 2^27 below** the `2^64 − 63` threshold. Even the theoretical maximum uint flag value (≈ 2^32) yields `n·64 ≈ 2^38`, still 2^26 below.
5. **Attacker control:** JavaScript cannot influence `max_tasks` — it is set from CLI flags/platform thread counts at startup; no runtime setter exists (`src/` has zero references). The web/worker JS surface cannot call a C++ operator.
6. **Other consumers:** apt/libapt — zero aligned-new references. libvips-cpp — exactly one aligned-new call site (`.text 0x403ab3`) with **constant** size argument (`mov esi, 4`) — arithmetically cannot wrap; moreover libvips-cpp is loaded by no running process in the local-dev runtime: sharp is Next's optional production image-optimizer, compose runs `next dev --webpack` (dev mode does not invoke sharp), and no app code imports `sharp` or `next/image` (`receipts/sharp-libvips-exposure.json`).
7. **cppgc symbols:** the two `MakeGarbageCollectedTraitInternal::Allocate(..., align_val_t, ...)` symbols **defined** by node do not call global aligned `operator new`; the cppgc aligned path routes to Oilpan's PageBackend linear-allocation buffer (`object-allocator.cc OutOfLineAllocateImpl`). They are parameter-type coincidences, not calls.
8. **Inlined-code caveat:** a same-binary inlined implementation of aligned `operator new` would remove the import; the import exists and every call to it was enumerated. A full source search of the exact Node tag for `align_val_t` found only the non-calling cppgc path — consistent with the binary.

**Hard runtime bounds (defence in depth, exact sources at tag v24.21.0):** String `kMaxLength = (1<<29)−24` (`v8-primitive.h:126`); `JSArrayBuffer::kMaxByteLength` = `kMaxSafeInteger` in this build (pointer compression/sandbox off, `node.gyp:5`); Node `Buffer::kMaxLength = v8::Uint8Array::kMaxLength` (`node_buffer.h:32`) — and Buffer/ArrayBuffer backing stores allocate through the malloc-based `ArrayBuffer::Allocator`, never through aligned `operator new` (`receipts/v8-runtime-bounds.json`).

**Verdict:** vulnerable code present and mapped, but the sole call path passes a startup-bounded, non-attacker-controlled size — ≥ 2^27 below the exact overflow threshold. Proposed `NOT_AFFECTED / vulnerable_code_cannot_be_controlled_by_adversary`.

---

## 7. Method and its limits (stated plainly)

### 7.1 Binary analysis tooling
The image ships no binutils and no python3; all ELF parsing (`.dynsym` enumeration, `.rela.plt` relocations, PLT stub discovery, `e8` call-site scan, disassembly-by-hand of `_ZnwmSt11align_val_t`) was done on the **host** in Python over binaries extracted verbatim by `docker create` + `docker cp` from the digest-pinned image. Extraction SHA-256s are recorded in `SHA256SUMS.txt` (`receipts/extracted/`).

### 7.2 The libvips/sharp consumer
`libvips-cpp.so.8.18.7` is present in `/workspace/node_modules` (installed by `npm ci` because `next` declares `sharp ^0.35.4` optional). It is **not loaded by any running process**: the compose web service runs Next.js in dev mode (`npm run dev ... --webpack`), which does not invoke the production image optimizer, and no application code imports `sharp` or `next/image`. This makes libvips a dormant file, not a reachable consumer — recorded in `receipts/sharp-libvips-exposure.json`. Its single aligned-new call uses a constant size regardless.

### 7.3 Residual limitations
- The 95619 path analysis is exhaustive at the PLT level; a hypothetical future inline of aligned `operator new` into node would evade it — but that would also remove the import we observe, and the source-tree audit found no such inline. Residual risk recorded as LOW-MEDIUM in the VEX row with an explicit expiry trigger.
- The 102010 consumer audit covers every libstdc++-linked binary in the image; a new binary added by a future image change expires the disposition.
- Neither row was disposed via KEV/EPSS: both snapshots are recorded as prioritisation inputs only, per policy.

---

## 8. Runtime model (unchanged, from parent head)

- **web** — `npm run dev --workspace @polyhunter/web -- --webpack --hostname 0.0.0.0`, published `127.0.0.1:3000` only.
- **worker** — `nodemon ... --exec node apps/worker/src/index.ts`.
- **postgres** — separate container, out of scope.
- Container user `node` (uid 1000), `CapEff = 0x0` (no capabilities). No application subprocess spawning (`apps/**`, `packages/**` carry zero `child_process`/`spawn` references — carried from WO-007 §4, unchanged).

---

## 9. Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Both target CVEs have complete individual records | **MET** — `PH-SEC-WO-008-VEX.json`, 2 findings with all policy-required fields |
| 2 | Upstream fix commits read and preserved | **MET** — both diffs + vulnerable-version snapshots + commit metadata from gcc.gnu.org by SHA |
| 3 | Exact shipped Node/V8 version mapped to source evidence | **MET** — v24.21.0 = commit `955266bfdd854cd280dffd47548673914484e4c0`, shallow-cloned and line-cited |
| 4 | CVE-2026-102010 does not rely on `.dynsym` absence in libstdc++.so | **MET** — positive absence proven per consumer binary (bytes + dynsym of node/libapt/libvips), source-tree corroboration |
| 5 | CVE-2026-95619 includes exact overflow arithmetic/threshold | **MET** — formula, threshold `2^64 − 63`, bound proof ≥ 2^27 margin |
| 6 | Consumer/call-path evidence sufficient for HIGH_ASSURANCE | **MET** — complete consumer enumeration + exhaustive PLT/call-site analysis; residual limitations disclosed |
| 7 | No product/runtime/dependency mutation | **MET** — evidence-only diff |
| 8 | No suppression/waiver | **MET** — zero suppressions |
| 9 | Parent/image/SARIF fingerprints remain locked | **MET** — preflight 15/15 |
| 10 | Evidence reproducible and sufficient for independent audit | **MET** — deterministic receipts + SHA256SUMS |

---

## 10. Bundle index

```
PH-SEC-WO-008/
├── SHA256SUMS.txt                          SHA-256 index over every receipt
├── analysis/
│   └── build_vex.py                        emits PH-SEC-WO-008-VEX.json (deterministic)
├── preflight/  (see receipts/preflight-reconciliation.json)
└── receipts/
    ├── preflight-reconciliation.json       15/15 PASS reconciliation
    ├── locked-sarif.json                   the locked SARIF (blob d3999a56, verbatim copy)
    ├── w007-vex-reference.json             WO-007 VEX as approved (drift reference)
    ├── w007-evidence-reference.md          WO-007 evidence bundle (drift reference)
    ├── w007-owner-approval.md              WO-007 owner approval (drift reference)
    ├── adr-0007.md / vex-policy.md         governance sources (fingerprinted)
    ├── cisa-kev-wo008.json                 CISA KEV catalog 2026.10.04
    ├── first-epss-wo008.json               FIRST EPSS 2026-10-05
    ├── artifact-identity.txt               node/V8/libstdc++/glibc identities + ldd
    ├── elf-inventory.txt                   every ELF binary in the image
    ├── libstdcxx-consumers.txt / -final.txt / consumer-set.json
    ├── dynsym-align-val-analysis.json      host ELF .dynsym parse (node, libstdc++, libvips)
    ├── upstream/
    │   ├── cve-2026-102010-commit-meta.txt / -binary_heap.diff / -erase_fn_imps-vulnerable.hpp
    │   └── cve-2026-95619-commit-meta.txt / -new_opa.diff / -new_opa-vulnerable.cc
    ├── cve-102010-presence-probe{,2,3}.txt pb_ds byte probes
    ├── cve-95619-node-dynsym.json          node's align_val_t dynsym entries
    ├── cve-95619-callsite-analysis.json    PLT relocation + call-site mapping
    ├── cve-95619-consumers.txt             align_val_t byte scan across consumers
    ├── libstdcxx-opnew-align-body.hex      decoded vulnerable operator new body
    ├── libstdcxx-allocator-imports.json    libstdc++ imports aligned_alloc (no posix_memalign)
    ├── libvips-cpp-aligned-new-*.json      libvips call site (constant size=4)
    ├── sharp-libvips-exposure.json         libvips dormant in dev runtime
    ├── v8-runtime-bounds.json              V8/Node size bounds + threshold cross-check
    ├── glibc-aligned-capability.txt        glibc 2.36 aligned functions
    └── extracted/                          verbatim binaries used for host analysis
```

Top-level deliverables: `PH-SEC-WO-008-EVIDENCE.md`, `PH-SEC-WO-008-VEX.md`, `PH-SEC-WO-008-VEX.json`.

---

## 11. Result

**`READY_FOR_INDEPENDENT_AUDIT`** (proposed dispositions; not approved by the executor).

- **CVE-2026-102010** — proposed `NOT_AFFECTED / vulnerable_code_not_present`. The vulnerable `__gnu_pbds` binary-heap `erase_if` does not exist in any executable page of the artifact.
- **CVE-2026-95619** — proposed `NOT_AFFECTED / vulnerable_code_cannot_be_controlled_by_adversary`. The vulnerable aligned-`new` rounding is confirmed present and mapped, but the artifact's only aligned-new call path passes a startup-bounded size ≥ 2^27 below the exact overflow threshold.

Both rows remain **absolute blockers** for PR #15 until independently audited and explicitly owner-approved for `polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`, per ADR-0007 and PH-SEC-VEX-POLICY. PH-M01-WO-002 is not started. PR #15 is not merged.
