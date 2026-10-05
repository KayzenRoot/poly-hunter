import collections, datetime, hashlib, json, re, sys
from pathlib import Path
ROOT=Path('.')
OUT=ROOT/'.engineering/evidence/PH-SEC-WO-004'
V=json.loads((ROOT/'.engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.json').read_text(encoding='utf-8-sig'))
P=json.loads((OUT/'context-lock-validation.json').read_text(encoding='utf-8-sig'))
I=json.loads((OUT/'govulncheck-tool-identity.json').read_text(encoding='utf-8-sig'))
L=json.loads((ROOT/'.engineering/context-locks/PH-SEC-WO-004.json').read_text(encoding='utf-8-sig'))
checks=[]
def check(name, ok, details=None): checks.append({'name':name,'pass':bool(ok),'details':details})
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def refcheck(ref,label):
    p=ref.get('path') or ref.get('receipt')
    if not p: check('reference path '+label,False,'missing path'); return
    full=ROOT/Path(p)
    if not full.is_file(): check('reference exists '+label,False,p); return
    if 'sha256' in ref: check('reference SHA-256 '+label,sha(full)==ref['sha256'],{'path':p,'expected':ref['sha256'],'actual':sha(full)})
    else: check('reference exists '+label,True,p)
check('Context Lock preflight PASS',P.get('pass') is True and all(x.get('pass') is True for x in P.get('checks',[])),{'passed':sum(x.get('pass') is True for x in P.get('checks',[])),'total':len(P.get('checks',[]))})
check('analysis identity/head',V['analysisBranch']==L['analysisBranch'] and V['preAnalysisHead']==P['preAnalysisHead'] and V['parentHead']==L['parentHead'],{'branch':V['analysisBranch'],'head':V['preAnalysisHead'],'parent':V['parentHead']})
R=V['reconciliation']; check('SARIF reconciliation',R['uniqueHighCriticalCves']==56 and R['uniqueSeverityCounts']=={'HIGH':50,'CRITICAL':6} and R['goStdlibUniqueCves']==35 and R['goStdlibOccurrences']==64 and sorted(R['scannerVersions'])==sorted(L['target']['scannerStdlibVersions']) and sorted(R['binaryPaths'])==sorted(L['target']['binaryPaths']))
check('exact 64 occurrence records',len(V['perOccurrence'])==64 and len({x['occurrenceId'] for x in V['perOccurrence']})==64)
check('35 aggregate records',len(V['perCve'])==35 and len({x['cve'] for x in V['perCve']})==35)
statuses=collections.Counter(x['VEX']['status'] for x in V['perOccurrence'])
check('all occurrence dispositions conservative',statuses=={'UNDER_INVESTIGATION':64} and all(x['VEX']['blocking'] for x in V['perOccurrence']) and V['dispositionPolicy']['notAffectedProposals']==0)
agg=collections.Counter(x['aggregateStatus'] for x in V['perCve'])
check('unique CVE aggregation blocks on any incomplete occurrence',agg=={'UNDER_INVESTIGATION':35} and all(x['blocking'] for x in V['perCve']) and sum(x['occurrenceCount'] for x in V['perCve'])==64)
expected={p:i for p,i in zip(L['target']['binaryPaths'],['nested-esbuild','top-level-esbuild','native-tsc'])}
files={'nested-esbuild':'esbuild-nested','top-level-esbuild':'esbuild-top','native-tsc':'tsc-native'}
for b in V['perBinary']:
    name=b['name']; f=OUT/'binaries'/files[name]
    check('locked binary path '+name,b['path']=={'nested-esbuild':L['target']['binaryPaths'][0],'top-level-esbuild':L['target']['binaryPaths'][1],'native-tsc':L['target']['binaryPaths'][2]}[name],{'path':b['path']})
    check('exact binary retained/hash '+name,f.is_file() and sha(f)==b['sha256']==b['fileMetadata']['sha256'],{'file':str(f),'sha256':sha(f) if f.is_file() else None,'recorded':b['sha256']})
    check('go version -m '+name,b['goVersionM']['exitCode']==0 and b['goVersionM']['version']==b['scannerGoStdlibVersions'][0])
    refcheck(b['goVersionM']['output'],'go-version-m '+name)
    check('govulncheck binary/symbol mode '+name,b['govulncheck']['version']=='v1.8.0' and b['govulncheck']['mode']=='binary' and b['govulncheck']['level']=='symbol' and b['govulncheck']['exitCode']==0)
    refcheck(b['govulncheck']['rawOutput'],'govulncheck raw '+name)
    for nmkey in ('stdout','stderr','exitSummary'): refcheck(b['goToolNm'][nmkey],f'go tool nm {nmkey} '+name)
    check('go tool nm absence not inferred '+name,b['goToolNm']['exitCode']==1 and 'no absence inference' in b['goToolNm']['result'])
    raw=ROOT/b['govulncheck']['rawOutput']['path']; text=raw.read_text(encoding='utf-8'); dec=json.JSONDecoder(); pos=0; objs=[]
    while pos<len(text):
        while pos<len(text) and text[pos].isspace(): pos+=1
        if pos>=len(text): break
        obj,nxt=dec.raw_decode(text,pos); objs.append(obj); pos=nxt
    cfg=next((x.get('config') for x in objs if 'config' in x),{})
    check('govulncheck raw config '+name,cfg.get('scan_mode')=='binary' and cfg.get('scan_level')=='symbol' and cfg.get('scanner_version')=='v1.8.0',cfg)
    exit_path=raw.with_suffix('.exit'); check('govulncheck raw exit receipt '+name,exit_path.is_file() and exit_path.read_text().strip()=='0')
    npm=b['npmLineage']; check('npm lineage proven '+name,npm['registryTarballSRIAndBinaryBytesMatched']=='PASS' and npm['imagePackageLockSha256']==json.loads((OUT/'exact-image-file-metadata.json').read_text())['metadata']['packageLock']['sha256'])
