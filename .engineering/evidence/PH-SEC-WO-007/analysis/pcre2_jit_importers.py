#!/usr/bin/env python3
"""PH-SEC-WO-007 / which image binaries IMPORT the pcre2 JIT entry points.

An ELF that dynamically links libpcre2 but never imports pcre2_jit_* cannot
reach the JIT code path described by CVE-2026-103111, no matter who controls
the pattern. This resolves that question per binary instead of by assumption.

Reads ELF files extracted unmodified from the exact image. Executes nothing.
"""

import json
import os
import sys


def basename(p):
    return os.path.basename(p.replace("\\", "/"))


def main():
    if len(sys.argv) < 3:
        print("usage: pcre2_jit_importers.py <dynsym.json> <out.json> [label...]",
              file=sys.stderr)
        return 2
    src, out = sys.argv[1], sys.argv[2]
    labels = sys.argv[3:]

    with open(src, encoding="utf-8") as fh:
        entries = json.load(fh)

    jit_prefixes = ("pcre2_jit_compile", "pcre2_jit_match", "pcre2_jit_stack")

    report = {
        "question": "Does any ELF in the exact image import pcre2 JIT entry points?",
        "cve": "CVE-2026-103111",
        "advisory_condition": "out-of-bounds write requires an attacker-controlled "
                              "regular expression AND certain pcre2 JIT API usage",
        "libpcre2_exports_jit": None,
        "binaries": {},
        "summary": {},
    }

    for e in entries:
        name = basename(e["path"])
        undef = {s["name"] for s in e.get("symbols", []) if not s.get("defined")}
        defined = {s["name"] for s in e.get("symbols", []) if s.get("defined")}
        jit_imports = sorted(n for n in undef if n.startswith(jit_prefixes))
        pcre_imports = sorted(n for n in undef if n.startswith("pcre2_"))
        jit_defines = sorted(n for n in defined if n.startswith(jit_prefixes))
        report["binaries"][name] = {
            "imports_pcre2_total": len(pcre_imports),
            "imports_pcre2": pcre_imports,
            "imports_pcre2_jit": jit_imports,
            "exports_pcre2_jit": jit_defines,
            "verdict": "JIT_REACHABLE" if jit_imports else "no_pcre2_jit_import",
        }
        if jit_defines:
            report["libpcre2_exports_jit"] = True

    total = len(report["binaries"])
    reachable = [n for n, v in report["binaries"].items()
                 if v["verdict"] == "JIT_REACHABLE"]
    report["summary"] = {
        "binaries_examined": total,
        "binaries_importing_pcre2_jit": len(reachable),
        "binaries_importing_pcre2_jit_names": sorted(reachable),
    }

    with open(out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
        fh.write("\n")
    print(json.dumps(report["summary"], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())