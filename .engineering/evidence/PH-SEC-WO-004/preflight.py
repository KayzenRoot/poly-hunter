import collections, datetime, hashlib, json, re, subprocess, sys
from pathlib import Path
ROOT=Path('.')
LOCK_PATH=ROOT/'.engineering/context-locks/PH-SEC-WO-004.json'
WO_PATH=ROOT/'.engineering/work-orders/PH-SEC-WO-004.md'
LOCK=json.loads(LOCK_PATH.read_text(encoding='utf-8-sig'))
PARENT=LOCK['parentHead']; BRANCH=LOCK['analysisBranch']; PR=25

def run(*args, check=True):
    p=subprocess.run(args, capture_output=True, text=True)
    if check and p.returncode: raise RuntimeError(f'{args} failed: {p.stderr.strip()}')
    return p
checks=[]
def ck(name, expected, actual):
    checks.append({'name':name,'expected':expected,'actual':actual,'pass':expected==actual})
def git(*args, check=True): return run('git',*args,check=check).stdout.strip()
branch=git('branch','--show-current'); head=git('rev-parse','HEAD')
ck('analysis branch',BRANCH,branch)
remote_refs=run('git','ls-remote','origin',f'refs/heads/{BRANCH}','refs/heads/feat/ph-m01-tenancy-persistence')
remote_map={line.split('\t')[1]:line.split('\t')[0] for line in remote_refs.stdout.splitlines() if '\t' in line}
ck('remote analysis head',head,remote_map.get(f'refs/heads/{BRANCH}'))
ck('locked parent commit exists','commit',git('cat-file','-t',PARENT,check=False))
anc=run('git','merge-base','--is-ancestor',PARENT,head,check=False)
ck('locked parent head ancestor',True,anc.returncode==0)
ck('live PR base branch head',PARENT,remote_map.get('refs/heads/feat/ph-m01-tenancy-persistence'))
pr=json.loads(run('gh','pr','view',str(PR),'--json','number,state,isDraft,headRefName,headRefOid,baseRefName,baseRefOid,url').stdout)
ck('PR identity',PR,pr['number']); ck('PR state','OPEN',pr['state']); ck('PR head branch',BRANCH,pr['headRefName']); ck('PR head SHA',head,pr['headRefOid']); ck('PR base branch','feat/ph-m01-tenancy-persistence',pr['baseRefName']); ck('PR base SHA',PARENT,pr['baseRefOid'])
main=LOCK['canonicalPolicyMainSha']
ck('locked canonical main commit exists','commit',git('cat-file','-t',main,check=False))
for source, expected in LOCK['criticalSources'].items():
    scope,path=source.split(':',1); rev=main if scope=='main' else PARENT
    ck(f'blob {source}',expected,git('rev-parse',f'{rev}:{path}',check=False))
workorder=WO_PATH.read_text(encoding='utf-8-sig')
section=re.search(r'## IN-SCOPE UNIQUE CVES\s+(.*?)(?=\n## )',workorder,re.S).group(1)
expected_cves=sorted(set(re.findall(r'CVE-\d{4}-\d{4,7}',section)))
sarif_path='.engineering/evidence/PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif'
blob=subprocess.check_output(['git','show',f'{PARENT}:{sarif_path}'])
blob_sha=git('rev-parse',f'{PARENT}:{sarif_path}')
working=(ROOT/sarif_path).read_bytes()
ck('locked SARIF blob SHA',LOCK['criticalSources'][f'parent:{sarif_path}'],blob_sha)
ck('SARIF worktree normalized to parent blob',True,working.replace(b'\r\n',b'\n')==blob)
ck('SARIF worktree SHA-256','e811c090d0748d3ebac6ab550e186b6480252e7d63b1733265e25f1561e3c372',hashlib.sha256(working).hexdigest())
sarif=json.loads(blob); results=sarif['runs'][0]['results']; unique={}; rows=[]
for i,r in enumerate(results):
    msg=r.get('message',{}).get('text','')
    def field(n):
        m=re.search(r'^\s*'+re.escape(n)+r'\s*:\s*(.*?)\s*$',msg,re.M); return m.group(1).strip() if m else ''
    c=r.get('ruleId',''); sev=field('Severity')
    if c.startswith('CVE-') and sev in ('HIGH','CRITICAL'): unique.setdefault(c,set()).add(sev)
    if c.startswith('CVE-') and sev in ('HIGH','CRITICAL') and field('Package').startswith('pkg:golang/stdlib@'):
        uri=(r.get('locations') or [{}])[0].get('physicalLocation',{}).get('artifactLocation',{}).get('uri','')
        path=next((p for p in LOCK['target']['binaryPaths'] if uri.endswith(p)),None)
        rows.append({'cve':c,'severity':sev,'version':field('Package').rsplit('@',1)[-1],'path':path,'index':i})
sevcounts=collections.Counter(next(iter(v)) for v in unique.values())
ck('unique HIGH/CRITICAL CVEs',LOCK['target']['uniqueHighCriticalCves'],len(unique))
ck('unique CVE severity counts',{'HIGH':50,'CRITICAL':6},dict(sevcounts))
ck('unique Go stdlib CVEs',LOCK['target']['goStdlibUniqueCves'],len({x['cve'] for x in rows}))
ck('Go stdlib occurrences',LOCK['target']['goStdlibOccurrences'],len(rows))
ck('scanner Go stdlib versions',sorted(LOCK['target']['scannerStdlibVersions']),sorted({x['version'] for x in rows}))
ck('locked executable paths',sorted(LOCK['target']['binaryPaths']),sorted({x['path'] for x in rows}))
ck('exact expected Go CVE identifiers',expected_cves,sorted({x['cve'] for x in rows}))
counts={'rawSarifResults':len(results),'uniqueHighCriticalCves':len(unique),'uniqueSeverityCounts':dict(sevcounts),'goStdlibUniqueCves':len({x['cve'] for x in rows}),'goStdlibOccurrences':len(rows),'goOccurrencesByVersion':dict(collections.Counter(x['version'] for x in rows)),'goOccurrencesByBinaryPath':dict(collections.Counter(x['path'] for x in rows))}
report={'schemaVersion':'1.0.0','capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'workOrder':'PH-SEC-WO-004','branch':branch,'preAnalysisHead':head,'parentHead':PARENT,'baseBranchRef':'feat/ph-m01-tenancy-persistence','pullRequest':pr,'canonicalPolicyMainSha':main,'counts':counts,'checks':checks,'pass':all(x['pass'] for x in checks),'occurrenceMatrix':rows,'sarif':{'path':sarif_path,'blobSha1':blob_sha,'worktreeSha256':hashlib.sha256(working).hexdigest(),'parentSha256':hashlib.sha256(blob).hexdigest(),'normalizedWorktreeMatchesParentBlob':working.replace(b'\r\n',b'\n')==blob}}
out=ROOT/'.engineering/evidence/PH-SEC-WO-004/context-lock-validation.json'
out.write_bytes((json.dumps(report,indent=2,ensure_ascii=False)+'\n').encode('utf-8'))
print(json.dumps({'pass':report['pass'],'passedChecks':sum(x['pass'] for x in checks),'totalChecks':len(checks),'failedChecks':[x for x in checks if not x['pass']],'counts':counts,'output':str(out)},indent=2,ensure_ascii=False))
if not report['pass']: sys.exit(2)
