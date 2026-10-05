# PH-SEC-WO-007 — VEX Disposition (proposed, not approved)

**Work Order:** PH-SEC-WO-007 · **Branch:** `security/ph-m01-dev-nongo-vex` · **PR:** #33 (draft, base `feat/ph-m01-tenancy-persistence`)
**Parent head:** `7d5be250255bd20cb0b20d6713f6f41c52c73b47` · **Parent PR:** #15 (OPEN, unmerged)
**Canonical main:** `64ec83d02dbf9c85ca9718eb319efb44a1d62b76`
**Target artifact:** `polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`
**Scanner:** docker scout 1.24.0 · **Locked SARIF:** `.engineering/evidence/PH-SEC-WO-005/validation/CR-01/polyhunter-dev-cr01.sarif`
**Governing policy:** `.engineering/proposals/PH-SEC-VEX-POLICY.md` via `ADR-0007`

## Review format: `BLOCKED_UNRESOLVED`

| Metric | Value |
|---|---|
| Unique HIGH/CRITICAL findings reconciled | **22 / 22** |
| HIGH / CRITICAL | 20 / 2 |
| Proposed `NOT_AFFECTED` | 21 |
| `AFFECTED` | 0 |
| `UNDER_INVESTIGATION` | **1 — CVE-2026-95619** |
| Scanner suppressions / ignores introduced | 0 |
| Original 35 Go HIGH/CRITICAL | 0 (unchanged) |

The STOP CONDITION requires zero `AFFECTED`/`UNDER_INVESTIGATION` rows for `READY_FOR_INDEPENDENT_AUDIT`. One row remains open, so this Work Order stops `BLOCKED_UNRESOLVED` and `PH-M01-WO-002` is **not** started.

## Approval state

| Role | Actor | State |
|---|---|---|
| Executor (proposes only) | Codex | complete |
| Independent auditor | ChatGPT / planning auditor | **PENDING** |
| Owner approval | Project Owner | **PENDING** |

Nothing in this document is approved. The executor cannot self-approve.

## VEX inputs (prioritisation only)

| Input | Snapshot | Result for these 22 |
|---|---|---|
| CISA KEV | catalogVersion `2026.10.04`, released `2026-10-04T18:52:56Z`, 1734 entries | **0 of 22 in KEV** |
| FIRST EPSS | date `2026-10-04`, 22/22 rows | max score `0.006630` (CVE-2026-69192), all < 0.007 |

Per PH-SEC-VEX-POLICY, KEV and EPSS are prioritisation inputs only and never convert a finding to `NOT_AFFECTED`. Every disposition below rests on exact-artifact evidence.

## Runtime model used for reachability

- **web:** `npm run dev --workspace @polyhunter/web -- --webpack --hostname 0.0.0.0`, published on host `127.0.0.1:3000` only.
- **worker:** `nodemon --legacy-watch --polling-interval 1000 --watch apps/worker --watch packages --ext ts,json --exec node apps/worker/src/index.ts`
- **postgres:** separate container `postgres:17.11-alpine3.24`.
- Container user `node` (uid 1000); `CapEff`/`CapPrm`/`CapInh` all `0x0`.
- **No application subprocess spawning:** grep over `apps/**` and `packages/**` returns zero `child_process` / `exec` / `execSync` / `spawn` / `spawnSync` references.

## Summary table

