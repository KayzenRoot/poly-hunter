# CR-01 — per-row revalidation of every prior disposition on the FINAL artifact

- prior artifact the dispositions were produced on: `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`
- FINAL artifact under revalidation: `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`

## Rule being applied

PH-SEC-VEX-POLICY: *"A HIGH/CRITICAL NOT_AFFECTED disposition expires at the earliest of ... a new image digest ..."* and *"Expired disposition returns to UNDER_INVESTIGATION automatically."* The CR-02/CR-03/CR-04 correction delta changed application code and therefore changed the image digest, so all 22 previously dispositioned rows expired.

For each expired row the policy-required comparison was performed across six axes: component/package, exact version, architecture, installed files, runtime assumptions and the assumptions the prior proof itself rested on. Where every axis is identical, the prior analysis is **preserved by reference** and backed by objective equivalence evidence. Where any axis differed, the affected analysis would have been redone. **No axis differed.**

## The six axes, and how each was measured on the FINAL artifact

| Axis | How it was measured | Result |
|---|---|---|
| component/package | Same scanner, same unfiltered command, both SARIF documents compared row by row on the package purl (receipt 07) | 80/80 rows identical; 0 added, 0 changed, 0 removed |
| exact version | Debian: dpkg-query inventory of the FINAL image diffed against the WO-007 artifact inventory (receipt 01). npm: version carried inside the package purl (receipt 07) | Debian inventory byte-identical across all 88 packages; every npm purl version identical |
| architecture | dpkg architecture field, container `uname -m`, ELF `EI_CLASS`/`e_machine` of the named binaries, perl `Config{archname}` (receipts 03, 05) | amd64 / x86_64 / ELF64 unchanged everywhere |
| installed files | SHA-256 recomputed inside the FINAL image for the exact native artifacts the libstdc++ and libvips proofs named (receipt 02) | `node`, `libstdc++.so.6.0.30`, `sharp-linux-x64-0.35.5.node`, `libvips-cpp.so.8.18.7` all hash-identical to the WO-008 baseline |
| runtime assumptions | Container user, capabilities, privileged flag, published ports, compose commands, live process table, source-level subprocess call sites (receipt 06) | Unchanged: uid 1000 (node), non-privileged, no cap add/drop, web published on 127.0.0.1:3000 only, worker unpublished, no perl process, no `child_process`/`exec`/`spawn` call site anywhere |
| prior proof assumptions | Each row's own `presenceEvidence` / `reachabilityEvidence` / `attackerControlledPrerequisite` re-read and its stated precondition re-measured on the FINAL artifact (below, per row) | Every precondition still holds verbatim |

The WO-002 delta is JavaScript/TypeScript application code (an origin helper, a CSRF guard, two Route Handlers and tests). It adds, removes and changes no Debian package, no npm dependency version, no native artifact and no runtime property, which is why every axis is identical rather than merely re-derived.

## Row-by-row verdicts

### CVE-2026-102010 — HIGH — libstdc++6 / __gnu_pbds detail::binary_heap erase_if (header-only template)

- Scanner component on the FINAL artifact: `deb/debian/gcc-12@12.2.0-14%2Bdeb12u1`
- Prior disposition source: PH-SEC-WO-008
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_present`
- Detected version (prior → FINAL): `libstdc++.so.6.0.30 (12.2.0-14+deb12u1)` → `libstdc++.so.6.0.30 (12.2.0-14+deb12u1)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `false`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: DISPROVEN AT SOURCE LEVEL for every compiled C++ consumer, mapped to its exact shipped version (Correction Delta CR-01). The prior bundle relied on byte-string/dynsym absence and asserted that an inlined instantiation would leave mangled names or distinctive strings; that assertion was FALSE and is REMOVED. The corrected proof is that a binary cannot contain an instantiation of a template its source never referenced, whether inlined or not, so source-level absence at the exact version is dispositive and independent of symbols/strings. Consumers and their sources: (1) node v24.21.0 = nodejs/node commit 955266bfdd854cd280dffd47548673914484e4c0 - no pb_ds/__gnu_pbds/binary_heap anywhere under src/ or deps/; (2) apt 2.6.1 = salsa.debian.org/apt-team/apt commit a626a66fece0a7d680e40b9e35b66e29fe9ae12c - no pb_ds/__gnu_pbds/binary_heap/erase_if/priority_queue and no <ext/...> includes; (3) libvips 8.18.7 = libvips/libvips commit 24ad4d042940e6bf99a68871ba886ca8847c9c82 - no pb_ds/__gnu_pbds/binary_heap/erase_if and no <ext/...> includes; (4) libvips-cpp statically-bundled C++ deps per @img/sharp-libvips-linux-x64/versions.json - highway 1.4.0 (2607d3b5...), libultrahdr 2.0.2 (e5f5a022...), harfbuzz 14.5.0 (863d3f77...), libheif 1.23.5 (413e2a87...) - all no matches (the remaining bundled deps are C libraries and cannot instantiate C++ templates); (5) sharp 0.35.5 addon = lovell/sharp commit 51a990faa26ade5586a4934ac9673c98d8893326 - no pb_ds/__gnu_pbds/binary_heap/erase_if. Component level: the artifact ships only libstdc++6 12.2.0-14+deb12u1 and gcc-12-base - NO libstdc++-12-dev, no C++ headers (/usr/include/c++ absent), no compiler - so the vulnerable header ext/pb_ds/detail/binary_heap_/erase_fn_imps.hpp is not installed and cannot be compiled in-image; the only way it could be present is as a pre-built instantiation in a shipped consumer, which the source audit excludes for every consumer.

