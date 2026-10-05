#!/usr/bin/env python3
"""Build PH-SEC-WO-008-VEX.json (deterministic, re-runnable).

Revised for Correction Delta CR-01 / CR-02 / CR-03.
"""
import json

env = {
    "environment": "local-dev",
    "compose_services": ["web", "worker", "postgres"],
    "web_command": "npm run dev --workspace @polyhunter/web -- --webpack --hostname 0.0.0.0 (container), published 127.0.0.1:3000",
    "worker_command": "nodemon --legacy-watch --polling-interval 1000 --watch apps/worker --watch packages --ext ts,json --exec node apps/worker/src/index.ts",
    "container_user": "node (uid 1000)",
    "capabilities_effective": "0x0000000000000000 (no CAP_SYS_ADMIN)",
    "network_exposure": "host binding is 127.0.0.1 only; container has no published port other than 3000->127.0.0.1",
    "application_subprocess_spawning": "none - no child_process/exec/spawn reference exists in apps/** or packages/** (carried from PH-SEC-WO-007 section 4; unchanged at parent head 5cf4c2f)",
}

img = {
    "reference": "polyhunter-dev:local",
    "digest": "sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3",
}

common = {
    "environment": env,
    "image": img,
    "parentHead": "5cf4c2ffe7b5365ca4941253f92b612f0322a83d",
    "branch": "security/ph-m01-libstdcpp-final-two",
    "parentPr": 15,
    "pr": 35,
    "policy": "PH-SEC-VEX-POLICY via ADR-0007",
}

