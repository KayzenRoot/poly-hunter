import json,pathlib
base=pathlib.Path('.engineering/evidence/PH-SEC-WO-002')
entries=json.loads((base/'go-vulndb-index.json').read_text(encoding='utf-8-sig'))
raw=(base/'govulncheck-binary-raw.txt').read_text(encoding='utf-8-sig')
symbol=raw.split('=== Symbol Results ===',1)[1].split('=== Package Results ===',1)[0]
package=raw.split('=== Package Results ===',1)[1].split('=== Module Results ===',1)[0]
module=raw.split('=== Module Results ===',1)[1]
rows=[]
for e in entries:
    goid=e['goId']
    rows.append({'cve':e['cve'],'goId':goid,'presentInRaw':goid in raw,'inSymbolResults':goid in symbol,'inPackageResults':goid in package,'inModuleResults':goid in module})
(base/'govulncheck-reconciliation.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
print(f"rows={len(rows)} raw={sum(r['presentInRaw'] for r in rows)} symbol={sum(r['inSymbolResults'] for r in rows)} package={sum(r['inPackageResults'] for r in rows)} module={sum(r['inModuleResults'] for r in rows)}")
for r in rows: print(f"{r['cve']} {r['goId']} raw={r['presentInRaw']} symbol={r['inSymbolResults']} package={r['inPackageResults']} module={r['inModuleResults']}")
