# PH-SEC-WO-007 — Evidence Bundle

**Work Order:** PH-SEC-WO-007 — exact-image VEX disposition for the remaining 22 development-image HIGH/CRITICAL findings
**Branch:** `security/ph-m01-dev-nongo-vex` · **PR:** #33 (draft → base `feat/ph-m01-tenancy-persistence`)
**Risk class:** HIGH_ASSURANCE / SECURITY_BLOCKER_DISPOSITION
**Result:** `BLOCKED_UNRESOLVED` — 22/22 reconciled, 20 proposed `NOT_AFFECTED`, 2 `UNDER_INVESTIGATION` (CVE-2026-102010 and CVE-2026-95619)

Executor: Codex (proposes dispositions only). Independent audit and owner approval are **PENDING**.

---

## 1. Scope and authorisation boundary

This Work Order is evidence-only. Nothing in the product, its dependencies, its runtime configuration or its data model was changed.

| Prohibited by the Work Order | Observed |
|---|---|
| Product / domain / schema / migration / TenantContext changes | none |
| Dockerfile or Compose mutation | none — `Dockerfile.dev` and `compose.yaml` untouched |
| Package manifest / lockfile / dependency mutation | none — `package.json` and `package-lock.json` untouched |
| Node major-version change | none |
| Scanner suppression, ignore, waiver, severity downgrade, wildcard VEX | none |
| Self-approval of `NOT_AFFECTED` | none — auditor and owner fields are `PENDING` |
| `PH-M01-WO-002` start | not started, per STOP CONDITION |
| Exploit payloads against external systems | none |

Safety rule observed throughout: only static inspection, ELF parsing, package/metadata reads, in-container benign probes and disposable-container `docker create` / `docker cp` extraction were used. Every container ran with `--network none`. No external system was probed.

---

## 2. PREFLIGHT

Reproduced deterministically by [`analysis/preflight.py`](PH-SEC-WO-007/analysis/preflight.py) → [`preflight/preflight-reconciliation.json`](PH-SEC-WO-007/preflight/preflight-reconciliation.json). The script exits non-zero if any assertion fails, so the receipt cannot silently go stale.

| # | Check | Result | Detail |
|---|---|---|---|
| P1 | Branch is `security/ph-m01-dev-nongo-vex` | PASS | — |
| P1 | Parent head `7d5be25` is an ancestor of HEAD | PASS | — |
| P1 | Merge-base equals parent head (no stray commits) | PASS | — |
| P1 | PR #15 OPEN and unmerged | PASS | head `feat/ph-m01-tenancy-persistence`, `mergedAt: null` |
| P2 | All Context Lock fingerprints | **PASS 17/17** | every `criticalSources` blob matched |
| P3 | Exact target image digest | **PASS** | `polyhunter-dev:local` = `sha256:ed140fd5…9297ba3`, identical to the lock |
| P4 | Locked SARIF fingerprint | PASS | blob `d3999a5664ec91e2b555d468b6e85c8d04aaabe9` |
| P4 | Exactly 22 unique HIGH/CRITICAL | PASS | 22 rules, 22 distinct CVE ids, no duplicates |
| P4 | 20 HIGH + 2 CRITICAL | PASS | CRITICAL = the two 9.1 perl rows |
| P5 | Original 35 Go HIGH/CRITICAL still zero | PASS | 0 Go HIGH/CRITICAL; 0 `golang` rules at any severity |
| P6 | CVE set reconciles exactly with the Work Order | PASS | no extras, no omissions |
| P7 | EPSS snapshot complete | PASS | 22/22 rows, date `2026-10-04` |
| P7 | KEV snapshot captured | PASS | catalogVersion `2026.10.04`; **0 of 22 in KEV** |

No mismatch was found, so no `STOP STALE/BLOCKED` was triggered on context grounds.

### Note on the scanner's package naming

Docker Scout reports Debian **source** packages. The image does not contain packages by those names, and that difference is itself evidence:

| Scanner package | Actually installed | Version |
|---|---|---|
| `gcc-12@12.2.0-14+deb12u1` | `libstdc++6`, `libgcc-s1`, `gcc-12-base` | identical ABI version |
| `pcre2@10.42-1+deb12u1` | `libpcre2-8-0` | identical |
| `perl@5.36.0-7+deb12u3` | `perl-base` (61 modules, minimal) | identical |
| `util-linux@2.38.1-5+deb12u3` | `util-linux` + `util-linux-extra` | identical |
| `zlib@1:1.2.13.dfsg-1` | `zlib1g` | identical |

