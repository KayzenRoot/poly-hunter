# PH-SEC-WO-008 — VEX Markdown (proposed dispositions)

**Work Order:** PH-SEC-WO-008 — final two libstdc++ blocker resolution
**Branch:** `security/ph-m01-libstdcpp-final-two` · **PR:** #35 (base = parent `feat/ph-m01-tenancy-persistence`)
**Risk class:** HIGH_ASSURANCE / SECURITY_BLOCKER_RESOLUTION
**Result:** `READY_FOR_INDEPENDENT_AUDIT` — both rows proposed `NOT_AFFECTED` with evidence; executor proposes only, independent audit + owner approval still required.

Machine-readable source of truth: [`PH-SEC-WO-008-VEX.json`](PH-SEC-WO-008-VEX.json).

---

## CVE-2026-102010 — libstdc++6 `__gnu_pbds` binary_heap `erase_if` use-after-free

| Field | Value |
|---|---|
| Scanner tuple | docker scout 1.24.0 · HIGH (7.0) · `pkg:deb/debian/gcc-12@12.2.0-14+deb12u1` · "not fixed" |
| Installed component | `libstdc++6 12.2.0-14+deb12u1` (`libstdc++.so.6.0.30`) — scanner reports the Debian **source** package |
| Image | `polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` |
| Upstream fix | GCC commit `aaa8351f4d2e636f9680a1f0a8ebc2f0a60611e6` (PR libstdc++/127656, 2026-09-25) |
| VEX status | **NOT_AFFECTED** (proposed) |
| Justification | `vulnerable_code_not_present` |
| KEV / EPSS | not in KEV (catalog 2026.10.04) · EPSS 0.0025 / 0.1479 (2026-10-05) — prioritisation only |
| Confidence | HIGH · residual risk LOW |

### What the upstream fix says

The fix commit modifies `libstdc++-v3/include/ext/pb_ds/detail/binary_heap_/erase_fn_imps.hpp` — the **GNU policy-based data structures** (`__gnu_pbds`) binary-heap container, a non-standard extension requiring `#include <ext/pb_ds/priority_queue.hpp>`. In `erase_if(Pred)`, after allocating a smaller entry array and copying the survivors, the code frees the old storage but never updates the member pointer `m_a_entries`; the one-line fix is `m_a_entries = new_entries;`. This is a use-after-free **inside `__gnu_pbds` only**. It is **not** `std::priority_queue` from `<queue>`: `std::priority_queue` has no `erase_if`, and the fix touches no `std::` component.

### Why the artifact is not affected

