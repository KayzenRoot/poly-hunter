# PH-SEC-WO-008 — VEX Markdown (proposed dispositions, post CR-01/CR-02/CR-03)

**Work Order:** PH-SEC-WO-008 — final two libstdc++ blocker resolution
**Branch:** `security/ph-m01-libstdcpp-final-two` · **PR:** #35 · **Revision:** correction delta applied after independent audit of `cf69a30`.
**Result:** `READY_FOR_INDEPENDENT_AUDIT` — both rows proposed `NOT_AFFECTED` with evidence; the executor proposes only, independent audit + owner approval still required.

Machine-readable source of truth: [`PH-SEC-WO-008-VEX.json`](PH-SEC-WO-008-VEX.json).

---

## Correction summary

| Finding | Correction |
|---|---|
| CR-01 | CVE-2026-102010 presence now proven by **source-level absence** for every compiled C++ consumer at its exact shipped version; the false "inlined leaves strings/nyms" claim is removed; pb_ds header/dev-package absence recorded. |
| CR-02 | CVE-2026-95619 libvips call-site ABI fixed (**RSI = alignment, RDI = size**); size traced to a data-derived buffer length; the "constant size 4" claim is withdrawn; the branch is closed by **runtime-unreachability** evidence. |
| CR-03 | Immutable Node v24.21.0 source receipts added and included in SHA256SUMS. |

---

## CVE-2026-102010 — `__gnu_pbds` binary_heap `erase_if` use-after-free

| Field | Value |
|---|---|
| Scanner tuple | docker scout 1.24.0 · HIGH (7.0) · `pkg:deb/debian/gcc-12@12.2.0-14+deb12u1` · "not fixed" |
| Installed component | `libstdc++6 12.2.0-14+deb12u1` (`libstdc++.so.6.0.30`) |
| Upstream fix | GCC commit `aaa8351f4d2e636f9680a1f0a8ebc2f0a60611e6` (PR libstdc++/127656) |
| VEX status | **NOT_AFFECTED** (proposed) — `vulnerable_code_not_present` |
| KEV / EPSS | not in KEV · EPSS 0.0025 / 0.1479 (prioritisation only) |
| Confidence | HIGH · residual risk LOW |

### Component level
The artifact installs only `libstdc++6` and `gcc-12-base` — **no** `libstdc++-12-dev`, **no** C++ headers (`/usr/include/c++` absent), **no** compiler, and **no** `ext/pb_ds/detail/binary_heap_/erase_fn_imps.hpp` anywhere. Scout reports the Debian **source** package `gcc-12`; the binary-only runtime packages carry no headers. The artifact cannot compile the vulnerable header, so presence would require a pre-built instantiation in a shipped consumer.

### Consumer level (dispositive)
Each compiled consumer is mapped to its exact source and shown free of any `ext/pb_ds` / `__gnu_pbds` / `binary_heap` / `erase_if` reference: node v24.21.0 (`955266bf…`), apt 2.6.1 (`a626a66f…`), libvips 8.18.7 (`24ad4d04…`), bundled C++ deps highway 1.4.0 / libultrahdr 2.0.2 / harfbuzz 14.5.0 / libheif 1.23.5, and the sharp 0.35.5 addon (`51a990fa…`). A template its source never referenced cannot be instantiated, inlined or not — so this proof does not depend on symbol/string absence. The earlier claim that inlining would necessarily leave mangled names/strings is **removed as false**.

---

## CVE-2026-95619 — libstdc++6 aligned `operator new` integer overflow

| Field | Value |
|---|---|
| Scanner tuple | docker scout 1.24.0 · HIGH (7.7) · `pkg:deb/debian/gcc-12@12.2.0-14+deb12u1` · "not fixed" |
| Installed component | `libstdc++6 12.2.0-14+deb12u1` (`libstdc++.so.6.0.30`) |
| Upstream fix | GCC commit `59d235ffa5a69231eb42e5290d52dc8c90d28b7a` (Red Hat 2537811) |
| VEX status | **NOT_AFFECTED** (proposed) — `vulnerable_code_cannot_be_controlled_by_adversary` |
| KEV / EPSS | not in KEV · EPSS 0.00363 / 0.2790 (prioritisation only) |
| Confidence | medium-high (node high; libvips branch excluded by runtime evidence) |

### Presence — confirmed vulnerable variant
`_ZnwmSt11align_val_t` performs the C11 rounding `(sz + al − 1) & ~(al − 1)` and calls glibc `aligned_alloc` (no `posix_memalign` compiled in). Exact threshold: `sz ≥ 2^64 − (align − 1)`; for align 64, `sz ≥ 2^64 − 63`.

### Reachable consumer — node
One aligned-new import, exactly two call sites, both in `OptimizingCompileTaskExecutor::EnsureInitialized()` → `operator new[](max_tasks · 64, align_val_t(64))`, with `max_tasks` a startup-only flag (default 4) or clamped thread count — ≥ 2^27 below the threshold and not influenceable from JavaScript. Preserved with Node v24.21.0 source receipts (CR-03).

### libvips — corrected ABI, branch closed by runtime evidence (CR-02)
Prior decoding `mov esi,4 (size=4)` was **wrong**: RSI is `alignment`, so that is alignment 4; size is in RDI (`mov rdi,r12`), where `lea r12,[rsi−0xe]` makes it a **data-derived buffer length** (an `ICC_PROFILE`/ICC-tag parser), not a constant. The size bound is **not proven at source** for that stripped function. The branch is closed instead by **direct runtime evidence**: `libvips-cpp` and `sharp-linux-x64.node` appear in **zero** `/proc/<pid>/maps` entries; the only mapped native module is `next-swc`, which does not link libstdc++.

**Disclosed limitation:** the libvips size bound is unproven at source; exclusion rests on the exact running runtime. Re-opened if image optimisation becomes active.

---

## Result

Both rows are policy-complete **proposed** `NOT_AFFECTED` under ADR-0007 / PH-SEC-VEX-POLICY, after CR-01/CR-02/CR-03. **No** suppression/waiver/accepted-risk was used. The executor cannot self-approve: independent audit and explicit owner approval for the exact artifact digest are required before these dispositions stop blocking PR #15.