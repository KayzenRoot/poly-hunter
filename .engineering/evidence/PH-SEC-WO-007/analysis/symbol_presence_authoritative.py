#!/usr/bin/env python3
"""PH-SEC-WO-007 / authoritative per-CVE symbol presence proof.

Supersedes the first-pass table, which was invalidated by two defects found
during validation:

  1. ELF64_Sym st_shndx is at byte offset 6, not 4. Reading it at 4 produced
     garbage `defined` flags, so early "absent" verdicts were unsound.
  2. libpcre2-8-0 exports suffixed names (pcre2_jit_compile_8). Querying the
     unsuffixed form produced a FALSE NEGATIVE for pcre2 JIT.

Method notes that constrain what this tool may claim:

  * Every library inspected here is STRIPPED: it has .dynsym but no .symtab.
    Therefore a MISS in .dynsym proves absence only for symbols the toolchain
    would have EXPORTED. For libraries built with -fvisibility=hidden (perl,
    glibc-style internal linkage) a miss is NOT proof of absence. Each entry
    below therefore carries an explicit `absence_is_proof` flag, set only where
    the symbol would necessarily be dynamic/exported.
  * Header-only C++ templates are never present in a shared object's symbol
    table, so this tool can say nothing about them.
"""

import json
import os
import sys


def basename(p):
    return os.path.basename(p.replace("\\", "/"))


# cve -> spec
#   lib        : which extracted artifact to inspect
#   sink       : symbols that implement the vulnerable operation
#   absence_is_proof: True only when a miss is conclusive
#   note       : why the flag is what it is
EXPECT = {
    "CVE-2026-85091": {
        "lib": "libz.so.1.2.13",
        "sink": ["gz_vacate"],
        "absence_is_proof": False,
        "note": "gz_vacate() is a `local` (static) function in zlib's gzlib.c and "
                "would NOT be exported even in a vulnerable 1.3.x build, so a "
                "dynsym miss is not proof. This CVE is decided by version "
                "identity instead: the artifact self-reports zlib 1.2.13 and the "
                "advisory states the vulnerable non-blocking gzwrite path was "
                "INTRODUCED in 1.3.1.2.",
    },
    "CVE-2026-102010": {
        "lib": "libstdc++.so.6.0.30",
        "sink": ["_ZSt20__erase_if", "erase_if"],
        "absence_is_proof": False,
        "note": "std::erase_if is a HEADER-ONLY C++ template: it is inlined into "
                "the consuming translation unit and would only appear here if "
                "libstdc++ itself explicitly instantiated it. This build DOES "
                "export 3012 _ZNSt* template instantiations, so a total absence "
                "of any erase_if symbol is meaningful but still not conclusive "
                "on its own. Decided together with consumer analysis (no C++ "
                "compiler in the image; the runtime is Node/JavaScript).",
    },
    "CVE-2026-95619": {
        "lib": "libstdc++.so.6.0.30",
        # CORRECTED after validation: the mangled type is align_val_t, not
        # align_val. An earlier query used the wrong name and produced a FALSE
        # NEGATIVE; the aligned allocation operators are in fact PRESENT.
        "sink": ["_ZnwmSt11align_val_t", "_ZnamSt11align_val_t",
                 "_ZdlPvSt11align_val_t", "_ZdaPvSt11align_val_t"],
        "absence_is_proof": True,
        "note": "C++ aligned operator new/delete are exported libstdc++ ABI "
                "symbols. Correct mangling confirmed empirically (align_val_t). "
                "They are PRESENT in libstdc++.6.0.30, so this CVE is NOT "
                "disposed by symbol absence and must be decided on reachability.",
    },
    "CVE-2026-103111": {
        "lib": "libpcre2-8.so.0.11.2",
        "sink": ["pcre2_jit_compile_8", "pcre2_jit_match_8",
                 "pcre2_jit_stack_create_8"],
        "absence_is_proof": True,
        "note": "pcre2's public 8-bit API is fully exported. JIT symbols carry "
                "the _8 suffix; the suffixed names must be queried.",
    },
    "CVE-2026-12087": {
        "lib": "Socket.so",
        "sink": ["pack_ip_mreq_source", "pack_ip_mreq"],
        "absence_is_proof": False,
        "note": "Socket's XS subs are registered at boot via newXS, NOT exported "
                "as ELF symbols, so a dynsym miss proves nothing. Runtime probe "
                "shows pack_ip_mreq_source IS callable at Socket 2.033.",
    },
    "CVE-2026-57432": {
        "lib": "perl",
        "sink": ["Perl_pack"],
        "absence_is_proof": False,
        "note": "perl builds internal Perl_* entry points with hidden visibility "
                "and ships stripped, so they are absent from .dynsym regardless. "
                "Not decided by symbol evidence.",
    },
    "CVE-2026-13221": {
        "lib": "perl",
        "sink": ["Perl_study_chunk"],
        "absence_is_proof": False,
        "note": "Same hidden-visibility limitation as CVE-2026-57432. Not decided "
                "by symbol evidence.",
    },
}

