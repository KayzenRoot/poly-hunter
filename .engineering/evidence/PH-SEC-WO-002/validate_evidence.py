import json,re,pathlib,subprocess,hashlib
E=pathlib.Path('.engineering/evidence'); R=E/'PH-SEC-WO-002'; vex=json.loads((E/'PH-SEC-WO-002-GOSU-VEX.json').read_text(encoding='utf-8-sig'))
wo=pathlib.Path('.engineering/work-orders/PH-SEC-WO-002.md').read_text(encoding='utf-8-sig').split('## IN-SCOPE CVES',1)[1].split('## OUT OF SCOPE',1)[0]
expected=set(re.findall(r'CVE-\d{4}-\d+',wo)); found=[x['cve'] for x in vex['items']]
assert len(found)==23 and set(found)==expected and len(set(found))==23
required={'cve','severity','imageDigest','gosuSha256','goVersion','vulnerablePackages','vulnerableSymbols','actualInvocationPath','attackerControlledInput','prerequisites','status','justification','authoritativeRefs','evidenceRefs','expiry'}
for x in vex['items']:
 assert required<=x.keys(), (x['cve'],required-x.keys())
 assert x['status']=='NOT_AFFECTED' and x['proposedDisposition'] is True and x['justification']['code']=='vulnerable_code_not_present'
 assert x['independentAuditor']=='PENDING' and x['ownerApproval']=='PENDING' and x['executorSelfApproval'] is False
 assert x['symbolPresence']['present']==0 and x['symbolPresence']['checked']==len(x['vulnerableSymbols'])
 assert len(x['authoritativeRefs'])>0 and len(x['evidenceRefs'])>=7 and x['expiry']['expiresAt']
 for s in x['vulnerableSymbols']: assert s['binaryPresence']=='ABSENT' and not s['observedMatches']
summary=json.loads((R/'binary-symbol-cve-summary.json').read_text(encoding='utf-8-sig'))
assert len(summary)==23 and all(x['allVulnerableSymbolsAbsent'] for x in summary)
comp=json.loads((R/'binary-symbol-comparison.json').read_text(encoding='utf-8-sig')); assert len(comp)==249 and not any(x['binarySymbolPresent'] for x in comp)
gov=json.loads((R/'govulncheck-reconciliation.json').read_text(encoding='utf-8-sig')); assert len(gov)==23 and all(not x['inSymbolResults'] for x in gov)
assert sum(x['severity']=='HIGH' for x in vex['items'])==21 and sum(x['severity']=='CRITICAL' for x in vex['items'])==2
md=(E/'PH-SEC-WO-002-GOSU-VEX.md').read_text(encoding='utf-8-sig'); assert len(re.findall(r'^\| CVE-\d{4}-\d+',md,re.M))==23
vex['analysisTimestampUtc']; mpath=R/'receipts-sha256.txt'
status=subprocess.run(['git','status','--short'],capture_output=True,text=True,check=True).stdout.splitlines()
allowed=['.engineering/evidence/PH-SEC-WO-002/','.engineering/evidence/PH-SEC-WO-002-GOSU-VEX.json','.engineering/evidence/PH-SEC-WO-002-GOSU-VEX.md','.engineering/evidence/PH-SEC-WO-002-EVIDENCE.md']
paths=[line[3:] for line in status]
assert all(any(p.startswith(a) for a in allowed) for p in paths), paths
print(f'PASS exact Work Order CVE set: {len(found)}/23')
print(f'PASS severity reconciliation: HIGH=21 CRITICAL=2')
print(f'PASS per-CVE required fields/status/evidence/expiry: {len(found)}/23; all approval fields pending')
print(f'PASS advisory symbol matrix: checked={len(comp)} present=0 across 23 CVEs')
print(f'PASS govulncheck matrix: 23 raw advisories; 0 symbol results')
print('PASS Markdown CVE rows: ' + str(sum(line.startswith('| CVE-') for line in md.splitlines())))
print(f'PASS current git modifications limited to evidence paths: {len(paths)} paths')
