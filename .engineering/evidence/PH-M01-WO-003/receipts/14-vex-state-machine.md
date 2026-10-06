# PH-M01-WO-003 — audit CR-04: VEX state machine on sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2

| | |
| --- | --- |
| Image | `polyhunter-dev:local` |
| Artifact under review | `sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2` |
| Prior artifact (dispositions expired here) | `sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c` |
| Locked base | `af6235d2164171985af6152ba03835826ace3cdb` |
| Scanner | docker scout 1.24.0 |
| Rows scanned | 82 |
| HIGH/CRITICAL rows | 25 |

> **Severity source.** Parsed from `message.text`. SARIF `level` carries the VEX/status
> channel, not the vulnerability severity; reading `level` reports 0 HIGH/CRITICAL on an
> image that has 25. This script throws rather than report a count from a broken parse.

## The state machine this artifact must be in

| Field | Value on every HIGH/CRITICAL row |
| --- | --- |
| `vexStatus` (current) | `UNDER_INVESTIGATION` |
| `proposedVexStatus` | `NOT_AFFECTED` |
| `independentAuditor` | `null` |
| `ownerApproval` | `null` |

Reconciled against the REAL scan: **25 UNDER_INVESTIGATION / 25 proposed NOT_AFFECTED / 0 AFFECTED / 0 auditor approvals / 0 owner approvals.**

The executor proposes. It does not dispose. Registering `NOT_AFFECTED` as current
approved state is precisely what the audit forbids, and none of these rows may stop
blocking until an independent auditor and the Project Owner both act on THIS digest.

## Why the rebuild branch was mandatory

CR-01 changed Docker build inputs: every workspace `package.json` (exports), every
workspace `tsconfig.json`, `apps/web/tsconfig.json` and `apps/web/next.config.ts`.
`Dockerfile.dev` copies the workspace manifests and compose mounts the tsconfigs, so the
identical-digest shortcut was unavailable. Unchanged: `package.json`,
`package-lock.json`, `Dockerfile.dev`, `compose.yaml`, the `node:24-bookworm-slim` base
image and every dependency version. `npm audit --audit-level=high` reports 0.

## Objective equivalence, measured on this artifact

| Axis | Result |
| --- | --- |
| component/package | every dispositioned row byte-identical to the prior scan |
| exact version | Debian inventory byte-identical across all 88 packages; every npm purl version identical |
| architecture | amd64 / x86_64 unchanged |
| installed files | node, libstdc++.so.6.0.30, sharp-linux-x64-0.35.5.node, libvips-cpp.so.8.18.7 — all four SHA-256 identical to the WO-002 baseline |
| runtime assumptions | uid 1000 (node), CapEff 0x0, non-privileged, 127.0.0.1:3000 only, no perl process, no subprocess call site |
| prior proof assumptions | every precondition re-confirmed; each row's own proof text reproduced verbatim below |

Receipt: `receipts/12-objective-equivalence.txt`.

## Scanner delta

Rows 80 → 82; identical 80; added 2; removed 0.

HIGH/CRITICAL 25 → 25.

| Added CVE | Severity | Component | High/Critical? |
| --- | --- | --- | --- |
| CVE-2026-105712 | LOW | `pkg:deb/debian/gnupg2@2.2.40-1.1%2Bdeb12u2?os_distro=bookworm&os_name=debian&os_version=12` | no |
| CVE-2026-104844 | MEDIUM | `pkg:npm/postcss-selector-parser@7.1.4` | no |

Every added row is BELOW HIGH/CRITICAL and originates outside this repository's dependency graph: Debian gnupg2/gpgv from the base image, and postcss-selector-parser bundled inside npm's own node_modules in the base image. Neither appears in package-lock.json. Their presence indicates the scanner datasource advanced between the two scans, not that WO-003 introduced a dependency. They are recorded, not suppressed.

No rows were removed by this scan.

Dispositioned CVEs absent from this scan: none.

HIGH/CRITICAL CVEs with no prior disposition: none.

