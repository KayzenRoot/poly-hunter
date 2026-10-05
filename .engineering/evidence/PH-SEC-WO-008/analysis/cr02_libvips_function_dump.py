#!/usr/bin/env python3
"""CR-02 (deep): dump the full enclosing function of the libvips aligned-new
call and locate callers, to trace R12 (the size argument) to its origin."""
import struct

from capstone import Cs, CS_ARCH_X86, CS_MODE_64

PATH = ".engineering/evidence/PH-SEC-WO-008/receipts/extracted/libvips-cpp.so.8.18.7"
d = open(PATH, "rb").read()
e_shoff = struct.unpack_from("<Q", d, 0x28)[0]
e_shentsize = struct.unpack_from("<H", d, 0x3A)[0]
e_shnum = struct.unpack_from("<H", d, 0x3C)[0]
e_shstrndx = struct.unpack_from("<H", d, 0x3E)[0]


def sh(i):
    o = e_shoff + i * e_shentsize
    keys = ("name", "typ", "flags", "addr", "off", "size", "link", "info", "align", "entsize")
    return dict(zip(keys, struct.unpack_from("<IIQQQQIIQQ", d, o)))


shstr = sh(e_shstrndx)


def sname(s, tab):
    o = tab["off"] + s["name"]
    e = d.index(b"\x00", o)
    return d[o:e].decode()


secs = {sname(sh(i), shstr): sh(i) for i in range(e_shnum)}
text = secs[".text"]
md = Cs(CS_ARCH_X86, CS_MODE_64)

FN_START, FN_END = 0x403780, 0x403b95
off = text["off"] + (FN_START - text["addr"])
code = d[off: off + (FN_END - FN_START)]
insns = list(md.disasm(code, FN_START))
print(f"=== full function {FN_START:#x}..{FN_END:#x} ({len(insns)} instructions) ===")
for i in insns:
    mark = "  <<< CALL aligned new[]" if i.mnemonic == "call" and i.op_str == "0x1f20" else ""
    print(f"{i.address:#x}: {i.mnemonic:<8} {i.op_str}{mark}")

# find first writes to r12 within the function
print("\n=== writes to r12 inside the function ===")
for i in insns:
    ops = i.op_str
    if i.mnemonic in ("mov", "lea", "pop", "movzx", "movsxd") and ops.split(",")[0].strip() == "r12":
        print(f"{i.address:#x}: {i.mnemonic} {ops}")

# find callers: search .text for `call` (e8 rel32) or `jmp` that targets FN_START
print("\n=== direct callers of the function (e8 rel32 -> FN_START) ===")
td = d[text["off"]: text["off"] + text["size"]]
callers = []
j = 0
while True:
    j = td.find(b"\xe8", j)
    if j < 0:
        break
    if j + 5 <= len(td):
        rel = struct.unpack_from("<i", td, j + 1)[0]
        v = text["addr"] + j
        if v + 5 + rel == FN_START:
            callers.append(v)
    j += 1
print([hex(c) for c in callers])

import json

with open(
    ".engineering/evidence/PH-SEC-WO-008/receipts/cr02-libvips-function-dump.txt", "w"
) as fp:
    fp.write(f"function {FN_START:#x}..{FN_END:#x}\n")
    for i in insns:
        mark = "  <<< CALL aligned new[]" if i.mnemonic == "call" and i.op_str == "0x1f20" else ""
        fp.write(f"{i.address:#x}: {i.mnemonic:<8} {i.op_str}{mark}\n")
    fp.write(f"\ndirect callers: {[hex(c) for c in callers]}\n")