In particular the image ships **`perl-base`, not `perl`**, which is why three of the six perl findings resolve to absent modules.

---

## 3. Target artifact identity

[`validation/image-identity.txt`](PH-SEC-WO-007/validation/image-identity.txt)

```
image_ref=polyhunter-dev:local
image_id=sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3
lock_digest=sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3
digest_match=True
os_arch=linux/amd64
config_user=node
entrypoint=[docker-entrypoint.sh]
cmd=[node]
```

Base `node:24-bookworm-slim`; Debian GNU/Linux 12 (bookworm); 88 dpkg packages ([`validation/image-dpkg-inventory.txt`](PH-SEC-WO-007/validation/image-dpkg-inventory.txt)).

---

## 4. Runtime model

Derived from the exact `compose.yaml` and `Dockerfile.dev` at parent head, then corroborated against the image.

- **web** — `npm run dev --workspace @polyhunter/web -- --webpack --hostname 0.0.0.0`; published on the host as `127.0.0.1:3000` only.
- **worker** — `nodemon … --exec node apps/worker/src/index.ts`.
- **postgres** — separate container `postgres:17.11-alpine3.24`.
- Container runs as `node` (uid 1000). `CapInh`/`CapPrm`/`CapEff`/`CapAmb` are all `0x0000000000000000`; `CapBnd` is `0xa80425fb`, which is only the inherited bound and grants no capability. **`CAP_SYS_ADMIN` is therefore unavailable.**
- Build-time install is `npm ci --ignore-scripts`.
- **The application never spawns a subprocess.** A grep over `apps/**` and `packages/**` (excluding `node_modules` and `.next`) returns zero `child_process`, `exec`, `execSync`, `spawn`, `spawnSync` or `execFile` references, and zero references to `grep`, `sed` or `pcre2`. This single fact is what keeps CVE-2026-103111 unreachable.

---

## 5. Method, and the limits that shaped it

### 5.1 ELF symbol evidence

The target image ships **no binutils** (no `nm`, no `readelf`), so symbol tables were read by a purpose-built pure-Python ELF64 `.dynsym` parser: [`analysis/elf_dynsym.py`](PH-SEC-WO-007/analysis/elf_dynsym.py). It executes nothing from the image and performs no network access.

Libraries were extracted unmodified via a disposable `docker create` + `docker cp`, hashed, and parsed on the host.

**Every inspected library is stripped** — `.dynsym` present, `.symtab` absent:

| Artifact | `.dynsym` entries | `.symtab` |
|---|---|---|
| `libz.so.1.2.13` | 125 | absent |
| `libstdc++.so.6.0.30` | 6165 | absent |
| `libpcre2-8.so.0.11.2` | 99 | absent |
| `perl` | 2191 | absent |
| `Socket.so` | 55 | absent |

Consequence, stated plainly: a `.dynsym` miss proves absence **only** for symbols the toolchain would have exported. It proves nothing for perl's hidden-visibility internals, nothing for header-only C++ templates, and nothing for XS subs (which are registered at boot via `newXS`, not exported). Each CVE row records whether its absence claim is dispositive.

To prevent a silent regression, the analysis runs a **parser self-test** on every invocation, asserting that known-present control symbols are visible in each artifact. All five pass — [`validation/symbol-presence-authoritative.json`](PH-SEC-WO-007/validation/symbol-presence-authoritative.json).

### 5.2 Corrections made during analysis

Validation caught three defects in the first pass. Each had already produced an unsound `NOT_AFFECTED`, so they are recorded in full.

1. **`ELF64_Sym.st_shndx` offset.** The field is at byte 6, not 4. Reading it at 4 consumed the `st_info`/`st_other` bytes and produced meaningless `defined` flags, invalidating every first-pass verdict. Detected because the first run reported grep as having *zero* imported symbols. Fixed; the reader now self-tests.
2. **pcre2 symbol suffix.** `libpcre2-8-0` exports `pcre2_jit_compile_8`. Querying the unsuffixed form reported the JIT absent — a **false `NOT_AFFECTED`** on CVE-2026-103111. Corrected and re-analysed.
3. **C++ mangled type.** The aligned allocation operators mangle as `align_val_t`. The wrong name reported them absent — a **false `NOT_AFFECTED`** on CVE-2026-95619. Corrected; they are present, and that row became the blocking finding.

Two further methodology errors were caught and corrected in the same spirit:

