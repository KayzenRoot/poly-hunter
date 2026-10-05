#!/usr/bin/env python3
"""PH-SEC-WO-007 / PREFLIGHT - deterministic reconciliation receipts.

Re-derives, from repository evidence only, every PREFLIGHT assertion the Work
Order requires. Exits non-zero if any assertion fails, so the receipt cannot be
silently stale.

Inputs are pinned by the Context Lock:
  canonicalMainSha = 64ec83d02dbf9c85ca9718eb319efb44a1d62b76
  parentHead       = 7d5be250255bd20cb0b20d6713f6f41c52c73b47
  locked SARIF     = .engineering/evidence/PH-SEC-WO-005/validation/CR-01/
                     polyhunter-dev-cr01.sarif at parentHead
"""

import json
import subprocess
import sys
from pathlib import Path

CANONICAL_MAIN = "64ec83d02dbf9c85ca9718eb319efb44a1d62b76"
PARENT_HEAD = "7d5be250255bd20cb0b20d6713f6f41c52c73b47"
TARGET_DIGEST = ("sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3")
SARIF_PATH = (".engineering/evidence/PH-SEC-WO-005/validation/CR-01/"
              "polyhunter-dev-cr01.sarif")
EXPECTED_CVES = [
    "CVE-2026-102010", "CVE-2026-78409", "CVE-2026-48962", "CVE-2026-102276",
    "CVE-2026-102278", "CVE-2026-14257", "CVE-2026-19534", "CVE-2026-48959",
    "CVE-2026-69152", "CVE-2026-73566", "CVE-2026-82560", "CVE-2026-103111",
    "CVE-2026-69192", "CVE-2026-95619", "CVE-2026-78410", "CVE-2026-78408",
    "CVE-2026-85091", "CVE-2026-57432", "CVE-2026-76642", "CVE-2026-93748",
    "CVE-2026-12087", "CVE-2026-13221",
]


def git(*args):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def blob_sha(ref, path):
    rc, out, _ = git("ls-tree", ref, "--", path)
    if rc != 0 or not out:
        return None
    return out.split()[2]


