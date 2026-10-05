#!/usr/bin/env python3
"""CR-05A: rewrite stale CVE-2026-95619 fields in build_vex.py and regenerate."""
import json
import re

p = ".engineering/evidence/PH-SEC-WO-008/analysis/build_vex.py"
s = open(p, encoding="utf-8").read()

def swap(old, new, tag):
    global s
    assert old in s, f"{tag} block not found"
    s = s.replace(old, new)
    print(f"replaced: {tag}")

# 1. reachabilityEvidence
old_reach = '''    "reachabilityEvidence": (
        "The complete set of consumers that link libstdc++.so.6 was enumerated across the whole image (receipt "
        "cr01-cr02-complete-libstdcxx-consumers.txt): node, apt/libapt (and apt method helpers), libvips-cpp.so.8.18.7, and "
        "sharp-linux-x64-0.35.5.node. Only node is executed in the local-dev runtime; the others are proven not loaded by direct process "
        "memory-map evidence (receipts cr02-runtime/*). For node - the reachable consumer - exhaustive PLT/relocation analysis of the exact "
        "shipped binary gives ONE aligned-new import (_ZnamSt11align_val_t, dynsym[532], 1 JUMP_SLOT at GOT 0x6b55608, PLT stub 0x747010) "
        "and exactly TWO call sites, both inside v8::internal::OptimizingCompileTaskExecutor::EnsureInitialized() "
        "(_ZN2v88internal29OptimizingCompileTaskExecutor17EnsureInitializedEv). Source mapping at exact tag v24.21.0 (commit "
        "955266bfdd854cd280dffd47548673914484e4c0, receipt cr03-node-source/): "
        "deps/v8/src/compiler-dispatcher/optimizing-compile-dispatcher.cc:141-142 -> base::OwnedVector<OptimizingCompileTaskState>::New(max_tasks) "
        "-> std::make_unique<T[]>(max_tasks) (base/vector.h:287-290); OptimizingCompileTaskState is alignas(PROCESSOR_CACHE_LINE_SIZE)=alignas(64) "
        "(optimizing-compile-dispatcher.h:29; PROCESSOR_CACHE_LINE_SIZE=64, common/globals.h:1025); so the call is "
        "operator new[](max_tasks * 64, align_val_t(64)). max_tasks = v8_flags.concurrent_turbofan_max_threads (DEFINE_UINT, default 4, "
        "startup-only, flag-definitions.h:1181) or, if 0, NumberOfWorkerThreads() (node clamps to uv_available_parallelism()-1, min 1, "
        "src/node_platform.cc:88-93). n is a bounded small integer, so n*64 is many orders of magnitude below 2^64-63; and no JavaScript "
        "runtime setter for the flag exists (source search for align_val_t returns only the non-calling cppgc path, receipt "
        "cr03-node-source/cr03-align-val-t-search.txt). cppgc's DEFINED aligned Allocate symbols route to the Oilpan PageBackend LAB, not to "
        "global aligned operator new."
    ),'''
new_reach = '''    "reachabilityEvidence": (
        "Two aligned-new call paths are REACHABLE in the local-dev runtime; both are closed by hard source/type-level bounds. "
        "(1) node: the complete consumer set that links libstdc++.so.6 was enumerated across the whole image (receipt "
        "cr01-cr02-complete-libstdcxx-consumers.txt); exhaustive PLT/relocation analysis of the exact shipped node binary gives ONE aligned-new "
        "import (_ZnamSt11align_val_t, dynsym[532], 1 JUMP_SLOT at GOT 0x6b55608, PLT stub 0x747010) and exactly TWO call sites, both inside "
        "v8::internal::OptimizingCompileTaskExecutor::EnsureInitialized() (_ZN2v88internal29OptimizingCompileTaskExecutor17EnsureInitializedEv). "
        "Source mapping at exact tag v24.21.0 (commit 955266bfdd854cd280dffd47548673914484e4c0, receipts cr03-node-source/): "
        "deps/v8/src/compiler-dispatcher/optimizing-compile-dispatcher.cc:141-142 -> base::OwnedVector<OptimizingCompileTaskState>::New(max_tasks) "
        "-> std::make_unique<T[]>(max_tasks) (base/vector.h:287-290); OptimizingCompileTaskState is alignas(PROCESSOR_CACHE_LINE_SIZE)=alignas(64) "
        "(optimizing-compile-dispatcher.h:29; PROCESSOR_CACHE_LINE_SIZE=64, common/globals.h:1025); the call is "
        "operator new[](max_tasks * 64, align_val_t(64)) with max_tasks = v8_flags.concurrent_turbofan_max_threads (DEFINE_UINT, default 4, "
        "startup-only, flag-definitions.h:1181) or NumberOfWorkerThreads() (node clamps to uv_available_parallelism()-1, min 1, "
        "src/node_platform.cc:88-93) - n*64 is >= 2^27 below the 2^64-63 threshold and has no JavaScript runtime setter "
        "(cr03-node-source/cr03-align-val-t-search.txt). cppgc's DEFINED aligned Allocate symbols route to the Oilpan PageBackend LAB, not to "
        "global aligned operator new. (2) libvips/libuhdr: REACHABLE via Next.js 16.3.8 /_next/image -> optimizeImage -> getSharp -> "
        "require('sharp') -> sharp -> libvips -> ultrahdr decode path -> IccHelper::readIccColorGamut (icc.cpp:657). Lazy loading is "
        "PROBE-CONFIRMED: one benign GET /_next/image request mapped sharp-linux-x64.node (5 segs) and libvips-cpp.so.8.18.7 (4 segs) into the "
        "running next-server (before: 0/0). The prior runtime-unreachability theory was WITHDRAWN / FALSIFIED BY CR-04 PROBE and is retained "
        "only as history (libvipsBranchResolution.runtime_unreachability_WITHDRAWN)."
    ),'''
