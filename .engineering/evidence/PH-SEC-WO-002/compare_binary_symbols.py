import json,re,pathlib
base=pathlib.Path('.engineering/evidence/PH-SEC-WO-002')
raw=(base/'gosu-go-tool-nm.txt').read_text(encoding='utf-8').splitlines()
names=set()
for line in raw:
    m=re.match(r'^\s*[0-9a-fA-F]+\s+[A-Za-z]\s+(.+)$', line)
    if m: names.add(m.group(1).strip())
manifest=json.loads((base/'go-vulndb-index.json').read_text(encoding='utf-8-sig'))
rows=[]
summary=[]
for entry in manifest:
    rec=json.loads((base/'go-vulndb'/f"{entry['goId']}.json").read_text(encoding='utf-8-sig'))
    checked=[]
    for affected in rec.get('affected',[]):
      for imp in affected.get('ecosystem_specific',{}).get('imports',[]):
        pkg=imp['path']
        for sym in imp.get('symbols',[]):
          candidates={f'{pkg}.{sym}'}
          if '.' in sym:
            recv,method=sym.rsplit('.',1)
            candidates.add(f'{pkg}.(*{recv}).{method}')
            candidates.add(f'{pkg}.({recv}).{method}')
          found=sorted(n for n in names if any(n==c or n.startswith(c+'.abi0') or n.startswith(c+'.func') for c in candidates))
          checked.append({'cve':entry['cve'],'goId':entry['goId'],'package':pkg,'symbol':sym,'candidates':sorted(candidates),'binarySymbolPresent':bool(found),'matches':found})
    present=[r for r in checked if r['binarySymbolPresent']]
    rows.extend(checked)
    summary.append({'cve':entry['cve'],'goId':entry['goId'],'symbolsChecked':len(checked),'symbolsPresent':len(present),'allVulnerableSymbolsAbsent':bool(checked) and not present,'presentSymbols':[f"{r['package']}.{r['symbol']} => {','.join(r['matches'])}" for r in present]})
(base/'binary-symbol-comparison.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
(base/'binary-symbol-cve-summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(f"nm_lines={len(raw)} names={len(names)} checked={len(rows)} present={sum(r['binarySymbolPresent'] for r in rows)} cves={len(summary)} all_absent={sum(r['allVulnerableSymbolsAbsent'] for r in summary)}")
for r in summary: print(f"{r['cve']} {r['goId']} checked={r['symbolsChecked']} present={r['symbolsPresent']} all_absent={r['allVulnerableSymbolsAbsent']}")