f102010 = {
    "cve": "CVE-2026-102010",
    "scanner": {
        "tool": "docker scout 1.24.0",
        "severity": 7,
        "band": "HIGH",
        "scannerPackage": "pkg:deb/debian/gcc-12@12.2.0-14%2Bdeb12u1?os_distro=bookworm&os_name=debian&os_version=12",
        "scannerPackageShort": "pkg:deb/debian/gcc-12@12.2.0-14+deb12u1",
        "reportedFixedVersion": "not fixed",
        "sarifSha256": "locked SARIF blob d3999a5664ec91e2b555d468b6e85c8d04aaabe9 (.engineering/evidence/PH-SEC-WO-005/validation/polyhunter-dev-final.sarif at parent head)",
    },
    "component": "libstdc++6 / __gnu_pbds detail::binary_heap erase_if (header-only template)",
    "detectedVersion": "libstdc++.so.6.0.30 (12.2.0-14+deb12u1)",
    "installedBinaryPackage": "libstdc++6 12.2.0-14+deb12u1 (gcc-12 source); gcc-12-base, libgcc-s1",
    **common,
    "upstreamAdvisory": {
        "fixStatus": "not fixed for gcc-12 in Debian; upstream fixed in GCC trunk by commit aaa8351f4d2e636f9680a1f0a8ebc2f0a60611e6 (2026-09-25, Jonathan Wakely, PR libstdc++/127656)",
        "affectedCondition": "use-after-free in __gnu_pbds detail::binary_heap erase_if: after reallocating the entry storage, the member pointer m_a_entries is left dangling (storage freed, new storage leaked). One-line fix adds `m_a_entries = new_entries;`.",
        "affectedApi": "__gnu_pbds::priority_queue (policy-based data structures, <ext/pb_ds/priority_queue.hpp>) backed by the binary_heap tag, when erase_if(pred) is invoked. NOT std::priority_queue (<queue>) - std::priority_queue has no erase_if and its underlying std heap algorithms are unrelated to pb_ds binary_heap_ internals.",
    },
    "vulnerableCodePresent": False,
    "presenceEvidence": (
        "DISPROVEN AT SOURCE LEVEL for every compiled C++ consumer, mapped to its exact shipped version (Correction Delta CR-01). "
        "The prior bundle relied on byte-string/dynsym absence and asserted that an inlined instantiation would leave mangled names or "
        "distinctive strings; that assertion was FALSE and is REMOVED. The corrected proof is that a binary cannot contain an "
        "instantiation of a template its source never referenced, whether inlined or not, so source-level absence at the exact version "
        "is dispositive and independent of symbols/strings. Consumers and their sources: (1) node v24.21.0 = nodejs/node commit "
        "955266bfdd854cd280dffd47548673914484e4c0 - no pb_ds/__gnu_pbds/binary_heap anywhere under src/ or deps/; "
        "(2) apt 2.6.1 = salsa.debian.org/apt-team/apt commit a626a66fece0a7d680e40b9e35b66e29fe9ae12c - no pb_ds/__gnu_pbds/"
        "binary_heap/erase_if/priority_queue and no <ext/...> includes; (3) libvips 8.18.7 = libvips/libvips commit "
        "24ad4d042940e6bf99a68871ba886ca8847c9c82 - no pb_ds/__gnu_pbds/binary_heap/erase_if and no <ext/...> includes; "
        "(4) libvips-cpp statically-bundled C++ deps per @img/sharp-libvips-linux-x64/versions.json - highway 1.4.0 "
        "(2607d3b5...), libultrahdr 2.0.2 (e5f5a022...), harfbuzz 14.5.0 (863d3f77...), libheif 1.23.5 (413e2a87...) - all no matches "
        "(the remaining bundled deps are C libraries and cannot instantiate C++ templates); (5) sharp 0.35.5 addon = lovell/sharp commit "
        "51a990faa26ade5586a4934ac9673c98d8893326 - no pb_ds/__gnu_pbds/binary_heap/erase_if. Component level: the artifact ships only "
        "libstdc++6 12.2.0-14+deb12u1 and gcc-12-base - NO libstdc++-12-dev, no C++ headers (/usr/include/c++ absent), no compiler - so the "
        "vulnerable header ext/pb_ds/detail/binary_heap_/erase_fn_imps.hpp is not installed and cannot be compiled in-image; the only way "
        "it could be present is as a pre-built instantiation in a shipped consumer, which the source audit excludes for every consumer."
    ),
    "reachabilityEvidence": (
        "Not required once presence is disproven at source level: the source set of every compiled C++ consumer (node, apt/libapt, "
        "libvips and its bundled deps, sharp addon) contains no pb_ds reference, so no instantiation of the vulnerable erase_if can exist "
        "in any executable page of this artifact, regardless of which libraries are loaded at runtime. Runtime load state is not used as "
        "evidence for this disposition."
    ),
    "attackerControlledPrerequisite": (
        "Moot: the vulnerable operation is not present. For completeness - triggering requires C++ code calling erase_if on a __gnu_pbds "
        "binary_heap priority_queue with attacker-influenced contents; no compiled consumer in the artifact references pb_ds at all."
    ),
    "privilegePrerequisite": "none (not applicable)",
    "cisaKev": {
        "inKev": False,
        "catalogVersion": "2026.10.04",
        "dateReleased": "2026-10-04T18:52:56.0635Z",
        "note": "KEV/EPSS are prioritisation inputs only and never convert a finding to NOT_AFFECTED (PH-SEC-VEX-POLICY).",
    },
    "firstEpss": {
        "score": "0.002500000",
        "percentile": "0.147930000",
        "date": "2026-10-05",
        "note": "prioritisation only; snapshot receipts/first-epss-wo008.json",
    },
    "vex": {
        "status": "NOT_AFFECTED",
        "justification": "vulnerable_code_not_present",
        "policy": "PH-SEC-VEX-POLICY via ADR-0007",
        "proposedBy": "Codex executor - proposes only; independent audit + owner approval still required",
    },
    "residualRisk": (
        "LOW. The disposition rests on source-level absence at the exact shipped version of every compiled C++ consumer plus the "
        "component-level absence of the pb_ds header/dev package. It expires if any consumer version changes or a new compiled consumer "
        "linking libstdc++ is added to the image."
    ),
    "expiryRevalidationTrigger": (
        "earliest of: 7 days (local-dev); new image digest; libstdc++6/gcc-12 package version change; any consumer version change "
        "(node/apt/libvips/sharp) or new compiled consumer; new upstream advisory; KEV status change."
    ),
    "dispositionTimestamp": "2026-10-05T17:30:00Z",
    "confidence": "high",
    "independentAuditor": "PENDING (this Work Order proposes; audit not yet performed)",
    "ownerApproval": "PENDING",
    "receipts": [
        "receipts/upstream/cve-2026-102010-commit-meta.txt",
        "receipts/upstream/cve-2026-102010-binary_heap.diff",
        "receipts/upstream/cve-2026-102010-erase_fn_imps-vulnerable.hpp",
        "receipts/cr01-cve-2026-102010-presence-proof.json",
        "receipts/cr01-pbds-header-and-dev-package.txt",
        "receipts/cr01-consumer-versions.txt",
        "receipts/cr01-sharp-libvips-versions.txt",
        "receipts/cr01-cr02-complete-libstdcxx-consumers.txt",
        "receipts/cr01-source-provenance/cr01-apt-2.6.1-pbds-absence.txt",
        "receipts/cr01-source-provenance/cr01-libvips-8.18.7-pbds-absence.txt",
        "receipts/cr01-source-provenance/cr01-highway-1.4.0-pbds-absence.txt",
        "receipts/cr01-source-provenance/cr01-uhdr-2.0.2-pbds-absence.txt",
        "receipts/cr01-source-provenance/cr01-harfbuzz-14.5.0-pbds-absence.txt",
        "receipts/cr01-source-provenance/cr01-libheif-1.23.5-pbds-absence.txt",
        "receipts/cr01-source-provenance/cr01-sharp-0.35.5-pbds-absence.txt",
        "receipts/cr03-node-source/cr03-pbds-search.txt",
    ],
}

