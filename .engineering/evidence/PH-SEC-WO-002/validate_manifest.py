import pathlib,hashlib
R=pathlib.Path('.engineering/evidence/PH-SEC-WO-002')
E=pathlib.Path('.engineering/evidence')
manifest=R/'receipts-sha256.txt'
lines=manifest.read_text(encoding='utf-8-sig').splitlines()
entries=[line for line in lines if len(line)>80 and line[64:66]=='  ']
expected=[p for p in [E/'PH-SEC-WO-002-GOSU-VEX.json',E/'PH-SEC-WO-002-GOSU-VEX.md',E/'PH-SEC-WO-002-EVIDENCE.md',*R.rglob('*')] if p.is_file() and p!=manifest]
assert len(entries)==len(expected),(len(entries),len(expected))
bad=[]
for line in entries:
    digest,path_size=line.split('  ',1)
    path=path_size.rsplit('  (',1)[0]
    if hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()!=digest:
        bad.append(path)
assert not bad,bad
print(f'PASS receipt manifest: {len(entries)} files; no omissions; all hashes match')