## CR-05 — CVE-2026-8376 semantics restored

WO-003 had restated this row as `vulnerable_code_not_in_execute_path`, resting it
on *"Perl is never executed"*. That is a semantic regression and it is restored
here to the accepted WO-002 disposition, which the independent auditor reviewed
and the Project Owner approved:

| Field | Accepted WO-002 value | WO-003 regression | This receipt |
| --- | --- | --- | --- |
| `vulnerableCodePresent` | `true` | *(unstated)* | **`true`** |
| `proposedJustification` | `vulnerable_code_cannot_be_controlled_by_adversary` | `vulnerable_code_not_in_execute_path` | **`vulnerable_code_cannot_be_controlled_by_adversary`** |
| `vexStatus` | `NOT_AFFECTED` (approved) | — | **`UNDER_INVESTIGATION`** (new digest ⇒ expired) |
| `independentAuditor` | approved | — | **`null`** |
| `ownerApproval` | approved | — | **`null`** |

**Why the weaker phrasing was wrong, not merely different.** The accepted proof is
an architecture and arithmetic bound, not a reachability argument. The vulnerable
code IS present: `Perl_study_chunk` is the regular-expression compilation path
inside the interpreter and ships as part of `perl-base 5.36.0-7+deb12u3`, which is
installed on this artifact. What an adversary cannot do is DRIVE IT INTO THE
OVERFLOW CONDITION, because the advisory scopes the defect to 32-bit (ILP32) Perl
builds and this artifact is amd64 / ELF64 with `perl -V:ivsize=8`, `longsize=8`,
`ptrsize=8`, `LONG_BIT=64`. Reachability is therefore IRRELEVANT to the
disposition — which is exactly why "Perl is never executed" cannot carry it: that
claim would become false the moment anything in the image invoked perl, while the
32-bit-build argument holds unconditionally.

**Secondary defence-in-depth retained, explicitly demoted.** "Perl is never
executed" is preserved in the JSON under `secondaryDefenceInDepth`, labelled
"NOT the justification for this disposition and must not be read as one", which is
the accepted record's own instruction. Its evidence is re-measured in this round:
no perl process in either container's live process table, no perl invocation in any
tracked `package.json`, and zero subprocess call sites across the 55 tracked source
files (the single `exec(` hit is `RegExp.prototype.exec`).

**What did NOT change.** `vexStatus` remains `UNDER_INVESTIGATION`,
`proposedVexStatus` remains a *proposal* of `NOT_AFFECTED`, `independentAuditor` and
`ownerApproval` remain `null`. CR-05 restored a justification, not an approval.

## Justification integrity — measured, not asserted

Rows compared against the accepted record: **25**. Divergences: **0**. Restored this round: `CVE-2026-8376`.

Every proposed disposition reproduces the accepted `(CVE, vulnerableCodePresent,
proposedJustification)` triple **exactly**. This is enforced mechanically inside
`cr04-vex-state-machine.mjs`: the script THROWS before writing any output if a
single row diverges from the approved record, so the failure mode CR-05 caught —
one row quietly restated in weaker words — can no longer pass silently into a
regenerated receipt. The check covers all 25 rows, which is also the answer to
"did any other row change its previously-approved justification": **no**.

## Per-row state