def main():
    checks = []

    def check(name, ok, detail):
        checks.append({"check": name, "result": "PASS" if ok else "FAIL",
                       "detail": detail})

    # ---- P1 branch / ancestry ----
    rc, branch, _ = git("rev-parse", "--abbrev-ref", "HEAD")
    check("P1_branch", branch == "security/ph-m01-dev-nongo-vex",
          f"HEAD branch={branch}")
    rc, _, _ = git("merge-base", "--is-ancestor", PARENT_HEAD, "HEAD")
    check("P1_parent_is_ancestor", rc == 0,
          f"git merge-base --is-ancestor {PARENT_HEAD} HEAD -> rc={rc}")
    rc, mb, _ = git("merge-base", "HEAD", PARENT_HEAD)
    check("P1_merge_base_is_parent_head", mb == PARENT_HEAD,
          f"merge-base={mb}")

    # ---- P2 context lock fingerprints ----
    lock = json.loads(Path(".engineering/context-locks/"
                           "PH-SEC-WO-007.json").read_text(encoding="utf-8"))
    alias = {"main": lock["canonicalMainSha"], "parent": lock["parentHead"]}
    fp = []
    for key, expected in sorted(lock["criticalSources"].items()):
        ref_name, path = key.split(":", 1)
        actual = blob_sha(alias[ref_name], path)
        fp.append({"source": key, "expected": expected, "actual": actual,
                   "match": actual == expected})
    check("P2_fingerprints", all(f["match"] for f in fp),
          f"{sum(1 for f in fp if f['match'])}/{len(fp)} fingerprints match")

    # ---- P3 exact target image digest (host-side observation) ----
    rc, actual_img, _ = git("rev-parse", "HEAD")
    digest_file = Path(".engineering/evidence/PH-SEC-WO-007/validation/"
                       "image-identity.txt")
    observed = digest_file.read_text(encoding="utf-8").strip() if digest_file.exists() else ""
    check("P3_target_digest_matches_lock", TARGET_DIGEST in observed,
          f"lock={TARGET_DIGEST} observed_file_contains={TARGET_DIGEST in observed}")

    # ---- P4 locked SARIF -> exactly 22 unique HIGH/CRITICAL, 20 HIGH + 2 CRITICAL ----
    sarif_blob = blob_sha(PARENT_HEAD, SARIF_PATH)
    check("P4_sarif_fingerprint", sarif_blob ==
          lock["criticalSources"][f"parent:{SARIF_PATH}"],
          f"blob={sarif_blob}")

    sarif = json.loads(Path(SARIF_PATH).read_text(encoding="utf-8"))
    rules = sarif["runs"][0]["tool"]["driver"]["rules"]
    hc, high, crit = [], [], []
    for r in rules:
        sev = float(r["properties"]["security-severity"])
        if sev >= 7.0:
            hc.append(r["id"])
            (crit if sev >= 9.0 else high).append(r["id"])
    check("P4_unique_high_critical_22", len(hc) == 22 and len(set(hc)) == 22,
          f"unique={len(set(hc))} total={len(hc)}")
    check("P4_high_20_critical_2", len(high) == 20 and len(crit) == 2,
          f"HIGH={len(high)} CRITICAL={len(crit)}")
    check("P4_no_duplicate_cve_rules",
          len({r["id"] for r in rules}) == len(rules),
          f"rules={len(rules)} distinct_ids={len({r['id'] for r in rules})}")

    # ---- P5 original 35 Go HIGH/CRITICAL remain zero ----
    go_hc = [r["id"] for r in rules
             if float(r["properties"]["security-severity"]) >= 7.0
             and ("golang" in (r["properties"].get("purls") or [""])[0]
                  or "GO-2026" in r["id"])]
    any_go = [r["id"] for r in rules
              if "golang" in (r["properties"].get("purls") or [""])[0]]
    check("P5_go_high_critical_zero", len(go_hc) == 0,
          f"go_high_critical={len(go_hc)}; golang rules at any severity={len(any_go)}")

    # ---- P6 exact CVE set reconciliation against the Work Order ----
    only_sarif = sorted(set(hc) - set(EXPECTED_CVES))
    only_wo = sorted(set(EXPECTED_CVES) - set(hc))
    check("P6_cve_set_exact_match", not only_sarif and not only_wo,
          f"in_sarif_not_wo={only_sarif} in_wo_not_sarif={only_wo}")

    # ---- P7 KEV / EPSS snapshot presence ----
    kev = json.loads(Path(".engineering/evidence/PH-SEC-WO-007/sources/"
                          "cisa-kev.json").read_text(encoding="utf-8"))
    epss = json.loads(Path(".engineering/evidence/PH-SEC-WO-007/sources/"
                           "first-epss.json").read_text(encoding="utf-8"))
    kev_hits = sorted({v["cveID"] for v in kev["vulnerabilities"]}
                      & set(EXPECTED_CVES))
    epss_rows = {d["cve"] for d in epss["data"]}
    check("P7_epss_complete_22", epss_rows == set(EXPECTED_CVES),
          f"rows={len(epss_rows)}/22")
    check("P7_kev_snapshot_present", bool(kev.get("catalogVersion")),
          f"catalogVersion={kev.get('catalogVersion')} "
          f"dateReleased={kev.get('dateReleased')} "
          f"targets_in_kev={len(kev_hits)}")

    report = {
        "workOrder": "PH-SEC-WO-007",
        "canonicalMainSha": CANONICAL_MAIN,
        "parentHead": PARENT_HEAD,
        "targetDigest": TARGET_DIGEST,
        "sarif": {"path": SARIF_PATH, "blob": sarif_blob,
                  "rules": len(rules), "results": len(sarif["runs"][0]["results"]),
                  "tool": sarif["runs"][0]["tool"]["driver"]["name"],
                  "toolVersion": sarif["runs"][0]["tool"]["driver"]["version"]},
        "fingerprints": fp,
        "kev": {"catalogVersion": kev.get("catalogVersion"),
                "dateReleased": kev.get("dateReleased"),
                "catalogCount": kev.get("count"),
                "targetsInKev": kev_hits},
        "epss": {"date": epss["data"][0]["date"] if epss["data"] else None,
                 "rows": len(epss_rows)},
        "checks": checks,
        "result": "PASS" if all(c["result"] == "PASS" for c in checks) else "FAIL",
    }
    json.dump(report, sys.stdout, indent=2)
    print()
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())