- **`grep -P` was initially mis-detected as unsupported** because the probe used grep's match exit code as a support test, and grep returns 1 on "no match". Re-tested positively: `-P` **is** supported, and grep **does** import `pcre2_jit_compile_8`. This weakened CVE-2026-103111 and was carried into the final disposition.
- **A control-symbol expectation was wrong** (not the parser): `inet_pton` is *imported* from libc by `Socket.so`, not defined by it. Corrected so the self-test tests what it claims to test.

Net effect: three findings that an unchecked first pass would have wrongly cleared, one of which is now the reason this Work Order is blocked.

---

## 6. Per-CVE evidence summary

Full structured evidence for all 22 rows is in [`PH-SEC-WO-007-VEX.json`](PH-SEC-WO-007-VEX.json). Grouped by the kind of proof that decided each row:

### 6.1 Vulnerable code or component positively absent (4)

| CVE | Decisive evidence | Receipt |
|---|---|---|
| CVE-2026-85091 | `libz.so.1.2.13` self-reports `inflate 1.2.13` / `deflate 1.2.13`; top tag `ZLIB_1.2.12`. Advisory: the vulnerable non-blocking `gzwrite` path and `gz_vacate()` were **introduced in 1.3.1.2**. Artifact predates it. | `symbol-presence-authoritative.json` |
| CVE-2026-48962 | `IO/Compress.pm`, `IO/Compress/Zip.pm` absent image-wide; perl-base ships 61 `.pm` files, full-image census is 164 | `perl-component-presence.txt` |
| CVE-2026-48959 | `IO/Uncompress/Unzip.pm` absent image-wide | `perl-component-presence.txt` |
| CVE-2026-82560 | `Pod/Text.pm` and `Podlators.pm` absent image-wide | `perl-component-presence.txt` |

### 6.2 Vulnerable code present, trigger prerequisites positively disproven (11)

| CVE | Disproved prerequisite |
|---|---|
| CVE-2026-12087 | Socket 2.033 **is** affected (`< 2.041`) and `pack_ip_mreq_source` **is** callable, but no caller exists. Only perl in the image is Debian's Debconf set, which never touches `Socket`. Debian's own note matches: "only reachable when a script passes attacker-controlled source". |
| CVE-2026-57432 | Needs a pack/unpack template from untrusted input. No perl program in the image builds one; perl is never executed by the runtime. |
| CVE-2026-13221 | Needs a regex with >65535 fixed-string alternation branches. None exists in the image and perl is never executed by the runtime. The advisory's `Introduced with` annotation (commit `acababb4…`, v5.37.10) postdates the image's 5.36.0, which *would* imply absence — but that was **not** verified against perl 5.36.0, so the row stays on reachability and is **not** reclassified `vulnerable_code_not_present`. See §6.5. |
| CVE-2026-76642 / 78409 / 78410 | `/etc/fstab` is the stock file whose entire content is `# UNCONFIGURED FSTAB FOR BASE SYSTEM` (sha256 `a6b093c9…fbd17`) — **zero mount entries**, so no `X-mount.*` option can exist. No `mount.*` helpers shipped. `CAP_SYS_ADMIN` unavailable. |
| CVE-2026-78408 | `nsenter --join-cgroup` requires a privileged operator. npm never invokes `nsenter`; `CAP_SYS_ADMIN` unavailable. |
| CVE-2026-19534 | undici's WebSocket client exists, but the **only** undici importer in npm is `node-gyp/lib/download.js`, which imports `{ Agent, EnvHttpProxyAgent, RetryAgent, fetch }` — HTTP only. `WebSocket` appears **zero** times across npm outside undici's own code and docs. |
| CVE-2026-73566 | `mapHas` is present and uncapped, but node-tar installs the filter only under `if (files?.length)` (`list.js:140-141`, `extract.js:86`). All six npm tar call sites were read: `pacote` uses full `tar.x`; `node-gyp` (×2) and `libnpmdiff` pass a boolean `filter`; `lib/utils/tar.js` and `stage/download.js` pass only `onentry`. No `files:` option exists at any call site. |
| CVE-2026-93748 | Requires a shared multi-user cache **and** a client sending `max-stale`. npm's cache is single-user on local disk at `/home/node/.npm` (owner `node`); npm emits `max-stale` **nowhere**; npm runs no HTTP cache server. |
| CVE-2026-69192 | `Address4` *is* executed by socks 2.8.9, but only as a constructor/formatter (`helpers.js:132,150,155`; `socksclient.js:195,688,779`). Zero calls to `isPrivate`, `isLoopback`, `isLinkLocal`, `isCGNAT`, `isInSubnet`, `isHostInSubnet`, `Address4.isValid` or `correctForm` — so no trust-boundary decision exists for the mis-decode to subvert. |