CONTROL = {
    "libz.so.1.2.13": {
        "must_be_present": ["inflate", "deflate", "gzwrite", "gzprintf"],
        "why": "proves the parser really sees gz*/infl* exports, i.e. a negative "
               "result is not a parser artefact",
    },
    "libstdc++.so.6.0.30": {
        # _ZnwmSt11align_val_t is listed as a control BECAUSE it is the exact
        # family under test for CVE-2026-95619. Including it forces the
        # self-test to fail loudly if the mangled name or the parser regresses,
        # which is precisely the defect that produced an earlier false negative.
        "must_be_present": ["_Znwm", "_ZdlPv", "_ZdaPv", "_ZnwmSt11align_val_t"],
        "why": "proves the C++ new/delete ABI family, including the aligned "
               "variants, is visible to the parser",
    },
    "libpcre2-8.so.0.11.2": {
        "must_be_present": ["pcre2_compile_8", "pcre2_match_8"],
        "why": "proves the suffixed pcre2 API is visible, so the JIT result is real",
    },
    "Socket.so": {
        # Only boot_Socket is DEFINED here. inet_pton/inet_ntop are UND (imported
        # from libc) - Socket.so wraps them, it does not define them. Using them
        # as controls would wrongly fail a correct parse.
        "must_be_present": ["boot_Socket"],
        "why": "proves the parser sees this object's own export; Perl_xs_handshake "
               "is correctly UND (imported from the perl executable), which is why "
               "it is not used as a control here",
    },
    "perl": {
        "must_be_present": ["Perl_xs_handshake", "Perl_croak_nocontext"],
        "why": "proves exported Perl_* ABI is visible even though internal "
               "Perl_* symbols are hidden",
    },
}


def main():
    if len(sys.argv) != 2:
        print("usage: symbol_presence_authoritative.py <dynsym.json>", file=sys.stderr)
        return 2
    with open(sys.argv[1], encoding="utf-8") as fh:
        entries = json.load(fh)

    by = {}
    for e in entries:
        by[basename(e["path"])] = e

    out = {
        "tool": "PH-SEC-WO-007 symbol_presence_authoritative.py",
        "supersedes": "first-pass table (invalid: st_shndx offset defect and "
                      "unsuffixed pcre2 symbol query)",
        "parser": "pure-python ELF64 .dynsym reader (analysis/elf_dynsym.py)",
        "stripping_notice": {
            lib: {
                "dynsym_entries": e["dynsym_count"],
                "symtab_present": e["symtab_present"],
                "meaning": "stripped: .dynsym only. A miss proves absence solely "
                           "for symbols that would have been exported.",
            }
            for lib, e in sorted(by.items())
        },
        "parser_selftest": {},
        "cves": {},
    }

    # ---- parser self-test: control symbols must be visible ----
    for lib, spec in sorted(CONTROL.items()):
        e = by.get(lib)
        if e is None:
            out["parser_selftest"][lib] = {"result": "ARTIFACT_NOT_EXTRACTED"}
            continue
        defined = {s["name"] for s in e["symbols"] if s["defined"]}
        res = {}
        ok = True
        for s in spec["must_be_present"]:
            hit = s in defined
            res[s] = hit
            ok = ok and hit
        out["parser_selftest"][lib] = {
            "control_symbols": res,
            "result": "PASS" if ok else "FAIL",
            "why": spec["why"],
        }

    # ---- per-CVE presence ----
    for cve, spec in sorted(EXPECT.items()):
        lib = spec["lib"]
        e = by.get(lib)
        rec = {
            "library": lib,
            "sink_symbols": spec["sink"],
            "absence_is_proof": spec["absence_is_proof"],
            "method_caveat": spec["note"],
        }
        if e is None:
            rec["result"] = "ARTIFACT_NOT_AVAILABLE"
            out["cves"][cve] = rec
            continue
        defined = {s["name"] for s in e["symbols"] if s["defined"]}
        hits = {s: (s in defined) for s in spec["sink"]}
        rec["sink_symbol_hits"] = hits
        present = [s for s, h in hits.items() if h]
        rec["sink_present"] = bool(present)
        rec["sink_present_names"] = present
        if present and spec["absence_is_proof"]:
            rec["result"] = "VULNERABLE_SYMBOL_PRESENT"
        elif present:
            rec["result"] = "SYMBOL_PRESENT_BUT_NOT_DISPOSITIVE"
        else:
            rec["result"] = ("VULNERABLE_SYMBOL_ABSENT"
                             if spec["absence_is_proof"]
                             else "NOT_DISPOSITIVE_BY_SYMBOLS")
        out["cves"][cve] = rec

    json.dump(out, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())