#!/usr/bin/env python3
"""PH-SEC-WO-007 - pure-Python ELF dynamic symbol reader.

Purpose: prove presence/absence of specific exported symbols in the exact
shared libraries shipped in polyhunter-dev:local@sha256:ed140fd5...

This tool exists because the target image has no binutils (nm/readelf), so the
only offline, non-invasive way to read the exported symbol table of a specific
library revision is to parse the ELF container directly.

No exploit, no execution of image code, no network. Read-only file parsing.
"""

import json
import struct
import sys

SHT_DYNSYM = 11
DT_STRTAB = 5
DT_SYMTAB = 6
DT_HASH = 4
DT_GNU_HASH = 0x6FFFFEF5

STB_LOCAL, STB_GLOBAL, STB_WEAK = 0, 1, 2
STT_FUNC, STT_OBJECT, STT_NOTYPE = 2, 1, 0

STV_DEFAULT, STV_INTERNAL, STV_HIDDEN, STV_PROTECTED = 0, 1, 2, 3


def _read_cstr(buf, off):
    if off < 0 or off >= len(buf):
        return ""
    end = buf.find(b"\x00", off)
    if end < 0:
        return ""
    return buf[off:end].decode("utf-8", "replace")


def parse_elf_dynsym(path):
    with open(path, "rb") as fh:
        data = fh.read()

    if data[:4] != b"\x7fELF":
        raise ValueError(f"{path}: not an ELF file")
    ei_class = data[4]
    if ei_class != 2:
        raise ValueError(f"{path}: not ELFCLASS64")
    ei_data = data[5]
    endian = "<" if ei_data == 1 else ">"

    e_type, e_machine = struct.unpack_from(endian + "HH", data, 16)
    e_phoff, e_shoff = struct.unpack_from(endian + "QQ", data, 32)
    e_phentsize, e_phnum = struct.unpack_from(endian + "HH", data, 54)
    e_shentsize, e_shnum, e_shstrndx = struct.unpack_from(endian + "HHH", data, 58)

    machine_names = {0x3E: "x86-64", 0xB7: "aarch64"}
    out = {
        "path": path,
        "size_bytes": len(data),
        "elf_type": {2: "ET_EXEC", 3: "ET_DYN"}.get(e_type, e_type),
        "machine": machine_names.get(e_machine, hex(e_machine)),
        "sections": [],
        "symbols": [],
        "dynsym_count": 0,
        "symtab_count": 0,
        "symtab_present": False,
    }

    # ---- section headers (for locating .dynsym/.dynstr precisely) ----
    sections = []
    for i in range(e_shnum):
        off = e_shoff + i * e_shentsize
        # ELF64_Shdr: name@0 type@4 flags@8 addr@16 offset@24 size@32
        #              link@40 info@44 addralign@48 entsize@56
        sh_name, sh_type = struct.unpack_from(endian + "II", data, off)
        sh_flags, sh_addr, sh_offset = struct.unpack_from(endian + "QQQ", data, off + 8)
        sh_size = struct.unpack_from(endian + "Q", data, off + 32)[0]
        sh_link = struct.unpack_from(endian + "I", data, off + 40)[0]
        sh_entsize = struct.unpack_from(endian + "Q", data, off + 56)[0]
        sections.append({
            "idx": i, "name_off": sh_name, "type": sh_type, "offset": sh_offset,
            "size": sh_size, "link": sh_link, "entsize": sh_entsize,
        })
    # section name string table
    if e_shstrndx < len(sections):
        sst = sections[e_shstrndx]
        shstrtab = data[sst["offset"]: sst["offset"] + sst["size"]]
        for s in sections:
            s["name"] = _read_cstr(shstrtab, s["name_off"])
            out["sections"].append({"name": s["name"], "type": s["type"],
                                    "size": s["size"], "offset": s["offset"]})

    # ---- preferred path: explicit .dynsym section ----
    # NOTE: .dynsym only lists EXPORTED symbols. Binaries built with
    # -fvisibility=hidden (notably perl) keep internal functions out of it, so a
    # .dynsym miss is NOT proof of absence. .symtab (when not stripped) is the
    # complete symbol table and is parsed too, so absence can be judged against
    # the strongest table the artifact actually retains.
    SHT_SYMTAB = 2
    tables = []
    for sec in sections:
        if sec["type"] in (SHT_DYNSYM, SHT_SYMTAB):
            st_sec = sections[sec["link"]] if sec["link"] < len(sections) else None
            if st_sec is None:
                continue
            st = data[st_sec["offset"]: st_sec["offset"] + st_sec["size"]]
            sym = data[sec["offset"]: sec["offset"] + sec["size"]]
            kind = "dynsym" if sec["type"] == SHT_DYNSYM else "symtab"
            tables.append((kind, sym, st))

    if not tables:
        # fallback: program headers (PT_DYNAMIC)
        for i in range(e_phnum):
            off = e_phoff + i * e_phentsize
            p_type = struct.unpack_from(endian + "I", data, off)[0]
            if p_type != 2:  # PT_DYNAMIC
                continue
            p_offset, p_vaddr = struct.unpack_from(endian + "QQ", data, off + 8)
            p_filesz = struct.unpack_from(endian + "Q", data, off + 32)[0]
            dyn = data[p_offset: p_offset + p_filesz]
            strtab_vaddr = symtab_vaddr = None
            for j in range(0, len(dyn) - 15, 16):
                tag, val = struct.unpack_from(endian + "qQ", dyn, j)
                if tag == DT_STRTAB: strtab_vaddr = val
                elif tag == DT_SYMTAB: symtab_vaddr = val
                elif tag == 0: break
            for ph in range(e_phnum):
                poff = e_phoff + ph * e_phentsize
                p_type2 = struct.unpack_from(endian + "I", data, poff)[0]
                if p_type2 != 1:  # PT_LOAD
                    continue
                p_off2 = struct.unpack_from(endian + "Q", data, poff + 8)[0]
                p_vaddr2 = struct.unpack_from(endian + "Q", data, poff + 16)[0]
                p_filesz2 = struct.unpack_from(endian + "Q", data, poff + 32)[0]
                if p_vaddr2 <= strtab_vaddr < p_vaddr2 + p_filesz2:
                    strtab = data[p_off2 + (strtab_vaddr - p_vaddr2):][:1 << 20]
                if p_vaddr2 <= symtab_vaddr < p_vaddr2 + p_filesz2:
                    start = p_off2 + (symtab_vaddr - p_vaddr2)
                    symtab = data[start: start + (1 << 22)]
            break
        if symtab is None or strtab is None:
            out["error"] = "could not locate dynsym/dynstr"
            return out
        tables.append(("dynsym", symtab, strtab))

    bind_names = {STB_LOCAL: "LOCAL", STB_GLOBAL: "GLOBAL", STB_WEAK: "WEAK"}
    type_names = {STT_NOTYPE: "NOTYPE", STT_OBJECT: "OBJECT", STT_FUNC: "FUNC"}
    vis_names = {STV_DEFAULT: "DEFAULT", STV_INTERNAL: "INTERNAL",
                 STV_HIDDEN: "HIDDEN", STV_PROTECTED: "PROTECTED"}

    entsize = 24  # ELF64_Sym
    for kind, symtab, strtab in tables:
        if kind == "dynsym":
            out["dynsym_count"] = len(symtab) // entsize
        else:
            out["symtab_count"] = len(symtab) // entsize
            out["symtab_present"] = True
        count = len(symtab) // entsize
        for i in range(count):
            base = i * entsize
            # ELF64_Sym: st_name@0(4) st_info@4(1) st_other@5(1)
            #            st_shndx@6(2) st_value@8(8) st_size@16(8)
            st_name, st_info, st_other = struct.unpack_from(endian + "IBB", symtab, base)
            st_shndx = struct.unpack_from(endian + "H", symtab, base + 6)[0]
            st_value = struct.unpack_from(endian + "Q", symtab, base + 8)[0]
            st_size = struct.unpack_from(endian + "Q", symtab, base + 16)[0]
            name = _read_cstr(strtab, st_name)
            if not name:
                continue
            out["symbols"].append({
                "table": kind,
                "name": name,
                "bind": bind_names.get(st_info >> 4, str(st_info >> 4)),
                "type": type_names.get(st_info & 0xF, str(st_info & 0xF)),
                "vis": vis_names.get(st_other & 0x3, str(st_other & 0x3)),
                "defined": st_shndx != 0,  # UND == imported, not provided
                "value": st_value,
                "size": st_size,
            })
    out["symbol_count"] = len(out["symbols"])
    return out


def main():
    if len(sys.argv) < 2:
        print("usage: elf_dynsym.py <lib> [<lib>...] [--out FILE]", file=sys.stderr)
        return 2
    args = sys.argv[1:]
    outfile = None
    if "--out" in args:
        i = args.index("--out")
        outfile = args[i + 1]
        args = args[:i] + args[i + 2:]
    results = [parse_elf_dynsym(p) for p in args]
    text = json.dumps(results, indent=2)
    if outfile:
        with open(outfile, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())