| # | CVE | Sev | Band | Component | Detected version | Vulnerable code present | VEX status | Justification |
|---|---|---|---|---|---|---|---|---|
| 1 | CVE-2026-85091 | 8.3 | HIGH | zlib | `1:1.2.13.dfsg-1` | **No** | NOT_AFFECTED | `vulnerable_code_not_present` |
| 2 | CVE-2026-48962 | 7.3 | HIGH | perl IO::Compress | `5.36.0-7+deb12u3` | **No** | NOT_AFFECTED | `vulnerable_code_not_present` |
| 3 | CVE-2026-48959 | 7.5 | HIGH | perl IO::Uncompress::Unzip | `5.36.0-7+deb12u3` | **No** | NOT_AFFECTED | `vulnerable_code_not_present` |
| 4 | CVE-2026-82560 | 7.5 | HIGH | perl Pod::Text | `5.36.0-7+deb12u3` | **No** | NOT_AFFECTED | `vulnerable_code_not_present` |
| 5 | CVE-2026-12087 | 9.1 | **CRITICAL** | perl Socket | `2.033` | **Yes** | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 6 | CVE-2026-57432 | 8.4 | HIGH | perl core pack/unpack | `5.36.0` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 7 | CVE-2026-13221 | 9.1 | **CRITICAL** | perl core regex trie | `5.36.0` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 8 | CVE-2026-76642 | 8.5 | HIGH | util-linux mount | `2.38.1-5+deb12u3` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 9 | CVE-2026-78409 | 7.0 | HIGH | util-linux mount X-mount.subdir | `2.38.1-5+deb12u3` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 10 | CVE-2026-78410 | 7.8 | HIGH | util-linux restricted bind mount | `2.38.1-5+deb12u3` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 11 | CVE-2026-78408 | 7.9 | HIGH | util-linux nsenter --join-cgroup | `2.38.1-5+deb12u3` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 12 | CVE-2026-102010 | 7.0 | HIGH | libstdc++6 std::erase_if | `12.2.0-14+deb12u1` | **No** | NOT_AFFECTED | `vulnerable_code_not_present` |
| 13 | CVE-2026-95619 | 7.7 | HIGH | libstdc++6 aligned operator new | `12.2.0-14+deb12u1` | **Yes** | **UNDER_INVESTIGATION** | — |
| 14 | CVE-2026-103111 | 7.6 | HIGH | pcre2 | `10.42-1+deb12u1` | **Yes** | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 15 | CVE-2026-14257 | 7.5 | HIGH | npm brace-expansion | `5.0.7` | Yes | NOT_AFFECTED | `vulnerable_code_cannot_be_controlled_by_adversary` |
| 16 | CVE-2026-69152 | 7.5 | HIGH | npm brace-expansion | `5.0.7` | Yes | NOT_AFFECTED | `vulnerable_code_cannot_be_controlled_by_adversary` |
| 17 | CVE-2026-102276 | 7.5 | HIGH | npm brace-expansion | `5.0.7` | Yes | NOT_AFFECTED | `vulnerable_code_cannot_be_controlled_by_adversary` |
| 18 | CVE-2026-102278 | 7.5 | HIGH | npm brace-expansion | `5.0.7` | Yes | NOT_AFFECTED | `vulnerable_code_cannot_be_controlled_by_adversary` |
| 19 | CVE-2026-19534 | 7.5 | HIGH | npm undici | `6.27.0` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 20 | CVE-2026-73566 | 7.5 | HIGH | npm tar | `7.5.19` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 21 | CVE-2026-69192 | 7.7 | HIGH | npm ip-address | `10.2.0` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |
| 22 | CVE-2026-93748 | 8.7 | HIGH | npm http-cache-semantics | `4.2.0` | Yes | NOT_AFFECTED | `vulnerable_code_not_in_execute_path` |

Full per-CVE evidence, prerequisites, residual risk and expiry triggers: [`PH-SEC-WO-007-VEX.json`](PH-SEC-WO-007-VEX.json). Method and receipts: [`PH-SEC-WO-007-EVIDENCE.md`](PH-SEC-WO-007-EVIDENCE.md).

## Blocking row — CVE-2026-95619

**Component:** `libstdc++6 12.2.0-14+deb12u1` (scanner attributes to source package `gcc-12`)
**Advisory:** integer overflow processing large inputs to the aligned operator new → undersized allocation → potential memory corruption. Not fixed: `gcc-12 <unfixed>`; fix commit `59d235ffa5a69231eb42e5290d52dc8c90d28b7a`, bugzilla `2537811`.

**Vulnerable code is confirmed present.** `libstdc++.so.6.0.30` exports the C++ aligned allocation operators:

```
_ZnwmSt11align_val_t      _ZnamSt11align_val_t
_ZdlPvSt11align_val_t     _ZdaPvSt11align_val_t
```

and `node` links that exact library:

```
$ ldd /usr/local/bin/node
libstdc++.so.6 => /lib/x86_64-linux-gnu/libstdc++.so.6
```

**Why this is not proposed `NOT_AFFECTED`.** Triggering the overflow requires a caller to pass an allocation size to `operator new(size_t, align_val_t)` large enough to overflow the internal size computation. The caller set across V8 and libstdc++ is large and **cannot be enumerated from inside this container**, and this analysis did not read the upstream commit to establish the exact size threshold. The application surface is TypeScript and cannot invoke a C++ operator directly — but that is an argument, not proof. ADR-0007 makes HIGH/CRITICAL default to `UNDER_INVESTIGATION` and lists "evidence is incomplete" as an explicit hard blocker. It fails closed.

**Minimal remediation delta.** No upstream fix exists for `gcc-12` (also unfixed in `gcc-14`/`gcc-15`/`gcc-16`), so there is no version bump that clears this row today. Resolution requires exactly one of:

1. **Wait for a Debian fix** to `libstdc++6` carrying commit `59d235ff`, then rebuild the dev image and re-run this analysis. Trigger: `libstdc++6` version change in the base image.
2. **Move the dev base image** to a Debian release whose `libstdc++6` is not affected, once one exists. Note `trixie` is recorded `<no-dsa>`/minor for the util-linux family but `libstdc++6` remains `<unfixed>` on all listed branches today.
3. **Independent auditor determination**, supported by (a) reading upstream commit `59d235ff` to establish the exact overflow threshold and (b) an audit of V8's aligned-allocation call sites showing no attacker-derived size can reach it. This is the only path that can close the row without waiting for Debian.

No Dockerfile, Compose, dependency or base-image change is authorised by this Work Order, so none was made.

