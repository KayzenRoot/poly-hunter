#!/usr/bin/env python3
"""Patch build_vex.py for Correction Delta CR-04."""
p = ".engineering/evidence/PH-SEC-WO-008/analysis/build_vex.py"
s = open(p, encoding="utf-8").read()

old_branch = '''    "libvipsBranchCorrection": {'''
new_branch = '''    "libvipsBranchResolution": {
        "correction": "CR-04 - point-in-time /proc/<pid>/maps is NOT proof of unreachability for Next.js 16.3.8: the /_next/image route "
        "lazily require('sharp') on the first valid request (handleNextImageRequest -> imageOptimizer -> optimizeImage -> getSharp). "
        "Runtime-unreachability is WITHDRAWN. The branch is now resolved by PATH A: exact source mapping plus a mathematical type/bound proof.",
        "callsite_identity": {
            "source": "libultrahdr v2.0.2 (commit e5f5a022fe96fc4dc2ee35c19f733a50df807abe), lib/src/icc.cpp, IccHelper::readIccColorGamut(void* icc_data, size_t icc_size), line 657",
            "expression": "::operator new[](icc_size - kICCIdentifierSize, std::align_val_t(alignof(ICCHeader)))",
            "statically_linked_into": "libvips-cpp.so.8.18.7 (bundled by @img/sharp-libvips-linux-x64 1.3.4; versions.json uhdr=2.0.2)",
            "identification_evidence": [
                "binary magic 0x464f52505f434349+0x454c49 = 'ICC_PROFILE\\\\0' = kICCIdentifier (icc.h:80)",
                "binary constant 0xe = kICCIdentifierSize = 14 (icc.h:83)",
                "entry guard cmp rsi,0x91/jbe requires icc_size >= 146 = sizeof(ICCHeader)(132) + 14 (icc.cpp:644)",
                "tag constants gXYZ/bXYZ/cicp (icc.h:108-115) match the binary 0x5a595867/0x5a595862/0x70636963",
                "alignment 4 = alignof(ICCHeader) (all uint32_t/uint8_t members)",
                ".rodata tables at the referenced rip-relative addresses are exactly the uhdr kBT709/kDisplayP3/kBT2020 colorant matrices (icc.h:128-142)"
            ]
        },
        "size_provenance": {
            "icc_size": "JpegDecoderHelper::getICCSize() = mICCBuffer.size() (std::vector<JOCTET>)",
            "mICCBuffer": "filled by jpeg_extract_marker_payload() from the FIRST JPEG APP2 marker whose payload starts with 'ICC_PROFILE\\\\0' (jpegdecoderhelper.cpp:238-239, 119-139); destination.resize(marker->data_length)",
            "marker_data_length": "set by mozjpeg jdmarker.c save_marker(): length is read via INPUT_2BYTES (16-bit big-endian, max 65535), length -= 2, data_length = min(length, length_limit=0xFFFF from jpeg_save_markers) -> data_length <= 65533",
            "attacker_control": "YES - the APP2 ICC payload is attacker-controlled image content decoded from a request-supplied image; the size equals the marker payload length (max 65533), so an adversary controls it only within [146, 65533] for the aligned-new branch to trigger"
        },
        "mathematical_bound_proof": {
            "call_size": "sz = icc_size - 14, with icc_size <= 65533 => sz <= 65519",
            "no_underflow": "icc.cpp:644 returns early unless icc_size >= sizeof(ICCHeader)+kICCIdentifierSize = 132+14 = 146, so icc_size - 14 >= 132 (no size_t underflow)",
            "align": "4 (alignof(ICCHeader))",
            "gcc12_overflow_condition": "aligned_alloc rounding wraps iff sz + align - 1 >= 2^64, i.e. sz >= 2^64 - 3 = 18446744073709551613",
            "max_feasible_sz": 65519,
            "margin": "18446744073709551613 / 65519 > 2.8e14 (>= 2^48)",
            "conclusion": "ARITHMETICALLY IMPOSSIBLE to reach the overflow: the size is hard-capped at 65519 by the JPEG 16-bit marker length field (enforced by mozjpeg jdmarker.c save_marker), at least 2^48 below the exact threshold. All arithmetic is on size_t (64-bit unsigned) with no intermediate narrowing."
        },
        "reachability": "REACHABLE in local-dev (probe-confirmed lazy load), so the proof rests entirely on the mathematical bound above, as required by audit Path A."
    },
    "libvipsBranchCorrection_SUPERSEDED": {'''

assert old_branch in s
s = s.replace(old_branch, new_branch, 1)

old_unreach = '''    "runtimeUnreachabilityOfNonNodeConsumers": {'''
new_unreach = '''    "runtime_unreachability_WITHDRAWN": {
        "note": "CR-04: the prior claim that libvips/sharp were unreachable (based on point-in-time /proc maps) is WITHDRAWN and FALSIFIED. A single benign GET /_next/image?url=%2Ficc-test.jpg&w=64&q=75 request (HTTP 200) lazily require('sharp') and mapped libvips-cpp.so.8.18.7 (4 segs) + sharp-linux-x64-0.35.5.node (5 segs) into the running next-server process (before: 0/0). Next 16.3.8 exposes the route and the parent next.config.ts sets no images.unoptimized.",
        "receipts": ["receipts/cr04-probe/probe-summary.txt", "receipts/cr04-probe/before-next72-maps.txt", "receipts/cr04-probe/after-next72-maps.txt", "receipts/cr04-next-image-route-analysis.json"]
    },
    "runtimeUnreachabilityOfNonNodeConsumers_SUPERSEDED": {'''