> reachability: Not required once presence is disproven at source level: the source set of every compiled C++ consumer (node, apt/libapt, libvips and its bundled deps, sharp addon) contains no pb_ds reference, so no instantiation of the vulnerable erase_if can exist in any executable page of this artifact, regardless of which libraries are loaded at runtime. Runtime load state is not used as evidence for this disposition.

> attacker-controlled prerequisite: Moot: the vulnerable operation is not present. For completeness - triggering requires C++ code calling erase_if on a __gnu_pbds binary_heap priority_queue with attacker-influenced contents; no compiled consumer in the artifact references pb_ds at all.

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** receipts/upstream/cve-2026-102010-commit-meta.txt, receipts/upstream/cve-2026-102010-binary_heap.diff, receipts/upstream/cve-2026-102010-erase_fn_imps-vulnerable.hpp, receipts/cr01-cve-2026-102010-presence-proof.json, receipts/cr01-pbds-header-and-dev-package.txt, receipts/cr01-consumer-versions.txt, receipts/cr01-sharp-libvips-versions.txt, receipts/cr01-cr02-complete-libstdcxx-consumers.txt, receipts/cr01-source-provenance/cr01-apt-2.6.1-pbds-absence.txt, receipts/cr01-source-provenance/cr01-libvips-8.18.7-pbds-absence.txt, receipts/cr01-source-provenance/cr01-highway-1.4.0-pbds-absence.txt, receipts/cr01-source-provenance/cr01-uhdr-2.0.2-pbds-absence.txt, receipts/cr01-source-provenance/cr01-harfbuzz-14.5.0-pbds-absence.txt, receipts/cr01-source-provenance/cr01-libheif-1.23.5-pbds-absence.txt, receipts/cr01-source-provenance/cr01-sharp-0.35.5-pbds-absence.txt, receipts/cr03-node-source/cr03-pbds-search.txt

### CVE-2026-102276 — HIGH — npm brace-expansion

- Scanner component on the FINAL artifact: `npm/brace-expansion@5.0.7`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_cannot_be_controlled_by_adversary`
- Detected version (prior → FINAL): `5.0.7 (npm bundled) | 5.0.12 (application tree)` → `5.0.7 (npm bundled) | 5.0.12 (application tree)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: PRESENT: p.push.apply(p, postParts) and parts.push.apply(parts, p) at dist/commonjs/index.js:62,64 and dist/esm/index.js:58,60 - exactly the two vectors the advisory describes; no iterative rewrite is present

> reachability: identical to CVE-2026-14257 - minimatch's 65,536-byte MAX_PATTERN_LENGTH is above both crash thresholds, so the only barrier is pattern provenance, which is local

> attacker-controlled prerequisite: an attacker must control a glob pattern reaching expand()

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/npm-bundled-inventory.txt, validation/npm-importer-behaviour.txt, validation/brace-pattern-sources.txt

### CVE-2026-102278 — HIGH — npm brace-expansion

- Scanner component on the FINAL artifact: `npm/brace-expansion@5.0.7`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_cannot_be_controlled_by_adversary`
- Detected version (prior → FINAL): `5.0.7 (npm bundled) | 5.0.12 (application tree)` → `5.0.7 (npm bundled) | 5.0.12 (application tree)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: PRESENT and directly confirmed: grep for EXPANSION_MAX_DEPTH across the package returns ABSENT, so the depth bound that constitutes the fix does not exist in 5.0.7

> reachability: identical to CVE-2026-14257. This is the cheapest payload of the four (~6.25 KB), far below minimatch's 65,536-byte cap, so pattern provenance is again the only barrier

> attacker-controlled prerequisite: an attacker must control a glob pattern reaching expand()

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/npm-bundled-inventory.txt, validation/npm-importer-behaviour.txt, validation/brace-pattern-sources.txt

### CVE-2026-103111 — HIGH — pcre2