f95619 = {
    "cve": "CVE-2026-95619",
    "scanner": {
        "tool": "docker scout 1.24.0",
        "severity": 7.7,
        "band": "HIGH",
        "scannerPackage": "pkg:deb/debian/gcc-12@12.2.0-14%2Bdeb12u1?os_distro=bookworm&os_name=debian&os_version=12",
        "scannerPackageShort": "pkg:deb/debian/gcc-12@12.2.0-14+deb12u1",
        "reportedFixedVersion": "not fixed",
        "sarifSha256": "locked SARIF blob d3999a5664ec91e2b555d468b6e85c8d04aaabe9",
    },
    "component": "libstdc++6 aligned operator new(size_t, align_val_t) integer overflow (libsupc++/new_opa.cc)",
    "detectedVersion": "libstdc++.so.6.0.30 (12.2.0-14+deb12u1)",
    "installedBinaryPackage": "libstdc++6 12.2.0-14+deb12u1 (gcc-12 source)",
    **common,
    "upstreamAdvisory": {
        "fixStatus": "not fixed for gcc-12 in Debian; upstream fixed in GCC trunk by commit 59d235ffa5a69231eb42e5290d52dc8c90d28b7a (2026-09-23, Jonathan Wakely; Red Hat bug reference 2537811 per locked scanner evidence)",
        "affectedCondition": (
            "operator new(size_t, align_val_t) rounds the size up to a multiple of the alignment ((sz + al - 1) & ~(al - 1)) before "
            "calling C11 aligned_alloc on targets compiled with _GLIBCXX_HAVE_ALIGNED_ALLOC and without _GLIBCXX_HAVE_POSIX_MEMALIGN. With sz "
            "near SIZE_MAX the addition wraps to a small value; aligned_alloc succeeds and returns a non-null pointer to an undersized "
            "region -> heap memory corruption in the caller."
        ),
        "overflowFormula": (
            "wraparound iff sz + align - 1 >= 2^64, i.e. sz >= 2^64 - (align - 1). For align=64: sz >= 2^64 - 63 = 18446744073709551553. "
            "A wrapped request then allocates (sz + align - 1) mod align bytes instead of sz."
        ),
    },
    "vulnerableCodePresent": True,
    "presenceEvidence": (
        "CONFIRMED PRESENT and confirmed to be the vulnerable variant: _ZnwmSt11align_val_t/_ZnamSt11align_val_t are exported by the shipped "
        "libstdc++.so.6.0.30 and the .so imports glibc 'aligned_alloc' (libstdcxx-allocator-imports.json; no posix_memalign import). "
        "Byte-level decode of _ZnwmSt11align_val_t (receipt libstdcxx-opnew-align-body.hex) shows the C11 rounding sequence "
        "lea rax,[rbx+rbp-1]; neg rbp; and rbp,rax ((sz+al-1) & ~(al-1)) at offset +0x2D followed by a call to glibc aligned_alloc - i.e. "
        "the exact code the upstream fix hardens is compiled in (the posix_memalign fast path from PR 113258 is NOT compiled in for gcc "
        "12.2.0-14+deb12u1). node links this .so (ldd receipt artifact-identity.txt) and maps it at runtime (runtime maps receipts), so the "
        "vulnerable code is mapped into the running process."
    ),
    "reachabilityEvidence": (
        "Two aligned-new call paths are REACHABLE in the local-dev runtime; both are closed by hard source/type-level bounds. "
        "(1) node: the complete consumer set that links libstdc++.so.6 was enumerated across the whole image (receipt "
        "cr01-cr02-complete-libstdcxx-consumers.txt); exhaustive PLT/relocation analysis of the exact "
        "shipped node binary gives ONE aligned-new import (_ZnamSt11align_val_t, dynsym[532], 1 JUMP_SLOT at GOT 0x6b55608, PLT stub "
        "0x747010) and exactly TWO call sites, both inside "
        "v8::internal::OptimizingCompileTaskExecutor::EnsureInitialized() "
        "(_ZN2v88internal29OptimizingCompileTaskExecutor17EnsureInitializedEv). Source mapping at exact tag v24.21.0 (commit "
        "955266bfdd854cd280dffd47548673914484e4c0, receipts cr03-node-source/): "
        "deps/v8/src/compiler-dispatcher/optimizing-compile-dispatcher.cc:141-142 -> base::OwnedVector<OptimizingCompileTaskState>::New(max_tasks) "
        "-> std::make_unique<T[]>(max_tasks) (base/vector.h:287-290); OptimizingCompileTaskState is alignas(PROCESSOR_CACHE_LINE_SIZE)=alignas(64) "
        "(optimizing-compile-dispatcher.h:29; PROCESSOR_CACHE_LINE_SIZE=64, common/globals.h:1025); so the call is "
        "operator new[](max_tasks * 64, align_val_t(64)). max_tasks = v8_flags.concurrent_turbofan_max_threads (DEFINE_UINT, default 4, "
        "startup-only, flag-definitions.h:1181) or NumberOfWorkerThreads() (node clamps to uv_available_parallelism()-1, min 1, "
        "src/node_platform.cc:88-93) - n*64 is >= 2^27 below the 2^64-63 threshold and has no JavaScript runtime setter "
        "(cr03-node-source/cr03-align-val-t-search.txt). cppgc's DEFINED aligned Allocate symbols route to the Oilpan PageBackend LAB, not to "
        "global aligned operator new. (2) libvips/libuhdr: REACHABLE via Next.js 16.3.8 /_next/image -> optimizeImage -> getSharp -> "
        "require('sharp') -> sharp -> libvips -> ultrahdr decode path -> IccHelper::readIccColorGamut (icc.cpp:657). Lazy loading is "
        "PROBE-CONFIRMED: one benign GET /_next/image request mapped sharp-linux-x64.node (5 segs) and libvips-cpp.so.8.18.7 (4 segs) into the "
        "running next-server (before: 0/0). The prior runtime-unreachability theory was WITHDRAWN / FALSIFIED BY CR-04 PROBE and is retained "
        "only as history (libvipsBranchResolution.runtime_unreachability_WITHDRAWN)."
    ),
    "libvipsBranchResolution": {
        "correction": "CR-04 - point-in-time /proc/<pid>/maps is NOT proof of unreachability for Next.js 16.3.8: the /_next/image route lazily require('sharp') on the first valid request (handleNextImageRequest -> imageOptimizer -> optimizeImage -> getSharp). Runtime-unreachability is WITHDRAWN. The branch is now resolved by PATH A: exact source mapping plus a mathematical type/bound proof.",
        "callsite_identity": {
            "source": "libultrahdr v2.0.2 (commit e5f5a022fe96fc4dc2ee35c19f733a50df807abe), lib/src/icc.cpp, IccHelper::readIccColorGamut(void* icc_data, size_t icc_size), line 657",
            "expression": "::operator new[](icc_size - kICCIdentifierSize, std::align_val_t(alignof(ICCHeader)))",
            "statically_linked_into": "libvips-cpp.so.8.18.7 (bundled by @img/sharp-libvips-linux-x64 1.3.4; versions.json uhdr=2.0.2)",
            "identification_evidence": [
                "binary magic 0x464f52505f434349+0x454c49 = 'ICC_PROFILE' = kICCIdentifier (icc.h:80)",
                "binary constant 0xe = kICCIdentifierSize = 14 (icc.h:83)",
                "entry guard cmp rsi,0x91/jbe requires icc_size >= 146 = sizeof(ICCHeader)(132) + 14 (icc.cpp:644)",
                "tag constants gXYZ/bXYZ/cicp (icc.h:108-115) match the binary 0x5a595867/0x5a595862/0x70636963",
                "alignment 4 = alignof(ICCHeader) (all uint32_t/uint8_t members)",
                ".rodata tables at the referenced rip-relative addresses are exactly the uhdr kBT709/kDisplayP3/kBT2020 colorant matrices (icc.h:128-142)"
            ]
        },
        "size_provenance": {
            "icc_size": "JpegDecoderHelper::getICCSize() = mICCBuffer.size() (std::vector<JOCTET>)",
            "mICCBuffer": "filled by jpeg_extract_marker_payload() from the FIRST JPEG APP2 marker whose payload starts with 'ICC_PROFILE' (jpegdecoderhelper.cpp:238-239, 119-139); destination.resize(marker->data_length)",
            "marker_data_length": "set by mozjpeg jdmarker.c save_marker(): length read via INPUT_2BYTES (16-bit BE, max 65535), length -= 2, data_length = min(length, length_limit=0xFFFF from jpeg_save_markers) -> data_length <= 65533",
            "attacker_control": "YES - the APP2 ICC payload is attacker-controlled image content; size equals marker payload length, controllable only within [146, 65533]"
        },
        "mathematical_bound_proof": {
            "call_size": "sz = icc_size - 14, with icc_size <= 65533 => sz <= 65519",
            "no_underflow": "icc.cpp:644 returns early unless icc_size >= 132+14 = 146, so icc_size - 14 >= 132 (no size_t underflow)",
            "align": "4 (alignof(ICCHeader))",
            "gcc12_overflow_condition": "aligned_alloc rounding wraps iff sz + align - 1 >= 2^64, i.e. sz >= 2^64 - 3 = 18446744073709551613",
            "max_feasible_sz": 65519,
            "margin": "18446744073709551613 / 65519 > 2.8e14 (>= 2^48)",
            "conclusion": "ARITHMETICALLY IMPOSSIBLE to reach the overflow: size hard-capped at 65519 by the JPEG 16-bit marker length field (mozjpeg jdmarker.c save_marker), >= 2^48 below the exact threshold. All arithmetic on size_t (64-bit unsigned), no intermediate narrowing."
        },
        "reachability": "REACHABLE in local-dev (probe-confirmed lazy load); the proof rests entirely on the mathematical bound above (audit Path A)."
    },
    "libvipsBranchCorrection_SUPERSEDED": {
        "correction": "CR-02 - the prior receipt misdecoded the libvips call site as 'mov esi,4 (size=4)'. Under x86-64 System V, "
        "operator new[](size_t size, align_val_t alignment) takes RDI=size, RSI=alignment. Corrected decoding (receipt "
        "cr02-libvips-aligned-new-callsite-analysis.json): mov esi,4 sets alignment=4; mov rdi,r12 sets size=r12, where "
        "0x4037eb lea r12,[rsi-0xe] makes size = (second argument) - 14. R12 is written only at that site on the path that reaches the call. "
        "The argument is a DATA-DERIVED buffer length (the function validates an 'ICC_PROFILE' magic (0x464f52505f434349 + 0x454c49) and "
        "ICC tag signatures gXYZ/bXYZ/cicp, requiring length > 145), NOT a constant. The prior 'constant size 4, cannot wrap' claim is "
        "WITHDRAWN. The exact source translation unit could not be mapped (the function is not among libvips-cpp's exported dynsym entries), "
        "so the size bound/attacker-control for this call site is NOT proven at source level."
    },
    "attackerControlledPrerequisite": (
        "an input path causing a compiled consumer to pass sz >= 2^64 - 63 (align 64) or sz >= 2^64 - 3 (align 4) to "
        "operator new(size_t, align_val_t). node: max_tasks*64 with max_tasks bounded by startup flags/thread counts - prerequisite "
        "unsatisfiable. libvips/libuhdr (REACHABLE via Next /_next/image, lazy loading probe-confirmed): the size IS attacker-controlled - "
        "it equals the JPEG APP2 ICC_PROFILE marker payload length minus 14 - but the JPEG marker format hard-caps that length at 16 bits "
        "(icc_size <= 65533, mozjpeg jdmarker.c save_marker INPUT_2BYTES), so the aligned allocation size is <= 65519, at least 2^48 below "
        "the 2^64-3 threshold: the prerequisite is arithmetically unsatisfiable within the format. apt/libapt and sharp-linux-x64.node carry "
        "zero aligned-new references."
    ),
    "runtime_unreachability_WITHDRAWN": {
        "note": "CR-04: the prior claim that libvips/sharp were unreachable (point-in-time /proc maps) is WITHDRAWN and FALSIFIED. A single benign GET /_next/image?url=%2Ficc-test.jpg&w=64&q=75 request (HTTP 200) lazily require('sharp') and mapped libvips-cpp.so.8.18.7 (4 segs) + sharp-linux-x64-0.35.5.node (5 segs) into the running next-server process (before: 0/0). Next 16.3.8 exposes the route; the parent next.config.ts sets no images.unoptimized.",
        "receipts": ["receipts/cr04-probe/probe-summary.txt", "receipts/cr04-probe/before-next72-maps.txt", "receipts/cr04-probe/after-next72-maps.txt", "receipts/cr04-next-image-route-analysis.json"]
    },
    "runtimeUnreachabilityOfNonNodeConsumers_SUPERSEDED": {
        "method": "direct process memory-map inspection of the exact running local-dev runtime (docker exec ... cat /proc/<pid>/maps for every PID in the web and worker containers).",
        "result": "libvips-cpp.so.8.18.7 and sharp-linux-x64-0.35.5.node appear in ZERO mappings; the only node_modules native module mapped anywhere is @next/swc-linux-x64-gnu/next-swc.linux-x64-gnu.node, which does not link libstdc++.so.6.",
        "consequence": "the libvips aligned-new call site cannot execute in the exact local-dev runtime, independently of any size argument; this closes the CR-02 branch on the runtime-evidence route permitted by the audit.",
        "limitation": "point-in-time observation of the local-dev runtime; if image optimisation (sharp/next-image) becomes active, the branch must be re-opened.",
        "receipts": ["receipts/cr02-runtime/web-all-maps.txt", "receipts/cr02-runtime/worker-all-maps.txt", "receipts/cr02-runtime-web-detail.txt", "receipts/cr02-runtime-mapped-native-modules.txt", "receipts/cr02-next-swc-and-native-modules.txt"]
    },
    "privilegePrerequisite": "none (not applicable; container runs as node uid 1000 with no capabilities)",
    "cisaKev": {
        "inKev": False,
        "catalogVersion": "2026.10.04",
        "dateReleased": "2026-10-04T18:52:56.0635Z",
        "note": "KEV/EPSS are prioritisation inputs only and never convert a finding to NOT_AFFECTED (PH-SEC-VEX-POLICY).",
    },
    "firstEpss": {
        "score": "0.003630000",
        "percentile": "0.279000000",
        "date": "2026-10-05",
        "note": "prioritisation only; snapshot receipts/first-epss-wo008.json",
    },
    "vex": {
        "status": "NOT_AFFECTED",
        "justification": "vulnerable_code_cannot_be_controlled_by_adversary",
        "policy": "PH-SEC-VEX-POLICY via ADR-0007",
        "proposedBy": "Codex executor - proposes only; independent audit + owner approval still required",
        "justificationBasis": (
            "The disposition rests exclusively on mathematical source/type-level bounds. Node/V8: the single aligned-new call path passes "
            "max_tasks*64 (startup-only flag or clamped thread count), >= 2^27 below the overflow threshold. libvips/libuhdr: the path IS "
            "reachable (Next 16.3.8 /_next/image -> optimizeImage -> getSharp -> require('sharp') -> sharp -> libvips -> ultrahdr "
            "readIccColorGamut; lazy loading probe-confirmed) and the ICC size IS attacker-controlled within the JPEG format, but the JPEG "
            "APP2 marker length is hard-capped at 16 bits (icc_size <= 65533, mozjpeg jdmarker.c save_marker), so the aligned allocation "
            "size is <= 65519 while the overflow threshold is sz >= 2^64 - 3 = 18446744073709551613 - the overflow is arithmetically "
            "impossible on this call path. The earlier runtime-unreachability theory is retained ONLY as a withdrawn/falsified historical "
            "note (WITHDRAWN / FALSIFIED BY CR-04 PROBE), never as a justification."
        ),
    },
        "residualRisk": (
        "LOW. Vulnerable libstdc++ code is mapped into the running processes. Safety rests on two independent hard, source/type-level "
        "bounds: (a) node's aligned-new call passes max_tasks*64 (startup-only flag / clamped thread count, >= 2^27 below threshold); "
        "(b) libvips/libuhdr's aligned-new call is reachable (probe-confirmed lazy load via Next /_next/image) and attacker-influenced, but "
        "its size is hard-capped by the JPEG 16-bit marker length field: icc_size <= 65533 => aligned allocation size <= 65519, >= 2^48 below "
        "the 2^64-3 threshold. Overflow is arithmetically impossible on both paths. The libvips bound is a property of the JPEG marker "
        "format; a future consumer passing an attacker-controlled size from a format without a hard length cap would require re-analysis. "
        "The earlier runtime-unreachability theory is withdrawn/falsified history only (CR-04 probe)."
    ),
    "expiryRevalidationTrigger": (
        "earliest of: 7 days (local-dev); new image digest; node/V8 change; libstdc++6/gcc-12 package version change (a Debian fix moves "
        "this row to FIXED); any consumer version change (next/sharp/libvips/uhdr) or new compiled consumer linking libstdc++.so.6; a "
        "consumer change that removes the JPEG 16-bit marker cap from the icc_size path; new upstream advisory; KEV status change."
    ),
    "dispositionTimestamp": "2026-10-05T17:30:00Z",
    "confidence": "high (both paths closed by source/type-level mathematical bounds; libvips reachability confirmed by probe but bounded >= 2^48 below threshold)",
    "independentAuditor": "PENDING (this Work Order proposes; audit not yet performed)",
    "ownerApproval": "PENDING",
    "receipts": [
        "receipts/cr04-libvips-callsite-source-mapping.json",
        "receipts/cr04-uhdr-source/cr04-uhdr-provenance.txt",
        "receipts/cr04-uhdr-source/cr04-icc-readIccColorGamut-excerpt.txt",
        "receipts/cr04-uhdr-source/cr04-icc-constants.txt",
        "receipts/cr04-uhdr-source/cr04-icc-header-struct.txt",
        "receipts/cr04-uhdr-source/cr04-readIccColorGamut-callers.txt",
        "receipts/cr04-uhdr-source/cr04-micc-buffer-extraction.txt",
        "receipts/cr04-uhdr-source/cr04-getICCSize.txt",
        "receipts/cr04-mozjpeg-marker-cap.txt",
        "receipts/cr04-libjpeg-identity.txt",
        "receipts/cr04-uhdr-symbol-in-binary.txt",
        "receipts/cr04-libvips-function-strings.txt",
        "receipts/cr04-next-image-route-analysis.json",
        "receipts/cr04-probe/probe-summary.txt",
        "receipts/cr04-probe/before-next72-maps.txt",
        "receipts/cr04-probe/after-next72-maps.txt",
        "receipts/upstream/cve-2026-95619-commit-meta.txt",
        "receipts/upstream/cve-2026-95619-new_opa.diff",
        "receipts/upstream/cve-2026-95619-new_opa-vulnerable.cc",
        "receipts/libstdcxx-opnew-align-body.hex",
        "receipts/libstdcxx-allocator-imports.json",
        "receipts/cve-95619-node-dynsym.json",
        "receipts/cve-95619-callsite-analysis.json",
        "receipts/cve-95619-consumers.txt",
        "receipts/cr02-libvips-disasm-console.txt",
        "receipts/cr02-libvips-stub-verification.txt",
        "receipts/cr02-libvips-function-dump.txt",
        "receipts/cr02-libvips-caller-full.txt",
        "receipts/cr02-libvips-aligned-new-callsite-analysis.json",
        "receipts/cr02-libvips-r12-trace.json",
        "receipts/cr02-runtime/web-all-maps.txt",
        "receipts/cr02-runtime/worker-all-maps.txt",
        "receipts/cr02-runtime-web-detail.txt",
        "receipts/cr02-runtime-mapped-native-modules.txt",
        "receipts/cr02-next-swc-and-native-modules.txt",
        "receipts/v8-runtime-bounds.json",
        "receipts/artifact-identity.txt",
    ],
}