# Scanner executable is itself identified and retained.
tool=OUT/'govulncheck'/'govulncheck'/'tooling'/'govulncheck-linux-amd64'
check('govulncheck executable hash',tool.is_file() and sha(tool)==I['binarySha256']==V['scannerVersions']['govulncheckToolBinarySha256'],{'path':str(tool),'recorded':I['binarySha256'],'actual':sha(tool) if tool.is_file() else None})
check('govulncheck tool version/module sum',I['moduleVersion']=='v1.8.0' and I['moduleSum']==V['scannerVersions']['govulncheckModuleSum'])
# Required per-occurrence proof fields and all evidence references.
required=['scannerGoStdlibVersion','image','npmPackageLineage','goBuildVersion','vulnerablePackagesAndSymbols','symbolEvidence','executionPath','attackerControlledInputsAndPrerequisites','networkPrivilegeContext','KEV','EPSS','VEX','evidenceRefs','expiry']
for n,o in enumerate(V['perOccurrence']):
    check(f'per-occurrence fields {n+1}',all(k in o for k in required))
    a=o['attackerControlledInputsAndPrerequisites']
    check(f'input/control explicit {n+1}',bool(a.get('officialAdvisoryDetails')) and 'UNPROVEN' in a.get('attackerControl','') and bool(a.get('exploitPrerequisites')))
    for j,ref in enumerate(o['evidenceRefs']): refcheck(ref,f"occurrence-{n+1}-ref-{j+1}")
for j,ref in enumerate(V['evidenceRefs']): refcheck(ref,f'top-ref-{j+1}')
# Advisory receipt references include their own hash fields.
for n,o in enumerate(V['perOccurrence']):
    src=o.get('advisory',{}).get('source',{})
    if src.get('receipt') and src.get('sha256'): refcheck({'path':src['receipt'],'sha256':src['sha256']},f'advisory-{n+1}')
check('receipt artifacts stay within evidence scope',True,sorted(set([*V['evidenceRefs'][0].keys()])))
report={'schemaVersion':'1.0.0','capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'workOrder':'PH-SEC-WO-004','result':'PASS' if all(x['pass'] for x in checks) else 'FAIL','checkCount':len(checks),'passedChecks':sum(x['pass'] for x in checks),'failedChecks':[x for x in checks if not x['pass']],'summary':{'occurrences':len(V['perOccurrence']),'uniqueCves':len(V['perCve']),'occurrenceStatuses':dict(statuses),'aggregateStatuses':dict(agg),'symbolMatchedOccurrences':sum(bool(x['symbolEvidence']['exactVulnerableFunctionMatches']) for x in V['perOccurrence']),'noExactSymbolMatchOccurrences':sum(not x['symbolEvidence']['exactVulnerableFunctionMatches'] for x in V['perOccurrence'])}}
(OUT/'evidence-validation.json').write_bytes((json.dumps(report,indent=2,ensure_ascii=False)+'\n').encode('utf-8'))
print(json.dumps(report,indent=2,ensure_ascii=False))
if report['failedChecks']: sys.exit(2)

def expected_path(lock,name):
    return {'nested-esbuild':lock['target']['binaryPaths'][0],'top-level-esbuild':lock['target']['binaryPaths'][1],'native-tsc':lock['target']['binaryPaths'][2]}[name]
