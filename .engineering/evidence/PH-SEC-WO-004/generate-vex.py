import json,pathlib,re,hashlib,collections,datetime,subprocess,functools
R=pathlib.Path('.engineering/evidence/PH-SEC-WO-004'); PARENT='339ef9ae3100b022623dfd0cfaa49b66a56cb7f0'
EXPECTED={'CVE-2022-30635','CVE-2023-39325','CVE-2023-44487','CVE-2023-45283','CVE-2023-45288','CVE-2024-24784','CVE-2024-24790','CVE-2024-24791','CVE-2024-34156','CVE-2024-34158','CVE-2025-22871','CVE-2025-58187','CVE-2025-58188','CVE-2025-61723','CVE-2025-61725','CVE-2025-61726','CVE-2025-61729','CVE-2025-68121','CVE-2026-25679','CVE-2026-32280','CVE-2026-32281','CVE-2026-32283','CVE-2026-33811','CVE-2026-33814','CVE-2026-33818','CVE-2026-39820','CVE-2026-39821','CVE-2026-39822','CVE-2026-39836','CVE-2026-42499','CVE-2026-42504','CVE-2026-46600','CVE-2026-56853','CVE-2026-56859','CVE-2026-56862'}
B={
'nested-esbuild':{'suffix':'/node_modules/@esbuild-kit/core-utils/node_modules/@esbuild/linux-x64/bin/esbuild','key':'nestedEsbuild','file':'esbuild-nested','pkg':'@esbuild/linux-x64','vers':'0.18.20','chain':'Compose db:migrate -> drizzle-kit migrate -> @esbuild-kit/esm-loader -> core-utils -> esbuild 0.18.20; package graph proves candidate, benign API probe spawned exact path; migration not run to avoid DB mutation.'},
'top-level-esbuild':{'suffix':'/node_modules/@esbuild/linux-x64/bin/esbuild','key':'topEsbuild','file':'esbuild-top','pkg':'@esbuild/linux-x64','vers':'0.25.12','chain':'Compose db:test:integration -> Vitest -> Vite -> esbuild 0.25.12; package graph proves candidate, benign API probe spawned exact path; integration suite not run to avoid DB mutation. Web startup uses next dev --webpack.'},
'native-tsc':{'suffix':'/node_modules/@typescript/typescript-linux-x64/lib/tsc','key':'nativeTsc','file':'tsc-native','pkg':'@typescript/typescript-linux-x64','vers':'7.0.2','chain':'root/workspace npm typecheck and build scripts -> typescript/bin/tsc -> native platform binary; benign tsc --help probe spawned exact path; no compilation run.'}}
PATHS={v['suffix']:k for k,v in B.items()}
def J(p): return json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def H(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
@functools.lru_cache(maxsize=None)
def G(*a): return subprocess.check_output(['git',*a],text=True).strip()
def objs(p):
 s=pathlib.Path(p).read_text(encoding='utf-8'); d=json.JSONDecoder(); i=0
 while i<len(s):
  while i<len(s) and s[i].isspace(): i+=1
  if i>=len(s): break
  x,j=d.raw_decode(s,i); yield x; i=j
def field(s,n):
 m=re.search(r'^\s*'+re.escape(n)+r'\s*:\s*(.*?)\s*$',s,re.M); return m.group(1).strip() if m else None
def ref(p,anchor=None):
 p=pathlib.Path(p); x={'path':p.as_posix()}
 if p.is_file(): x['sha256']=H(p)
 if anchor: x['anchor']=anchor
 return x
def traceName(t):
 if not t.get('package') or not t.get('function'): return None
 return t['package']+'.'+(t.get('receiver')+'.' if t.get('receiver') else '')+t['function']
lock=J('.engineering/context-locks/PH-SEC-WO-004.json'); branch=G('branch','--show-current'); head=G('rev-parse','HEAD')
if branch!=lock['analysisBranch'] or subprocess.run(['git','merge-base','--is-ancestor',PARENT,head]).returncode: raise SystemExit('branch/ancestry failure')
for k,v in lock['criticalSources'].items():
 scope,path=k.split(':',1); rev=lock['canonicalPolicyMainSha'] if scope=='main' else lock['parentHead']
 if G('rev-parse',f'{rev}:{path}')!=v: raise SystemExit('context lock fingerprint mismatch: '+k)
sarifpath='.engineering/evidence/PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif'; sarifblob=subprocess.check_output(['git','show',f'{PARENT}:{sarifpath}']); sarifbytes=pathlib.Path(sarifpath).read_bytes()
if hashlib.sha256(sarifbytes).hexdigest()!='e811c090d0748d3ebac6ab550e186b6480252e7d63b1733265e25f1561e3c372' or sarifbytes.replace(b'\r\n',b'\n')!=sarifblob: raise SystemExit('SARIF source materialization/blob mismatch')
sarif=json.loads(sarifbytes); rows=[]; high={}; counts=collections.Counter()
for i,r in enumerate(sarif['runs'][0]['results']):
 t=r.get('message',{}).get('text',''); sev=field(t,'Severity'); c=r.get('ruleId','')
 if c.startswith('CVE-') and sev in ('HIGH','CRITICAL'): high.setdefault(c,set()).add(sev)
 if not c.startswith('CVE-') or not sev in ('HIGH','CRITICAL'): continue
 pkg=field(t,'Package')
 if not pkg or not pkg.startswith('pkg:golang/stdlib@'): continue
 path=(r.get('locations') or [{}])[0].get('physicalLocation',{}).get('artifactLocation',{}).get('uri'); b=next((n for suffix,n in PATHS.items() if path and path.endswith(suffix)),None)
 if not b: raise SystemExit('unexpected binary path '+str(path))
 rows.append({'sarifResultIndex':i,'occurrenceId':f'SARIF-{i+1:04d}-{c}','cve':c,'severity':sev,'scannerPurl':pkg,'scannerGoStdlibVersion':pkg.rsplit('@',1)[1],'scannerAffectedRange':field(t,'Affected range'),'scannerFixedVersion':field(t,'Fixed version'),'binaryPath':path,'binary':b})
if len(high)!=56 or len(rows)!=64 or {x['cve'] for x in rows}!=EXPECTED: raise SystemExit('SARIF reconciliation failure')
if {x['scannerGoStdlibVersion'] for x in rows}!={'1.20.7','1.23.12','1.26.4'}: raise SystemExit('Go versions differ')
sev_cves=collections.Counter(next(iter(v)) for v in high.values())
if sev_cves!=collections.Counter({'HIGH':50,'CRITICAL':6}): raise SystemExit('unique severities differ')
image=J(R/'exact-image-file-metadata.json'); local=J(R/'local-image-metadata.json'); lineage=J(R/'npm-package-lineage-verification.json'); lockfile=J('package-lock.json')
if not lineage['checksPassed'] or H('package-lock.json')!=image['metadata']['packageLock']['sha256']: raise SystemExit('package lineage/hash mismatch')
index=J(R/'go-vuln-db-index.json'); idby={a:x['id'] for x in index for a in x.get('aliases',[]) if a.startswith('CVE-')}
osv={}; osvpath={}
for it in J(R/'go-vuln-db'/'go-vuln-db-osv-index.json')['records']:
 p=R/'go-vuln-db'/'osvs'/(it['id']+'.json'); d=J(p)
 for a in d.get('aliases',[]):
  if a.startswith('CVE-'):osv[a]=d;osvpath[a]=p.as_posix()
if set(osv)!=(EXPECTED-{'CVE-2023-44487'}):raise SystemExit('official Go DB set mismatch')
epss={x['cve']:x for x in J(R/'first-epss.json')['data']}; kev={x['cveID']:x for x in J(R/'cisa-kev.json')['vulnerabilities'] if x.get('cveID') in EXPECTED}
nvd=J(R/'nvd-cve-2023-44487.json').get('vulnerabilities',[{}])[0].get('cve',{}); nvdtext=next((x['value'] for x in nvd.get('descriptions',[]) if x.get('lang')=='en'),'')
govcfg={}; govfind={}; govver={}; govraw={}
for b,d in B.items():
 raw=R/'govulncheck'/'govulncheck'/'raw'/(d['file']+'.json'); exitp=R/'govulncheck'/'govulncheck'/'raw'/(d['file']+'.exit')
 if exitp.read_text().strip()!='0':raise SystemExit('govulncheck exit failure '+b)
 allj=list(objs(raw)); cfg=next(x['config'] for x in allj if 'config' in x)
 if cfg.get('scan_mode')!='binary' or cfg.get('scan_level')!='symbol' or cfg.get('scanner_version')!='v1.8.0':raise SystemExit('govulncheck config mismatch')
 govcfg[b]=cfg;govfind[b]=[x['finding'] for x in allj if 'finding' in x];govraw[b]=raw.as_posix()
 gp=R/'govulncheck'/'govulncheck'/'go-version-m'/(d['file']+'.txt'); txt=gp.read_text(encoding='utf-8'); m=re.search(r'^\S+: go(\d+\.\d+\.\d+)',txt)
 if not m:raise SystemExit('go version -m absent '+b)
 govver[b]=m.group(1)
 if (R/'govulncheck'/'govulncheck'/'go-version-m'/(d['file']+'.exit')).read_text().strip()!='0':raise SystemExit('go version -m failed '+b)
# Build per-occurrence records. Missing or contradictory proof stays UNDER_INVESTIGATION.
def imports(c):
 d=osv.get(c); out=[]
 if d:
  for a in d.get('affected',[]):
   if a.get('package',{}).get('name')=='stdlib':
    for q in a.get('ecosystem_specific',{}).get('imports',[]):out.append({'path':q.get('path'),'symbols':q.get('symbols',[])})
 return out
def fixed(c):
 out=[]
 for a in (osv.get(c,{}).get('affected',[])):
  if a.get('package',{}).get('name')=='stdlib':
   for r in a.get('ranges',[]):out += [e['fixed'] for e in r.get('events',[]) if 'fixed' in e]
 return sorted(set(out))
findby={b:collections.defaultdict(list) for b in B}
for b,fs in govfind.items():
 for f in fs:findby[b][f['osv']].append(f)
bycve=collections.defaultdict(list); per=[]
for r in rows:
 c,b=r['cve'],r['binary']; goid=idby.get(c); findings=findby[b].get(goid,[]) if goid else []
 tr=[]
 for f in findings: tr.extend([{k:t.get(k) for k in ('module','version','package','function','receiver','position')} for t in f.get('trace',[])])
 dedup=[];seen=set()
 for t in tr:
  k=json.dumps(t,sort_keys=True)
  if k not in seen:seen.add(k);dedup.append(t)
 vuln=imports(c); declared={q['path']+'.'+s for q in vuln for s in q.get('symbols',[])}
 observed=sorted({traceName(t) for t in dedup if traceName(t)}); hits=sorted(declared.intersection(observed))
 if c=='CVE-2023-44487': presence='UNRESOLVED_NO_GO_DB_ALIAS_OR_GOVULNCHECK_FINDING'
 elif hits:presence='VULNERABLE_SYMBOL_CONFIRMED_IN_BINARY'
 elif findings:presence='PACKAGE_OR_MODULE_MATCH_ONLY; SYMBOL_UNPROVEN'
 else:presence='NO_MATCH; ABSENCE_UNPROVEN'
 if c in osv:
  adv=osv[c]; summary=adv.get('summary',''); details=adv.get('details',''); source={'kind':'Go Vulnerability Database','id':goid,'url':f'https://pkg.go.dev/vuln/{goid}','receipt':osvpath[c],'sha256':H(osvpath[c])}
 else:
  adv={};summary='No direct CVE alias in official Go vulnerability database index; exact scanner-to-Go attribution unresolved.';details=nvdtext;source={'kind':'NVD CVE record','id':c,'url':f'https://nvd.nist.gov/vuln/detail/{c}','receipt':str(R/'nvd-cve-2023-44487.json'),'sha256':H(R/'nvd-cve-2023-44487.json')}
 if c=='CVE-2023-44487':
  candidate='No direct Go advisory/package/symbol mapping exists for this scanner attribution. NVD describes HTTP/2 stream-cancellation denial of service; if that attribution were correct, a malicious HTTP/2 peer would need to reach an HTTP/2 server. This tool binary has no proven server/listener path.'
 else:
  candidate=f'Upstream advisory-required operation/input: {summary}. The advisory details below state the relevant package operation and prerequisites. Whether the exact binary executes that operation on workflow inputs, and whether an adversary controls those inputs, is UNPROVEN.'
 missing=[]
 if not hits:missing.append('Exact vulnerable-code presence/absence is unresolved; govulncheck had no exact vulnerable symbol hit, and go tool nm failed due no symbol section.')
 missing.append('Binary-mode govulncheck does not provide per-occurrence call-chain proof; benign probe did not trigger the vulnerable API or exploit condition.')
 missing.append('No proven attacker-controlled path from browser/network input into this vulnerable function. Untrusted contributor/CI ownership of local source/config is not frozen here.')
 if b!='native-tsc':missing.append('Migration/integration commands with possible database writes were not executed; candidate command path is statically mapped and binary invocation was probed benignly.')
 else:missing.append('Only `tsc --help` ran; no project compilation or hostile source was executed.')
 if c=='CVE-2023-44487':missing.append('No direct Go DB record or govulncheck advisory maps this scanner-reported CVE to an exact Go package/symbol.')
 rawref=ref(govraw[b]); sarifref={'path':sarifpath,'sha256':hashlib.sha256(sarifbytes).hexdigest(),'resultIndex':r['sarifResultIndex'],'binaryPath':r['binaryPath']}
 meta=image['metadata'][B[b]['key']]
 o={**r,'image':{'reference':'polyhunter-dev:local','imageId':local['imageId'],'daemonRepoDigests':local.get('repoDigests',[]),'binarySha256':meta['sha256']},'npmPackageLineage':{'binaryPackage':B[b]['pkg'],'binaryPackageVersion':B[b]['vers'],'packageLockSha256':meta['sha256'] if False else image['metadata']['packageLock']['sha256'],'tarballIntegrityAndBinaryMatch':'PASS','receipt':ref(R/'npm-package-lineage-verification.json')},'goBuildVersion':govver[b],
'vulnerablePackagesAndSymbols':vuln,'upstreamFixedVersions':fixed(c) or [r['scannerFixedVersion']],'advisory':{'id':goid,'summary':summary,'details':details,'source':source},
'symbolEvidence':{'govulncheckMode':'binary','scanLevel':'symbol','matchingFindingCount':len(findings),'traces':dedup,'observedFunctions':observed,'exactVulnerableFunctionMatches':hits,'presenceAssessment':presence,'goToolNm':'exit 1/no symbol section for this executable; no absence inference'},
'executionPath':{'assessment':B[b]['chain'],'probeReceipt':ref(R/'tool-runtime-invocation-probes.json',b),'composeReceipt':ref(R/'compose-runtime-context.json'),'workflowInputs':'Local repository source/config/test files; no direct product-source tool-spawn match in apps/ or packages/ textual search. Explicit test/migration/typecheck commands remain local-tool paths.','staticSourceFingerprints':{p:G('rev-parse',f'{PARENT}:{p}') for p in ['compose.yaml','package.json','package-lock.json','apps/web/package.json','apps/worker/package.json','packages/db/package.json','packages/db/drizzle.config.ts']}},
'attackerControlledInputsAndPrerequisites':{'officialAdvisorySummary':summary,'officialAdvisoryDetails':details,'candidateInputClass':candidate,'attackerControl':'UNPROVEN. The dev tools consume repository-controlled assets when explicitly invoked; whether an untrusted contributor or CI principal controls those assets was not decided.','exploitPrerequisites':'Use the package-specific operation and malformed input described in the official advisory. No exact vulnerable function call chain or adversary-controlled payload path was established; no exploit payload was run.'},
'networkPrivilegeContext':{'toolProcessUser':'node uid 1000','effectiveCapabilities':'0000000000000000','toolProbeNetwork':'no TCP/TCP6 FDs on tool child processes; AF_UNIX socketpairs/stdio only','webExposure':'0.0.0.0:3000 inside project-scoped Compose network; host port bound to 127.0.0.1:3000','workerExposure':'no host port; nodemon only persisted at sampling and worker shell clean-exited','contextIsNotProof':'local binding, uid, and capabilities do not establish NOT_AFFECTED.'},
'KEV':{'status':'LISTED' if c in kev else 'NOT_LISTED_IN_CISA_SNAPSHOT','entry':kev.get(c),'snapshot':ref(R/'cisa-kev.json')},'EPSS':{'score':epss[c]['epss'],'percentile':epss[c]['percentile'],'date':epss[c]['date'],'snapshot':ref(R/'first-epss.json')},
'VEX':{'status':'UNDER_INVESTIGATION','justification':None,'blocking':True,'reason':'Per-occurrence reachability, exploit preconditions or adversary control is incomplete; no NOT_AFFECTED self-approval.'},'missingProof':missing,'evidenceRefs':[sarifref,rawref,source,ref(R/'exact-image-file-metadata.json',B[b]['key']),ref(R/'npm-package-lineage-verification.json',c),ref(R/'tool-runtime-invocation-probes.json',b),ref(R/'compose-runtime-context.json'),ref(R/'go-vuln-db-index.json')],
'expiry':'Blocking until fully resolved; reassess before promotion and on image, scan, upstream advisory, Go DB, KEV, workflow or trust-boundary changes. Any later NOT_AFFECTED local-dev proposal expires at 7 days and requires independent audit plus owner approval.'}
 per.append(o);bycve[c].append(o)

# Aggregate each unique CVE. One unresolved occurrence blocks the entire CVE.
aggregates=[]
for c,os in sorted(bycve.items()):
 no=[x['occurrenceId'] for x in os if not x['symbolEvidence']['exactVulnerableFunctionMatches']]
 paths=sorted({i['path'] for x in os for i in x['vulnerablePackagesAndSymbols']})
 functions=sorted({s for x in os for s in x['symbolEvidence']['exactVulnerableFunctionMatches']})
 risk=epss[c]; ad=osv.get(c)
 aggregates.append({'cve':c,'severity':os[0]['severity'],'occurrenceCount':len(os),'occurrenceIds':[x['occurrenceId'] for x in os],'binaryPaths':sorted({x['binaryPath'] for x in os}),'scannerGoStdlibVersions':sorted({x['scannerGoStdlibVersion'] for x in os}),'affectedPackagePaths':paths,'vulnerablePackagesAndSymbols':imports(c),'govulncheckSymbolHitsByBinary':{b:sorted({s for x in os if x['binary']==b for s in x['symbolEvidence']['exactVulnerableFunctionMatches']}) for b in B if any(x['binary']==b for x in os)},'noExactSymbolOccurrenceIds':no,'officialGoAdvisory':({'id':ad['id'],'summary':ad.get('summary'),'details':ad.get('details'),'url':f"https://pkg.go.dev/vuln/{ad['id']}",'fixedVersions':fixed(c),'receipt':ref(osvpath[c])} if ad else {'id':None,'summary':os[0]['advisory']['summary'],'details':os[0]['advisory']['details'],'url':'https://nvd.nist.gov/vuln/detail/CVE-2023-44487','receipt':ref(R/'nvd-cve-2023-44487.json')}),'KEV':{'status':'LISTED' if c in kev else 'NOT_LISTED_IN_CISA_SNAPSHOT','entry':kev.get(c)},'EPSS':{'score':risk['epss'],'percentile':risk['percentile'],'date':risk['date']},'aggregateStatus':'UNDER_INVESTIGATION','blocking':True,'aggregationRule':'Every occurrence must be FIXED or fully evidenced proposed NOT_AFFECTED; any incomplete occurrence blocks.','reason':('Go DB lacks direct CVE mapping and no govulncheck finding; exact attribution unresolved.' if not ad else ('Some occurrences lack exact symbol hit and code absence is unproven.' if no else 'Vulnerable functions appear in exact binaries, but call path/exploit input reachability and adversary control are not proven for every occurrence.'))+' No NOT_AFFECTED proposal is made.'})
# Per-binary package/build lineage and scan receipts.
perbin=[]
lockkeys={
'nested-esbuild':['node_modules/@esbuild-kit/esm-loader','node_modules/@esbuild-kit/core-utils','node_modules/@esbuild-kit/core-utils/node_modules/esbuild','node_modules/@esbuild-kit/core-utils/node_modules/@esbuild/linux-x64'],
'top-level-esbuild':['node_modules/vite','node_modules/vitest','node_modules/esbuild','node_modules/@esbuild/linux-x64'],
'native-tsc':['node_modules/typescript','node_modules/@typescript/typescript-linux-x64']}
for b,d in B.items():
 occ=[x for x in per if x['binary']==b]; meta=image['metadata'][d['key']]; entries=[]
 for k in lockkeys[b]:
  e=lockfile['packages'].get(k)
  if not e:raise SystemExit('missing package lock entry '+k)
  entries.append({'key':k,'version':e.get('version'),'resolved':e.get('resolved'),'integrity':e.get('integrity')})
 gp=R/'govulncheck'/'govulncheck'/'go-version-m'/(d['file']+'.txt'); raw=pathlib.Path(govraw[b]); ids={idby.get(c) for c in EXPECTED}; in_scope=[f for f in govfind[b] if f['osv'] in ids]
 no=sorted({x['cve'] for x in occ if not x['symbolEvidence']['exactVulnerableFunctionMatches']})
 perbin.append({'name':b,'path':occ[0]['binaryPath'],'scannerOccurrenceCount':len(occ),'scannerGoStdlibVersions':sorted({x['scannerGoStdlibVersion'] for x in occ}),'sha256':meta['sha256'],'fileMetadata':meta,'goVersionM':{'version':govver[b],'output':ref(gp),'exitCode':0},'npmLineage':{'packages':entries,'imagePackageLockSha256':image['metadata']['packageLock']['sha256'],'registryTarballSRIAndBinaryBytesMatched':'PASS','receipt':ref(R/'npm-package-lineage-verification.json')},'govulncheck':{'version':govcfg[b]['scanner_version'],'mode':govcfg[b]['scan_mode'],'level':govcfg[b]['scan_level'],'database':govcfg[b]['db'],'databaseLastModified':govcfg[b]['db_last_modified'],'rawOutput':ref(raw),'exitCode':0,'rawFindingsAllScopes':len(govfind[b]),'inScopeSymbolMatchedOccurrences':sum(bool(x['symbolEvidence']['exactVulnerableFunctionMatches']) for x in occ),'inScopeOccurrencesWithoutSymbolMatch':sum(not x['symbolEvidence']['exactVulnerableFunctionMatches'] for x in occ),'noSymbolCves':no},'goToolNm':{'attempted':True,'toolchain':'go1.26.8 in official golang tool image','exitCode':1,'result':'no symbol section/no symbols; no absence inference','stdout':ref(R/'nm'/(d['file']+'.stdout')),'stderr':ref(R/'nm'/(d['file']+'.stderr')),'exitSummary':ref(R/'nm'/'go-tool-nm-exits.txt',d['file'])},'actualExecutionPath':d['chain'],'runtimeProbe':ref(R/'tool-runtime-invocation-probes.json',b),'steadyState':ref(R/('polyhunter-web-runtime-processes.json' if b!='native-tsc' else 'polyhunter-web-runtime-processes.json')),'composeContext':ref(R/'compose-runtime-context.json'),'occurrenceIds':[x['occurrenceId'] for x in occ]})

# Distinguish unique-CVE severities from scanner occurrence counts in the refreshed preflight receipt.
pre=J(R/'context-lock-validation.json'); pre.setdefault('counts',{})['uniqueSeverityCounts']=dict(sev_cves); pre['counts']['occurrenceSeverityCounts']=dict(collections.Counter(x['severity'] for x in rows)); pre['counts']['goOccurrencesByBinary']={b:sum(x['binary']==b for x in rows) for b in B}; pre['counts']['govulnSymbolCoverage']={'symbolMatchedOccurrences':sum(bool(x['symbolEvidence']['exactVulnerableFunctionMatches']) for x in per),'noExactSymbolMatchOccurrences':sum(not x['symbolEvidence']['exactVulnerableFunctionMatches'] for x in per)}; pre['pass']=True
(R/'context-lock-validation.json').write_bytes((json.dumps(pre,indent=2,ensure_ascii=False)+'\n').encode('utf-8'))

runner=J(R/'govulncheck-runner.json')
if runner.get('exitCode')!=0:raise SystemExit('govulncheck runner failed')
sourcepaths=['Dockerfile.dev','compose.yaml','package.json','package-lock.json','apps/web/package.json','apps/worker/package.json','packages/db/package.json','packages/db/drizzle.config.ts','vitest.integration.config.ts','tests/tsconfig.json']
sources={p:{'commit':PARENT,'gitBlobSha1':G('rev-parse',f'{PARENT}:{p}'),'sha256':hashlib.sha256(subprocess.check_output(['git','show',f'{PARENT}:{p}'])).hexdigest()} for p in sourcepaths}
imageRef={'reference':'polyhunter-dev:local','imageId':local['imageId'],'daemonRepoDigests':local.get('repoDigests',[]),'repoDigestCaveat':'daemon local repo digest; no independent registry manifest lookup performed; binary bytes independently matched npm tarballs'}
V={'schemaVersion':'1.0.0','workOrder':'PH-SEC-WO-004','result':'BLOCKED_UNRESOLVED','executionGate':'ANALYSIS_COMPLETE_BLOCKED','analysisBranch':branch,'preAnalysisHead':head,'parentHead':PARENT,'pullRequest':{'number':25,'url':'https://github.com/KayzenRoot/poly-hunter/pull/25','base':'feat/ph-m01-tenancy-persistence','stateAtStart':'OPEN_DRAFT'},'contextLock':{'valid':True,'canonicalPolicyMainSha':lock['canonicalPolicyMainSha'],'lockedFingerprints':len(lock['criticalSources']),'receipt':ref(R/'context-lock-validation.json')},'target':{**imageRef,'scanSource':sarifpath,'scanSourceSha256':hashlib.sha256(sarifbytes).hexdigest(),'environment':'local-dev Docker Compose'},'reconciliation':{'uniqueHighCriticalCves':56,'uniqueSeverityCounts':dict(sev_cves),'goStdlibUniqueCves':35,'goStdlibOccurrences':64,'occurrencesByBinary':{b:sum(x['binary']==b for x in per) for b in B},'scannerVersions':sorted({x['scannerGoStdlibVersion'] for x in per}),'binaryPaths':sorted({x['binaryPath'] for x in per}),'expectedCveSetMatch':True,'nonGoUniqueCvesCountedButNotAnalysed':21},'scannerVersions':{'govulncheck':govcfg['nested-esbuild']['scanner_version'],'goToolchain':(R/'govulncheck'/'govulncheck'/'go-toolchain-version.txt').read_text(encoding='utf-8').strip(),'goVulnDatabase':govcfg['nested-esbuild']['db'],'goDbLastModified':govcfg['nested-esbuild']['db_last_modified'],'goDbIndexSha256':H(R/'go-vuln-db-index.json'),'goToolNm':'go1.26.8; unsupported for absent symbol proof on these stripped binaries','govulncheckToolBinarySha256':J(R/'govulncheck-tool-identity.json')['binarySha256'],'govulncheckModuleSum':J(R/'govulncheck-tool-identity.json')['moduleSum'],'govulncheckToolIdentity':ref(R/'govulncheck-tool-identity.json'),'analysisToolImage':ref(R/'analysis-tool-image.json')},'riskSources':{'KEV':{'source':'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json','receipt':ref(R/'cisa-kev.json'),'inScopeListedCves':sorted(kev)},'EPSS':{'source':'https://api.first.org/data/v1/epss','receipt':ref(R/'first-epss.json'),'records':35,'dates':sorted({x['date'] for x in epss.values()})}},'perBinary':perbin,'perOccurrence':per,'perCve':aggregates,'dispositionPolicy':{'executorSelfApproval':False,'independentAuditor':'pending','ownerApprovalRequiredForNotAffected':True,'notAffectedProposals':0,'fixedCount':0,'underInvestigationOccurrences':64,'reason':'61 occurrences have exact vulnerable function symbols present; all occurrences still lack complete per-function reachability and adversary-controlled prerequisite evidence. Three no-match occurrences do not prove code absence. All remain UNDER_INVESTIGATION.'},'sourceFingerprints':sources,'evidenceRefs':[ref(R/'context-lock-validation.json'),ref(R/'exact-image-file-metadata.json'),ref(R/'npm-package-lineage-verification.json'),ref(R/'govulncheck-runner.json'),ref(R/'tool-runtime-invocation-probes.json'),ref(R/'compose-runtime-context.json'),ref(R/'first-epss.json'),ref(R/'cisa-kev.json'),ref(R/'go-vuln-db-index.json'),ref(R/'go-vuln-db'/'go-vuln-db-osv-index.json'),ref(R/'nvd-cve-2023-44487.json'),ref(R/'govulncheck-tool-identity.json'),ref(R/'analysis-tool-image.json')],'expiry':'UNDER_INVESTIGATION remains blocking; reassess before promotion and on image, scanner, advisory, Go DB, KEV, workflow, or trust-boundary change. A future NOT_AFFECTED local-dev disposition expires after 7 days and requires independent audit and owner approval.','stopCondition':'BLOCKED_UNRESOLVED: one or more HIGH/CRITICAL occurrences remain UNDER_INVESTIGATION. No product or non-Go finding analysis.'}
pathlib.Path('.engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.json').write_bytes((json.dumps(V,indent=2,ensure_ascii=False)+'\n').encode('utf-8'))
# Human-readable VEX matrix and independent Evidence Bundle.
label={'nested-esbuild':'nested esbuild','top-level-esbuild':'top-level esbuild','native-tsc':'native tsc'}
md=['# PH-SEC-WO-004 — VEX Go stdlib na imagem dev','','**Resultado: `BLOCKED_UNRESOLVED`**  ','**Branch:** `'+branch+'`  ','**PR:** [#25](https://github.com/KayzenRoot/poly-hunter/pull/25)  ','**Head de entrada da análise:** `'+head+'`  ','**Parent/base travado:** `'+PARENT+'`','','## Reconciliação e binários','',f"- Context Lock válido; 11 fingerprints revalidados.",f"- SARIF parent: `{sarifpath}` (SHA-256 `{hashlib.sha256(sarifbytes).hexdigest()}`). 56 CVEs HIGH/CRITICAL únicos (50 HIGH, 6 CRITICAL); 35 Go stdlib únicos; 64 ocorrências.",f"- Versões scanner: `{', '.join(sorted({x['scannerGoStdlibVersion'] for x in per}))}`; caminhos binários iguais aos três do Context Lock.",'- O `package-lock.json` extraído da imagem é byte a byte igual ao travado no parent. Os três binários foram comparados byte a byte com os membros dos tarballs npm resolvidos pelo lockfile; SRI e SHA-256 coincidem.','', '| Binário | Go / npm | SHA-256 |','|---|---|---|']
for b in perbin:md.append(f"| `{b['path']}` | Go `{b['goVersionM']['version']}` / {label[b['name']]} {B[b['name']]['vers']} | `{b['sha256']}` |")
md += ['', '## Govulncheck / símbolo','',f"- Hash SHA-256 do executável govulncheck: `{J(R/'govulncheck-tool-identity.json')['binarySha256']}`; module sum `{J(R/'govulncheck-tool-identity.json')['moduleSum']}`; imagem de análise `{J(R/'analysis-tool-image.json')['repoDigest']}`.",f"- `govulncheck {govcfg['nested-esbuild']['scanner_version']}`, modo `binary`, nível `symbol`; Go DB atualizado em `{govcfg['nested-esbuild'].get('db_last_modified')}`. Outputs brutos JSON e `go version -m` estão em `.engineering/evidence/PH-SEC-WO-004/govulncheck/`.",f"- Símbolos vulneráveis exatos encontrados em 61/64 ocorrências. Três ocorrências sem hit: CVE-2022-30635, CVE-2023-44487 e CVE-2023-45283. Não foi inferida ausência de código.",'- `go tool nm` foi tentado nos três binários e falhou com “no symbol section/no symbols”; stderr/exit codes preservados em `.engineering/evidence/PH-SEC-WO-004/nm/`.', '- O modo binário identifica símbolos presentes, mas não prova o call chain para o caminho vulnerável no comando real. Os probes benignos verificaram a execução dos binários, sem acionar as funções vulneráveis.','', '## Caminho local e input','', '- Nested esbuild: comando Compose `db:migrate` encadeia Drizzle Kit, loader ESM, core-utils e o `esbuild` travado. O caminho pelo pacote foi verificado com probe em memória dentro do container; migração não foi executada porque pode alterar PostgreSQL.', '- Top esbuild: `db:test:integration` encadeia Vitest/Vite/esbuild. O probe em memória iniciou o binário exato; a suíte de integração não foi executada por poder alterar PostgreSQL. O web ativo está em Next `--webpack` e não tinha filho esbuild na captura.', '- Native tsc: comandos root/workspace `typecheck` e `build` encadeiam o wrapper TypeScript ao executável nativo; `tsc --help` executou o binário exato sem compilar. O startup Compose não executa tsc.', '- Os inputs dos fluxos são código, testes, configuração e schema no workspace. Não foi identificada chamada direta de child process/esbuild/tsc em `apps/` ou `packages/` na busca registrada. Se um contribuinte não confiável controla esses arquivos, essa fronteira não foi resolvida aqui; por isso nenhuma dispensa VEX foi proposta.', '- Web saudável, porta publicada apenas no host em `127.0.0.1:3000`; dentro da rede Compose escuta em `0.0.0.0:3000`. Worker sem porta publicada; processo nodemon relança o shell que encerra limpo. Processos amostrados como `node` uid 1000, CapEff 0. Contexto apoiador, não prova de não afetado.','', '## CVEs únicos','', '| CVE | Sev. | Ocorr. | Pacotes Go | KEV | EPSS (percentil) | Símbolos encontrados | Status agregado |','|---|---:|---:|---|---|---|---:|---|']
for c in aggregates:
 symbols=sum(len(v) for v in c['govulncheckSymbolHitsByBinary'].values()); packages=', '.join(c['affectedPackagePaths']) or 'sem atribuição Go direta'
 md.append(f"| `{c['cve']}` | {c['severity']} | {c['occurrenceCount']} | {packages} | {c['KEV']['status']} | {c['EPSS']['score']} ({c['EPSS']['percentile']}) | {symbols} | `{c['aggregateStatus']}` |")
md += ['', 'CVE-2023-44487 está no CISA KEV e EPSS o coloca em 0.99999 (percentil 0.99998, data 2026-10-03). O índice Go não contém alias direto; o scanner ainda o relata como `stdlib@1.20.7`, e não houve correspondência govulncheck. Mantido como bloqueador até atribuição e símbolos serem esclarecidos.','', '## Matriz de 64 ocorrências','', '| SARIF | CVE | Binário | Go | Símbolo vulnerável no binário | Pré-condição/adversary input (advisory) | Status |','|---|---|---|---:|---|---|---|']
for o in per:
 hits=o['symbolEvidence']['exactVulnerableFunctionMatches']; text=', '.join(hits[:3])+(' … +' + str(len(hits)-3) if len(hits)>3 else '') if hits else 'não confirmado'
 detail=o['advisory']['summary'] or 'atribuição de CVE não resolvida no Go DB'
 if o['cve']=='CVE-2023-44487':detail='NVD: HTTP/2 rapid stream-reset DoS; atribuição do scanner a Go stdlib não resolvida'
 md.append(f"| `{o['occurrenceId']}` | `{o['cve']}` | {label[o['binary']]} | {o['scannerGoStdlibVersion']} | {text} | {detail}; caminho de input/controle não provado | `{o['VEX']['status']}` |")
md += ['', '## Bloqueio','', '- 64/64 ocorrências continuam `UNDER_INVESTIGATION`; nenhuma recebeu `FIXED` ou proposta `NOT_AFFECTED`.', '- Em 61 ocorrências, os símbolos estão presentes, mas não há prova por função de reachability e input controlável por adversário. Nas outras três a ausência também não foi provada.', '- Auditor independente e aprovação do owner são requisitos para qualquer proposta NOT_AFFECTED. Nenhuma autoaprovação foi feita.','', '## Limites','', '- Nenhum Dockerfile, Compose, dependência, package-lock, código de produto, schema ou migration foi modificado.', '- Os 21 CVEs únicos não-Go foram contados para reconciliação, sem análise. PR #15 permanece aberta e não mergeada.', '- Fontes: [Go Vulnerability Database](https://vuln.go.dev/), [documentação oficial govulncheck](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck), [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog), [FIRST EPSS](https://www.first.org/epss/), [NVD CVE-2023-44487](https://nvd.nist.gov/vuln/detail/CVE-2023-44487).','']
pathlib.Path('.engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.md').write_bytes(('\n'.join(line.rstrip() for line in md).rstrip('\n')+'\n').encode('utf-8'))

e=['# PH-SEC-WO-004 — Evidence Bundle','','**Resultado:** `BLOCKED_UNRESOLVED`  ','**Branch:** `'+branch+'`  ','**PR:** [#25](https://github.com/KayzenRoot/poly-hunter/pull/25)  ','**Head de entrada:** `'+head+'`  ','**Parent/base:** `'+PARENT+'`','','## Preflight','', '- Releitura: `AGENTS.md`, Work Order, Context Lock e Execution Brief.', '- Branch, ancestry, PR/base ao vivo e fingerprints travados conferidos antes de análise; Context Lock PASS (33/33 verificações).', '- Reparse do SARIF: 56 CVEs únicos HIGH/CRITICAL (50 HIGH, 6 CRITICAL); 35 Go stdlib únicos; 64 ocorrências; versões 1.20.7, 1.23.12 e 1.26.4; os três caminhos do Context Lock.','', '## Identidade e ferramentas','',f"- Imagem `polyhunter-dev:local`; Docker daemon image ID `{local.get('imageId')}`. Repo digest local reportado `{', '.join(local.get('repoDigests',[]))}` não foi verificado em registry; as hashes dos executáveis foram reproduzidas pelo artefato npm travado.",'- SHA-256 por binário e Go build metadata estão na matriz VEX JSON.', '- package-lock da imagem bate byte a byte com o lockfile do parent. Os tarballs oficiais npm foram obtidos pelos `resolved` travados; os SRI SHA-512 bateram e cada executável interno teve o mesmo SHA-256 da imagem. Ver `npm-package-lineage-verification.json`.',f"- govulncheck `{govcfg['nested-esbuild']['scanner_version']}` binary/symbol, instalado de `golang.org/x/vuln` dentro de imagem oficial Go pinada `{J(R/'analysis-tool-image.json')['repoDigest']}`; SHA-256 do binário `{J(R/'govulncheck-tool-identity.json')['binarySha256']}`, module sum `{J(R/'govulncheck-tool-identity.json')['moduleSum']}`. Runner exit {runner['exitCode']}; rootfs read-only, cap-drop ALL, no-new-privileges. Raw outputs e identidade do executável em `govulncheck/` e `govulncheck-tool-identity.json`.",'- Go DB `vuln.go.dev`; index e advisories OSV preservados. FIRST EPSS contém 35 IDs na data '+', '.join(sorted({x['date'] for x in epss.values()}))+'. CISA KEV lista: '+(', '.join(sorted(kev)) or 'nenhum')+'.','', '## Execução e segurança','', '- Probes benignos no container web iniciaram ambos esbuild por API em memória e o wrapper npm do tsc executou o binário nativo exato. Processos uid 1000/CapEff 0; probe sem TCP/TCP6 FD, usando AF_UNIX/stdio.', '- Fluxos Compose anotados por pacote/scripts; migration e integração não foram executadas por poderem alterar PostgreSQL. App-source search não encontrou spawn/execFile/esbuild/typescript nos arquivos `.ts/.tsx/.js/.mjs` sob `apps/` e `packages/` (exit 1, sem matches).', '- Compose atual: web healthy, host `127.0.0.1:3000`; worker sem porta publicada. Worker nodemon relança script que clean-exit. Recibos de processo/config/log preservados.','', '## Disposições','', '- JSON VEX traz 64 registros por ocorrência com pacote/símbolos, scanner e versão, hash exato, linha npm, ferramenta, caminho real, candidato a input controlado, pré-condições do advisory, network/privilege, KEV, EPSS, referências, expiração e missing proof.', '- Símbolos foram confirmados em 61 ocorrências; 3 seguem sem match e sem prova de ausência. Mesmo nas demais, binary scan e probes não provaram reachability do símbolo vulnerável nem attacker control.', '- 64/64 `UNDER_INVESTIGATION`; 35/35 agregados bloqueadores. Resultado `BLOCKED_UNRESOLVED`. Nenhuma dispensa ou autoaprovação.', '', '## Escopo e recibos','', '- Sem alterações de Dockerfile, Compose, dependências, package-lock, aplicação, schema ou migrations.', '- Nenhum finding não-Go analisado; 21 CVEs não-Go foram contados apenas para reconciliação. PR #15 não mergeada.', f"- Integridade cruzada dos outputs: `evidence-validation.json` {J(R/'evidence-validation.json')['result']} ({J(R/'evidence-validation.json')['passedChecks']}/{J(R/'evidence-validation.json')['checkCount']} checks), incluindo hashes de binários, saídas brutas e refs de evidência.",'- `receipt-sha256.txt` indexa os entregáveis e todos os recibos, exceto ele próprio para evitar autorreferência.','']
pathlib.Path('.engineering/evidence/PH-SEC-WO-004-EVIDENCE.md').write_bytes(('\n'.join(line.rstrip() for line in e).rstrip('\n')+'\n').encode('utf-8'))
print(json.dumps({'result':V['result'],'head':head,'counts':V['reconciliation'],'symbolHits':sum(bool(x['symbolEvidence']['exactVulnerableFunctionMatches']) for x in per),'noSymbolHit':sum(not x['symbolEvidence']['exactVulnerableFunctionMatches'] for x in per),'govDbRecords':len(osv),'missingDirectMapping':sorted(EXPECTED-set(osv)),'outputs':['.engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.json','.engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.md','.engineering/evidence/PH-SEC-WO-004-EVIDENCE.md']},indent=2,ensure_ascii=False))
