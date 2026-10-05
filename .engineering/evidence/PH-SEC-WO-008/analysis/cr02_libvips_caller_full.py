#!/usr/bin/env python3
"""CR-02 (final): full dump of the caller function 0x3ef120 and every jump
targeting the block that calls the ICC-profile function at 0x3ef350, then trace
the register setup for that call."""
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

FN, SZ = 0x3ef120, 1275
off = text["off"] + (FN - text["addr"])
insns = list(md.disasm(d[off: off + SZ], FN))

print(f"=== jumps/branches targeting 0x3ef350 (the call block) ===")
for i in insns:
    if i.mnemonic in ("jmp", "je", "jne", "jg", "jge", "jl", "jle", "ja", "jae", "jb", "jbe") and i.op_str == "0x3ef350":
        print(f"{i.address:#x}: {i.mnemonic} {i.op_str}")

# The call at 0x3ef350 is likely reached by falling through from a preceding
# basic block. Print all instructions between 0x3ef120 and 0x3ef355.
print("\n=== full function body ===")
for i in insns:
    if i.address > 0x3ef360:
        break
    mark = ""
    if i.mnemonic == "call" and i.op_str == "0x403780":
        mark = "   <<< call ICC_profile_fn (rdi=profile ptr, rsi=profile len)"
    print(f"{i.address:#x}: {i.mnemonic:<8} {i.op_str}{mark}")

with open(
    ".engineering/evidence/PH-SEC-WO-008/receipts/cr02-libvips-caller-full.txt", "w"
) as fp:
    fp.write(f"caller function {FN:#x}..{FN+SZ:#x}\n\n")
    for i in insns:
        mark = "   <<< call ICC_profile_fn" if (i.mnemonic == "call" and i.op_str == "0x403780") else ""
        fp.write(f"{i.address:#x}: {i.mnemonic:<8} {i.op_str}{mark}\n")