### 6.3 Vulnerable code present, attacker cannot control the required input (5)

**brace-expansion 5.0.7 — CVE-2026-14257, CVE-2026-69152, CVE-2026-102276, CVE-2026-102278**

Vulnerable code confirmed present in npm's copy by direct markers: `p.push.apply(p, postParts)` and `parts.push.apply(parts, p)` at `dist/commonjs/index.js:62,64`; `N.push.apply(N, expand_(n[j], max, false))` at `:197`; and `EXPANSION_MAX_DEPTH` **absent** (the CVE-2026-102278 fix marker). The only importer in npm is `minimatch@10.2.5`.

The disposition turns on one structural fact: **brace expansion applies to the pattern, not to the subject.** Every minimatch pattern source in npm 11.19.0 was enumerated and each is local or trust-gated:

| Consumer | Pattern source | Trust |
|---|---|---|
| `@npmcli/map-workspaces`, `lib/utils/get-workspaces.js` | `workspaces` field of the **local** `package.json` | repo-controlled |
| `ignore-walk` (npm pack) | `files` field of the **local** `package.json` | repo-controlled |
| `@npmcli/arborist` `query-selector-all.js` | operator CLI query path | operator |
| `@npmcli/arborist` `release-age-exclude.js` | npm config `min-release-age-exclude` | operator config |
| `@tufjs/models` `role.js` | `DelegatedRole.paths` from **signature-verified** TUF metadata | signature-gated |

Registry-supplied values (package names, target paths) appear only as **subjects**. `minimatch`'s `MAX_PATTERN_LENGTH` of 65,536 does **not** block the documented payloads, so provenance — not length — is the operative control. At runtime, compose executes only `npm run dev`, which performs no dependency resolution and no glob over untrusted input.

The **application tree is separately patched**: `/workspace/node_modules/brace-expansion` is `5.0.12`, above every fix version for all four CVEs, and no application code imports `minimatch`, `glob` or `brace-expansion`.

**pcre2 — CVE-2026-103111**

`libpcre2-8.so.0.11.2` exports `pcre2_jit_compile_8`, `pcre2_jit_match_8`, `pcre2_jit_stack_create_8`, `pcre2_jit_stack_assign_8`, `pcre2_jit_stack_free_8`. GNU grep 3.8 imports `pcre2_jit_compile_8` and `-P/--perl-regexp` is functional. The advisory requires an **attacker-controlled regex**; no such channel exists because the application never spawns a subprocess and the only host exposure is `127.0.0.1:3000`.

This is the weakest `NOT_AFFECTED` in the bundle and is flagged for explicit auditor attention: an operator running `grep -P` over untrusted or network-fetched content inside this container would reach it. That is a shell-access precondition, not a remote one.

### 6.4 Not disposed — `UNDER_INVESTIGATION` (2)

**CVE-2026-95619** — libstdc++6 aligned operator new.

Vulnerable symbols confirmed present (`_ZnwmSt11align_val_t`, `_ZnamSt11align_val_t`, `_ZdlPvSt11align_val_t`, `_ZdaPvSt11align_val_t`), and `node` links that exact `libstdc++.so.6`. Triggering the overflow needs a caller to pass a large enough size to `operator new(size_t, align_val_t)`; the caller set across V8 and libstdc++ cannot be enumerated from inside this container, and the upstream commit was not read to establish the threshold. ADR-0007 treats "evidence is incomplete" as a hard blocker, so the row fails closed rather than being asserted `NOT_AFFECTED`.

**CVE-2026-102010** — libstdc++6 `std::erase_if` on a binary-heap `priority_queue` (reclassified by audit finding **CR-04**).