swap(old_reach, new_reach, "reachabilityEvidence")

# 2. attackerControlledPrerequisite
old_att = '''    "attackerControlledPrerequisite": (
        "an input path causing a compiled consumer to pass sz >= 2^64 - 63 (align 64) or sz >= 2^64 - 3 (align 4) to "
        "operator new(size_t, align_val_t). For node: max_tasks*64 with max_tasks bounded by startup flags/thread counts. For "
        "libvips/libuhdr (reachable via Next /_next/image, probe-confirmed): the size IS attacker-influenced but hard-capped at 65519 bytes "
        "by the JPEG 16-bit marker length field - at least 2^48 below the threshold - so the prerequisite can never be satisfied. "
        "sharp-linux-x64.node and apt/libapt carry zero aligned-new references."
    ),'''
new_att = '''    "attackerControlledPrerequisite": (
        "an input path causing a compiled consumer to pass sz >= 2^64 - 63 (align 64) or sz >= 2^64 - 3 (align 4) to "
        "operator new(size_t, align_val_t). node: max_tasks*64 with max_tasks bounded by startup flags/thread counts - prerequisite "
        "unsatisfiable. libvips/libuhdr (REACHABLE via Next /_next/image, probe-confirmed): the size IS attacker-controlled - it equals the "
        "JPEG APP2 ICC_PROFILE marker payload length minus 14 - but the JPEG marker format hard-caps that length at 16 bits "
        "(icc_size <= 65533, mozjpeg jdmarker.c save_marker INPUT_2BYTES), so the aligned allocation size is <= 65519, at least 2^48 below "
        "the 2^64-3 threshold: the prerequisite is arithmetically unsatisfiable within the format. apt/libapt and sharp-linux-x64.node carry "
        "zero aligned-new references."
    ),'''
swap(old_att, new_att, "attackerControlledPrerequisite")

# 3. residualRisk
old_res = '"LOW-MEDIUM. Vulnerable library code is confirmed mapped into the running node process. Safety rests on (a) complete enumeration of "\n        "aligned-new call sites in the exact shipped node binary (one import, two call sites, bounded size) with preserved Node v24.21.0 "\n        "source provenance (CR-03); and (b) direct runtime evidence that libvips-cpp / sharp addon are not loaded. The libvips call site\'s "\n        "size bound is NOT proven at source and is excluded only by runtime unreachability - a genuine, disclosed limitation. Any Node/V8 "\n        "upgrade, any consumer version change, or activation of image optimisation expires this disposition."'
new_res = '"LOW. Vulnerable libstdc++ code is mapped into the running processes. Safety rests on two independent hard, source/type-level "\n        "bounds: (a) node\'s aligned-new call passes max_tasks*64 (startup-only flag / clamped thread count, >= 2^27 below threshold); "\n        "(b) libvips/libuhdr\'s aligned-new call is reachable (probe-confirmed lazy load via Next /_next/image) and attacker-influenced, but "\n        "its size is hard-capped by the JPEG 16-bit marker length field: icc_size <= 65533 => aligned allocation size <= 65519, >= 2^48 below "\n        "the 2^64-3 threshold. Overflow is arithmetically impossible on both paths. The libvips bound is a property of the JPEG marker "\n        "format; a future consumer passing an attacker-controlled size from a format without a hard length cap would require re-analysis. "\n        "The earlier runtime-unreachability theory is withdrawn/falsified history only (CR-04 probe)."'
swap(old_res, new_res, "residualRisk")

# 4. justificationBasis
old_jb = '''        "justificationBasis": (
            "The reachable consumer is node; its single aligned-new call path passes max_tasks*64 with max_tasks a startup-only flag/thread "
            "count, so an adversary cannot cause the overflow size. The identifiable non-node consumers (libvips-cpp, sharp addon) are not "
            "loaded in the local-dev runtime and apt/libapt carry no aligned-new references."
        ),'''
new_jb = '''        "justificationBasis": (
            "The disposition rests exclusively on mathematical source/type-level bounds. Node/V8: the single aligned-new call path passes "
            "max_tasks*64 (startup-only flag or clamped thread count), >= 2^27 below the overflow threshold. libvips/libuhdr: the path IS "
            "reachable (Next 16.3.8 /_next/image -> optimizeImage -> getSharp -> require('sharp') -> sharp -> libvips -> ultrahdr "
            "readIccColorGamut; lazy loading probe-confirmed) and the ICC size IS attacker-controlled within the JPEG format, but the JPEG "
            "APP2 marker length is hard-capped at 16 bits (icc_size <= 65533, mozjpeg jdmarker.c save_marker), so the aligned allocation "
            "size is <= 65519 while the overflow threshold is sz >= 2^64 - 3 = 18446744073709551613 - the overflow is arithmetically "
            "impossible on this call path. The earlier runtime-unreachability theory is retained ONLY as a withdrawn/falsified historical "
            "note (WITHDRAWN / FALSIFIED BY CR-04 PROBE), never as a justification."
        ),'''
swap(old_jb, new_jb, "justificationBasis")

open(p, "w", encoding="utf-8", newline="\n").write(s)
print("build_vex.py updated")