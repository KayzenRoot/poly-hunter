#!/usr/bin/env python3
"""CR-04 PATH A: identify the libvips function containing the aligned-new call.

Reads the rip-relative string references inside the function 0x403780 so the
enclosing source can be identified from its format strings.
"""
import struct

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


def read_vaddr(vaddr, maxlen=200):
    for name, s in secs.items():
        if s["typ"] == 8:
            continue
        if s["addr"] <= vaddr < s["addr"] + s["size"]:
            o = s["off"] + (vaddr - s["addr"])
            e = d.find(b"\x00", o, o + maxlen)
            return name, d[o:e].decode(errors="replace")
    return None, None


# rip-relative lea targets inside the function (computed from disassembly)
for site, disp, tag in (
    (0x4039db, 0x9F9F7E, "val-effect branch A"),
    (0x403b09, 0x9F9E10, "val-effect branch B"),
    (0x403b2b, 0x9F9DAE, "val-effect branch C"),
):
    insn_len = 7
    target = site + insn_len + disp
    sec, s = read_vaddr(target)
    print(f"{tag}: lea at {site:#x} -> vaddr {target:#x} ({sec}) = {s!r}")

# also scan the whole function for any lea rip-relative and dump those strings
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

text = secs[".text"]
md = Cs(CS_ARCH_X86, CS_MODE_64)
off = text["off"] + (0x403780 - text["addr"])
print("\n=== all rip-relative lea/mov string references in the function ===")
for i in md.disasm(d[off: off + 1045], 0x403780):
    if ("rip" in i.op_str) and i.mnemonic in ("lea", "mov", "movabs"):
        # parse [rip + 0x...]
        import re
        m = re.search(r"rip \+ (0x[0-9a-f]+)", i.op_str)
        if m:
            disp = int(m.group(1), 16)
            target = i.address + i.size + disp
            sec, s = read_vaddr(target)
            if s is not None:
                print(f"{i.address:#x}: {i.mnemonic} {i.op_str} -> {target:#x} ({sec}) = {s!r}")