- Scanner component on the FINAL artifact: `deb/debian/pcre2@10.42-1%2Bdeb12u1`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `libpcre2-8.so.0.11.2 (10.42-1+deb12u1)` → `libpcre2-8.so.0.11.2 (10.42-1+deb12u1)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: CONFIRMED PRESENT. libpcre2-8.so.0.11.2 exports the 8-bit JIT API: pcre2_jit_compile_8, pcre2_jit_match_8, pcre2_jit_stack_create_8, pcre2_jit_stack_assign_8, pcre2_jit_stack_free_8. GNU grep 3.8 in this image IMPORTS pcre2_jit_compile_8 and its -P/--perl-regexp option is functional (verified positively by matching and by the negative control exiting 1 on non-match), so the JIT path is genuinely reachable from a user-supplied pattern. An earlier query using the unsuffixed pcre2_jit_compile produced a FALSE NEGATIVE and has been corrected. The library reaches grep, sed, find, tar, install, mount, nsenter, id and ~60 other coreutils transitively through libselinux1.

> reachability: the advisory requires an ATTACKER-CONTROLLED REGEX to reach a pcre2 JIT consumer. No such path exists in the defined runtime: web and worker never spawn a subprocess - grep over apps/** and packages/** finds no child_process, exec, execSync, spawn or spawnSync reference - and compose runs only `npm run dev` and nodemon. The container also has no inbound path other than 127.0.0.1:3000, so an external attacker cannot supply a pattern to these utilities.

> attacker-controlled prerequisite: an attacker must control a regex string passed to grep -P (or another pcre2-JIT consumer) inside the container; the web/worker runtime provides no such channel

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/libpcre2-jit-importers.json, validation/grep-pcre2-support.txt, validation/util-pcre-prerequisites.txt, validation/perl-util-pcre-reachability.txt

### CVE-2026-12087 — CRITICAL — perl (Socket 2.033)

- Scanner component on the FINAL artifact: `deb/debian/perl@5.36.0-7%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `Socket 2.033 (perl-base)` → `Socket 2.033 (perl-base)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: HONEST FINDING: the vulnerable function IS present and callable. Socket.pm (sha256 39ac19481f0873c5bb198d2f6b53c802c73a04844aff0b86b8aef5add9945f20) declares $VERSION='2.033' and lists pack_ip_mreq_source in its export list at line 111; a runtime probe `perl -MSocket -e 'keys %Socket::'` returns pack_ip_mreq_source. Socket 2.033 < 2.041, so the artifact is inside the affected range. Note that a .dynsym miss would have been meaningless here: XS subs are registered at boot via newXS and are not exported ELF symbols.

> reachability: Socket::pack_ip_mreq_source has NO caller in the image. The only perl code present is Debian's own maintenance set - /usr/share/perl5/Debconf/** (~100 modules) and /usr/share/debconf/fix_db.pl - none of which references Socket or IP multicast packing. No PolyHunter code is perl, and the compose runtime never executes perl at all (web = next dev, worker = node). Debian's own assessment matches: 'only reachable when a script passes attacker-controlled source to pack_ip_mreq_source()'.

> attacker-controlled prerequisite: a perl script must call Socket::pack_ip_mreq_source with an attacker-controlled source string shorter than 4 bytes

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/perl-component-presence.txt, validation/perl-util-pcre-reachability.txt, validation/symbol-presence-authoritative.json

### CVE-2026-13221 — CRITICAL — perl core (regex trie optimiser)

- Scanner component on the FINAL artifact: `deb/debian/perl@5.36.0-7%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `perl 5.36.0 (/usr/bin/perl, 3804464 bytes)` → `perl 5.36.0 (/usr/bin/perl, 3804464 bytes)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: Treated as PRESENT, which is the fail-closed reading: perl is stripped and its internal symbols have hidden visibility, so a .dynsym miss proves nothing here and absence cannot be established from the artifact. The advisory's 'Introduced with' annotation places the flaw at v5.37.10, AFTER the 5.36.0 shipped in this image, which would imply absence -- but that inference is NOT treated as proof, because no version-history check against perl 5.36.0 was performed. This row is therefore decided on reachability, not on presence.

> reachability: requires compiling a regular expression containing an alternation of more than 65535 fixed-string branches. No such pattern exists in the image; the only perl code is Debian's Debconf set, and perl is never executed by the compose runtime.

> attacker-controlled prerequisite: a perl script must compile an attacker-controlled regex with >65535 fixed-string alternation branches

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/perl-component-presence.txt, validation/perl-util-pcre-reachability.txt

### CVE-2026-14257 — HIGH — npm brace-expansion

- Scanner component on the FINAL artifact: `npm/brace-expansion@5.0.7`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_cannot_be_controlled_by_adversary`
- Detected version (prior → FINAL): `5.0.7 (npm bundled) | 5.0.12 (application workspace tree)` → `5.0.7 (npm bundled) | 5.0.12 (application workspace tree)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: CONFIRMED PRESENT in npm's copy: /usr/local/lib/node_modules/npm/node_modules/brace-expansion is 5.0.7 and contains N.push.apply(N, expand_(n[j], max, false)) at dist/commonjs/index.js:197 and dist/esm/index.js:193; no EXPANSION_MAX_LENGTH or maxLength token exists, so the 5.0.8 fix is absent. The APPLICATION tree is a DIFFERENT and PATCHED copy: /workspace/node_modules/brace-expansion is 5.0.12, above every fix version for all four brace-expansion CVEs, and no application code imports minimatch, glob or brace-expansion.

> reachability: the only importer of brace-expansion inside npm is minimatch 10.2.5, which calls expand() through braceExpand() - and brace expansion applies to the PATTERN, not to the subject. Every minimatch pattern source in npm 11.19.0 was enumerated and each originates locally, not from the registry: @npmcli/map-workspaces and lib/utils/get-workspaces.js read the workspaces field of the LOCAL package.json; ignore-walk reads the local files field during npm pack; @npmcli/arborist query-selector-all.js matches an operator supplied CLI query path; release-age-exclude.js matches operator npm config (min-release-age-exclude); @tufjs/models matches DelegatedRole paths from signature-verified TUF metadata. Registry-supplied values (package names, target paths) appear only as subjects. minimatch's MAX_PATTERN_LENGTH of 65,536 does NOT block the documented payloads, so the control that matters is pattern provenance, and it is local. At runtime compose executes only `npm run dev`, which performs no dependency resolution and no glob over untrusted input.

> attacker-controlled prerequisite: an attacker must control a GLOB PATTERN STRING that reaches expand(); no untrusted pattern source exists in the defined workflow

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/npm-bundled-inventory.txt, validation/npm-importer-behaviour.txt, validation/brace-pattern-sources.txt, validation/callsite-arguments.txt

### CVE-2026-19534 — HIGH — npm undici

- Scanner component on the FINAL artifact: `npm/undici@6.27.0`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `6.27.0 (npm bundled only; absent from the application tree)` → `6.27.0 (npm bundled only; absent from the application tree)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: PRESENT: undici 6.27.0 ships a full WebSocket client at lib/web/websocket/ (websocket.js, connection.js, receiver.js, sender.js, frame.js, permessage-deflate.js). 6.27.0 is within the affected range >= 6.7.0, < 6.28.1.