The bundle previously proposed `NOT_AFFECTED / vulnerable_code_not_present`, resting on the absence of an `erase_if` symbol from `libstdc++.so.6.0.30` (with a 3012-instantiation positive control), the image shipping no C++ compiler, and the runtime being JavaScript. The re-audit rejected that proof: `std::erase_if` is a **header-only template**, so it appears in `libstdc++.so`'s symbol table only if libstdc++ explicitly instantiated it — header/template code can be instantiated or inlined into **already-compiled C++ consumers** (including Node/V8 or any other shipped binary), and the absence of a compiler in the image does not prove absence of a previously compiled instantiation. "the runtime is JavaScript" is also insufficient because **Node/V8 is itself a compiled C++ runtime** linking this `libstdc++`. No exhaustive consumer/call-site audit of Node/V8 and other relevant binaries was performed, so presence/instantiation and reachability are **unproven**. The `vulnerable_code_not_present` justification is removed and the row fails closed to `UNDER_INVESTIGATION`; no NOT_AFFECTED justification is attached.

### 6.5 Correction made after the independent audit — CVE-2026-13221

Audit finding **CR-03** rejected the wording of the CVE-2026-13221 row, which asserted the flaw was "introduced in 5.37.10" with no exact source, and was internally contradictory ("5.36.0 is within the introduced range … so 5.36.0 predates it"). Corrected as follows.

**The claim now carries an exact upstream source**, transcribed from the locked SARIF advisory text for this CVE (`.engineering/evidence/PH-SEC-WO-005/validation/CR-01/polyhunter-dev-cr01.sarif`, blob `d3999a5664ec91e2b555d468b6e85c8d04aaabe9`):

| Field | Value |
|---|---|
| Introduced with | `https://github.com/Perl/perl5/commit/acababb42be12ff2986b73c1bfa963b70bb5d54e` (v5.37.10) |
| Fixed by | `https://github.com/Perl/perl5/commit/03f74bbbd3a68350d926ee93d56ee4808c28c4c7` (v5.43.10) |
| Debian bookworm | not fixed |

Both citations were extracted mechanically from that SARIF rule and were **not** independently re-verified against the perl5 git history; the bundle says so explicitly rather than implying a check that was not performed.

**The disposition is deliberately unchanged.** It remains proposed `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path` on the reachability basis. It was **not** converted to `vulnerable_code_not_present`, because no objective upstream or version-history evidence for Perl **5.36.0** was obtained — the `Introduced with` annotation is an upstream assertion about a commit, not a verified reading of the 5.36.0 source tree. The contradiction is removed by treating the row's `vulnerableCodePresent` as the **fail-closed** reading (`true`) and stating that the annotation is an unverified inference toward absence.

The precise auditor action that would permit the stronger classification is recorded in the row's `residualRisk`: confirm that commit `acababb4…` introduced the 16-bit trie delta **and** that 5.36.0 predates it.

### 6.6 Correction made after the independent re-audit — CVE-2026-102010 (CR-04)

The independent re-audit recorded on PR #33, on exact head
`457d5081de0fdf704add4a09300831e196f17917`, accepted **CR-01 / CR-02 / CR-03** and
issued a new finding, **CR-04**, against this row. It is corrected by the
**conservative path**.

**What was rejected.** The prior row proposed
`NOT_AFFECTED / vulnerable_code_not_present`. The proof was: zero `erase_if`
symbols in `libstdc++.so.6.0.30` while 3012 `_ZNSt*` template instantiations are
exported (a positive control), no C++ compiler in the image, and a
JavaScript/TypeScript runtime. The re-audit held that this cannot support
`vulnerable_code_not_present`:

| Re-audit objection | Why the prior proof fails |
|---|---|
| Header-only template | `std::erase_if` appears in `libstdc++.so`'s symbol table only if libstdc++ **explicitly instantiated** it. A `.dynsym` miss does not prove the template's code is absent. |
| Already-compiled consumers | Header/template code can be **instantiated or inlined into already-compiled C++ consumers**, including **Node/V8** or any other shipped binary, when those binaries were built. |
| No compiler in image | That the image contains no C++ compiler does not prove no **previously compiled** instantiation exists; consumers ship as binaries. |
| "the runtime is JavaScript" | Node/V8 is itself a **compiled C++ runtime** linking this `libstdc++`. |
| No consumer audit | No exhaustive consumer/call-site audit of Node/V8 or other relevant binaries was performed. |

Under ADR-0007 / PH-SEC-VEX-POLICY, incomplete presence/reachability evidence
cannot support `NOT_AFFECTED`.

**What changed.**