| CVE | Severity | Component | Prior source | Prior justification | Identity | Premise | vexStatus | proposed | auditor | owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CVE-2026-102010 | HIGH | `pkg:deb/debian/gcc-12` | PH-SEC-WO-008 | vulnerable_code_not_present | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-78409 | HIGH | `pkg:deb/debian/util-linux` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-48962 | HIGH | `pkg:deb/debian/perl` | PH-SEC-WO-007 | vulnerable_code_not_present | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-102276 | HIGH | `pkg:npm/brace-expansion` | PH-SEC-WO-007 | vulnerable_code_cannot_be_controlled_by_adversary | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-102278 | HIGH | `pkg:npm/brace-expansion` | PH-SEC-WO-007 | vulnerable_code_cannot_be_controlled_by_adversary | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-14257 | HIGH | `pkg:npm/brace-expansion` | PH-SEC-WO-007 | vulnerable_code_cannot_be_controlled_by_adversary | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-19534 | HIGH | `pkg:npm/undici` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-42497 | HIGH | `pkg:deb/debian/perl` | PH-M01-WO-002 (this delta) | vulnerable_code_not_present | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-48959 | HIGH | `pkg:deb/debian/perl` | PH-SEC-WO-007 | vulnerable_code_not_present | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-69152 | HIGH | `pkg:npm/brace-expansion` | PH-SEC-WO-007 | vulnerable_code_cannot_be_controlled_by_adversary | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-73566 | HIGH | `pkg:npm/tar` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-82560 | HIGH | `pkg:deb/debian/perl` | PH-SEC-WO-007 | vulnerable_code_not_present | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-103111 | HIGH | `pkg:deb/debian/pcre2` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-69192 | HIGH | `pkg:npm/ip-address` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-95619 | HIGH | `pkg:deb/debian/gcc-12` | PH-SEC-WO-008 | vulnerable_code_cannot_be_controlled_by_adversary | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-78410 | HIGH | `pkg:deb/debian/util-linux` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-78408 | HIGH | `pkg:deb/debian/util-linux` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-85091 | HIGH | `pkg:deb/debian/zlib` | PH-SEC-WO-007 | vulnerable_code_not_present | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-57432 | HIGH | `pkg:deb/debian/perl` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-76642 | HIGH | `pkg:deb/debian/util-linux` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-93748 | HIGH | `pkg:npm/http-cache-semantics` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-12087 | CRITICAL | `pkg:deb/debian/perl` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-13221 | CRITICAL | `pkg:deb/debian/perl` | PH-SEC-WO-007 | vulnerable_code_not_in_execute_path | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-42496 | CRITICAL | `pkg:deb/debian/perl` | PH-M01-WO-002 (this delta) | vulnerable_code_not_present | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |
| CVE-2026-8376 | CRITICAL | `pkg:deb/debian/perl` | PH-M01-WO-002 (this delta) | vulnerable_code_cannot_be_controlled_by_adversary | same | reconfirmed | `UNDER_INVESTIGATION` | `NOT_AFFECTED` | null | null |

## Preserved prior bases

Each row's own proof text is reproduced in the JSON companion
(`13-cr04-vex-state-machine.json`) under `preservedPriorBasis`. They are copied verbatim
from the accepted records — PH-SEC-WO-008 supersedes PH-SEC-WO-007 for the two
libstdc++ rows, because WO-008's correction delta replaced the WO-007 byte-string
presence argument and withdrew the WO-007 runtime-unreachability theory. Nothing here is
restated as a shared per-axis sentence.

### CVE-2026-95619 — the aligned-allocation / arithmetic bound, preserved in full

The audit named this row specifically: its foundation is the accepted
aligned-allocation arithmetic proof, not a generic statement about regex or route inputs.
Reproduced from `.engineering/evidence/PH-SEC-WO-008-VEX.json`:

> **affectedCondition** — operator new(size_t, align_val_t) rounds the size up to a
> multiple of the alignment ((sz + al - 1) & ~(al - 1)) before calling C11 aligned_alloc on
> targets compiled with _GLIBCXX_HAVE_ALIGNED_ALLOC and without
> _GLIBCXX_HAVE_POSIX_MEMALIGN. With sz near SIZE_MAX the addition wraps to a small
> value; aligned_alloc succeeds and returns a non-null pointer to an undersized region
> -> heap memory corruption in the caller.
>
> **overflowFormula** — wraparound iff sz + align - 1 >= 2^64, i.e. sz >= 2^64 - (align - 1).
> For align=64: sz >= 2^64 - 63 = 18446744073709551553.
>
> **node path** — exhaustive PLT/relocation analysis of the exact shipped node binary
> gives ONE aligned-new import (_ZnamSt11align_val_t) and exactly TWO call sites, both in
> `v8::internal::OptimizingCompileTaskExecutor::EnsureInitialized()`:
> `base::OwnedVector<OptimizingCompileTaskState>::New(max_tasks)` ->
> `std::make_unique<T[]>(max_tasks)` with `OptimizingCompileTaskState`
> `alignas(PROCESSOR_CACHE_LINE_SIZE)=alignas(64)`, so the call is
> `operator new[](max_tasks * 64, align_val_t(64))`. max_tasks is
> `v8_flags.concurrent_turbofan_max_threads` (startup-only, default 4) or
> `NumberOfWorkerThreads()` (clamped to `uv_available_parallelism()-1`, min 1) — n*64 is
> >= 2^27 below the 2^64-63 threshold and has no JavaScript runtime setter.
>
> **libvips/libuhdr path (REACHABLE)** — Next 16.3.8 `/_next/image -> optimizeImage ->
> getSharp -> require('sharp') -> libvips -> ultrahdr decode ->
> `IccHelper::readIccColorGamut` (icc.cpp:657),
> `::operator new[](icc_size - kICCIdentifierSize, std::align_val_t(alignof(ICCHeader)))`.
> Reachability is probe-confirmed (a benign `/_next/image` request lazily maps
> libvips-cpp.so.8.18.7 and sharp-linux-x64-0.35.5.node into the running next-server;
> before: 0/0). The earlier runtime-unreachability theory is WITHDRAWN / FALSIFIED and
> retained only as history.
>
> **mathematical_bound_proof** — call_size sz = icc_size - 14 with icc_size <= 65533 =>
> sz <= 65519; no_underflow: icc.cpp:644 returns early unless icc_size >= 146, so
> icc_size - 14 >= 132; align = 4; gcc12_overflow_condition: aligned_alloc rounding wraps
> iff sz >= 2^64 - 3 = 18446744073709551613; max_feasible_sz 65519; margin > 2.8e14
> (>= 2^48); conclusion: ARITHMETICALLY IMPOSSIBLE to reach the overflow, all arithmetic
> on 64-bit size_t with no intermediate narrowing. The cap comes from the JPEG format
> itself: mozjpeg `jdmarker.c save_marker()` reads the APP2 length via INPUT_2BYTES
> (16-bit BE, max 65535), subtracts 2 and clamps to 0xFFFF, so data_length <= 65533.
>
> **attackerControlledPrerequisite** — the libvips size IS attacker-controlled (the ICC
> payload is image content) but bounded to [146, 65533] by the JPEG marker format, so the
> prerequisite is arithmetically unsatisfiable. The node prerequisite is unsatisfiable by
> the thread-count bound. apt/libapt and sharp-linux-x64.node carry zero aligned-new
> references.
>
> **state on this artifact** — every one of those preconditions is re-measured above: the
> node binary and libstdc++.so.6.0.30 hash identically, the architecture is unchanged,
> and WO-003 adds no compiled consumer and changes no consumer version. The arithmetic
> bound is therefore preserved by reference. The row remains `UNDER_INVESTIGATION` with
> `proposedVexStatus: NOT_AFFECTED`, `independentAuditor: null`, `ownerApproval: null`.

## Suppression policy

Suppressions added: **0**. Ignore rules added: **0**. Severity downgrades: **0**.

This document cannot emit AFFECTED by construction. An AFFECTED row is a real defect and belongs in a correction request, not in a self-generated reconciliation.

## Approval state

`independentAuditor: null` · `ownerApproval: null` · **PROPOSED — awaiting independent audit and Project Owner decision**

Per CR-04 the executor does NOT register NOT_AFFECTED as current approved state. Until an independent auditor and the Project Owner act on this exact digest, all 25 rows block under the 'never advance with a known HIGH/CRITICAL defect' rule.

## Expiry

A NOT_AFFECTED disposition expires at the earliest of: a new image digest, a package/component version change, a new compiled consumer of the affected library, a new upstream advisory, a KEV status change, or 7 days for local-dev. Any of those returns the row to UNDER_INVESTIGATION automatically.
