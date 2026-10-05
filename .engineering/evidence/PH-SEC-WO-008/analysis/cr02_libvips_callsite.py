#!/usr/bin/env python3
"""CR-02: correct SysV AMD64 decoding of the libvips-cpp aligned-new[] call site.

ABI reminder for  operator new[](std::size_t size, std::align_val_t alignment):
    RDI = size        (first integer argument)
    RSI = alignment   (second integer argument)

This script locates the call to _ZnamSt11align_val_t in the exact shipped
libvips-cpp.so.8.18.7, disassembles a window around it with capstone, and
traces the registers feeding RDI/RSI backward to their immediate sources.
"""
import json
import struct
import sys

try:
    from capstone import Cs, CS_ARCH_X86, CS_MODE_64
except ImportError:
    print("capstone not available", file=sys.stderr)
    sys.exit(2)

PATH = ".engineering/evidence/PH-SEC-WO-008/receipts/extracted/libvips-cpp.so.8.18.7"
TARGET = "_ZnamSt11align_val_t"

d = open(PATH, "rb").read()

# --- ELF section table -------------------------------------------------------
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

# --- locate the import and its PLT slot -------------------------------------
ds, dst = secs[".dynsym"], secs[".dynstr"]
undef = {}
n = ds["size"] // ds["entsize"]
for i in range(n):
    o = ds["off"] + i * ds["entsize"]
    st_name, _, _, st_shndx, _, _ = struct.unpack_from("<IBBHQQ", d, o)
    if st_shndx == 0:
        no = dst["off"] + st_name
        e = d.index(b"\x00", no)
        if d[no:e].decode(errors="replace") == TARGET:
            undef[i] = TARGET

gots = []
rp = secs[".rela.plt"]
for j in range(rp["size"] // 24):
    o = rp["off"] + j * 24
    r_offset, r_info, _ = struct.unpack_from("<QQq", d, o)
    if (r_info >> 32) in undef:
        gots.append(r_offset)

plt = secs.get(".plt") or secs.get(".plt.sec")
plt_data = d[plt["off"]: plt["off"] + plt["size"]]
targets = set()
j = 0
while True:
    k = plt_data.find(b"\xff\x25", j)
    if k < 0:
        break
    disp = struct.unpack_from("<i", plt_data, k + 2)[0]
    if plt["addr"] + k + 6 + disp in gots:
        targets.add(plt["addr"] + (k & ~0xF))
    j = k + 1

# --- find call sites ---------------------------------------------------------
text = secs[".text"]
text_data = d[text["off"]: text["off"] + text["size"]]
call_sites = []
j = 0
while True:
    j = text_data.find(b"\xe8", j)
    if j < 0:
        break
    if j + 5 <= len(text_data):
        rel = struct.unpack_from("<i", text_data, j + 1)[0]
        vaddr = text["addr"] + j
        if vaddr + 5 + rel in targets:
            call_sites.append(vaddr)
    j += 1

print(f"call sites to {TARGET}: {[hex(v) for v in call_sites]}")

# --- disassemble a window before each call site -----------------------------
md = Cs(CS_ARCH_X86, CS_MODE_64)
result = {"binary": PATH, "target_symbol": TARGET, "call_sites": []}

for site in call_sites:
    # 160 bytes before, 16 after
    start = site - 160
    off = text["off"] + (start - text["addr"])
    code = d[off: off + 176]
    insns = list(md.disasm(code, start))
    window = [
        f"{i.address:#x}: {i.mnemonic:<8} {i.op_str}"
        for i in insns
        if start <= i.address <= site + 8
    ]
    print(f"\n=== window around call site {site:#x} ===")
    for line in window:
        print(line)
    result["call_sites"].append({"vaddr": hex(site), "window": window})

with open(
    ".engineering/evidence/PH-SEC-WO-008/receipts/cr02-libvips-aligned-new-disassembly.json", "w"
) as fp:
    json.dump(result, fp, indent=1)
print("\nreceipt written")