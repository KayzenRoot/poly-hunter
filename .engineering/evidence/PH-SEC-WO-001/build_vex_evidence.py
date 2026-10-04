from __future__ import annotations
import collections, hashlib, json, re, subprocess
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parents[3]
SUP=ROOT/".engineering/evidence/PH-SEC-WO-001"
BASE="3ad44a62bbcc00abdc61b34efd6983a2e765aca9"
MAIN="771f75bbd23fd458e67be1d34024e78e39f5b8af"
INITIAL="e4ae81487abb5dfb31632eb07a25b01dd1950f9b"
AT="2026-10-04T00:08:11Z"
IMAGES=[
 {"key":"dev","name":"polyhunter-dev:local","digest":"sha256:6c8701d8141745e1625c392da42ff643389ed1dab1fcddd13d8dcff704180caa","sarif":".engineering/evidence/PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif","blob":"63052aca98c6162904f1c27033a92319d4e90734","oldSha":"E703FF5206493044293AB3EE0A54502223DD0BFFA5C8972BEE0F8F131E96B86D"},
 {"key":"postgres","name":"postgres:17.11-alpine3.24","digest":"sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24","sarif":".engineering/evidence/PH-M01-WO-001-container-scans/postgres-17.11-alpine3.24-final.sarif","blob":"daa12f4610944c01b8e3a5f028b495eecddeda43","oldSha":"44A3C64B51E25C8E6AA08B0DDB95C0980A0A0A20060662A02E47CD2A28ACF3C9"},
]
MAINLOCK={".engineering/proposals/PH-SEC-VEX-POLICY.md":"3e1b20cbe164d655379a5b93e360186dd14daac7",".engineering/decisions/ADR-0007-VEX-DISPOSITION-GATE.md":"d5325dfa8327429e3c5d0f9a559c800a162e8022",".engineering/SECURITY.md":"f9be6741fd4e5b6956ffc626b38c405c23a689b1"}
BASELOCK={".engineering/evidence/PH-M01-WO-001-EVIDENCE.md":"ae9b70956b875ce49acc86cb4f496ddb2fb21664",IMAGES[0]["sarif"]:IMAGES[0]["blob"],IMAGES[1]["sarif"]:IMAGES[1]["blob"]}
INPUTS=[f".engineering/evidence/PH-SEC-WO-001/{x}" for x in ["runtime-context.json","runtime-command-output.txt","runtime-component-inspection.txt","cisa-kev-2026-10-03.json","first-epss-2026-10-03.json","cve-program-records-2026-10-03.json","osv-cve-records-2026-10-03.json"]]
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest().upper()
def git(*a):return subprocess.check_output(["git",*a],cwd=ROOT,text=True,stderr=subprocess.STDOUT).strip()
def blob(r,p):return git("rev-parse",f"{r}:{p}")
def ancestor(a,b):return subprocess.run(["git","merge-base","--is-ancestor",a,b],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
def rj(p):return json.loads(Path(p).read_text(encoding="utf-8-sig"))
def wj(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
def fields(t):
 d={}
 for k in ("Severity","Package","Affected range","Fixed version","EPSS Score","EPSS Percentile","CVSS Score","CVSS Vector"):
  m=re.search("^"+re.escape(k)+r"\s*:\s*(.*?)\s*$",t,re.M)
  if m:d[k]=m.group(1).strip()
 return d
def parsepurl(x):
 m=re.match(r"^pkg:([^/]+)/(.+?)@([^?]+)",x or "")
 return {"type":m.group(1),"name":unquote(m.group(2)),"version":unquote(m.group(3))} if m else {"type":"unknown","name":x or "unknown","version":"unknown"}
def cnadata(e):
 c=e.get("record",{}).get("containers",{}).get("cna",{})
 d=next((x.get("value","") for x in c.get("descriptions",[]) if x.get("lang")=="en"),"")
 return c,d
def presence(img,c,loc):
 n=c["name"].lower()
 if img=="postgres" and n=="stdlib":s="Scout locates Go stdlib 1.24.6 in /usr/local/bin/gosu; runtime confirms executable."
 elif img=="postgres" and n=="libxml2":s="Scout locates libxml2 2.13.9-r2; runtime confirms /usr/lib/libxml2.so.2.13.9 and package metadata."
 elif img=="dev" and n=="stdlib":s="Scout locates Go stdlib in a native tool; runtime confirms esbuild and TypeScript tsc binaries."
 elif img=="dev" and n in {"brace-expansion","http-cache-semantics","ip-address","tar","undici"}:s=f"Runtime resolves global npm package and confirms version {c['version']}."
 else:
  alias={"gcc-12":"gcc-12-base","perl":"perl-base","pcre2":"libpcre2-8-0","util-linux":"util-linux"}.get(n)
  s=f"Runtime dpkg-query confirms {alias} in scanned version family." if alias else "Exact SARIF identifies package/version and locations; no separate package query."
 return {"assessment":"PRESENT","verification":s,"exactLocations":loc}
def reach(img,names,loc):
 if img=="postgres" and "libxml2" in names:return {"assessment":"PARTIALLY_OBSERVED_SPECIFIC_VULNERABLE_PATH_UNCONFIRMED","evidence":"A benign authenticated xml_is_well_formed('<vex/>') SQL call succeeded, showing PostgreSQL XML processing is reachable. It does not establish CVE-2026-86140 xmlSnprintfElements reachability or attacker control through the application.","targetInputToVulnerableOperation":"UNKNOWN","paths":loc}
 if img=="postgres" and "stdlib" in names:return {"assessment":"UNCONFIRMED","evidence":"Exact /usr/local/bin/gosu exists. Captured process list has PostgreSQL UID 70 and no gosu process; vulnerable Go routines/startup arguments were not traced.","targetInputToVulnerableOperation":"UNKNOWN","paths":loc}
 if img=="dev" and "stdlib" in names:return {"assessment":"UNCONFIRMED","evidence":"Go-linked esbuild/TypeScript executables are present. Startup evidence does not trace vulnerable routines or prove tool invocation across reload/build; a single process snapshot cannot establish non-reachability.","targetInputToVulnerableOperation":"UNKNOWN","paths":loc}
 if img=="dev" and names & {"brace-expansion","http-cache-semantics","ip-address","tar","undici"}:return {"assessment":"UNCONFIRMED","evidence":"Global npm packages are present and npm starts dev services, but specific module loading and attacker-controlled dataflow are unproven.","targetInputToVulnerableOperation":"UNKNOWN","paths":loc}
 return {"assessment":"UNCONFIRMED","evidence":"Exact image/package is present; no call-path trace establishes vulnerable routine use.","targetInputToVulnerableOperation":"UNKNOWN","paths":loc}
def netcontext(img,r):
 n=r.get("network",{});common={"name":n.get("name"),"driver":n.get("driver"),"internal":n.get("internal"),"scope":n.get("scope"),"peers":["polyhunter-web","polyhunter-worker","polyhunter-postgres"]}
 if img=="dev":return {"services":["polyhunter-web","polyhunter-worker"],"user":"node UID 1000","privileged":False,"capAdd":None,"capDrop":None,"CapEff":"0000000000000000","NoNewPrivs":False,"readOnlyRootFilesystem":False,"network":{**common,"webHostBinding":"127.0.0.1:3000","workerHostPorts":[]},"assessment":"Host web publication is loopback-only; Compose peers communicate. Non-root/CapEff=0 are context; mounts/rootfs writable, NoNewPrivs disabled, no CVE-specific mitigation."}
 return {"services":["polyhunter-postgres"],"user":"Config.User empty; PID 1 postgres UID/GID 70:70","privileged":False,"capAdd":None,"capDrop":None,"CapEff":"0000000000000000","NoNewPrivs":False,"readOnlyRootFilesystem":False,"network":{**common,"hostPublishedPort":False,"listenAddresses":"*"},"assessment":"5432 is not host-published, but PostgreSQL listens on * inside project-scoped Compose bridge (Internal=false) and accepts authenticated peers. UID 70/CapEff=0 do not prove vulnerable paths unreachable."}
def main():
 lock=rj(ROOT/".engineering/context-locks/PH-SEC-WO-001.json")
 runtime=rj(SUP/"runtime-context.json")
 cvsnap=rj(SUP/"cve-program-records-2026-10-03.json")
 osvsnap=rj(SUP/"osv-cve-records-2026-10-03.json")
 epsssnap=rj(SUP/"first-epss-2026-10-03.json")
 kevsnap=rj(SUP/"cisa-kev-2026-10-03.json")
 branch=git("branch","--show-current");head=git("rev-parse","HEAD");origin=git("rev-parse","origin/main")
 if branch!="security/ph-m01-wo001-vex-analysis" or origin!=MAIN or not ancestor(BASE,head) or not ancestor(INITIAL,head):raise SystemExit("STOP: Context Lock branch/main/lineage mismatch")
 checks=[]
 for ref,table in ((MAIN,MAINLOCK),(BASE,BASELOCK)):
  for p,want in table.items():
   got=blob(ref,p);local=git("hash-object",p) if p in [x["sarif"] for x in IMAGES] else None
   checks.append({"path":p,"sourceCommit":ref,"expectedGitBlobSha1":want,"actualGitBlobSha1":got,"localGitBlobSha1":local,"pass":got==want and (local is None or local==want)})
 if not all(x["pass"] for x in checks):raise SystemExit("STOP: Context Lock fingerprint mismatch")
 if runtime["imageDigests"]["dev"]!=lock["exactImages"]["polyhunter-dev:local"] or runtime["imageDigests"]["postgres"]!=lock["exactImages"]["postgres:17.11-alpine3.24"]:raise SystemExit("STOP: runtime digest mismatch")
 shas={p:sha(ROOT/p) for p in INPUTS}
 oldaudit=[{"path":im["sarif"],"publishedSha256":im["oldSha"],"recomputedSha256":sha(ROOT/im["sarif"]),"lockedGitBlobSha1":im["blob"],"localGitBlobSha1":git("hash-object",im["sarif"]),"publishedMatches":im["oldSha"].lower()==sha(ROOT/im["sarif"]).lower()} for im in IMAGES]
 wj(SUP/"context-lock-validation.json",{"workOrder":"PH-SEC-WO-001","validatedAtUtc":AT,"branch":branch,"headBeforeGeneration":INITIAL,"currentHead":head,"originMain":origin,"blockedBase":BASE,"contextLockSha256":sha(ROOT/".engineering/context-locks/PH-SEC-WO-001.json"),"lockedSourceChecks":checks,"runtimeDigests":runtime["imageDigests"],"sourceReceiptSha256":shas,"priorEvidenceSha256Audit":oldaudit,"result":"PASS"})
 cve_map={x["cve"]:x for x in cvsnap["records"]}
 osv_map={x["cve"]:x for x in osvsnap["records"]}
 ep_map={x["cve"]:x for x in epsssnap["data"]}
 kev_list=kevsnap["vulnerabilities"];kev_map={x["cveID"]:x for x in kev_list}
 groups={};inventory={"workOrder":"PH-SEC-WO-001","analysisTimestampUtc":AT,"scanner":{"name":"Docker Scout CLI","version":"1.24.0"},"images":[]}
 for im in IMAGES:
  sar=rj(ROOT/im["sarif"]);run=sar["runs"][0];rules={x["id"]:x for x in run["tool"]["driver"]["rules"]}
  occ=[];unique={}
  for idx,res in enumerate(run.get("results",[])):
   f=fields(res.get("message",{}).get("text",""));sev=f.get("Severity","").upper()
   if sev not in {"HIGH","CRITICAL"}:continue
   cve=res["ruleId"];rule=rules.get(cve,{})
   purls=rule.get("properties",{}).get("purls") or [f.get("Package","")]
   comps=[parsepurl(p) for p in purls]
   loc=[z.get("physicalLocation",{}).get("artifactLocation",{}).get("uri","") for z in res.get("locations",[])]
   one={"resultIndex":idx,"cve":cve,"severity":sev,"sarifLevel":res.get("level"),"components":comps,"purls":purls,"affectedRange":f.get("Affected range"),"fixedVersion":f.get("Fixed version"),"scannerEpss":f.get("EPSS Score"),"scannerEpssPercentile":f.get("EPSS Percentile"),"cvssScore":f.get("CVSS Score"),"cvssVector":f.get("CVSS Vector"),"locations":loc,"scoutReference":rule.get("helpUri"),"advisoryText":rule.get("help",{}).get("text",""),"title":rule.get("shortDescription",{}).get("text","")}
   occ.append(one);unique[cve]=sev
   g=groups.setdefault((im["key"],cve),{"image":im,"cve":cve,"severity":sev,"occurrences":[],"components":{}})
   if g["severity"]!=sev:raise SystemExit("STOP: CVE severity disagreement")
   g["occurrences"].append(one)
   for j,c in enumerate(comps):
    k=(c["type"],c["name"],c["version"]);x=g["components"].setdefault(k,{**c,"purls":[],"locations":[],"affectedRanges":[],"fixes":[]})
    if purls[j] not in x["purls"]:x["purls"].append(purls[j])
    for p in loc:
     if p not in x["locations"]:x["locations"].append(p)
    if one["affectedRange"] and one["affectedRange"] not in x["affectedRanges"]:x["affectedRanges"].append(one["affectedRange"])
    if one["fixedVersion"] and one["fixedVersion"].lower()!="not fixed" and one["fixedVersion"] not in x["fixes"]:x["fixes"].append(one["fixedVersion"])
  inventory["images"].append({"image":im["name"],"digest":im["digest"],"sarifPath":im["sarif"],"gitBlobSha1":im["blob"],"sha256":sha(ROOT/im["sarif"]),"highCriticalOccurrences":len(occ),"uniqueCves":len(unique),"uniqueCvesBySeverity":dict(collections.Counter(unique.values())),"occurrencesBySeverity":dict(collections.Counter(x["severity"] for x in occ)),"suppressedCount":sum(1 for x in occ if x.get("suppressions")),"findings":occ})
 ids=sorted({c for _,c in groups})
 if len(ids)!=57 or len(groups)!=80 or set(ids)-set(cve_map) or set(ids)-set(ep_map):raise SystemExit("STOP: SARIF and source reconciliation failure")
 wj(SUP/"sarif-inventory.json",inventory)
 source={"workOrder":"PH-SEC-WO-001","analysisTimestampUtc":AT,"snapshots":{"cveProgram":{"path":"cve-program-records-2026-10-03.json","sha256":shas[INPUTS[5]],"retrievedAtUtc":cvsnap.get("retrievedAtUtc")},"osv":{"path":"osv-cve-records-2026-10-03.json","sha256":shas[INPUTS[6]],"retrievedAtUtc":osvsnap.get("retrievedAtUtc")},"firstEpss":{"path":"first-epss-2026-10-03.json","sha256":shas[INPUTS[4]],"asOf":"2026-10-03","retrievedAtUtc":"2026-10-03T23:30:57Z"},"cisaKev":{"path":"cisa-kev-2026-10-03.json","sha256":shas[INPUTS[3]],"catalogVersion":kevsnap.get("catalogVersion"),"dateReleased":kevsnap.get("dateReleased"),"retrievalDate":"2026-10-03"}},"uniqueCves":len(ids),"cveProgramCoverage":sum(c in cve_map for c in ids),"epssCoverage":sum(c in ep_map for c in ids),"osvHttp200":sum(osv_map.get(c,{}).get("httpStatus")==200 for c in ids),"osvHttp404":sum(osv_map.get(c,{}).get("httpStatus")==404 for c in ids),"kevMatches":sorted(set(ids)&set(kev_map)),"records":[]}
 for c in ids:
  e=cve_map[c];cn,d=cnadata(e);o=osv_map.get(c,{});ore=o.get("record",{})
  source["records"].append({"cve":c,"httpStatus":e.get("httpStatus"),"title":cn.get("title",""),"cna":cn.get("providerMetadata",{}).get("shortName"),"cnaUpdated":cn.get("providerMetadata",{}).get("dateUpdated"),"description":d,"affected":cn.get("affected",[]),"problemTypes":cn.get("problemTypes",[]),"references":cn.get("references",[]),"metrics":cn.get("metrics",[]),"epss":ep_map[c],"kev":{"listed":c in kev_map,"catalogVersion":kevsnap.get("catalogVersion"),"entry":kev_map.get(c)},"osv":{"httpStatus":o.get("httpStatus"),"id":ore.get("id"),"summary":ore.get("summary"),"details":ore.get("details"),"modified":ore.get("modified"),"affected":ore.get("affected",[]),"references":ore.get("references",[])}})
 wj(SUP/"cve-source-analysis.json",source)
 rows=[];statuses=collections.Counter()
 for (ik,c),g in groups.items():
  im=g["image"];ce=cve_map[c];cn,desc=cnadata(ce);o=osv_map.get(c,{});ore=o.get("record",{});ep=ep_map[c];ke=kev_map.get(c)
  comps=[]
  for _,co in sorted(g["components"].items()):
   co=dict(co);co["presenceEvidence"]=presence(ik,co,co["locations"]);comps.append(co)
  loc=[p for co in comps for p in co["locations"]];names={co["name"].lower() for co in comps}
  ci=next(i for i,x in enumerate(cvsnap["records"]) if x["cve"]==c)
  ei=next(i for i,x in enumerate(epsssnap["data"]) if x["cve"]==c)
  oi=next(i for i,x in enumerate(osvsnap["records"]) if x["cve"]==c)
  ki=next((i for i,x in enumerate(kev_list) if x.get("cveID")==c),None)
  scanrows=[{"sarifResultIndex":x["resultIndex"],"severity":x["severity"],"purls":x["purls"],"affectedRange":x["affectedRange"],"fixedVersionReportedByScout":x["fixedVersion"],"scannerEpssScore":x["scannerEpss"],"scannerEpssPercentile":x["scannerEpssPercentile"],"cvssScore":x["cvssScore"],"cvssVector":x["cvssVector"],"locations":x["locations"],"scoutReference":x["scoutReference"],"advisoryText":x["advisoryText"]} for x in g["occurrences"]]
  refs=[
   {"source":"Docker Scout locked SARIF","path":im["sarif"],"sha256":sha(ROOT/im["sarif"]),"gitBlobSha1":im["blob"],"jsonPointer":f"/runs/0/results/{g['occurrences'][0]['resultIndex']}","allResultIndexes":[x["resultIndex"] for x in g["occurrences"]]},
   {"source":"CVE Program CNA","path":"PH-SEC-WO-001/cve-program-records-2026-10-03.json","sha256":shas[INPUTS[5]],"jsonPointer":f"/records/{ci}","url":f"https://cveawg.mitre.org/api/cve/{c}"},
   {"source":"FIRST EPSS","path":"PH-SEC-WO-001/first-epss-2026-10-03.json","sha256":shas[INPUTS[4]],"jsonPointer":f"/data/{ei}","url":f"https://api.first.org/data/v1/epss?cve={c}&date=2026-10-03"},
   {"source":"CISA KEV snapshot","path":"PH-SEC-WO-001/cisa-kev-2026-10-03.json","sha256":shas[INPUTS[3]],"jsonPointer":f"/vulnerabilities/{ki}" if ki is not None else "/vulnerabilities","match":ke or "no matching CVE in full catalog snapshot","url":"https://www.cisa.gov/known-exploited-vulnerabilities-catalog"},
   {"source":"exact runtime","path":"PH-SEC-WO-001/runtime-context.json","sha256":shas[INPUTS[0]],"imageDigest":im["digest"]},
   {"source":"runtime security/package inspection","path":"PH-SEC-WO-001/runtime-component-inspection.txt","sha256":shas[INPUTS[2]]},
   {"source":"OSV cross-check","path":"PH-SEC-WO-001/osv-cve-records-2026-10-03.json","sha256":shas[INPUTS[6]],"jsonPointer":f"/records/{oi}","httpStatus":o.get("httpStatus"),"url":f"https://api.osv.dev/v1/vulns/{c}"}]
  fix=sorted({f for co in comps for f in co["fixes"]})
  fixfields=sorted({x["fixedVersion"] for x in g["occurrences"] if x.get("fixedVersion")})
  container=netcontext(ik,runtime);status="UNDER_INVESTIGATION";statuses[status]+=1
  rows.append({"cve":c,"image":im["name"],"imageDigest":im["digest"],"environment":"local-dev","severity":g["severity"],"component":"; ".join(f"{co['type']}:{co['name']}@{co['version']}" for co in comps),"version":[co["version"] for co in comps],"components":comps,
   "scanner":{"name":"Docker Scout CLI","version":"1.24.0","sarifPath":im["sarif"],"sarifGitBlobSha1":im["blob"],"sarifSha256":sha(ROOT/im["sarif"]),"occurrenceCount":len(g["occurrences"]),"findings":scanrows,"suppressed":False},
   "vulnerability":{"title":cn.get("title",""),"upstreamDescription":desc,"cna":cn.get("providerMetadata",{}).get("shortName"),"cnaUpdatedAt":cn.get("providerMetadata",{}).get("dateUpdated"),"affectedVersionStatements":cn.get("affected",[]),"cveProgramReferences":cn.get("references",[]),"osvHttpStatus":o.get("httpStatus"),"osvSummary":ore.get("summary"),"osvDetails":ore.get("details")},
   "upstreamFix":{"exactImageStatus":"scanner detects a version in the affected range","scannerReportedFixedVersions":fix,"scannerFixedVersionFields":fixfields,"assessment":("Scout reports candidate fix versions: "+", ".join(fix)) if fix else "Scout reports not fixed for the detected package; this does not prove no upstream patch exists.","fixPresentInExactDigest":False,"note":"Candidate fix is not proof the immutable digest is patched; distro backport differences remain possible."},
   "kev":{"listed":ke is not None,"catalogVersion":kevsnap.get("catalogVersion"),"catalogReleaseDate":kevsnap.get("dateReleased"),"entry":ke,"absenceMeaning":"Prioritization only; absence is not NOT_AFFECTED evidence."},
   "epss":{"score":float(ep["epss"]),"percentile":float(ep["percentile"]),"asOfDate":ep.get("date"),"source":"FIRST","scannerReportedValues":sorted({(x["scannerEpss"],x["scannerEpssPercentile"]) for x in g["occurrences"] if x["scannerEpss"] is not None}),"use":"Prioritization only; low EPSS is not NOT_AFFECTED evidence."},
   "componentPresence":{"assessment":"PRESENT","basis":"Exact digest SARIF location with per-component runtime corroboration."},
   "prerequisites":{"upstreamCnaDescription":desc,"knownPrerequisitesInTarget":"UNKNOWN","targetAssessment":"CNA narrative records upstream conditions where stated; no exploit-precondition test or application-to-vulnerable-operation trace was performed."},
   "reachability":reach(ik,names,loc),
   "attackerControl":{"upstreamNarrativeMentionsAttackerOrInput":bool(re.search(r"attacker|attacker-controlled|crafted|malicious|remote|request|input|message|file|packet|HTTP",desc,re.I)),"targetInputControl":"UNKNOWN","assessment":"No proof whether an attacker can control this operation in the exact runtime. Local binding, one process snapshot, or KEV absence is not proof."},
   "networkPrivilegeContext":container,
   "mitigation":{"verifiedCveSpecificInlineMitigations":[],"contextualControls":[container["assessment"],"No CVE-specific disabling configuration established."],"notClaimedAsMitigations":["low EPSS","absence from KEV","loopback web binding","unpublished PostgreSQL port","non-root service identity","CapEff=0"]},
   "status":status,"justification":{"vexJustificationCode":None,"rationale":"UNDER_INVESTIGATION: vulnerable component/version is present in the exact digest, while reachability, attacker control and target prerequisites remain unproven. No NOT_AFFECTED proposal."},
   "independentAuditor":"PENDING — executor is not independent auditor","ownerApproval":"PENDING — no owner approval recorded","dispositionTimestamp":AT,
   "expiry":{"expiresAt":None,"policyMeaning":"No NOT_AFFECTED exception is active; UNDER_INVESTIGATION remains blocking.","revalidationDeadline":(datetime.fromisoformat(AT.replace("Z","+00:00"))+timedelta(days=7)).isoformat().replace("+00:00","Z"),"revalidationTriggers":["before promotion/gate evaluation","new digest/scanner","new vendor advisory or fix data","KEV change","material runtime/network/privilege/data-flow change","stale evidence"],"futureNotAffected":"Any future local-dev/CI NOT_AFFECTED proposal expires within seven days under policy or earlier on material trigger."},"evidenceRefs":refs})
 if len(rows)!=80 or source["kevMatches"]!=["CVE-2023-44487"] or source["epssCoverage"]!=57 or source["cveProgramCoverage"]!=57:raise SystemExit("STOP: output counts mismatch")
 byimg={}
 for im in IMAGES:
  rr=[x for x in rows if x["image"]==im["name"]]
  byimg[im["key"]]={"image":im["name"],"digest":im["digest"],"uniqueCveRows":len(rr),"critical":sum(x["severity"]=="CRITICAL" for x in rr),"high":sum(x["severity"]=="HIGH" for x in rr),"occurrences":sum(x["scanner"]["occurrenceCount"] for x in rr),"statusCounts":dict(collections.Counter(x["status"] for x in rr))}
 wj(SUP/"cve-source-analysis.json",source)
 artifactpaths=INPUTS+[".engineering/evidence/PH-SEC-WO-001/context-lock-validation.json",".engineering/evidence/PH-SEC-WO-001/sarif-inventory.json",".engineering/evidence/PH-SEC-WO-001/cve-source-analysis.json",".engineering/evidence/PH-SEC-WO-001/build_vex_evidence.py"]
 artifacts=[{"path":p,"sha256":sha(ROOT/p),"bytes":(ROOT/p).stat().st_size} for p in artifactpaths]
 vex={"schemaVersion":"1.0.0","workOrder":"PH-SEC-WO-001","policy":{"canonicalMain":MAIN,"policyPath":".engineering/proposals/PH-SEC-VEX-POLICY.md","adrPath":".engineering/decisions/ADR-0007-VEX-DISPOSITION-GATE.md","highCriticalDefault":"UNDER_INVESTIGATION","independentAuditorRequired":True,"ownerApprovalRequired":True,"executorSelfApproval":False},
 "result":"BLOCKED_UNRESOLVED","analysisTimestampUtc":AT,"analysisBranch":"security/ph-m01-wo001-vex-analysis","pr":{"number":19,"url":"https://github.com/KayzenRoot/poly-hunter/pull/19","stateAtPreflight":"OPEN","draftAtPreflight":True,"baseBranch":"feat/ph-m01-tenancy-persistence"},"scope":"Exact-image local-dev analysis of locked final SARIF HIGH/CRITICAL findings only; no product/runtime implementation changes.",
 "reconciliation":{"uniqueCvesAcrossImages":57,"imageCveRows":len(rows),"scannerOccurrences":sum(x["scanner"]["occurrenceCount"] for x in rows),"byImage":byimg,"statusCounts":dict(statuses),"kevMatchedCves":source["kevMatches"],"unresolvedBlockerRows":sum(x["status"] in {"AFFECTED","UNDER_INVESTIGATION"} for x in rows)},
 "sourceSnapshots":source["snapshots"],"runtimeEvidence":{"devDigest":runtime["imageDigests"]["dev"],"postgresDigest":runtime["imageDigests"]["postgres"],"runtimeReceipt":"PH-SEC-WO-001/runtime-context.json","securityInspection":"PH-SEC-WO-001/runtime-component-inspection.txt","xmlProbe":"Benign authenticated xml_is_well_formed('<vex/>') returned true; no exploit payload."},
 "sourceArtifacts":artifacts,"items":rows,"resultRationale":"All 80 rows remain UNDER_INVESTIGATION: exact vulnerable components/versions are present, but evidence does not prove a non-exploitable path or a fix in these immutable digests."}
 vexpath=ROOT/".engineering/evidence/PH-SEC-WO-001-VEX.json";mdpath=ROOT/".engineering/evidence/PH-SEC-WO-001-VEX.md";evpath=ROOT/".engineering/evidence/PH-SEC-WO-001-EVIDENCE.md"
 wj(vexpath,vex)
 rows.sort(key=lambda x:(0 if x["image"]==IMAGES[0]["name"] else 1,0 if x["severity"]=="CRITICAL" else 1,x["cve"]))
 md=["# PH-SEC-WO-001 — VEX por imagem e CVE","","**Resultado: BLOCKED_UNRESOLVED** — todos os 80 pares imagem/CVE seguem UNDER_INVESTIGATION.","",f"Inventário: {len(ids)} CVE IDs, 80 pares imagem/CVE, {sum(x['scanner']['occurrenceCount'] for x in rows)} ocorrências; timestamp {AT} UTC.","","## Reconciliação","","| Imagem | Digest | HIGH | CRITICAL | Linhas VEX | Ocorrências |","| --- | --- | ---: | ---: | ---: | ---: |"]
 for k in ("dev","postgres"):
  z=byimg[k];md.append(f"| {z['image']} | {z['digest']} | {z['high']} | {z['critical']} | {z['uniqueCveRows']} | {z['occurrences']} |")
 md += ["","Cada registro JSON é individual por imagem/CVE. Componentes/versões múltiplos, paths, scanner ranges, prerequisite description, controles, refs e índices SARIF estão preservados no registro correspondente.","",
 "## Contexto de runtime","","- Dev: web/worker UID 1000, CapEff=0; web host binding 127.0.0.1:3000 e worker sem porta; bridge Compose project-scoped, Internal=false; peers comunicam; rootfs/mounts RW, NoNewPrivs=0.",
 "- PostgreSQL: PID 1 UID 70, CapEff=0; porta 5432 sem publicação no host, listen_addresses=* na bridge project-scoped, Internal=false. Probe XML benigna autenticada comprova parser acessível mas não a função CVE específica nem input controlado pela aplicação.",
 "- Os controles são contextuais, não mitigação inline. Nenhum exploit foi executado.","",
 "## Findings","","| Imagem | CVE | Sev. | Componente(s) e versão(s) | Fix Scout | KEV | EPSS/percentil | Reachability | Status |","| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
 for r in rows:
  co="; ".join(f"{x['name']}@{x['version']}" for x in r["components"]);fx=", ".join(r["upstreamFix"]["scannerReportedFixedVersions"]) or "não fixado pelo Scout";rr=r["reachability"]["assessment"]
  md.append(f"| {r['image']} | {r['cve']} | {r['severity']} | {co} | {fx} | {'SIM' if r['kev']['listed'] else 'não'} | {r['epss']['score']:.6f}/{r['epss']['percentile']:.6f} | {rr} | {r['status']} |")
 md += ["","## Interpretação individual","","Cada linha da tabela referencia o objeto completo do CVE no JSON, com descrição e advisory CNA/upstream, range afetada, fixes, presença, pré-requisitos, entrada controlável, contexto de rede/privilégio, mitigação, VEX justification, expiry e evidence refs reproduzíveis.","",
 "CVE KEV: "+", ".join(source["kevMatches"])+"; EPSS baixo e ausência no KEV não sustentam NOT_AFFECTED. O finding HIGH libxml2 tem processamento XML autenticado observado em teste benigno; o caminho xmlSnprintfElements e controle atacante permanecem desconhecidos. Go/nativos/npm e pacotes do dev foram detectados/presentes; as rotinas vulneráveis não foram rastreadas. gosu e libxml2 existem no digest PostgreSQL; reachability específica não provada.","",
 "## Gate","","HIGH_ASSURANCE: BLOCKED. Todos os 80 findings ficam UNDER_INVESTIGATION. Nenhum NOT_AFFECTED foi proposto ou autoaprovado; PR #15 não foi alterada.",""]
 mdpath.write_text("\n".join(md).rstrip()+"\n",encoding="utf-8")
 genhash=sha(__file__)
 ev=["# PH-SEC-WO-001 Evidence Bundle","","**Resultado:** BLOCKED_UNRESOLVED  ","**Branch/PR:** security/ph-m01-wo001-vex-analysis / PR #19 (draft; base feat/ph-m01-tenancy-persistence)  ",f"**Head antes da geração:** {INITIAL}  ","**Timestamp:** "+AT+" UTC","","## Escopo e autoridade","","Análise somente dos findings HIGH/CRITICAL nas duas imagens travadas do PH-M01-WO-001 conforme política VEX/ADR-0007 em main "+MAIN+". Alterações limitadas aos artefatos de evidência PH-SEC-WO-001; nenhuma mudança de Dockerfile, Compose, dependências, schema, migration, TenantContext ou código de produto. Não houve merge PR #15 nem início de PH-M01-WO-002.","",
 "## Context Lock e integridade","","- Context Lock: PASS; branch, linhagem, origin/main, seis fingerprints e image digests conferem.",
 "- SARIF local corresponde aos Git blob SHA-1 travados.",
 "- Discrepância herdada nos SHA-256 do Evidence Bundle PH-M01: dev publicado E703FF... vs recalculado E811C0...; PostgreSQL publicado 44A3C6... vs recalculado AC3C32... . Git blob IDs SHA-1 conferem. Arquivos-base não foram alterados; divergência registrada em context-lock-validation.json.",
 "- Preflight: PH-SEC-WO-001/context-lock-validation.json.","",
 "## Imagens/reconciliação","","| Imagem | Digest | HIGH únicos | CRITICAL únicos | Linhas imagem/CVE | Ocorrências |","| --- | --- | ---: | ---: | ---: | ---: |"]
 for k in ("dev","postgres"):
  z=byimg[k];ev.append(f"| {z['image']} | {z['digest']} | {z['high']} | {z['critical']} | {z['uniqueCveRows']} | {z['occurrences']} |")
 ev += ["",f"57 IDs CVE distintos, 80 pares e {sum(x['scanner']['occurrenceCount'] for x in rows)} ocorrências; todas as 80 linhas UNDER_INVESTIGATION. KEV match: {', '.join(source['kevMatches'])}.",
 "Docker Scout CLI 1.24.0. Inventário por resultado: PH-SEC-WO-001/sarif-inventory.json. Disposição completa: PH-SEC-WO-001-VEX.json e PH-SEC-WO-001-VEX.md.","",
 "## Sources e runtime","","- CVE Program API: 57/57 HTTP 200; raw snapshot cve-program-records-2026-10-03.json.",
 "- FIRST EPSS: 57/57, data 2026-10-03; first-epss-2026-10-03.json.",
 f"- CISA KEV: catálogo {kevsnap.get('catalogVersion')} publicado {kevsnap.get('dateReleased')}; cisa-kev-2026-10-03.json.",
 f"- OSV complementar: {source['osvHttp200']} HTTP 200, {source['osvHttp404']} HTTP 404; ausência não é prova.",
 "- Hashes e timestamps das fontes em cve-source-analysis.json.",
 "- Runtime exact-digest: runtime-context.json e runtime-component-inspection.txt; serviços healthy/running; digests conferem.",
 "- Dev UID 1000/CapEff=0; web loopback e worker sem host port. PostgreSQL UID 70/CapEff=0, sem porta publicada, listen_addresses=* na Compose bridge project-scoped/Internal=false.",
 "- Probe xml_is_well_formed benigna autenticada confirma parser SQL acessível, sem confirmação da função vulnerável ou fluxo de input externo.","",
 "## Riscos restantes","","- 80/80 permanecem UNDER_INVESTIGATION, pois componentes/versões vulneráveis estão presentes e não há prova completa de correção no digest ou caminho não explorável.",
 "- Priorizar CVE-2023-44487, único match KEV e EPSS elevado; aplicabilidade ao processo executado continua sem call-path evidence.",
 "- Dev inclui Go em ferramentas esbuild/TypeScript, npm globals, Perl, util-linux, PCRE2 e gcc-12-base. PostgreSQL inclui Go stdlib em gosu e libxml2. Para cada CVE o input attacker-controlled e reachability permanecem desconhecidos ou parciais.",
 "- Somente local-dev observado; CI/staging/produção não avaliados. Auditor independente e owner approval pendentes para qualquer NOT_AFFECTED.","",
 "## Checks","","- Context Lock, linhagem, fingerprints, image digests: PASS.",
 "- Parse determinístico: PASS; dev 56 (50 HIGH, 6 CRITICAL), PG 24 (22 HIGH, 2 CRITICAL), conjunto 57, linhas 80, ocorrências 109.",
 "- Sources: PASS; CVE Program e EPSS 57/57; KEV comparado ao catálogo; lacunas OSV anotadas.",
 "- Inspeção runtime/package/security: PASS; limitações de call-path explícitas.",
 "- git diff --check e revisão de paths: executar após geração e antes do commit.",
 "- npm/testes de produto não executados; mudança é somente evidência.","",
 "## Entregáveis","","- .engineering/evidence/PH-SEC-WO-001-VEX.json",
 "- .engineering/evidence/PH-SEC-WO-001-VEX.md",
 "- .engineering/evidence/PH-SEC-WO-001-EVIDENCE.md",
 "- Recibos/análises em .engineering/evidence/PH-SEC-WO-001/.","","## SHA-256 de artefatos",""]
 for p,label in [(vexpath,"VEX JSON"),(mdpath,"VEX Markdown"),(SUP/"sarif-inventory.json","SARIF inventory"),(SUP/"cve-source-analysis.json","CVE source analysis"),(SUP/"context-lock-validation.json","Context Lock validation")]:ev.append(f"- {label}: {sha(p)}")
 ev.append(f"- Generator: {genhash}")
 evpath.write_text("\n".join(ev)+"\n",encoding="utf-8")
 print(json.dumps({"result":vex["result"],"uniqueCves":len(ids),"imageCveRows":len(rows),"occurrences":sum(x["scanner"]["occurrenceCount"] for x in rows),"byImage":byimg,"statuses":dict(statuses),"kev":source["kevMatches"],"osv200":source["osvHttp200"],"osv404":source["osvHttp404"],"vexJson":sha(vexpath),"vexMd":sha(mdpath),"bundle":sha(evpath),"generator":genhash},ensure_ascii=False,indent=2))
if __name__=="__main__":main()