assert old_unreach in s
s = s.replace(old_unreach, new_unreach, 1)

old_att = '"an input path causing a compiled consumer to pass sz >= 2^64 - 63 (align 64) or sz >= 2^64 - 3 (align 4) to "\n        "operator new(size_t, align_val_t). For the only reachable caller (node) this is disproven: max_tasks*64 with max_tasks bounded by "\n        "startup flags/thread counts. For libvips-cpp the call site\'s size bound is not proven at source; that call site is instead excluded "\n        "by direct runtime unreachability (below). sharp-linux-x64.node and apt/libapt carry zero aligned-new references."'
new_att = '"an input path causing a compiled consumer to pass sz >= 2^64 - 63 (align 64) or sz >= 2^64 - 3 (align 4) to "\n        "operator new(size_t, align_val_t). For node: max_tasks*64 with max_tasks bounded by startup flags/thread counts. For "\n        "libvips/libuhdr (reachable via Next /_next/image, probe-confirmed): the size IS attacker-influenced but hard-capped at 65519 bytes "\n        "by the JPEG 16-bit marker length field - at least 2^48 below the threshold - so the prerequisite can never be satisfied. "\n        "sharp-linux-x64.node and apt/libapt carry zero aligned-new references."'
assert old_att in s, "att block not found"
s = s.replace(old_att, new_att)

old_res = '"LOW-MEDIUM. Vulnerable library code is confirmed mapped into the running node process. Safety rests on (a) complete enumeration of "\n        "aligned-new call sites in the exact shipped node binary (one import, two call sites, bounded size) with preserved Node v24.21.0 "\n        "source provenance (CR-03); and (b) direct runtime evidence that libvips-cpp / sharp addon are not loaded. The libvips call site\'s "\n        "size bound is NOT proven at source and is excluded only by runtime unreachability - a genuine, disclosed limitation. Any Node/V8 "\n        "upgrade, any consumer version change, or activation of image optimisation expires this disposition."'
new_res = '"LOW. Vulnerable libstdc++ code is mapped into the running processes. Safety rests on two independent hard bounds: (a) node\'s "\n        "aligned-new call passes max_tasks*64 (startup flag/thread count, >= 2^27 below threshold); (b) libvips/libuhdr\'s aligned-new call "\n        "(reachable via Next /_next/image, probe-confirmed) passes icc_size-14 with icc_size <= 65533 by the JPEG 16-bit marker length cap "\n        "enforced in mozjpeg jdmarker.c - >= 2^48 below the threshold. Both bounds are source/type-level facts, not runtime observations. "\n        "The libvips bound depends on the JPEG marker format cap; a future consumer that passes an attacker-controlled size from a format "\n        "without a hard length cap would need re-analysis. Expiry triggers below."'
assert old_res in s, "res block not found"
s = s.replace(old_res, new_res)

old_exp = '"this row to FIXED); any consumer version change or new compiled consumer linking libstdc++.so.6; activation of sharp/next-image "\n        "image optimisation in the runtime; new upstream advisory; KEV status change."'
new_exp = '"this row to FIXED); any consumer version change (next/sharp/libvips/uhdr) or new compiled consumer linking libstdc++.so.6; a "\n        "consumer change that removes the JPEG 16-bit marker cap from the icc_size path; new upstream advisory; KEV status change."'
assert old_exp in s, "exp block not found"
s = s.replace(old_exp, new_exp)

old_conf = '"medium-high (node path high; libvips branch excluded by runtime evidence, not by a proven size bound)"'
new_conf = '"high (both paths closed by source/type-level mathematical bounds; libvips reachability confirmed by probe but bounded >= 2^48 below threshold)"'
assert old_conf in s
s = s.replace(old_conf, new_conf)

old_receipts = '''    "receipts": [
        "receipts/upstream/cve-2026-95619-commit-meta.txt",'''
new_receipts = '''    "receipts": [
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
        "receipts/upstream/cve-2026-95619-commit-meta.txt",'''
assert old_receipts in s
s = s.replace(old_receipts, new_receipts, 1)

old_cd = '''        "CR-02": "CVE-2026-95619 libvips call-site ABI decoding corrected (RSI=alignment, RDI=size); size traced to a data-derived buffer length; libvips branch resolved by direct runtime unreachability evidence instead of an (unsupported) constant-size claim.",'''
new_cd = '''        "CR-02": "libvips call-site ABI decoding corrected (RSI=alignment, RDI=size); size traced to a data-derived buffer length. (ABI ACCEPTED by re-audit)",
        "CR-04": "runtime-unreachability WITHDRAWN (probe-falsified lazy loading); libvips callsite mapped to libultrahdr v2.0.2 readIccColorGamut (icc.cpp:657); size hard-bounded at 65519 by the JPEG 16-bit marker cap (mozjpeg save_marker) - >= 2^48 below the 2^64-3 overflow threshold.",'''
assert old_cd in s
s = s.replace(old_cd, new_cd)

open(p, "w", encoding="utf-8", newline="\n").write(s)
print("build_vex.py patched for CR-04")