| Field | Before | After |
|---|---|---|
| `vex.status` | `NOT_AFFECTED` | **`UNDER_INVESTIGATION`** |
| `vex.justification` | `vulnerable_code_not_present` | **removed** — `UNDER_INVESTIGATION` carries no justification |
| `vulnerableCodePresent` | `false` | **not decidable** — `"NOT PROVEN EITHER WAY - header-only template; presence is not decidable from libstdc++.so's dynamic symbol table"` |
| `presenceEvidence` / `reachabilityEvidence` | symbol absence + no-compiler + JS runtime | explicit statement that instantiation/reachability in shipped C++ consumers is **unproven** and that a `.dynsym` miss is non-dispositive |
| summary counts | 21 NOT_AFFECTED + 1 UNDER_INVESTIGATION | **20 NOT_AFFECTED + 2 UNDER_INVESTIGATION** |

**Path A (conservative) was chosen** because no strong proof satisfying ADR-0007
was obtained: the exact upstream fix/affected-code was not analysed to identify
the specific `priority_queue` implementation/API, and no exhaustive
consumer/call-site audit of Node/V8 or other relevant compiled binaries was
performed.

**Unchanged.** Parent exact head, target image digest, locked SARIF, the locked
22-CVE set (20 HIGH + 2 CRITICAL), every other row's analysis, and the product /
Dockerfile / Compose / dependencies / schema / migrations / TenantContext /
trading state. Result remains `BLOCKED_UNRESOLVED`.

---

## 7. Test and validation evidence

| Check | Result | Receipt |
|---|---|---|
| PREFLIGHT reconciliation (13 assertions) | PASS | `preflight/preflight-reconciliation.json` |
| ELF parser self-test (5 artifacts) | PASS | `validation/symbol-presence-authoritative.json` |
| pcre2 JIT importer scan (10 binaries) | 0 of 10 import JIT from the sample; grep's own import recorded | `validation/libpcre2-jit-importers.json` |
| Exact image digest vs lock | PASS | `validation/image-identity.txt` |
| Package inventory (88 packages) | recorded | `validation/image-dpkg-inventory.txt` |
| Component presence / reachability probes | recorded | `validation/perl-component-presence.txt`, `perl-util-pcre-reachability.txt`, `util-pcre-prerequisites.txt`, `grep-pcre2-support.txt` |
| npm importer behaviour and call sites | recorded | `validation/npm-bundled-inventory.txt`, `npm-importer-behaviour.txt`, `callsite-arguments.txt`, `brace-pattern-sources.txt` |
| Container-context diagnosis (CR-01, 18 assertions) | **PASS 18/18** — 13/13 mandatory git/CI, 5/5 container probes | `validation/container-context-diagnosis.json` |
| CI Validate run #46 on the exact parent head | **SUCCESS**, all 16 steps green | `validation/validate-ci-run-46.json`, `validation/validate-ci-parent.yml` |
| Evidence manifest + SHA-256 index | generated | `PH-SEC-WO-007/SHA256SUMS.txt` |

### Repository validation gates — corrected by audit finding CR-01

Full detail in [`validation/gates.md`](PH-SEC-WO-007/validation/gates.md).

**The authoritative verdict is that the parent exact head passes `npm run
validate`.** GitHub Actions `Validate` run #46 / `37243275834` ran on
`headSha` `7d5be250255bd20cb0b20d6713f6f41c52c73b47` — the exact parent head —
and concluded `success`, with all 16 steps green including **`Run required
validation gates` → `npm run validate`**. That job performs a full
`actions/checkout` plus `npm ci`, so it evaluates the gates under the conditions
the gates are defined for.

Receipts: [`validate-ci-run-46.json`](PH-SEC-WO-007/validation/validate-ci-run-46.json),
[`validate-ci-parent.yml`](PH-SEC-WO-007/validation/validate-ci-parent.yml).

| Gate | Verdict | Authority |
|---|---|---|
| `npm run validate` (lint + format:check + typecheck + test + build + audit) | **PASS** | CI run #46 on the exact parent head |
| `npm run lint` | **PASS** | CI run #46 |
| `npm run format:check` | **PASS** | CI run #46 |
| `npm run typecheck` | **PASS** | CI run #46 |
| `npm test` | **PASS** — 1 file, 4 tests | CI run #46 step `Run PostgreSQL tenancy integration tests` |
| `npm audit --audit-level=high` | **PASS** — 0 vulnerabilities | CI run #46 step 6 |
| `git diff --check HEAD` | **PASS** | in-container receipt; unchanged by this Work Order |
| Product / Dockerfile / Compose / dependency diff | **empty** | in-container receipt; independently re-verified by the preflight |

#### The earlier FAIL verdicts were container-context artifacts

