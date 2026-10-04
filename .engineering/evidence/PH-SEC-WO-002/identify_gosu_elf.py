import pathlib,hashlib
p=pathlib.Path(r"C:\Users\csn19\AppData\Local\Temp\ph-sec-wo002-analysis\gosu")
b=p.read_bytes()
assert b[:4]==b'\x7fELF'
elf_class={1:'ELF32',2:'ELF64'}.get(b[4],f'unknown({b[4]})')
endianness={1:'little',2:'big'}.get(b[5],f'unknown({b[5]})')
order='little' if b[5]==1 else 'big'
machine=int.from_bytes(b[18:20],order)
print(f"path=/usr/local/bin/gosu\nmagic={b[:4].hex()}\nclass={elf_class}\nendianness={endianness}\nmachine={machine}\narchitecture={'x86_64' if machine==62 else 'unknown'}\nbytes={len(b)}\nsha256={hashlib.sha256(b).hexdigest()}")
