#!/usr/bin/env python3
"""CR-02 (rigorous): resolve the PLT target of the libvips aligned-new call and
trace R12/RDI backward to the origin of the size argument.

Steps:
 1. Parse .rela.plt -> symbol name for each GOT slot; parse .plt/.plt.sec to map
    each stub vaddr to its symbol (verified, not assumed).
 2. Parse .eh_frame to get function ranges (stripped binary has no .symtab).
 3. Find the call to _ZnamSt11align_val_t, print its verified PLT target.
 4. Disassemble the whole enclosing function and report every write to R12 and
    RDI to establish the size provenance.
"""
import json
import struct
import sys

from capstone import Cs, CS_ARCH_X86, CS_MODE_64

PATH = ".engineering/evidence/PH-SEC-WO-008/receipts/extracted/libvips-cpp.so.8.18.7"
TARGET = "_ZnamSt11align_val_t"

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

# symbol index -> name; and index -> (name, is_undef)
sym_names = {}
n = ds["size"] // ds["entsize"]
for i in range(n):
    o = ds["off"] + i * ds["entsize"]
    st_name, _, _, st_shndx, _, _ = struct.unpack_from("<IBBHQQ", d, o)
    no = dst["off"] + st_name
    e = d.index(b"\x00", no)
    sym_names[i] = (d[no:e].decode(errors="replace"), st_shndx == 0)

# .rela.plt: r_offset -> symbol name
sym_of_got = {}
rp = secs[".rela.plt"]
for j in range(rp["size"] // 24):
    o = rp["off"] + j * 24
    r_offset, r_info, _ = struct.unpack_from("<QQq", d, o)
    sym_of_got[r_offset] = sym_names[r_info >> 32][0]

# Walk .plt and .plt.sec: each 16-byte entry begins with endbr64 (f3 0f 1e fa)
# then `ff 25 disp32` -> jmp [rip+disp] into GOT.
stub_to_sym = {}
for name in (".plt", ".plt.sec", ".plt.got"):
    s = secs.get(name)
    if not s:
        continue
    base, off, size = s["addr"], s["off"], s["size"]
    for k in range(0, size - 6):
        if d[off + k: off + k + 2] == b"\xff\x25":
            disp = struct.unpack_from("<i", d, off + k + 2)[0]
            got = base + k + 6 + disp
            entry_start = base + (k - 4 if k >= 4 and d[off + k - 4: off + k] == b"\xf3\x0f\x1e\xfa" else k)
            if got in sym_of_got:
                stub_to_sym[entry_start] = sym_of_got[got]

print("PLT stub for target:")
for addr, nm in sorted(stub_to_sym.items()):
    if nm == TARGET:
        print(f"  {addr:#x} -> {nm}")

# --- find call to the target stub in .text ----------------------------------
text = secs[".text"]
td = d[text["off"]: text["off"] + text["size"]]
target_stubs = {a for a, nm in stub_to_sym.items() if nm == TARGET}
sites = []
j = 0
while True:
    j = td.find(b"\xe8", j)
    if j < 0:
        break
    if j + 5 <= len(td):
        rel = struct.unpack_from("<i", td, j + 1)[0]
        v = text["addr"] + j
        if v + 5 + rel in target_stubs:
            sites.append((v, v + 5 + rel))
    j += 1
print(f"call sites (verified stub): {[(hex(a), hex(t)) for a, t in sites]}")

# --- .eh_frame function ranges ----------------------------------------------
def parse_eh_frame():
    s = secs.get(".eh_frame")
    if not s:
        return []
    base = s["addr"]
    data = d[s["off"]: s["off"] + s["size"]]
    fdes = []
    p = 0
    while p + 4 <= len(data):
        length = struct.unpack_from("<I", data, p)[0]
        if length == 0:
            break
        if length == 0xFFFFFFFF:
            break
        cie_id = struct.unpack_from("<I", data, p + 4)[0]
        if cie_id != 0:  # FDE (CIE id != 0)
            try:
                pc_begin = struct.unpack_from("<i", data, p + 8)[0]
                pc_range = struct.unpack_from("<I", data, p + 12)[0]
                fdes.append((base + p + 8 + pc_begin, pc_range))
            except struct.error:
                pass
        p += 4 + length
    return fdes


fdes = parse_eh_frame()
print(f"eh_frame FDE count: {len(fdes)}")


def enclosing(vaddr):
    best = None
    for start, size in fdes:
        if start <= vaddr < start + size:
            if best is None or start > best[0]:
                best = (start, size)
    return best


md = Cs(CS_ARCH_X86, CS_MODE_64)
report = {"binary": PATH, "target_symbol": TARGET, "call_analysis": []}

for site, stub in sites:
    fn = enclosing(site)
    entry = {"call_site": hex(site), "plt_stub": hex(stub)}
    if not fn:
        entry["enclosing_function"] = None
        report["call_analysis"].append(entry)
        continue
    start, size = fn
    entry["enclosing_function"] = {"vaddr": hex(start), "size": size}
    off = text["off"] + (start - text["addr"])
    code = d[off: off + size]
    writes_r12, writes_rdi, context = [], [], []
    for i in md.disasm(code, start):
        line = f"{i.address:#x}: {i.mnemonic:<8} {i.op_str}"
        if i.address <= site <= i.address + i.size:
            context.append(">>> " + line)
            continue
        if i.address < site:
            if ", r12" in i.op_str and (i.mnemonic in ("mov", "lea", "movzx", "movsxd", "pop") or i.mnemonic.startswith("mov")):
                writes_r12.append(line)
            if ", rdi" in i.op_str and i.mnemonic in ("mov", "lea", "pop") :
                writes_rdi.append(line)
    entry["last_writes_to_r12"] = writes_r12[-6:]
    entry["last_writes_to_rdi"] = writes_rdi[-6:]
    entry["call_context"] = context
    print(f"\n=== call site {hex(site)} in function {hex(start)} (+{size} bytes) ===")
    print("last writes to r12:")
    for l in writes_r12[-8:]:
        print("   ", l)
    print("last writes to rdi:")
    for l in writes_rdi[-8:]:
        print("   ", l)
    print("context:")
    for l in context:
        print("   ", l)
    report["call_analysis"].append(entry)

with open(
    ".engineering/evidence/PH-SEC-WO-008/receipts/cr02-libvips-r12-trace.json", "w"
) as fp:
    json.dump(report, fp, indent=1)
print("\nreceipt: cr02-libvips-r12-trace.json")