An earlier revision of this bundle recorded `lint`, `format:check` and `typecheck`
as `FAIL (pre-existing)` and asserted that PR #15 and the parent head cannot pass
`npm run validate`. The independent audit rejected that claim (CR-01), and the
claim was wrong. Those failures were produced by running the validation **inside
the compose `web` container**, whose `/workspace` is not a faithful view of the
repository. The compose `web` service does not bind-mount `apps/worker`, and
neither `compose.yaml` nor `Dockerfile.dev` provides `biome.json`, `.gitignore`
or `.git` inside the container:

- **`typecheck` `TS5058`** — `apps/worker/tsconfig.json` **is** tracked at the
  parent exact head; the container simply has only `package.json` there.
- **`format:check` 68 errors** — with no `biome.json`, Biome falls back to its
  defaults, which indent with **tabs**, while the repository config mandates
  `indentStyle: "space"`. The same `tsconfig.base.json` bytes pass on the host and
  fail in the container, with Biome **2.5.15 in both** — so this is configuration
  absence, not version drift.
- **`lint` 990 errors** — with no `biome.json` the `!.engineering` exclusion is
  gone, and with no `.gitignore` the `.next/` rule cannot apply, so Biome traverses
  the generated `apps/web/.next/dev/**` dev-server output held in the `web_next`
  volume.

Confirmed by 18 deterministic assertions — 13 mandatory git/CI assertions that
need no container and exit non-zero on drift, plus 5 container probes — in
[`analysis/09-container-context.py`](PH-SEC-WO-007/analysis/09-container-context.py),
**18/18 PASS**. Receipt:
[`container-context-diagnosis.json`](PH-SEC-WO-007/validation/container-context-diagnosis.json).

The in-container receipts are **retained as an observation of container
behaviour**, no longer as evidence about the parent head and no longer described
as pre-existing defects.

#### This branch has no CI execution of its own

`.github/workflows/validate.yml` triggers only on `pull_request` targeting `main`
and `push` to `main`. PR #33 targets `feat/ph-m01-tenancy-persistence`, so **no
Validate run exists for this branch**. Its gate state is therefore not
CI-attested; it rests on the empty product diff, the deterministic preflight, and
the fact that every added file is under `.engineering/`, which `biome.json`
excludes. Branch-level attestation would need a workflow or branch-policy change,
which is outside this Work Order's authority — reported, not made.

---

## 8. Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | 22/22 findings have individual exact-artifact rows | **MET** — 22 rows, one CVE each, no grouping |
| 2 | No row silently omitted or untraceably grouped | **MET** — machine-readable, one `cve` key per row |
| 3 | Every proposed `NOT_AFFECTED` satisfies ADR-0007 evidence requirements | **MET for the 20 proposed** — each cites the missing prerequisite with positive evidence; both `UNDER_INVESTIGATION` rows correctly carry no justification |
| 4 | No scanner suppression/ignore introduced | **MET** — zero suppressions |
| 5 | Exact target image/digest and locked scan unchanged | **MET** — digest identical; SARIF blob `d3999a56…` |
| 6 | Original 35 Go HIGH/CRITICAL remain zero | **MET** — 0 Go rules at any severity |
| 7 | No product, Dockerfile, Compose, dependency, schema, migration, TenantContext or trading changes | **MET** — evidence-only diff |
| 8 | Bundle sufficient for independent HIGH_ASSURANCE audit | **MET**, with method limits and the corrections disclosed in §5 and §6.6 |
| 9 | If any AFFECTED/UNDER_INVESTIGATION remains, report an exact minimal remediation delta and remain BLOCKED | **MET** — see below |

---

## 9. Minimal remediation delta for the blocking rows

Two rows remain `UNDER_INVESTIGATION` (both libstdc++ / gcc-12), and neither has an upstream fix for `gcc-12` (`gcc-14`, `gcc-15`, `gcc-16` are also `<unfixed>`), so no version bump clears them today.

**CVE-2026-95619** (aligned `operator new`) — exactly one of:

1. **Wait for a Debian `libstdc++6` fix** carrying commit `59d235ffa5a69231eb42e5290d52dc8c90d28b7a`, then rebuild the dev image and re-run this analysis. Trigger: `libstdc++6` version change in the base image.
2. **Move the dev base image** to a Debian release whose `libstdc++6` is unaffected, once one exists.
3. **Independent auditor determination**, supported by reading upstream commit `59d235ff` for the exact overflow threshold and auditing V8's aligned-allocation call sites for attacker-derived sizes. This is the only path that can close the row without waiting on Debian.

