import datetime, hashlib
from pathlib import Path
root=Path('.engineering/evidence')
receipt=root/'PH-SEC-WO-004'
index=receipt/'receipt-sha256.txt'
outputs=[root/'PH-SEC-WO-004-DEV-GO-VEX.json',root/'PH-SEC-WO-004-DEV-GO-VEX.md',root/'PH-SEC-WO-004-EVIDENCE.md']
files=set(outputs)
files.update(p for p in receipt.rglob('*') if p.is_file() and p!=index)
lines=['PH-SEC-WO-004 SHA-256 evidence receipt index',f'Generated UTC: {datetime.datetime.now(datetime.timezone.utc).isoformat()}',f'Coverage: three PH-SEC-WO-004 root deliverables and every receipt under {receipt.as_posix()}',f'Files indexed: {len(files)}','The index excludes itself to avoid a self-referential digest.']
for p in sorted(files,key=lambda x:x.as_posix().casefold()):
    b=p.read_bytes(); lines.append(f'{hashlib.sha256(b).hexdigest()}  {p.name if p.parent==root else p.as_posix().removeprefix(root.as_posix()+"/")}  ({len(b)} bytes)')
index.write_bytes(('\n'.join(lines)+'\n').encode('utf-8'))
print('\n'.join(lines[:6])); print('...'); print(lines[-1])
