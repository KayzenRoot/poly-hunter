#!/usr/bin/env python3
"""CR-02 (caller trace): disassemble the caller of the ICC-profile function to
establish where the length argument (rsi -> r12 -> size in RDI) comes from."""
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

# The ICC-profile function is 0x403780. Its single caller is 0x3ef350.
# Disassemble a generous window before the call at 0x3ef350.
CALLER = 0x3ef350
start = CALLER - 260
off = text["off"] + (start - text["addr"])
code = d[off: off + 300]
print(f"=== caller window around call to 0x403780 at {CALLER:#x} ===")
lines = []
for i in md.disasm(code, start):
    mark = "  <<< call ICC_profile_fn" if (i.mnemonic == "call" and i.op_str == "0x403780") else ""
    line = f"{i.address:#x}: {i.mnemonic:<8} {i.op_str}{mark}"
    lines.append(line)
    print(line)

# Also dump the beginning of the caller function: find function start via eh_frame
# (reuse the eh_frame parser from the other script, inline)
def parse_eh_frame():
    s = secs.get(".eh_frame")
    base = s["addr"]
    data = d[s["off"]: s["off"] + s["size"]]
    fdes = []
    p = 0
    while p + 4 <= len(data):
        length = struct.unpack_from("<I", data, p)[0]
        if length in (0, 0xFFFFFFFF):
            break
        cie_id = struct.unpack_from("<I", data, p + 4)[0]
        if cie_id != 0:
            try:
                pc_begin = struct.unpack_from("<i", data, p + 8)[0]
                pc_range = struct.unpack_from("<I", data, p + 12)[0]
                fdes.append((base + p + 8 + pc_begin, pc_range))
            except struct.error:
                pass
        p += 4 + length
    return fdes


def enclosing(v):
    best = None
    for s0, sz0 in parse_eh_frame():
        if s0 <= v < s0 + sz0 and (best is None or s0 > best[0]):
            best = (s0, sz0)
    return best


fn = enclosing(CALLER)
print(f"\ncaller enclosing function: {fn[0]:#x} size {fn[1]}" if fn else "no fn")
if fn:
    fs, fz = fn
    o = text["off"] + (fs - text["addr"])
    c = d[o: o + fz]
    insns = list(md.disasm(c, fs))
    # print instructions that write rsi/rdi/rax near the call
    print("\n=== instructions defining rsi/rdi/rax in the caller (last 20 before call) ===")
    defs = []
    for i in insns:
        if i.address >= CALLER:
            continue
        ops = i.op_str
        dest = ops.split(",")[0].strip() if "," in ops else ops.strip()
        if dest in ("rsi", "esi", "rdi", "edi", "rax", "eax", "r12") and i.mnemonic in (
            "mov", "lea", "movzx", "movsxd", "pop", "call", "add", "sub",
        ):
            defs.append(f"{i.address:#x}: {i.mnemonic:<8} {ops}")
    for l in defs[-25:]:
        print(l)

with open(
    ".engineering/evidence/PH-SEC-WO-008/receipts/cr02-libvips-caller-trace.txt", "w"
) as fp:
    fp.write(f"caller of ICC-profile fn at {CALLER:#x}\n")
    for l in lines:
        fp.write(l + "\n")
    fp.write(f"\nenclosing function: {fn}\n")
    for l in defs[-25:]:
        fp.write(l + "\n")