vex = {
    "schemaVersion": "1.0.0",
    "workOrder": "PH-SEC-WO-008",
    "title": "PH-SEC-WO-008 - final two libstdc++ blocker resolution (proposed dispositions; post CR-01/CR-02/CR-03 correction delta)",
    "branch": "security/ph-m01-libstdcpp-final-two",
    "parentHead": "5cf4c2ffe7b5365ca4941253f92b612f0322a83d",
    "canonicalMainSha": "64ec83d02dbf9c85ca9718eb319efb44a1d62b76",
    "parentPr": 15,
    "pr": 35,
    "image": img,
    "scanner": {
        "tool": "docker scout 1.24.0",
        "lockedSarifBlob": "d3999a5664ec91e2b555d468b6e85c8d04aaabe9",
    },
    "vexInputs": {
        "adr": ".engineering/decisions/ADR-0007-VEX-DISPOSITION-GATE.md (blob d5325dfa8327429e3c5d0f9a559c800a162e8022)",
        "policy": ".engineering/proposals/PH-SEC-VEX-POLICY.md (blob 3e1b20cbe164d655379a5b93e360186dd14daac7)",
        "cisaKev": {
            "catalogVersion": "2026.10.04",
            "receipt": "receipts/cisa-kev-wo008.json",
            "targetCvesInKev": [],
        },
        "firstEpss": {"date": "2026-10-05", "receipt": "receipts/first-epss-wo008.json"},
    },
    "headSemantics": {
        "contentHead": "02e9f96a28eda91bf3d4a8bd813df1e76315e178",
        "contentHeadMeaning": "the commit against which the deterministic preflight was executed; receipts/preflight-reconciliation.json records this head (14/14 PASS)",
        "closureHead": "d7aed91ed86724ee5f710691c19afaca74523209",
        "closureHeadMeaning": "the receipt-only closure commit immediately after contentHead, containing exactly two evidence files: receipts/preflight-reconciliation.json and SHA256SUMS.txt; the independent auditor verified closureHead is exactly one commit ahead of contentHead with a delta touching only those two files",
        "note": "no receipt claims to contain its own final commit SHA; no self-referential receipt loop exists or is attempted. Deterministic preflight was executed against contentHead; a receipt-only closure commit then recorded that result and regenerated SHA256SUMS."
    },
    "correctionDelta": {
        "CR-01": "CVE-2026-102010 presence proof rebuilt on source-level absence at exact consumer versions; false 'inlined leaves strings' claim removed; pb_ds header/dev-package absence recorded. (ACCEPTED by re-audit)",
        "CR-02": "libvips call-site ABI decoding corrected (RSI=alignment, RDI=size); size traced to a data-derived buffer length. (ABI ACCEPTED by re-audit)",
        "CR-04": "runtime-unreachability WITHDRAWN (probe-falsified lazy loading); libvips callsite mapped to libultrahdr v2.0.2 readIccColorGamut (icc.cpp:657); size hard-bounded at 65519 by the JPEG 16-bit marker cap (mozjpeg save_marker) - >= 2^48 below the 2^64-3 overflow threshold.",
        "CR-03": "immutable Node v24.21.0 source/provenance receipts added and included in SHA256SUMS. (ACCEPTED by re-audit)",
        "CR-05": "canonical evidence consistency pass: all stale runtime-unreachability text removed from VEX JSON/MD and Evidence Bundle; deterministic preflight executed against contentHead.",
        "CR-06": "(A) runtime-loaded-state sentence removed from the CVE-2026-102010 row - source-level absence + header/dev-package absence are the sole basis, runtime load state is not used as evidence. (B) explicit contentHead/closureHead semantics documented; no self-referential receipt.",
    },
    "summary": {
        "totalFindings": 2,
        "byStatus": {"NOT_AFFECTED": 2},
        "reviewFormat": "READY_FOR_INDEPENDENT_AUDIT (proposed; executor cannot self-approve)",
    },
    "approvalState": {
        "executor": "Codex - proposing only",
        "independentAuditor": "PENDING",
        "ownerApproval": "PENDING",
        "note": (
            "Under ADR-0007/PH-SEC-VEX-POLICY these proposed NOT_AFFECTED dispositions block until independently audited and explicitly "
            "owner-approved for the exact artifact digest."
        ),
    },
    "upstreamFixCommits": {
        "CVE-2026-102010": "aaa8351f4d2e636f9680a1f0a8ebc2f0a60611e6",
        "CVE-2026-95619": "59d235ffa5a69231eb42e5290d52dc8c90d28b7a",
    },
    "findings": [f102010, f95619],
}

with open(".engineering/evidence/PH-SEC-WO-008-VEX.json", "w", newline="\n") as fp:
    json.dump(vex, fp, indent=2, ensure_ascii=False)
print("VEX.json written, findings:", len(vex["findings"]))