> reachability: the vulnerable API is never invoked. The ONLY undici importer anywhere in npm is node_modules/node-gyp/lib/download.js, and it imports exactly { Agent, EnvHttpProxyAgent, RetryAgent, fetch } - HTTP fetching only. A grep for 'WebSocket' across the whole npm tree, excluding undici's own implementation and docs, returns ZERO hits. npm never opens a WebSocket, so neither the attacker-controlled-server condition nor the plaintext ws:// MITM condition can arise.

> attacker-controlled prerequisite: an attacker must control a WebSocket server (or the path to one) that npm connects to; npm initiates no WebSocket connection

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/npm-bundled-inventory.txt, validation/npm-importer-behaviour.txt

### CVE-2026-48959 — HIGH — perl (IO::Uncompress::Unzip)

- Scanner component on the FINAL artifact: `deb/debian/perl@5.36.0-7%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_present`
- Detected version (prior → FINAL): `5.36.0-7+deb12u3 (perl-base)` → `5.36.0-7+deb12u3 (perl-base)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `false`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: module probe returns ABSENT for IO/Uncompress/Unzip.pm and for Podlators.pm; not part of perl-base's 61 modules nor of the 164-file full-image .pm census

> reachability: vulnerable module is not installed; unreachable in any phase

> attacker-controlled prerequisite: a perl script must extract a named entry from an attacker-supplied zip

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/perl-component-presence.txt, validation/image-dpkg-inventory.txt

### CVE-2026-48962 — HIGH — perl (IO::Compress)

- Scanner component on the FINAL artifact: `deb/debian/perl@5.36.0-7%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_present`
- Detected version (prior → FINAL): `5.36.0-7+deb12u3 (perl-base)` → `5.36.0-7+deb12u3 (perl-base)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `false`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: module probe over the whole image returns ABSENT for IO/Compress.pm, IO/Compress/Zip.pm and IO/Uncompress/Unzip.pm. perl-base ships exactly 61 .pm files (AutoLoader, Carp, Config, Cwd, DynaLoader, Errno, Exporter, Fcntl, File::*, Getopt::Long, Hash::Util, IO, IO::File/Handle/Pipe/Socket, IPC::Open2/3, List::Util, POSIX, Scalar::Util, SelectSaver, Socket, Symbol, Text::ParseWords, Text::Tabs, Text::Wrap, Tie::Hash, XSLoader, attributes, base, builtin, bytes, constant, feature, fields, integer, lib, locale, overload, overloading, parent, re, strict, utf8, vars, warnings) and the full-image .pm census is 164 files, none of which is IO::Compress.

> reachability: the vulnerable module is not installed, therefore no code path can reach it regardless of perl invocation

> attacker-controlled prerequisite: a perl script must call IO::Compress with an attacker-controlled output glob

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/perl-component-presence.txt, validation/image-dpkg-inventory.txt

### CVE-2026-57432 — HIGH — perl core (pack/unpack)

- Scanner component on the FINAL artifact: `deb/debian/perl@5.36.0-7%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `perl 5.36.0 (/usr/bin/perl, 3804464 bytes)` → `perl 5.36.0 (/usr/bin/perl, 3804464 bytes)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: core pack/unpack is compiled into /usr/bin/perl, which is present and runnable (perl 5.36.0, x86_64-linux-gnu-thread-multi). Presence of the specific static function CANNOT be asserted from the artifact: the perl binary is stripped and builds internal Perl_* entry points with hidden visibility, so they are absent from .dynsym regardless. This row is therefore decided on reachability, not on symbols.

> reachability: requires a pack/unpack TEMPLATE derived from untrusted input. No perl program in the image derives a template from external input: the only perl code is Debian's Debconf set and fix_db.pl. Perl is never executed by the compose runtime. Additionally the trigger needs a repeat count near 2^63 to wrap a 64-bit SSize_t.

> attacker-controlled prerequisite: a perl script must build a pack/unpack template from attacker-controlled input

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/perl-component-presence.txt, validation/perl-util-pcre-reachability.txt, validation/symbol-presence-authoritative.json