The vulnerable code is header-only and would exist only if a shipped compiled C++ consumer instantiates it. Rather than repeating the CR-04 defect (reasoning from `libstdc++.so`'s symbol table), every compiled C++ consumer in the exact artifact was **enumerated and audited directly**:

1. **Consumer enumeration** — filesystem-wide scan for `libstdc++.so.6` linkage across the image yields the complete set: `node` (≡ `nodejs`), the `apt` frontends with `libapt-pkg`/`libapt-private`, and `libvips-cpp.so.8.18.7` (sharp's bundled libvips). Receipts: `receipts/libstdcxx-consumer-set.json`, `receipts/elf-inventory.txt`, `receipts/libstdcxx-consumers-final.txt`.
2. **Per-consumer audit** — zero `pb_ds`/`__gnu_pbds`/`binary_heap` byte strings in node, libapt and libvips-cpp (`cve-102010-presence-probe*.txt`); zero `__gnu_pbds`/`binary_heap` entries in the host-parsed ELF64 `.dynsym` of node, libstdc++ and libvips-cpp (`dynsym-align-val-analysis.json`); zero `stl_heap` strings in node. Node's only `priority_queue` strings are the JavaScript module `lib/internal/priority_queue.js` (a JS class, unrelated to C++ `std::priority_queue`).
3. **Source corroboration** — the Node.js source at the exact shipped tag (v24.21.0 = commit `955266bfdd854cd280dffd47548673914484e4c0`) contains no `ext/pb_ds` include anywhere in `src/` or `deps/`.
4. **Inlined-code caveat handled** — because the code is a template that may be inlined, the proof is taken at the consumer-binary level (byte + dynsym audit of each shipped binary), not at the library level. An instantiation inside a consumer binary would necessarily leave either exported symbols (none) or at minimum the mangled names/strings in that binary (none found).

There is no executable page in this artifact that contains the vulnerable `erase_if` instantiation. Presence is disproven, so reachability and attacker control are moot (and independently unproven-positive).

---

## CVE-2026-95619 — libstdc++6 aligned `operator new` integer overflow

| Field | Value |
|---|---|
| Scanner tuple | docker scout 1.24.0 · HIGH (7.7) · `pkg:deb/debian/gcc-12@12.2.0-14+deb12u1` · "not fixed" |
| Installed component | `libstdc++6 12.2.0-14+deb12u1` (`libstdc++.so.6.0.30`) |
| Image | `polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` |
| Upstream fix | GCC commit `59d235ffa5a69231eb42e5290d52dc8c90d28b7a` (2026-09-23; Red Hat bug 2537811 per locked scanner evidence) |
| VEX status | **NOT_AFFECTED** (proposed) |
| Justification | `vulnerable_code_cannot_be_controlled_by_adversary` |
| KEV / EPSS | not in KEV (catalog 2026.10.04) · EPSS 0.00363 / 0.2790 (2026-10-05) — prioritisation only |
| Confidence | HIGH for the enumerated path · residual risk LOW-MEDIUM |

### What the upstream fix says

`libstdc++-v3/libsupc++/new_opa.cc`: on targets compiled with `_GLIBCXX_HAVE_ALIGNED_ALLOC` and without `_GLIBCXX_HAVE_POSIX_MEMALIGN`, `operator new(size_t, align_val_t)` rounds the size up (`(sz + align - 1) & ~(align - 1)`) before calling C11 `aligned_alloc`. With `sz` near `SIZE_MAX` the addition **wraps to a small value**, `aligned_alloc` succeeds, and the caller receives a non-null pointer to an undersized region. The fix moves the adjustment into a checked `__gnu_cxx::aligned_alloc` using `__builtin_add_overflow`, adds the same check to the `_aligned_malloc` (Wine) and malloc-fallback branches, and throws `std::bad_alloc` instead of returning a wrapped pointer.

**Exact overflow formula (64-bit `size_t`):** wraparound iff `sz + align - 1 ≥ 2^64`, i.e. `sz ≥ 2^64 − (align − 1)`. For `align = 64` (the only alignment used by the artifact's sole aligned consumer): **`sz ≥ 2^64 − 63 = 18446744073709551553`**. A wrapped request allocates `(sz + 63) mod 64` bytes instead of `sz`.

### Vulnerable code presence — confirmed, in the vulnerable variant

The shipped `libstdc++.so.6.0.30` exports `_ZnwmSt11align_val_t`/`_ZnamSt11align_val_t` and imports glibc **`aligned_alloc`** (no `posix_memalign` import — `libstdcxx-allocator-imports.json`). Byte-level decode of `_ZnwmSt11align_val_t` (`receipts/libstdcxx-opnew-align-body.hex`) shows the rounding sequence `lea rax,[rbx+rbp-1]; neg rbp; and rbp,rax` at offset +0x2D followed by a call to `aligned_alloc` — i.e. the posix_memalign fast path (PR 113258) is **not** compiled in for gcc 12.2.0-14+deb12u1 and the exact code the fix hardens **is** in the artifact. `node` links this `.so` (`ldd` receipt), so the vulnerable code is mapped into the running process. This row is therefore disposed on **reachability + attacker control**, never on presence.

### Why no adversary can reach the overflow

Exhaustive call-site analysis of the exact shipped `node` binary (126,595,440 bytes):

1. `node`'s `.dynsym` carries exactly one aligned-new import: `_ZnamSt11align_val_t` (1 JUMP_SLOT at GOT `0x6b55608`, PLT stub `0x747010`). `_ZnwmSt11align_val_t` is neither imported nor defined by node. Receipt: `cve-95619-node-dynsym.json`.
2. Exactly **2 call sites** target that PLT stub (vaddrs `0xd7201e`, `0xd72164`), both inside `v8::internal::OptimizingCompileTaskExecutor::EnsureInitialized()` (`_ZN2v88internal29OptimizingCompileTaskExecutor17EnsureInitializedEv`, `0xd71fc0` + 430 bytes). Receipt: `cve-95619-callsite-analysis.json`.
3. Source mapping at exact tag v24.21.0: `optimizing-compile-dispatcher.cc:141-142` → `base::OwnedVector<OptimizingCompileTaskState>::New(max_tasks)` → `std::make_unique<OptimizingCompileTaskState[]>(max_tasks)`; `OptimizingCompileTaskState` is `alignas(64)` (`PROCESSOR_CACHE_LINE_SIZE`, `common/globals.h:1025`). The call is therefore `operator new[](max_tasks * 64, align_val_t(64))`.
4. **Bound:** `max_tasks` = `v8_flags.concurrent_turbofan_max_threads` (DEFINE_UINT, default **4**, startup-only flag) or, when 0, `NumberOfWorkerThreads()` (node clamps to `uv_available_parallelism()−1`, min 1). Even with absurd values, `n·64 ≤ ~2^37` — a factor `≥ 2^27` below the `2^64−63` threshold. JavaScript has no API to influence `max_tasks` at runtime; it derives from CLI/platform startup only.
5. **Other consumers:** `apt`/`libapt-pkg`/`libapt-private` carry zero `align_val_t` references (byte scan). `libvips-cpp.so.8.18.7` has exactly one aligned-new call site (`0x403ab3`) with a **constant** size argument (`mov esi,4`) — cannot wrap — and libvips-cpp is loaded by **no running process** in the local-dev runtime: sharp is Next.js's optional production image optimizer, and compose runs `next dev --webpack` (`sharp-libvips-exposure.json`). The app imports neither `sharp` nor `next/image`.
6. **cppgc note:** the two `cppgc::internal::MakeGarbageCollectedTraitInternal::Allocate(..., align_val_t, ...)` symbols **defined** by node are parameter-type coincidences; their implementation routes to Oilpan's PageBackend linear-allocation buffer, never to global aligned `operator new` (`object-allocator.cc OutOfLineAllocateImpl`).

The inlined-code caveat is handled the same way as for 102010: any same-binary inlined implementation of aligned `operator new` would remove the import, yet the import exists and every call to it was enumerated; and a source search of the exact Node tag for `align_val_t` found only the non-calling cppgc path, consistent with the binary.

---

## Result

Both rows are policy-complete **proposed** `NOT_AFFECTED` under ADR-0007 / PH-SEC-VEX-POLICY:

- CVE-2026-102010 — `vulnerable_code_not_present` (consumer-level positive absence).
- CVE-2026-95619 — `vulnerable_code_cannot_be_controlled_by_adversary` (single bounded, non-attacker-controlled call path).

**No** suppression, ignore, waiver or accepted-risk was used. **No** product, Dockerfile, Compose, base-image, package manifest, lockfile, schema, migration, TenantContext, auth, secret vault, Polymarket or trading mutation was performed. The executor cannot self-approve: independent audit and explicit owner approval for the exact artifact digest are required before these dispositions stop blocking PR #15.