**CVE-2026-102010** (`std::erase_if` on a binary-heap `priority_queue`, reclassified by CR-04) — exactly one of:

1. **Wait for a Debian `libstdc++6` fix** carrying commit `aaa8351f4d2e636f9680a1f0a8ebc2f0a60611e6`, then rebuild the dev image and re-run this analysis. Trigger: `libstdc++6` version change in the base image.
2. **Independent auditor determination**, supported by analysis of upstream fix commit `aaa8351f` (identifying the specific `priority_queue` implementation/API involved) **and** an exhaustive-enough audit of Node/V8 and other relevant compiled consumers showing the vulnerable `erase_if` instantiation/call path is absent or unreachable with attacker-controlled input. A mere `.dynsym` miss in `libstdc++.so` is **not** sufficient (that was the CR-04 defect).

No Dockerfile, Compose, dependency or base-image change is authorised by this Work Order, so none was made.

---

## 10. Bundle index

```
PH-SEC-WO-007/
├── SHA256SUMS.txt                     SHA-256 index over every receipt below
├── analysis/                          deterministic, re-runnable analysis scripts
│   ├── preflight.py                   PREFLIGHT reconciliation (exits non-zero on drift)
│   ├── elf_dynsym.py                  pure-Python ELF64 .dynsym reader
│   ├── symbol_presence_authoritative.py per-CVE symbol proof + parser self-test
│   ├── pcre2_jit_importers.py         which binaries import pcre2 JIT
│   ├── build_vex.py                   emits PH-SEC-WO-007-VEX.json
│   ├── 01-perl-component-presence.sh
│   ├── 02-binary-symbol-presence.sh
│   ├── 03-perl-util-pcre-reachability.sh
│   ├── 04-util-pcre-prereq.sh
│   ├── 05-npm-bundled-inventory.sh
│   ├── 06-npm-importer-behaviour.sh
│   ├── 07-callsite-arguments.sh
│   ├── 08-brace-pattern-sources.sh
│   └── 09-container-context.py        CR-01 gate-artifact diagnosis (18 assertions)
├── preflight/
│   └── preflight-reconciliation.json
├── sources/
│   ├── cisa-kev.json                  CISA KEV catalog 2026.10.04
│   └── first-epss.json                FIRST EPSS 2026-10-04, 22 rows
└── validation/
    ├── gates.md                       validation gate state (CR-01 corrected)
    ├── container-context-diagnosis.json  CR-01 mechanism, 18/18 PASS
    ├── validate-ci-run-46.json        CI Validate run #46 on the exact parent head
    ├── validate-ci-parent.yml         CI workflow at the parent head (blob-exact)
    ├── image-identity.txt
    ├── image-dpkg-inventory.txt
    ├── symbol-presence-authoritative.json
    ├── libpcre2-jit-importers.json
    ├── perl-component-presence.txt
    ├── perl-util-pcre-reachability.txt
    ├── util-pcre-prerequisites.txt
    ├── grep-pcre2-support.txt
    ├── npm-bundled-inventory.txt
    ├── npm-importer-behaviour.txt
    ├── callsite-arguments.txt
    ├── brace-pattern-sources.txt
    └── check-*.txt                    retained in-container gate observations
```

Top-level deliverables: `PH-SEC-WO-007-EVIDENCE.md`, `PH-SEC-WO-007-VEX.md`, `PH-SEC-WO-007-VEX.json`.

---

## 11. Result

**`BLOCKED_UNRESOLVED`**

All 22 findings are individually reconciled against the exact artifact. Twenty are proposed `NOT_AFFECTED` with positive exact-artifact evidence. Two remain `UNDER_INVESTIGATION`:

- **CVE-2026-95619** — the vulnerable symbol is confirmed present in a library the running Node process links, and the caller set cannot be enumerated from inside this container.
- **CVE-2026-102010** — reclassified by audit finding **CR-04**: the vulnerable code is a header-only template, so `.dynsym` absence from `libstdc++.so` is non-dispositive, and instantiation/reachability in shipped C++ consumers (Node/V8 or other binaries) is unproven. No policy-complete `NOT_AFFECTED` proof was obtained, so the row fails closed.

Because the STOP CONDITION permits `READY_FOR_INDEPENDENT_AUDIT` only at zero `AFFECTED`/`UNDER_INVESTIGATION`, this Work Order stops blocked. `PH-M01-WO-002` is **not** started. No disposition here is approved; independent audit and explicit owner approval remain mandatory.