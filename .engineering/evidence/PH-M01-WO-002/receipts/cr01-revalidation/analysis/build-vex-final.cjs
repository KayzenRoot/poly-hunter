const crypto = require("node:crypto");
const fs = require("node:fs");

const PRIOR_ARTIFACT =
  "sha256:4cb8f254120efe66d7781c2261ee451aef50e8243bde6471271995551783d538";
const FINAL_ARTIFACT =
  "sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c";
const PRIOR_WO002_ARTIFACT = "sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3";
const BRANCH = "feat/ph-m01-identity-rbac";
const HEAD = process.env.REVALIDATION_HEAD || "PENDING";

const wo007 = JSON.parse(
  fs.readFileSync(".engineering/evidence/PH-SEC-WO-007-VEX.json", "utf8"),
);
const wo008 = JSON.parse(
  fs.readFileSync(".engineering/evidence/PH-SEC-WO-008-VEX.json", "utf8"),
);

const byCve = new Map();
for (const f of wo007.findings) {
  byCve.set(f.cve, { source: "PH-SEC-WO-007", finding: f });
}
for (const f of wo008.findings) {
  byCve.set(f.cve, { source: "PH-SEC-WO-008", finding: f });
}

// ---- parse the FINAL artifact scan --------------------------------------
const parseMsg = (r) => {
  const t = (r.message && r.message.text) || "";
  const o = {};
  for (const l of t.split("\n")) {
    const i = l.indexOf(":");
    if (i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return o;
};
const sarif = JSON.parse(
  fs.readFileSync(".engineering/evidence/PH-M01-WO-002/receipts/runtime/final-image-scan.sarif", "utf8"),
);
const scan = new Map();
for (const r of sarif.runs[0].results || []) {
  const p = parseMsg(r);
  const k = r.ruleId + "|" + p["Package"];
  if (!scan.has(k)) {
    scan.set(k, {
      cve: r.ruleId,
      scannerSeverity: p["Severity"],
      packagePurl: p["Package"],
      affectedRange: p["Affected range"],
      reportedFixedVersion: p["Fixed version"],
      epssScore: p["EPSS Score"],
      epssPercentile: p["EPSS Percentile"],
    });
  }
}
const allRows = [...scan.values()].sort((a, b) => a.cve.localeCompare(b.cve));
const highCritical = allRows.filter(
  (r) => r.scannerSeverity === "HIGH" || r.scannerSeverity === "CRITICAL",
);

// ---- the three Perl rows introduced by this delta -----------------------
const perlDelta = {
  "CVE-2026-42496": {
    component: "Perl Archive::Tar < 3.08 (symlink extraction path escape)",
    justification: "vulnerable_code_not_present",
    evidence:
      "Re-proven on the FINAL artifact by three independent methods: (1) `dpkg -S Archive/Tar.pm` returns 'no path found' and `perl-modules`/`perl` are dpkg status 'not-installed', so no installed package provides the module; (2) `find / -name Tar.pm -path '*Archive*'` returns zero hits on every mount of the image; (3) the image's own perl cannot load it — `perl -MArchive::Tar` fails with \"Can't locate Archive/Tar.pm in @INC\" enumerating all 10 @INC roots. Only perl-base 5.36.0-7+deb12u3 is installed, and Archive::Tar is not part of perl-base. Receipt 04.",
    receipts: [
      "receipts/cr01-revalidation/04-perl-archive-tar-absence.txt",
      "receipts/cr01-revalidation/03-final-perl-and-toolchain-packages.txt",
    ],
  },
  "CVE-2026-42497": {
    component: "Perl Archive::Tar < 3.08 (hardlink extraction path escape)",
    justification: "vulnerable_code_not_present",
    evidence:
      "Same component and same absence proof as CVE-2026-42496, re-run on the FINAL artifact: the hardlink extraction path lives in the same absent module. Receipt 04.",
    receipts: [
      "receipts/cr01-revalidation/04-perl-archive-tar-absence.txt",
      "receipts/cr01-revalidation/03-final-perl-and-toolchain-packages.txt",
    ],
  },
  "CVE-2026-8376": {
    component:
      "Perl interpreter < 5.40.5-RC1, heap buffer overflow in Perl_study_chunk",
    justification: "vulnerable_code_cannot_be_controlled_by_adversary",
    evidence:
      "The advisory scopes the defect to 32-BIT (ILP32) Perl builds. That prerequisite is unsatisfiable on the FINAL artifact and was re-measured directly: the installed perl-base is 5.36.0-7+deb12u3 amd64; the container kernel is x86_64; the perl binary's ELF header has EI_CLASS=0x02 (ELF64) and e_machine=0x3e (x86-64), so the interpreter cannot even be loaded as a 32-bit build; and the interpreter itself reports Config{ivsize}=8 bytes (64-bit IV), Config{longsize}=8 (LONG_BIT=64), Config{ptrsize}=8 (64-bit pointers), ivtype=long, use64bitint=define. The overflow therefore has no reachable arithmetic precondition. This disposition rests on the impossible 32-bit prerequisite, not on perl being unexecuted. Receipt 05.",
    receipts: [
      "receipts/cr01-revalidation/05-perl-bitness-ivsize.txt",
      "receipts/cr01-revalidation/06-runtime-assumptions.txt",
    ],
  },
};

// ---- revalidation of every prior row -------------------------------------
const EQUIVALENCE_AXES = [
  {
    axis: "component/package",
    method:
      "Same scanner, same unfiltered command, both artifacts compared row by row on the package purl.",
    receipt: "receipts/cr01-revalidation/07-component-version-comparison.txt",
    result: "identical for all 80 rows (0 added, 0 changed, 0 removed)",
  },
  {
    axis: "exact version",
    method:
      "Debian side: dpkg-query inventory of the FINAL image diffed against the WO-007 artifact inventory. npm side: version carried in the package purl and compared directly.",
    receipt: "receipts/cr01-revalidation/01-final-image-dpkg-inventory.txt",
    result:
      "Debian inventory byte-identical (88 packages, zero differences vs the WO-007 artifact). Every npm purl version identical.",
  },
  {
    axis: "architecture",
    method:
      "dpkg architecture field, container uname -m, ELF EI_CLASS/e_machine of the named binaries, and perl Config archname.",
    receipt: "receipts/cr01-revalidation/03-final-perl-and-toolchain-packages.txt",
    result:
      "amd64 / x86_64 unchanged; perl-base amd64; all prior ELF64 assumptions hold.",
  },
  {
    axis: "installed files",
    method:
      "SHA-256 recomputed inside the FINAL image for the exact native artifacts the libstdc++ and libvips proofs named.",
    receipt: "receipts/cr01-revalidation/02-final-artifact-sha256.txt",
    result:
      "node, libstdc++.so.6.0.30, sharp-linux-x64-0.35.5.node and libvips-cpp.so.8.18.7 all hash-identical to the WO-008 baseline.",
  },
  {
    axis: "runtime assumptions",
    method:
      "Container user, capabilities, privileged flag, published ports, compose commands, live process table and source-level subprocess call sites.",
    receipt: "receipts/cr01-revalidation/06-runtime-assumptions.txt",
    result:
      "Unchanged: uid 1000 (node), not privileged, no cap add/drop, web published on 127.0.0.1:3000 only, worker unpublished, no perl process in either container, no child_process/exec/spawn call site anywhere in apps/ or packages/.",
  },
  {
    axis: "prior proof assumptions",
    method:
      "Each prior disposition's own evidence claim was re-read and its stated precondition re-measured on the FINAL artifact.",
    receipt:
      "receipts/cr01-revalidation/08-prior-row-revalidation.md",
    result:
      "Every precondition still holds verbatim; no assumption required re-derivation. Details per row in receipt 08.",
  },
];

const rows = highCritical.map((row) => {
  const prior = byCve.get(row.cve);
  if (prior) {
    const f = prior.finding;
    return {
      cve: row.cve,
      scannerSeverity: row.scannerSeverity,
      component: f.component,
      vulnerableCodePresent: f.vulnerableCodePresent,
      vexStatus: "UNDER_INVESTIGATION",
      proposedVexStatus: f.vex.status,
      proposedJustification: f.vex.justification,
      priorDispositionSource: prior.source,
      priorArtifact: PRIOR_WO002_ARTIFACT,
      priorOwnerApproval: f.ownerApproval,
      revalidation: {
        verdict: "ASSUMPTIONS_IDENTICAL — prior analysis preserved by reference",
        objectiveEquivalenceEvidence: EQUIVALENCE_AXES,
      },
      statusReason:
        "PH-SEC-VEX-POLICY: a new image digest expires a NOT_AFFECTED disposition. " +
        "This row returns to UNDER_INVESTIGATION until an independent audit verifies the " +
        "objective equivalence evidence above and the owner approves the new digest. " +
        "The prior owner approval does NOT carry over to " +
        FINAL_ARTIFACT +
        ".",
    };
  }
  const delta = perlDelta[row.cve];
  return {
    cve: row.cve,
    scannerSeverity: row.scannerSeverity,
    component: delta.component,
    vulnerableCodePresent: "no",
    vexStatus: "UNDER_INVESTIGATION",
    proposedVexStatus: "NOT_AFFECTED",
    proposedJustification: delta.justification,
    priorDispositionSource: "PH-M01-WO-002 (this delta)",
    priorArtifact: PRIOR_ARTIFACT,
    priorOwnerApproval: null,
    revalidation: {
      verdict: "NEW_ROW — analysis performed on the FINAL artifact",
      objectiveEquivalenceEvidence: delta.receipts,
      evidence: delta.evidence,
    },
    statusReason:
      "PH-SEC-VEX-POLICY: newly proposed NOT_AFFECTED disposition. It blocks until an " +
      "independent security auditor verifies it and the owner approves it.",
  };
});

const doc = {
  schemaVersion: 1,
  workOrder: "PH-M01-WO-002",
  correctionDelta: "CR-01 — final-digest VEX revalidation",
  title:
    "VEX revalidation of every HIGH/CRITICAL finding on the FINAL rebuilt artifact",
  branch: BRANCH,
  head: HEAD,
  priorPr: 37,
  artifact: {
    final: FINAL_ARTIFACT,
    priorWo002Artifact: PRIOR_ARTIFACT,
    priorWo007Wo008Artifact: PRIOR_WO002_ARTIFACT,
    rebuildReason:
      "The CR-02/CR-03/CR-04 correction delta changed application code, which changes the image digest.",
    expiryRule:
      "PH-SEC-VEX-POLICY: a NOT_AFFECTED disposition expires at a new image digest. Every disposition below therefore returns to UNDER_INVESTIGATION on this digest until re-approved.",
  },
  scanner: {
    tool: "docker scout cves <image> --format sarif",
    version: "1.24.0 (go1.26.3, windows/amd64)",
    dockerEngine: "29.7.2",
    command: "docker scout cves polyhunter-dev:local --format sarif",
    receipt: "receipts/runtime/final-image-scan.sarif",
    receiptSha256: crypto
      .createHash("sha256")
      .update(
        fs.readFileSync(
          ".engineering/evidence/PH-M01-WO-002/receipts/runtime/final-image-scan.sarif",
        ),
      )
      .digest("hex"),
  },
  objectiveEquivalence: {
    method:
      "Per PH-SEC-VEX-POLICY, every prior NOT_AFFECTED disposition expires on a new image digest. " +
      "For each prior row the following axes were compared between the artifact the disposition was " +
      "produced on and the FINAL artifact: component/package, exact version, architecture, installed " +
      "files, runtime assumptions, and the assumptions the prior proof itself rested on. " +
      "Where every axis is identical, the prior analysis is preserved by reference and backed by the " +
      "objective equivalence evidence. Where any axis changed, the affected analysis is redone — " +
      "no such axis changed in this delta.",
    axes: EQUIVALENCE_AXES,
    outcome:
      "ZERO scanner delta (80 of 80 rows identical), byte-identical Debian package inventory, " +
      "byte-identical native artifacts, unchanged runtime assumptions. The WO-002 code delta is " +
      "JavaScript/TypeScript application code and does not alter any component the prior proofs " +
      "analysed.",
  },
  summary: {
    totalRowsScanned: allRows.length,
    highCriticalRows: highCritical.length,
    underInvestigation: rows.filter((r) => r.vexStatus === "UNDER_INVESTIGATION").length,
    proposedNotAffected: rows.filter((r) => r.proposedVexStatus === "NOT_AFFECTED")
      .length,
    affected: 0,
    fixed: 0,
    carriedOverByReference: rows.filter(
      (r) => r.priorDispositionSource.startsWith("PH-SEC"),
    ).length,
    newThisDelta: rows.filter(
      (r) => r.priorDispositionSource.startsWith("PH-M01"),
    ).length,
  },
  approvalState: {
    independentAuditor: null,
    ownerApproval: null,
    status: "PROPOSED — ALL HIGH/CRITICAL ROWS REMAIN UNDER_INVESTIGATION",
    note:
      "This executor cannot self-approve (PH-SEC-VEX-POLICY). The prior owner approvals recorded " +
      "on the older digests are NOT approval of " +
      FINAL_ARTIFACT +
      ". Owner approval has not been requested.",
  },
  findings: rows,
};

fs.writeFileSync(
  ".engineering/evidence/PH-M01-WO-002/receipts/cr01-revalidation/PH-M01-WO-002-VEX-FINAL.json",
  JSON.stringify(doc, null, 2) + "\n",
);
console.log(
  "rows:",
  rows.length,
  "| by reference:",
  doc.summary.carriedOverByReference,
  "| new:",
  doc.summary.newThisDelta,
  "| sarif sha256:",
  doc.scanner.receiptSha256,
);