## Rows requiring explicit auditor confirmation

These are proposed `NOT_AFFECTED` but rest on a reachability argument rather than on absence of the vulnerable code. They are ordered by how much the conclusion depends on that argument.

| CVE | Why it needs confirmation |
|---|---|
| CVE-2026-95619 | **Blocking.** Vulnerable symbol present in a library the runtime links; caller set not enumerable here. |
| CVE-2026-103111 | Weakest `NOT_AFFECTED`. pcre2 JIT is present *and functional* via `grep -P`, which imports `pcre2_jit_compile_8`. Only the absence of any application subprocess channel keeps it unreachable — an operator running `grep -P` over untrusted content inside the container would reach it. Shell-access precondition, not remote. |
| CVE-2026-14257 / 69152 / 102276 / 102278 | Vulnerable code present in npm's `brace-expansion@5.0.7`. Disposition turns on the finding that brace expansion applies to the **pattern**, and that every npm pattern source is local/trusted (repo manifests, npm config, operator CLI, signature-gated TUF). Enumeration was by grep over the installed npm tree, not a full control-flow audit. The application tree is separately patched at `5.0.12`. |
| CVE-2026-69192 | `Address4` **is** executed by socks; the disposition turns on the absence of any classifier-based trust decision rather than on absence of execution. Re-open immediately if npm or a dependency ever uses `ip-address` as an SSRF guard. |
| CVE-2026-57432 / 13221 | Core perl C code is present and cannot be disproven (perl is stripped with hidden visibility). Only non-execution protects them. |
| CVE-2026-12087 | Vulnerable function is present and callable at Socket 2.033; only the absence of a caller protects it. |
| CVE-2026-102010 | `std::erase_if` is header-only. Symbol absence is corroborated by a strong positive control (3012 `_ZNSt*` template instantiations *are* exported, and none is `erase_if`), plus the facts that the image ships no C++ compiler and the runtime is JavaScript. |

## Rows where the vulnerable code is positively absent

| CVE | Proof |
|---|---|
| CVE-2026-85091 | Artifact self-reports `inflate 1.2.13` / `deflate 1.2.13` in-band; highest exported tag `ZLIB_1.2.12`. Advisory states the vulnerable non-blocking `gzwrite` path and `gz_vacate()` were **introduced in 1.3.1.2**. The artifact predates it by a full minor series. |
| CVE-2026-48962 | `IO/Compress.pm`, `IO/Compress/Zip.pm` absent image-wide. |
| CVE-2026-48959 | `IO/Uncompress/Unzip.pm` absent image-wide. |
| CVE-2026-82560 | `Pod/Text.pm` and `Podlators.pm` absent image-wide. |

## Method corrections made during this Work Order

Three defects in the first-pass analysis were found by validation and corrected before any disposition was written. They are recorded because each one had produced a **false `NOT_AFFECTED`**, and reproducing them would defeat the purpose of the exercise.

1. **ELF `st_shndx` offset.** `ELF64_Sym.st_shndx` is at byte 6, not 4. Reading it at 4 yielded garbage `defined` flags, invalidating every first-pass symbol verdict. Fixed, and the reader now self-tests against known-present control symbols in each artifact.
2. **pcre2 symbol suffix.** `libpcre2-8-0` exports `pcre2_jit_compile_8`, not `pcre2_jit_compile`. The unsuffixed query reported JIT absent and would have produced an unjustified `NOT_AFFECTED`. Corrected; `pcre2_jit_compile_8` is present and the row was re-analysed on that basis.
3. **C++ mangled type.** The aligned allocation operators mangle as `align_val_t`, not `align_val`. The wrong name reported them absent. Corrected; they are present and CVE-2026-95619 became the blocking row.

Two further methodology limits are load-bearing and are stated rather than papered over:

- **Every inspected library is stripped** (`.dynsym` present, `.symtab` absent). A `.dynsym` miss therefore proves absence only for symbols the toolchain would have exported. For perl (hidden visibility) and for header-only C++ templates, symbol evidence is explicitly marked non-dispositive and those rows are decided on reachability instead.
- **XS subs are not ELF symbols.** `Socket::pack_ip_mreq_source` is registered at boot via `newXS`, so its absence from `Socket.so`'s `.dynsym` proves nothing. A runtime probe shows it **is** callable.

`grep -P` support was also initially mis-detected: the first probe used a match exit code as a support test, and `grep` returns 1 on "no match". Re-tested positively, `-P` **is** supported and `grep` does import `pcre2_jit_compile_8`.

## Expiry

Every proposed `NOT_AFFECTED` expires at the earliest of: 7 days from disposition; a new image digest; a new scanner result changing component/version; a new vendor/upstream advisory; a KEV status change; a material architecture or exposure change; or evidence becoming stale. An expired disposition returns to `UNDER_INVESTIGATION` automatically.

CVE-2026-95619 is already `UNDER_INVESTIGATION` and requires one of the three remediation paths above to change state.