### CVE-2026-69152 — HIGH — npm brace-expansion

- Scanner component on the FINAL artifact: `npm/brace-expansion@5.0.7`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_cannot_be_controlled_by_adversary`
- Detected version (prior → FINAL): `5.0.7 (npm bundled) | 5.0.12 (application tree)` → `5.0.7 (npm bundled) | 5.0.12 (application tree)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: PRESENT: the same 5.0.7 implementation carrying values.push.apply(values, expand_(...)) with no running total, at dist/commonjs/index.js:197; no cumulative length accounting exists in the file

> reachability: identical to CVE-2026-14257 - brace expansion runs on the pattern, every npm pattern source is local/trusted, and the runtime performs no dependency resolution

> attacker-controlled prerequisite: an attacker must control a glob pattern reaching expand()

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/npm-bundled-inventory.txt, validation/npm-importer-behaviour.txt, validation/brace-pattern-sources.txt

### CVE-2026-69192 — HIGH — npm ip-address

- Scanner component on the FINAL artifact: `npm/ip-address@10.2.0`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `10.2.0 (npm bundled only; absent from the application tree)` → `10.2.0 (npm bundled only; absent from the application tree)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: PRESENT: ip-address 10.2.0 is installed and consumed by socks 2.8.9 at build/common/helpers.js:7 and build/client/socksclient.js:21. The defect is in Address4.parse, which is exercised.

> reachability: the DOCUMENTED security impact requires a trust-boundary decision built on the classifier API. An exhaustive grep of the socks consumer shows it calls ONLY the constructors and formatters - new Address4(ip) at helpers.js:132 and :150, new Address6(ip) at helpers.js:155, and Address6.fromByteArray(...).canonicalForm() at socksclient.js:195, :688, :779 - for validating and routing proxy and destination hosts. ZERO calls to isPrivate, isLoopback, isLinkLocal, isCGNAT, isInSubnet, isHostInSubnet, Address4.isValid or correctForm exist in the consumer. With no classifier-based allow/deny decision anywhere in npm, the SSRF-filter-bypass outcome cannot materialise; a mis-decode here would at most be a correctness/connection-routing bug, which the advisory explicitly classifies as the non-security direction.

> attacker-controlled prerequisite: an attacker must cause a decision to be made on Address4 classifier output; npm makes no such decision

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/npm-bundled-inventory.txt, validation/npm-importer-behaviour.txt, validation/callsite-arguments.txt

### CVE-2026-73566 — HIGH — npm tar (node-tar)

- Scanner component on the FINAL artifact: `npm/tar@7.5.19`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `7.5.19 (npm bundled); Next.js also ships its own compiled tar under apps/web/.next/compiled/tar` → `7.5.19 (npm bundled); Next.js also ships its own compiled tar under apps/web/.next/compiled/tar` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: PRESENT: dist/commonjs/list.js:62 defines `const mapHas = (file, r = '') => {` and line 69 recurses via mapHas(path.dirname(file), root) with no segment cap; dist/esm/list.js:23,30 mirrors it. filesFilter is exported at list.js:79.

> reachability: the advisory is explicit that mapHas is reachable ONLY when a member-selection list is supplied. Every tar call site in npm 11.19.0 was enumerated and inspected: pacote/lib/fetcher.js:385 tar.x(#tarxOptions({cwd})) - full extraction; node-gyp/lib/install.js:211 and :234 tar.extract({file, strip:1, filter: isValid, onwarn, cwd}) - uses a boolean filter, not a member list; libnpmdiff/lib/untar.js:11 tar.list({filter: ...}) - again filter only; npm/lib/utils/tar.js:57 and npm/lib/commands/stage/download.js:48 tar.t({onentry}) - no filter and no list. A grep for a `files:` option adjacent to any tar call site returns NOTHING. node-tar itself installs the vulnerable filter only under a guard - list.js:140-141 `if (files?.length) filesFilter(opt, files)` and extract.js:86 - and no caller ever makes `files` a non-empty array, so mapHas is never reached.

> attacker-controlled prerequisite: an attacker must supply a crafted archive AND the victim must call tar.t/tar.x with a member-selection list; npm never does

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/npm-bundled-inventory.txt, validation/npm-importer-behaviour.txt, validation/callsite-arguments.txt

### CVE-2026-76642 — HIGH — util-linux (mount)

- Scanner component on the FINAL artifact: `deb/debian/util-linux@2.38.1-5%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `util-linux 2.38.1-5+deb12u3 + util-linux-extra 2.38.1-5+deb12u3` → `util-linux 2.38.1-5+deb12u3 + util-linux-extra 2.38.1-5+deb12u3` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: /usr/bin/mount and /usr/bin/umount are present. dpkg -L util-linux confirms the binaries ship. The trigger INPUT, however, is positively absent (see reachability).

> reachability: requires (a) an /etc/fstab entry carrying an X-mount.* option and (b) CAP_SYS_ADMIN to mount at all. Both are disproved: /etc/fstab in this image is the stock base file whose entire content is the single comment line '# UNCONFIGURED FSTAB FOR BASE SYSTEM' (sha256 a6b093c9916c6c54e5d634d3689f1a0132e14cce0b8e50ff445da8e85acfbd17) - zero mount entries, verified by grep for '^[^#]*(X-mount\.|x-mount\.)' returning nothing; and no /sbin/mount.* helper is shipped. CapEff/CapPrm/CapInh are all 0x0 in the container (CapBnd 0xa80425fb is only the inherited bound and does not grant use), so mount(2) cannot be invoked. mount/nsenter are never spawned by the web or worker runtime.

> attacker-controlled prerequisite: a local unprivileged user must be able to influence a privileged mount(8) run against an attacker-authored fstab entry; no such entry exists

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/util-pcre-prerequisites.txt, validation/perl-util-pcre-reachability.txt, validation/image-dpkg-inventory.txt

### CVE-2026-78408 — HIGH — util-linux (nsenter --join-cgroup)

- Scanner component on the FINAL artifact: `deb/debian/util-linux@2.38.1-5%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `util-linux 2.38.1-5+deb12u3` → `util-linux 2.38.1-5+deb12u3` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: /usr/bin/nsenter present and shipped by util-linux

> reachability: the flag requires a PRIVILEGED OPERATOR to run nsenter --join-cgroup against a target. No npm command, compose service or application path invokes nsenter: grep over apps/**, packages/** and scripts/** returns no child_process/exec/spawn reference at all, so the runtime cannot reach it; and CapEff 0x0 means even a manual invocation could not obtain the required privilege. The container's cgroup namespace is not the host cgroup.

> attacker-controlled prerequisite: a privileged operator must run nsenter --join-cgroup against an attacker-controlled cgroup

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/util-pcre-prerequisites.txt, validation/perl-util-pcre-reachability.txt

### CVE-2026-78409 — HIGH — util-linux (mount X-mount.subdir)

- Scanner component on the FINAL artifact: `deb/debian/util-linux@2.38.1-5%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `util-linux 2.38.1-5+deb12u3` → `util-linux 2.38.1-5+deb12u3` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: /usr/bin/mount present; trigger input absent as below

> reachability: same two disproved prerequisites as CVE-2026-76642: zero fstab entries (stock unconfigured file) so no X-mount.subdir entry can exist, and no effective CAP_SYS_ADMIN. Additionally the vulnerable detached-tree fast path is documented as requiring a Linux 6.15+ host kernel, which is a host property not controlled by this image.

> attacker-controlled prerequisite: an fstab-authorized X-mount.subdir entry must exist and be usable by an unprivileged user

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/util-pcre-prerequisites.txt, validation/perl-util-pcre-reachability.txt

### CVE-2026-78410 — HIGH — util-linux (restricted bind mount)

- Scanner component on the FINAL artifact: `deb/debian/util-linux@2.38.1-5%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `util-linux 2.38.1-5+deb12u3` → `util-linux 2.38.1-5+deb12u3` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: /usr/bin/mount present; trigger input absent as below

> reachability: requires an fstab entry for a restricted bind mount plus CAP_SYS_ADMIN. Both disproved: zero fstab entries and CapEff 0x0. Not spawned by the runtime.

> attacker-controlled prerequisite: attacker must be able to replace an fstab-authorized bind-mount source or a writable ancestor

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/util-pcre-prerequisites.txt, validation/perl-util-pcre-reachability.txt

### CVE-2026-82560 — HIGH — perl (Pod::Text)

- Scanner component on the FINAL artifact: `deb/debian/perl@5.36.0-7%2Bdeb12u3`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_present`
- Detected version (prior → FINAL): `5.36.0-7+deb12u3 (perl-base)` → `5.36.0-7+deb12u3 (perl-base)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `false`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: module probe returns ABSENT for Pod/Text.pm and for Podlators.pm; not present in perl-base nor anywhere else in the image

> reachability: vulnerable module is not installed; unreachable in any phase

> attacker-controlled prerequisite: a perl script must format an attacker-supplied POD document

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/perl-component-presence.txt, validation/image-dpkg-inventory.txt

### CVE-2026-85091 — HIGH — zlib

- Scanner component on the FINAL artifact: `deb/debian/zlib@1%3A1.2.13.dfsg-1`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_present`
- Detected version (prior → FINAL): `1:1.2.13.dfsg-1` → `1:1.2.13.dfsg-1` (identical)
- Vulnerable code present (prior conclusion, re-verified): `false`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: artifact self-reports its version in-band: 'inflate 1.2.13 Copyright 1995-2022 Mark Adler', 'deflate 1.2.13', bare '1.2.13'; highest exported version tag is ZLIB_1.2.12. The advisory states the non-blocking gz* support and gz_vacate() were INTRODUCED upstream in zlib 1.3.1.2. The shipped library predates that by a full minor series, so the vulnerable code cannot exist in this artifact.

> reachability: zlib is present only as a transitive dependency of libapt-pkg6.0, libbz2-1.0, libgcrypt20, libgpg-error0 and liblzma5 (dpkg Depends). None of these is on the web/worker runtime path. No gzprintf/gzvprintf non-blocking write occurs at runtime.

> attacker-controlled prerequisite: an attacker must cause a process in the image to call gzprintf()/gzvprintf() on a non-blocking file descriptor after a write stall

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/image-identity.txt, validation/symbol-presence-authoritative.json, validation/image-dpkg-inventory.txt

### CVE-2026-93748 — HIGH — npm http-cache-semantics

- Scanner component on the FINAL artifact: `npm/http-cache-semantics@4.2.0`
- Prior disposition source: PH-SEC-WO-007
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_not_in_execute_path`
- Detected version (prior → FINAL): `4.2.0 (npm bundled only; absent from the application tree)` → `4.2.0 (npm bundled only; absent from the application tree)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: PRESENT: http-cache-semantics 4.2.0 is installed and imported by make-fetch-happen/lib/cache/policy.js, which is npm's HTTP cache policy implementation

> reachability: the attack requires BOTH a shared multi-user cache and a client that emits a max-stale request directive. Neither holds. npm's cache is a single-user local disk cache at /home/node/.npm owned by node (uid 1000), inside a container that runs one user and publishes only 127.0.0.1:3000 - there is no second cache consumer to leak to. And npm never emits max-stale: a grep for 'max-stale' across the entire npm tree returns no hit outside the library's own implementation and docs. npm also runs no HTTP cache server - no createServer in npm/lib. With no client max-stale and no shared cache, the credential-recovery path does not exist.

> attacker-controlled prerequisite: an attacker must issue a request carrying a large max-stale value against a shared cache holding another user's zeroed entries; npm is not such a cache and does not send max-stale

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** validation/npm-bundled-inventory.txt, validation/npm-importer-behaviour.txt, validation/callsite-arguments.txt

### CVE-2026-95619 — HIGH — libstdc++6 aligned operator new(size_t, align_val_t) integer overflow (libsupc++/new_opa.cc)

- Scanner component on the FINAL artifact: `deb/debian/gcc-12@12.2.0-14%2Bdeb12u1`
- Prior disposition source: PH-SEC-WO-008
- Prior status / justification: `NOT_AFFECTED` / `vulnerable_code_cannot_be_controlled_by_adversary`
- Detected version (prior → FINAL): `libstdc++.so.6.0.30 (12.2.0-14+deb12u1)` → `libstdc++.so.6.0.30 (12.2.0-14+deb12u1)` (identical)
- Vulnerable code present (prior conclusion, re-verified): `true`

**Prior proof assumption, and its state on the FINAL artifact:**

> presence: CONFIRMED PRESENT and confirmed to be the vulnerable variant: _ZnwmSt11align_val_t/_ZnamSt11align_val_t are exported by the shipped libstdc++.so.6.0.30 and the .so imports glibc 'aligned_alloc' (libstdcxx-allocator-imports.json; no posix_memalign import). Byte-level decode of _ZnwmSt11align_val_t (receipt libstdcxx-opnew-align-body.hex) shows the C11 rounding sequence lea rax,[rbx+rbp-1]; neg rbp; and rbp,rax ((sz+al-1) & ~(al-1)) at offset +0x2D followed by a call to glibc aligned_alloc - i.e. the exact code the upstream fix hardens is compiled in (the posix_memalign fast path from PR 113258 is NOT compiled in for gcc 12.2.0-14+deb12u1). node links this .so (ldd receipt artifact-identity.txt) and maps it at runtime (runtime maps receipts), so the vulnerable code is mapped into the running process.

> reachability: Two aligned-new call paths are REACHABLE in the local-dev runtime; both are closed by hard source/type-level bounds. (1) node: the complete consumer set that links libstdc++.so.6 was enumerated across the whole image (receipt cr01-cr02-complete-libstdcxx-consumers.txt); exhaustive PLT/relocation analysis of the exact shipped node binary gives ONE aligned-new import (_ZnamSt11align_val_t, dynsym[532], 1 JUMP_SLOT at GOT 0x6b55608, PLT stub 0x747010) and exactly TWO call sites, both inside v8::internal::OptimizingCompileTaskExecutor::EnsureInitialized() (_ZN2v88internal29OptimizingCompileTaskExecutor17EnsureInitializedEv). Source mapping at exact tag v24.21.0 (commit 955266bfdd854cd280dffd47548673914484e4c0, receipts cr03-node-source/): deps/v8/src/compiler-dispatcher/optimizing-compile-dispatcher.cc:141-142 -> base::OwnedVector<OptimizingCompileTaskState>::New(max_tasks) -> std::make_unique<T[]>(max_tasks) (base/vector.h:287-290); OptimizingCompileTaskState is alignas(PROCESSOR_CACHE_LINE_SIZE)=alignas(64) (optimizing-compile-dispatcher.h:29; PROCESSOR_CACHE_LINE_SIZE=64, common/globals.h:1025); so the call is operator new[](max_tasks * 64, align_val_t(64)). max_tasks = v8_flags.concurrent_turbofan_max_threads (DEFINE_UINT, default 4, startup-only, flag-definitions.h:1181) or NumberOfWorkerThreads() (node clamps to uv_available_parallelism()-1, min 1, src/node_platform.cc:88-93) - n*64 is >= 2^27 below the 2^64-63 threshold and has no JavaScript runtime setter (cr03-node-source/cr03-align-val-t-search.txt). cppgc's DEFINED aligned Allocate symbols route to the Oilpan PageBackend LAB, not to global aligned operator new. (2) libvips/libuhdr: REACHABLE via Next.js 16.3.8 /_next/image -> optimizeImage -> getSharp -> require('sharp') -> sharp -> libvips -> ultrahdr decode path -> IccHelper::readIccColorGamut (icc.cpp:657). Lazy loading is PROBE-CONFIRMED: one benign GET /_next/image request mapped sharp-linux-x64.node (5 segs) and libvips-cpp.so.8.18.7 (4 segs) into the running next-server (before: 0/0). The prior runtime-unreachability theory was WITHDRAWN / FALSIFIED BY CR-04 PROBE and is retained only as history (libvipsBranchResolution.runtime_unreachability_WITHDRAWN).

> attacker-controlled prerequisite: an input path causing a compiled consumer to pass sz >= 2^64 - 63 (align 64) or sz >= 2^64 - 3 (align 4) to operator new(size_t, align_val_t). node: max_tasks*64 with max_tasks bounded by startup flags/thread counts - prerequisite unsatisfiable. libvips/libuhdr (REACHABLE via Next /_next/image, lazy loading probe-confirmed): the size IS attacker-controlled - it equals the JPEG APP2 ICC_PROFILE marker payload length minus 14 - but the JPEG marker format hard-caps that length at 16 bits (icc_size <= 65533, mozjpeg jdmarker.c save_marker INPUT_2BYTES), so the aligned allocation size is <= 65519, at least 2^48 below the 2^64-3 threshold: the prerequisite is arithmetically unsatisfiable within the format. apt/libapt and sharp-linux-x64.node carry zero aligned-new references.

**Verdict:** ASSUMPTIONS IDENTICAL — the prior analysis is preserved by reference. The component, its exact version, its architecture, the installed files it was proven over and the runtime assumptions it depended on are all unchanged on the FINAL digest (receipts 01, 02, 03, 06, 07).

**Status on the FINAL digest:** `UNDER_INVESTIGATION` until an independent auditor verifies the equivalence evidence and the owner approves this digest. The owner approval recorded on `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3` does not carry over to `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

**Prior receipts (unchanged, still applicable):** receipts/cr04-libvips-callsite-source-mapping.json, receipts/cr04-uhdr-source/cr04-uhdr-provenance.txt, receipts/cr04-uhdr-source/cr04-icc-readIccColorGamut-excerpt.txt, receipts/cr04-uhdr-source/cr04-icc-constants.txt, receipts/cr04-uhdr-source/cr04-icc-header-struct.txt, receipts/cr04-uhdr-source/cr04-readIccColorGamut-callers.txt, receipts/cr04-uhdr-source/cr04-micc-buffer-extraction.txt, receipts/cr04-uhdr-source/cr04-getICCSize.txt, receipts/cr04-mozjpeg-marker-cap.txt, receipts/cr04-libjpeg-identity.txt, receipts/cr04-uhdr-symbol-in-binary.txt, receipts/cr04-libvips-function-strings.txt, receipts/cr04-next-image-route-analysis.json, receipts/cr04-probe/probe-summary.txt, receipts/cr04-probe/before-next72-maps.txt, receipts/cr04-probe/after-next72-maps.txt, receipts/upstream/cve-2026-95619-commit-meta.txt, receipts/upstream/cve-2026-95619-new_opa.diff, receipts/upstream/cve-2026-95619-new_opa-vulnerable.cc, receipts/libstdcxx-opnew-align-body.hex, receipts/libstdcxx-allocator-imports.json, receipts/cve-95619-node-dynsym.json, receipts/cve-95619-callsite-analysis.json, receipts/cve-95619-consumers.txt, receipts/cr02-libvips-disasm-console.txt, receipts/cr02-libvips-stub-verification.txt, receipts/cr02-libvips-function-dump.txt, receipts/cr02-libvips-caller-full.txt, receipts/cr02-libvips-aligned-new-callsite-analysis.json, receipts/cr02-libvips-r12-trace.json, receipts/cr02-runtime/web-all-maps.txt, receipts/cr02-runtime/worker-all-maps.txt, receipts/cr02-runtime-web-detail.txt, receipts/cr02-runtime-mapped-native-modules.txt, receipts/cr02-next-swc-and-native-modules.txt, receipts/v8-runtime-bounds.json, receipts/artifact-identity.txt

## The three rows introduced by this delta

These are not carried over: their analysis was performed directly on the FINAL artifact and is recorded in full in `PH-M01-WO-002-VEX-FINAL.json`.

- **CVE-2026-42496** (CRITICAL) — `deb/debian/perl@5.36.0-7%2Bdeb12u3` — analysed fresh on `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.
- **CVE-2026-42497** (HIGH) — `deb/debian/perl@5.36.0-7%2Bdeb12u3` — analysed fresh on `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.
- **CVE-2026-8376** (CRITICAL) — `deb/debian/perl@5.36.0-7%2Bdeb12u3` — analysed fresh on `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`.

## Summary

- Prior rows revalidated by reference: **22**
- Prior rows whose analysis had to be redone: **0**
- Rows analysed fresh on the FINAL digest: **3**
- Total HIGH/CRITICAL rows on `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c`: **25**, all currently `UNDER_INVESTIGATION`.
