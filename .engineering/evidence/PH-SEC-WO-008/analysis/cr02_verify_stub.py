#!/usr/bin/env python3
"""CR-02 (verification): rigorously verify the PLT stub 0x1f20 maps to
_ZnamSt11align_val_t, and report the exact .rela.plt relocation backing it.
No heuristics: dump the bytes and print the GOT slot and reloc symbol index."""
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
ds, dst = secs[".dynsym"], secs[".dynstr"]


def sym(idx):
    o = ds["off"] + idx * ds["entsize"]
    st_name, _, _, st_shndx, st_value, _ = struct.unpack_from("<IBBHQQ", d, o)
    no = dst["off"] + st_name
    e = d.index(b"\x00", no)
    return d[no:e].decode(errors="replace"), st_shndx


# locate the section containing vaddr 0x1f20
for name, s in secs.items():
    if s["typ"] != 1 and not name.startswith(".plt"):
        continue
    if s["addr"] <= 0x1f20 < s["addr"] + s["size"]:
        print(f"0x1f20 is in section {name} (addr={s['addr']:#x} size={s['size']:#x})")
        off = s["off"] + (0x1f20 - s["addr"])
        print("bytes:", " ".join(f"{b:02x}" for b in d[off: off + 16]))

# decode the ff25 jmp at the stub and compute the GOT slot.
# Classic .plt entry layout: `ff 25 disp32` (jmp *GOT) ; `68 idx` ; `e9 plt0`.
s = secs[".plt.sec"] if ".plt.sec" in secs else secs[".plt"]
off = s["off"] + (0x1f20 - s["addr"])
b = d[off: off + 16]
assert b[:2] == b"\xff\x25", b[:2]
disp = struct.unpack_from("<i", b, 2)[0]
got = 0x1f20 + 6 + disp
print(f"stub 0x1f20: {b[:2].hex()} disp={disp:#x} -> GOT {got:#x}")
if b[6] == 0x68:
    plt_index = struct.unpack_from("<I", b, 7)[0]
    print(f"  push reloc index {plt_index}")

# map GOT -> reloc symbol
for name in (".rela.plt", ".rela.dyn"):
    rs = secs.get(name)
    if not rs:
        continue
    for j in range(rs["size"] // 24):
        o = rs["off"] + j * 24
        r_offset, r_info, addend = struct.unpack_from("<QQq", d, o)
        if r_offset == got:
            idx = r_info >> 32
            nm, shndx = sym(idx)
            print(f"{name}: reloc for GOT {got:#x} -> dynsym[{idx}] = {nm} (shndx={shndx}) type={r_info & 0xffffffff}")

# count all call sites to that stub
print("\nall e8 call sites targeting 0x1f20 in .text:")
text = secs[".text"]
td = d[text["off"]: text["off"] + text["size"]]
sites = []
j = 0
while True:
    j = td.find(b"\xe8", j)
    if j < 0:
        break
    if j + 5 <= len(td):
        rel = struct.unpack_from("<i", td, j + 1)[0]
        v = text["addr"] + j
        if v + 5 + rel == 0x1f20:
            sites.append(v)
    j += 1
print([hex(x) for x in sites])
print("total:", len(sites))