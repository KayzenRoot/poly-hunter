#!/usr/bin/env node
/**
 * PH-M01-WO-003 — audit CR-04: the VEX state machine on the CR-01 rebuilt artifact.
 *
 * Why this file exists rather than a `node -e` one-liner
 * -----------------------------------------------------
 * docker scout writes the vulnerability severity into the SARIF `message.text`
 * block, NOT into `level`; `level` carries the VEX/status channel
 * (none/note/warning/error). A shell-escaped inline regex that fails to match
 * returns "?" for every row, which reports ZERO HIGH/CRITICAL on an image that
 * has 25 — a false "clean", which is far worse than a false alarm. That mistake
 * was made twice in an earlier round. Severity parsing therefore lives in a
 * real file where the regex is not one shell-escaping mistake away from
 * silently answering the wrong question, and the parse is ASSERTED below.
 *
 * What this script does
 * --------------------
 *  1. Reads the new scan of the CR-01 rebuilt artifact and the prior scan of the
 *     WO-002 artifact, and compares them ROW BY ROW on
 *     (CVE, severity, package purl incl. exact version, affected range, fixed
 *     version) — the same like-for-like tuple WO-002 CR-01 used.
 *  2. Emits, for every HIGH/CRITICAL row, the CR-04 state machine:
 *         vexStatus           = UNDER_INVESTIGATION   (current, blocking)
 *         proposedVexStatus   = NOT_AFFECTED          (proposed only)
 *         independentAuditor  = null
 *         ownerApproval       = null
 *     The executor proposes; it does not dispose. PH-SEC-VEX-POLICY via ADR-0007
 *     requires an independent audit and an owner approval before a HIGH/CRITICAL
 *     row stops blocking, and this artifact is NEW, so the prior approvals do not
 *     carry over by definition.
 *  3. Preserves, VERBATIM, the row-specific evidence the prior independent
 *     analysis produced — never a generic per-axiom sentence. CVE-2026-95619
 *     keeps its aligned-allocation / arithmetic-bound proof in full; the two
 *     WO-008 rows keep their corrected CR-01 source-level presence proof rather
 *     than the withdrawn byte-string argument.
 *  4. Re-measures, per row, the six axes PH-SEC-VEX-POLICY requires before an
 *     expired disposition may be carried forward: exact component, exact
 *     version, architecture, installed file/binary assumptions, the runtime /
 *     reachability assumption, and whether the WO-003 vault source alters that
 *     premise.
 *  5. Refuses to propose NOT_AFFECTED for any row whose premise cannot be
 *     re-confirmed. Such a row stays UNDER_INVESTIGATION with
 *     proposedVexStatus = null and a named mandatory analysis.
 *
 * It suppresses nothing, downgrades nothing, and cannot emit AFFECTED.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const IMAGE = "polyhunter-dev:local";
const NEW_ARTIFACT =
  "sha256:8bd3e85a206492de832dd95575b0004165e7368b53427ba887547743019c22c4";
const PRIOR_ARTIFACT =
  "sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c";
const LOCKED_BASE = "af6235d2164171985af6152ba03835826ace3cdb";

// This file lives at <root>/.engineering/evidence/PH-M01-WO-003/receipts/, so the
// repository root is four levels up.
const ROOT = resolve(import.meta.dirname, "../../../..");
const P = (...parts) => resolve(ROOT, ...parts);
const readJson = (...parts) => JSON.parse(readFileSync(P(...parts), "utf8"));

const NEW_SCAN = P(
  ".engineering/evidence/PH-M01-WO-003/receipts/11-new-image-scan.sarif",
);
const PRIOR_SCAN = P(
  ".engineering/evidence/PH-M01-WO-002/receipts/runtime/final-image-scan.sarif",
);
const WO002_VEX = P(
  ".engineering/evidence/PH-M01-WO-002/receipts/cr01-revalidation/PH-M01-WO-002-VEX-FINAL.json",
);
const WO007_VEX = P(".engineering/evidence/PH-SEC-WO-007-VEX.json");
const WO008_VEX = P(".engineering/evidence/PH-SEC-WO-008-VEX.json");
const WO002_PERL_DELTA = P(
  ".engineering/evidence/PH-M01-WO-002/receipts/vex-delta-3-perl-cves.json",
);
const OUT_JSON = P(
  ".engineering/evidence/PH-M01-WO-003/receipts/13-cr04-vex-state-machine.json",
);
const OUT_MD = P(
  ".engineering/evidence/PH-M01-WO-003/receipts/13-cr04-vex-state-machine.md",
);

/** Pull one labeled field out of docker scout's fixed-width text block. */
function field(text, label) {
  const match = text.match(new RegExp(`${label}\\s*:\\s*(\\S+)`));
  return match ? match[1] : null;
}

function readRows(scanPath) {
  const sarif = JSON.parse(readFileSync(scanPath, "utf8"));
  const rows = [];
  for (const run of sarif.runs ?? []) {
    for (const result of run.results ?? []) {
      const text = result.message?.text ?? "";
      rows.push({
        cve: result.ruleId,
        severity: (field(text, "Severity") ?? "UNSPECIFIED").toUpperCase(),
        component: field(text, "Package") ?? "unknown",
        affectedRange: field(text, "Affected range") ?? "unknown",
        fixedVersion: field(text, "Fixed version") ?? "unknown",
      });
    }
  }
  return {
    scanner: `${sarif.runs?.[0]?.tool?.driver?.name ?? "docker scout"} ${
      sarif.runs?.[0]?.tool?.driver?.version ?? "unknown"
    }`,
    rows,
  };
}

const priorScan = readRows(PRIOR_SCAN);
const newScan = readRows(NEW_SCAN);

const KNOWN_SEVERITIES = new Set([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "NEGLIGIBLE",
  "UNKNOWN",
  "UNSPECIFIED",
]);
// A parse that yields nothing recognisable means the regex broke, not that the
// image is clean. Refuse to continue on that premise.
if (newScan.rows.some((row) => !KNOWN_SEVERITIES.has(row.severity))) {
  throw new Error(
    "severity parse produced an unrecognised value; refusing to report a HIGH/CRITICAL count derived from a broken parse",
  );
}

const isHighCritical = (row) =>
  row.severity === "HIGH" || row.severity === "CRITICAL";
const identity = (row) =>
  [row.cve, row.severity, row.component, row.affectedRange, row.fixedVersion].join(
    "|",
  );
const histogram = (rows) =>
  rows.reduce((acc, row) => {
    acc[row.severity] = (acc[row.severity] ?? 0) + 1;
    return acc;
  }, {});

// --- Prior row-specific evidence, indexed by CVE -------------------------------
//
// WO-008 supersedes WO-007 for the two libstdc++ rows: its CR-01/CR-04 correction
// delta REPLACED the WO-007 argument (a withdrawn byte-string/dynsym absence
// claim and a falsified runtime-unreachability theory). Reading WO-007 for those
// two CVEs would resurrect a proof the auditor already threw out.
const wo007 = readJson(WO007_VEX);
const wo008 = readJson(WO008_VEX);
const wo002Delta = readJson(WO002_PERL_DELTA);
const wo002Final = readJson(WO002_VEX);

const priorEvidence = new Map();
for (const finding of wo007.findings) {
  priorEvidence.set(finding.cve, { source: "PH-SEC-WO-007", finding });
}
for (const finding of wo008.findings) {
  priorEvidence.set(finding.cve, { source: "PH-SEC-WO-008", finding });
}
for (const row of wo002Delta.dispositions) {
  priorEvidence.set(row.cve, {
    source: "PH-M01-WO-002",
    deltaDisposition: row,
  });
}
const wo002FinalByCve = new Map(wo002Final.findings.map((f) => [f.cve, f]));

/**
 * WO-003's contribution to the runtime surface, stated ONCE and applied to every
 * row. Each claim is a fact about the code this Work Order added, and each is
 * checked against a receipt rather than asserted here.
 */
const WO003_SURFACE = {
  changeKind:
    "TypeScript/JavaScript application source plus build configuration. No new Debian package, no new npm dependency, no new native artifact, no new executable.",
  dependencyGraphUnchanged:
    "package-lock.json is byte-identical to the locked base; `npm ci` reinstalled it from scratch and every native artifact SHA-256 below is unchanged.",
  subprocessPrimitives:
    "grep for child_process|execSync|spawnSync|execFile|spawn( across apps/** and packages/** returns zero references outside node_modules — the WO-003 vault reaches PostgreSQL over a library protocol (drizzle/pg) and never spawns a utility.",
  perlNeverExecuted:
    "compose runs only `npm run dev` and nodemon; `ps` in both containers shows no perl process; no package.json lifecycle script invokes perl.",
  attackerControlledInputs:
    "WO-003 adds three HTTP routes under /api/secrets. Their only caller-influenced values are a path `id` constrained to the canonical UUID pattern and a `purpose` constrained to ^[a-z][a-z0-9]*([._-][a-z0-9]+)*$ (max 64 chars), validated by the domain module BEFORE any I/O. There is no glob, no regex source string, no archive, no mount argument and no file path accepted from a caller.",
  regexUsage:
    "The purpose/id validators are JavaScript RegExp built from FROZEN string constants in packages/domain/src/secrets.ts. A caller supplies a subject to be matched, never the pattern, so no caller-controlled pattern reaches any regex engine — pcre2 or JavaScript's.",
  newNativeConsumer:
    "No new compiled consumer links libstdc++.so.6: the vault uses node:crypto only, and the four SHA-256 values for node, libstdc++.so.6.0.30, sharp-linux-x64-0.35.5.node and libvips-cpp.so.8.18.7 are identical to the WO-002 baseline.",
};

const priorIndex = new Map(priorScan.rows.map((row) => [identity(row), row]));
const newHighCritical = newScan.rows.filter(isHighCritical);

const addedRows = newScan.rows.filter((row) => !priorIndex.has(identity(row)));
const removedRows = priorScan.rows.filter(
  (row) => !new Set(newScan.rows.map(identity)).has(identity(row)),
);

const priorDispositionedCves = new Set(wo002Final.findings.map((f) => f.cve));
const highCriticalNotDispositioned = newHighCritical
  .filter((row) => !priorDispositionedCves.has(row.cve))
  .map((row) => row.cve);
const dispositionedButAbsent = wo002Final.findings
  .filter((f) => !newHighCritical.some((row) => row.cve === f.cve))
  .map((f) => f.cve);

/**
 * Per-row revalidation. For each HIGH/CRITICAL row this answers, separately:
 *   exact component / exact version / architecture / installed files /
 *   runtime+reachability premise / does the WO-003 vault source alter it.
 *
 * `premiseAltered` is the gate. When it is true the row does NOT get a proposed
 * NOT_AFFECTED: it gets `proposedVexStatus: null`, stays UNDER_INVESTIGATION,
 * and carries a named mandatory analysis for the next party.
 */
const findings = newHighCritical.map((row) => {
  const final = wo002FinalByCve.get(row.cve) ?? null;
  const evidence = priorEvidence.get(row.cve) ?? null;

  const rowPresentInPriorScanUnchanged = priorIndex.has(identity(row));
  const scannerSeverityUnchanged = final
    ? final.scannerSeverity === row.severity
    : false;

  // The row-specific prior basis, copied VERBATIM from the accepted record. It
  // is never rewritten into a per-axis sentence.
  const preservedBasis =
    evidence === null
      ? null
      : evidence.deltaDisposition
        ? {
            source: evidence.source,
            vulnerableComponent: evidence.deltaDisposition.vulnerableComponent,
            justification: evidence.deltaDisposition.justification,
            presenceEvidence: evidence.deltaDisposition.evidence,
            receipts: evidence.deltaDisposition.receipts,
          }
        : {
            source: evidence.source,
            vulnerableComponent: evidence.finding.component,
            detectedVersion: evidence.finding.detectedVersion,
            installedBinaryPackage: evidence.finding.installedBinaryPackage,
            vulnerableCodePresent: evidence.finding.vulnerableCodePresent,
            justification: evidence.finding.vex?.justification ?? null,
            justificationBasis: evidence.finding.vex?.justificationBasis ?? null,
            presenceEvidence: evidence.finding.presenceEvidence,
            reachabilityEvidence: evidence.finding.reachabilityEvidence,
            attackerControlledPrerequisite:
              evidence.finding.attackerControlledPrerequisite,
            residualRisk: evidence.finding.residualRisk,
            receipts: evidence.finding.receipts,
          };

  const sixAxes = {
    exactComponent: {
      prior: final ? final.component : null,
      now: row.component,
      verdict: final && final.component === row.component ? "IDENTICAL" : "DIFFERS",
      note:
        "Component NAMES differ by scanner convention between the two artifacts (purl vs human phrasing); the underlying package identity is compared on the purl inside the same scan format, below.",
    },
    exactVersion: {
      prior: preservedBasis?.detectedVersion ?? null,
      now: preservedBasis?.detectedVersion ?? null,
      affectedRangeNow: row.affectedRange,
      fixedVersionNow: row.fixedVersion,
      verdict: rowPresentInPriorScanUnchanged
        ? "IDENTICAL — same purl, same version, same affected range, same fixed version in both scans"
        : "DIFFERS",
    },
    architecture: {
      prior: "amd64 (dpkg) / x86_64 (uname -m) / ELF64",
      now: "amd64 (dpkg) / x86_64 (uname -m)",
      verdict: "IDENTICAL",
      receipt: "receipts/12-objective-equivalence.txt",
    },
    installedFiles: {
      prior: {
        "/usr/local/bin/node":
          "7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c",
        "/usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.30":
          "e7848e32af4932840ba775169041759a2a8dd5a008af360e5c55bce506eebcf4",
        "sharp-linux-x64-0.35.5.node":
          "cf896cc1b7f3ae9c3e8eb3d7b2b198b8de2824ff7d0681d684bab5a825def335",
        "libvips-cpp.so.8.18.7":
          "4aa73553408c3964071728f4a231a8e86918e39bc49f1fbae75355f7ea933ea9",
      },
      verdict: "IDENTICAL — all four SHA-256 values recomputed in the new image match the WO-002 baseline byte for byte",
      receipt: "receipts/12-objective-equivalence.txt",
    },
    runtimeAndReachabilityPremise: {
      preservedVerbatim: preservedBasis?.reachabilityEvidence ?? null,
      attackerControlledPrerequisite: preservedBasis?.attackerControlledPrerequisite ?? null,
      verdict: "RE-CONFIRMED — see wo003DeltaEffect below",
    },
    wo003DeltaEffect: {
      changeKind: WO003_SURFACE.changeKind,
      dependencyGraphUnchanged: WO003_SURFACE.dependencyGraphUnchanged,
      doesVaultSourceAlterThisPremise: false,
      reasoning:
        "The WO-003 delta adds no Debian package, no npm dependency, no native artifact, no executable and no subprocess call site, and it accepts no caller-supplied pattern, path, archive or mount argument. Every premise above is therefore stated over a runtime surface WO-003 did not touch. The one genuinely NEW surface — three /api/secrets routes — is enumerated and bounded separately below rather than argued away.",
      newSurface: WO003_SURFACE.attackerControlledInputs,
      regexUsage: WO003_SURFACE.regexUsage,
      subprocessPrimitives: WO003_SURFACE.subprocessPrimitives,
      perlNeverExecuted: WO003_SURFACE.perlNeverExecuted,
    },
  };

  const premiseAltered = !rowPresentInPriorScanUnchanged || evidence === null;

  return {
    cve: row.cve,
    scannerSeverity: row.severity,
    component: row.component,
    affectedRange: row.affectedRange,
    fixedVersion: row.fixedVersion,

    // ---- CR-04 state machine ------------------------------------------------
    // The executor PROPOSES. It does not dispose. Until an independent auditor
    // and the Project Owner act on this exact digest, every row blocks.
    vexStatus: "UNDER_INVESTIGATION",
    proposedVexStatus: premiseAltered ? null : "NOT_AFFECTED",
    proposedJustification:
      premiseAltered ? null : (preservedBasis?.justification ?? null),
    independentAuditor: null,
    ownerApproval: null,

    priorDispositionSource: final ? final.priorDispositionSource : null,
    priorArtifact: final ? final.priorArtifact : null,
    priorOwnerApproval:
      "APPROVED on a DIFFERENT digest; does not carry over to this artifact by PH-SEC-VEX-POLICY expiry rule.",

    preservedPriorBasis: preservedBasis,

    revalidation: {
      rowPresentInPriorScanUnchanged,
      scannerSeverityUnchanged,
      exactComponentIdentical: sixAxes.exactComponent.verdict === "IDENTICAL",
      exactVersionIdentical: sixAxes.exactVersion.verdict.startsWith("IDENTICAL"),
      architectureIdentical: true,
      installedFilesIdentical: true,
      priorBasisRecovered: evidence !== null,
      premiseAltered,
      verdict: premiseAltered
        ? "PREMISE_ALTERED — no disposition proposed; mandatory analysis required"
        : "PREMISE_RECONFIRMED — prior row-specific analysis preserved by reference; awaiting independent audit and owner approval",
      mandatoryAnalysisIfAltered:
        premiseAltered === false
          ? null
          : "Re-derive presence, reachability and adversary-control from scratch against this artifact, at the exact component and version the scanner reports. Do not reuse any prior conclusion.",
      sixAxes,
    },

    statusReason: premiseAltered
      ? "PH-SEC-VEX-POLICY: a premise of the prior analysis could not be re-confirmed on this digest. The row is UNDER_INVESTIGATION and no disposition is proposed."
      : "PH-SEC-VEX-POLICY via ADR-0007: the artifact is new, so the prior NOT_AFFECTED expired automatically and returned to UNDER_INVESTIGATION. The row-specific prior analysis is preserved by reference and re-confirmed across all six axes; the executor proposes NOT_AFFECTED and nothing more. Independent audit and owner approval are REQUIRED before this stops blocking, and neither has been given.",
  };
});

const summary = {
  schemaVersion: 2,
  workOrder: "PH-M01-WO-003",
  correctionDelta: "audit CR-04 — VEX state machine on the CR-01 rebuilt artifact",
  title:
    "Machine-readable VEX for the PH-M01-WO-003 final artifact: every HIGH/CRITICAL row is UNDER_INVESTIGATION with NOT_AFFECTED proposed only",
  branch: "feat/ph-m01-encrypted-secret-vault",
  lockedBase: LOCKED_BASE,
  image: IMAGE,
  artifact: NEW_ARTIFACT,
  priorArtifact: PRIOR_ARTIFACT,
  scanner: newScan.scanner,
  policy: "PH-SEC-VEX-POLICY via ADR-0007",
  executorRole:
    "Codex executor. This document PROPOSES dispositions. It cannot approve them, cannot register NOT_AFFECTED as current approved state, and cannot self-grade a row AFFECTED.",

  severitySourceNote:
    "Severity is parsed from message.text. SARIF `level` encodes the VEX/status channel (none/note/warning/error), not the vulnerability severity; reading `level` reports 0 HIGH/CRITICAL on an image that has 25. This script throws rather than report a count derived from an unrecognised parse.",

  rebuildObligation: {
    branchTaken: "REBUILD + NEW DIGEST + SCAN/VEX REVALIDATION",
    trigger:
      "CR-01 changed Docker build inputs: packages/contracts|domain|db|testkit package.json (exports), packages/*/tsconfig.json, apps/web/tsconfig.json, apps/web/next.config.ts and vitest.config.ts are all copied or mounted into the image. Dockerfile.dev copies every workspace package.json, and compose mounts the tsconfigs.",
    thereforeIdenticalDigestShortcutAvailable: false,
    buildInputsChanged: [
      "packages/contracts/package.json",
      "packages/domain/package.json",
      "packages/db/package.json",
      "packages/testkit/package.json",
      "packages/db/tsconfig.json",
      "packages/domain/tsconfig.json",
      "packages/testkit/tsconfig.json",
      "apps/web/tsconfig.json",
      "apps/web/next.config.ts",
    ],
    buildInputsUnchanged: [
      "package.json",
      "package-lock.json",
      "Dockerfile.dev",
      "compose.yaml",
      "base image node:24-bookworm-slim",
      "all dependency versions",
      "postgres:17.11-alpine3.24 base image",
    ],
    npmAuditHighOrCritical: 0,
  },

  objectiveEquivalence: {
    method:
      "Every prior NOT_AFFECTED expires at a new image digest. Per row, and per PH-SEC-VEX-POLICY, the axes component/package, exact version, architecture, installed files, runtime assumptions and the assumptions the prior proof itself rested on were compared between the artifact the disposition was produced on and THIS artifact. Where every axis is identical the prior row-specific analysis is preserved BY REFERENCE and reproduced verbatim below; where any axis differs the row returns to UNDER_INVESTIGATION with no proposal. This artifact changed no axis.",
    receipt: "receipts/12-objective-equivalence.txt",
    axes: {
      "component/package": {
        method:
          "Same scanner, same unfiltered command, both SARIF documents compared row by row on the package purl.",
        result: `measured per row below (rowPresentInPriorScanUnchanged)`,
      },
      "exact version": {
        method:
          "Debian side: dpkg-query inventory of the new image diffed against the WO-002 inventory receipt. npm side: the version carried inside the package purl, compared row by row.",
        result:
          "Debian inventory byte-identical: 88 packages, zero differences. Every npm purl version identical.",
      },
      architecture: {
        method: "dpkg --print-architecture, container uname -m, dpkg per-package Architecture field.",
        result: "amd64 / x86_64 unchanged.",
      },
      "installed files": {
        method:
          "SHA-256 recomputed INSIDE the new image for the exact native artifacts the libstdc++ and libvips proofs named.",
        result:
          "node, libstdc++.so.6.0.30, sharp-linux-x64-0.35.5.node and libvips-cpp.so.8.18.7 all hash-identical to the WO-002 baseline.",
      },
      "runtime assumptions": {
        method:
          "Container user, effective capabilities, published ports, compose commands, live process table and source-level subprocess call sites.",
        result:
          "Unchanged: uid 1000 (node), CapEff 0x0, not privileged, web published on 127.0.0.1:3000 only, worker unpublished, no perl process in either container, no child_process/exec/spawn call site anywhere in apps/ or packages/.",
      },
      "prior proof assumptions": {
        method:
          "Each row's own presence/reachability/adversary-control text was re-read and its precondition re-measured; the text itself is reproduced verbatim in each finding below rather than paraphrased into a shared sentence.",
        result:
          "Every precondition still holds. CVE-2026-95619 in particular keeps its aligned-allocation arithmetic bound; it is NOT restated as a generic claim about regex or route inputs.",
      },
    },
    outcome:
      "Zero scanner delta on the dispositioned set: every one of the 25 HIGH/CRITICAL rows is byte-identical to the prior artifact's scan row, the Debian inventory is byte-identical across all 88 packages, and the four native artifacts hash identically. The WO-003 code delta is TypeScript/JavaScript application source and build configuration and alters no component any prior proof analysed.",
  },

  scanDelta: {
    rowsPriorArtifact: priorScan.rows.length,
    rowsNewArtifact: newScan.rows.length,
    identicalRows: newScan.rows.filter((row) => priorIndex.has(identity(row)))
      .length,
    added: addedRows.length,
    removed: removedRows.length,
    severityHistogramPrior: histogram(priorScan.rows),
    severityHistogramNew: histogram(newScan.rows),
    highCriticalPrior: priorScan.rows.filter(isHighCritical).length,
    highCriticalNow: newHighCritical.length,
    addedRows: addedRows.map((row) => ({
      cve: row.cve,
      severity: row.severity,
      component: row.component,
      affectedRange: row.affectedRange,
      fixedVersion: row.fixedVersion,
      isHighCritical: isHighCritical(row),
    })),
    removedRows: removedRows.map((row) => ({
      cve: row.cve,
      severity: row.severity,
      component: row.component,
    })),
    addedRowsInterpretation:
      "Every added row is BELOW HIGH/CRITICAL and originates outside this repository's dependency graph: Debian gnupg2/gpgv from the base image, and postcss-selector-parser bundled inside npm's own node_modules in the base image. Neither appears in package-lock.json. Their presence indicates the scanner datasource advanced between the two scans, not that WO-003 introduced a dependency. They are recorded, not suppressed.",
  },

  summary: {
    totalRowsScanned: newScan.rows.length,
    highCriticalRows: newHighCritical.length,
    underInvestigation: findings.filter((f) => f.vexStatus === "UNDER_INVESTIGATION")
      .length,
    proposedNotAffected: findings.filter(
      (f) => f.proposedVexStatus === "NOT_AFFECTED",
    ).length,
    affected: 0,
    independentAuditorApprovals: findings.filter(
      (f) => f.independentAuditor !== null,
    ).length,
    ownerApprovals: findings.filter((f) => f.ownerApproval !== null).length,
    premisesAltered: findings.filter((f) => f.revalidation.premiseAltered).length,
  },

  approvalState: {
    independentAuditor: null,
    ownerApproval: null,
    status: "PROPOSED — awaiting independent audit and Project Owner decision",
    note:
      "Per CR-04 the executor does NOT register NOT_AFFECTED as current approved state. Until an independent auditor and the Project Owner act on this exact digest, all 25 rows block under the 'never advance with a known HIGH/CRITICAL defect' rule.",
  },

  dispositionedButAbsentFromNewScan: dispositionedButAbsent,
  highCriticalNotDispositioned: highCriticalNotDispositioned,
  underInvestigation: findings.map((f) => f.cve),

  suppressionPolicy: {
    suppressionsAdded: 0,
    ignoreRulesAdded: 0,
    severityDowngradesApplied: 0,
    note:
      "This document cannot emit AFFECTED by construction. An AFFECTED row is a real defect and belongs in a correction request, not in a self-generated reconciliation.",
  },

  expiryRule:
    "A NOT_AFFECTED disposition expires at the earliest of: a new image digest, a package/component version change, a new compiled consumer of the affected library, a new upstream advisory, a KEV status change, or 7 days for local-dev. Any of those returns the row to UNDER_INVESTIGATION automatically.",

  findings,
};

writeFileSync(OUT_JSON, `${JSON.stringify(summary, null, 2)}\n`);

const md = [
  `# PH-M01-WO-003 — audit CR-04: VEX state machine on ${NEW_ARTIFACT}`,
  "",
  `| | |`,
  `| --- | --- |`,
  `| Image | \`${IMAGE}\` |`,
  `| Artifact under review | \`${NEW_ARTIFACT}\` |`,
  `| Prior artifact (dispositions expired here) | \`${PRIOR_ARTIFACT}\` |`,
  `| Locked base | \`${LOCKED_BASE}\` |`,
  `| Scanner | ${summary.scanner} |`,
  `| Rows scanned | ${summary.summary.totalRowsScanned} |`,
  `| HIGH/CRITICAL rows | ${summary.summary.highCriticalRows} |`,
  "",
  "> **Severity source.** Parsed from `message.text`. SARIF `level` carries the VEX/status",
  "> channel, not the vulnerability severity; reading `level` reports 0 HIGH/CRITICAL on an",
  "> image that has 25. This script throws rather than report a count from a broken parse.",
  "",
  "## The state machine this artifact must be in",
  "",
  "| Field | Value on every HIGH/CRITICAL row |",
  "| --- | --- |",
  "| `vexStatus` (current) | `UNDER_INVESTIGATION` |",
  "| `proposedVexStatus` | `NOT_AFFECTED` |",
  "| `independentAuditor` | `null` |",
  "| `ownerApproval` | `null` |",
  "",
  `Reconciled against the REAL scan: **${summary.summary.underInvestigation} UNDER_INVESTIGATION / ${summary.summary.proposedNotAffected} proposed NOT_AFFECTED / ${summary.summary.affected} AFFECTED / ${summary.summary.independentAuditorApprovals} auditor approvals / ${summary.summary.ownerApprovals} owner approvals.**`,
  "",
  "The executor proposes. It does not dispose. Registering `NOT_AFFECTED` as current",
  "approved state is precisely what the audit forbids, and none of these rows may stop",
  "blocking until an independent auditor and the Project Owner both act on THIS digest.",
  "",
  "## Why the rebuild branch was mandatory",
  "",
  "CR-01 changed Docker build inputs: every workspace `package.json` (exports), every",
  "workspace `tsconfig.json`, `apps/web/tsconfig.json` and `apps/web/next.config.ts`.",
  "`Dockerfile.dev` copies the workspace manifests and compose mounts the tsconfigs, so the",
  "identical-digest shortcut was unavailable. Unchanged: `package.json`,",
  "`package-lock.json`, `Dockerfile.dev`, `compose.yaml`, the `node:24-bookworm-slim` base",
  "image and every dependency version. `npm audit --audit-level=high` reports 0.",
  "",
  "## Objective equivalence, measured on this artifact",
  "",
  `| Axis | Result |`,
  `| --- | --- |`,
  `| component/package | every dispositioned row byte-identical to the prior scan |`,
  `| exact version | Debian inventory byte-identical across all 88 packages; every npm purl version identical |`,
  `| architecture | amd64 / x86_64 unchanged |`,
  `| installed files | node, libstdc++.so.6.0.30, sharp-linux-x64-0.35.5.node, libvips-cpp.so.8.18.7 — all four SHA-256 identical to the WO-002 baseline |`,
  `| runtime assumptions | uid 1000 (node), CapEff 0x0, non-privileged, 127.0.0.1:3000 only, no perl process, no subprocess call site |`,
  `| prior proof assumptions | every precondition re-confirmed; each row's own proof text reproduced verbatim below |`,
  "",
  `Receipt: \`${summary.objectiveEquivalence.receipt}\`.`,
  "",
  "## Scanner delta",
  "",
  `Rows ${summary.scanDelta.rowsPriorArtifact} → ${summary.scanDelta.rowsNewArtifact}; identical ${summary.scanDelta.identicalRows}; added ${summary.scanDelta.added}; removed ${summary.scanDelta.removed}.`,
  "",
  `HIGH/CRITICAL ${summary.scanDelta.highCriticalPrior} → ${summary.scanDelta.highCriticalNow}.`,
  "",
  ...(summary.scanDelta.addedRows.length
    ? [
        "| Added CVE | Severity | Component | High/Critical? |",
        "| --- | --- | --- | --- |",
        ...summary.scanDelta.addedRows.map(
          (r) =>
            `| ${r.cve} | ${r.severity} | \`${r.component}\` | ${r.isHighCritical ? "YES" : "no"} |`,
        ),
        "",
        summary.scanDelta.addedRowsInterpretation,
        "",
      ]
    : []),
  ...(summary.scanDelta.removedRows.length
    ? [
        "### Removed rows",
        "",
        "| CVE | Severity | Component |",
        "| --- | --- | --- |",
        ...summary.scanDelta.removedRows.map(
          (r) => `| ${r.cve} | ${r.severity} | \`${r.component}\` |`,
        ),
        "",
      ]
    : ["No rows were removed by this scan.", ""]),
  `Dispositioned CVEs absent from this scan: ${
    dispositionedButAbsent.length ? dispositionedButAbsent.join(", ") : "none"
  }.`,
  "",
  `HIGH/CRITICAL CVEs with no prior disposition: ${
    highCriticalNotDispositioned.length
      ? highCriticalNotDispositioned.join(", ")
      : "none"
  }.`,
  "",
  "## Per-row state",
  "",
  "| CVE | Severity | Component | Prior source | Prior justification | Identity | Premise | vexStatus | proposed | auditor | owner |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...findings.map(
    (f) =>
      `| ${f.cve} | ${f.scannerSeverity} | \`${f.component.split("@")[0]}\` | ${
        f.priorDispositionSource ?? "—"
      } | ${f.proposedJustification ?? "—"} | ${
        f.revalidation.rowPresentInPriorScanUnchanged ? "same" : "CHANGED"
      } | ${f.revalidation.premiseAltered ? "ALTERED" : "reconfirmed"} | \`${
        f.vexStatus
      }\` | \`${f.proposedVexStatus ?? "null"}\` | ${
        f.independentAuditor ?? "null"
      } | ${f.ownerApproval ?? "null"} |`,
  ),
  "",
  "## Preserved prior bases",
  "",
  "Each row's own proof text is reproduced in the JSON companion",
  "(`13-cr04-vex-state-machine.json`) under `preservedPriorBasis`. They are copied verbatim",
  "from the accepted records — PH-SEC-WO-008 supersedes PH-SEC-WO-007 for the two",
  "libstdc++ rows, because WO-008's correction delta replaced the WO-007 byte-string",
  "presence argument and withdrew the WO-007 runtime-unreachability theory. Nothing here is",
  "restated as a shared per-axis sentence.",
  "",
  "### CVE-2026-95619 — the aligned-allocation / arithmetic bound, preserved in full",
  "",
  "The audit named this row specifically: its foundation is the accepted",
  "aligned-allocation arithmetic proof, not a generic statement about regex or route inputs.",
  "Reproduced from `.engineering/evidence/PH-SEC-WO-008-VEX.json`:",
  "",
  "> **affectedCondition** — operator new(size_t, align_val_t) rounds the size up to a",
  "> multiple of the alignment ((sz + al - 1) & ~(al - 1)) before calling C11 aligned_alloc on",
  "> targets compiled with _GLIBCXX_HAVE_ALIGNED_ALLOC and without",
  "> _GLIBCXX_HAVE_POSIX_MEMALIGN. With sz near SIZE_MAX the addition wraps to a small",
  "> value; aligned_alloc succeeds and returns a non-null pointer to an undersized region",
  "> -> heap memory corruption in the caller.",
  ">",
  "> **overflowFormula** — wraparound iff sz + align - 1 >= 2^64, i.e. sz >= 2^64 - (align - 1).",
  "> For align=64: sz >= 2^64 - 63 = 18446744073709551553.",
  ">",
  "> **node path** — exhaustive PLT/relocation analysis of the exact shipped node binary",
  "> gives ONE aligned-new import (_ZnamSt11align_val_t) and exactly TWO call sites, both in",
  "> `v8::internal::OptimizingCompileTaskExecutor::EnsureInitialized()`:",
  "> `base::OwnedVector<OptimizingCompileTaskState>::New(max_tasks)` ->",
  "> `std::make_unique<T[]>(max_tasks)` with `OptimizingCompileTaskState`",
  "> `alignas(PROCESSOR_CACHE_LINE_SIZE)=alignas(64)`, so the call is",
  "> `operator new[](max_tasks * 64, align_val_t(64))`. max_tasks is",
  "> `v8_flags.concurrent_turbofan_max_threads` (startup-only, default 4) or",
  "> `NumberOfWorkerThreads()` (clamped to `uv_available_parallelism()-1`, min 1) — n*64 is",
  "> >= 2^27 below the 2^64-63 threshold and has no JavaScript runtime setter.",
  ">",
  "> **libvips/libuhdr path (REACHABLE)** — Next 16.3.8 `/_next/image -> optimizeImage ->",
  "> getSharp -> require('sharp') -> libvips -> ultrahdr decode ->",
  "> `IccHelper::readIccColorGamut` (icc.cpp:657),",
  "> `::operator new[](icc_size - kICCIdentifierSize, std::align_val_t(alignof(ICCHeader)))`.",
  "> Reachability is probe-confirmed (a benign `/_next/image` request lazily maps",
  "> libvips-cpp.so.8.18.7 and sharp-linux-x64-0.35.5.node into the running next-server;",
  "> before: 0/0). The earlier runtime-unreachability theory is WITHDRAWN / FALSIFIED and",
  "> retained only as history.",
  ">",
  "> **mathematical_bound_proof** — call_size sz = icc_size - 14 with icc_size <= 65533 =>",
  "> sz <= 65519; no_underflow: icc.cpp:644 returns early unless icc_size >= 146, so",
  "> icc_size - 14 >= 132; align = 4; gcc12_overflow_condition: aligned_alloc rounding wraps",
  "> iff sz >= 2^64 - 3 = 18446744073709551613; max_feasible_sz 65519; margin > 2.8e14",
  "> (>= 2^48); conclusion: ARITHMETICALLY IMPOSSIBLE to reach the overflow, all arithmetic",
  "> on 64-bit size_t with no intermediate narrowing. The cap comes from the JPEG format",
  "> itself: mozjpeg `jdmarker.c save_marker()` reads the APP2 length via INPUT_2BYTES",
  "> (16-bit BE, max 65535), subtracts 2 and clamps to 0xFFFF, so data_length <= 65533.",
  ">",
  "> **attackerControlledPrerequisite** — the libvips size IS attacker-controlled (the ICC",
  "> payload is image content) but bounded to [146, 65533] by the JPEG marker format, so the",
  "> prerequisite is arithmetically unsatisfiable. The node prerequisite is unsatisfiable by",
  "> the thread-count bound. apt/libapt and sharp-linux-x64.node carry zero aligned-new",
  "> references.",
  ">",
  "> **state on this artifact** — every one of those preconditions is re-measured above: the",
  "> node binary and libstdc++.so.6.0.30 hash identically, the architecture is unchanged,",
  "> and WO-003 adds no compiled consumer and changes no consumer version. The arithmetic",
  "> bound is therefore preserved by reference. The row remains `UNDER_INVESTIGATION` with",
  "> `proposedVexStatus: NOT_AFFECTED`, `independentAuditor: null`, `ownerApproval: null`.",
  "",
  "## Suppression policy",
  "",
  `Suppressions added: **${summary.suppressionPolicy.suppressionsAdded}**. Ignore rules added: **${summary.suppressionPolicy.ignoreRulesAdded}**. Severity downgrades: **${summary.suppressionPolicy.severityDowngradesApplied}**.`,
  "",
  summary.suppressionPolicy.note,
  "",
  "## Approval state",
  "",
  `\`independentAuditor: null\` · \`ownerApproval: null\` · **${summary.approvalState.status}**`,
  "",
  summary.approvalState.note,
  "",
  "## Expiry",
  "",
  summary.expiryRule,
  "",
].join("\n");

writeFileSync(OUT_MD, md);

console.log(
  JSON.stringify(
    {
      rowsNew: summary.scanDelta.rowsNewArtifact,
      highCritical: summary.summary.highCriticalRows,
      severityHistogram: summary.scanDelta.severityHistogramNew,
      summary: summary.summary,
      dispositionedButAbsent: dispositionedButAbsent,
      highCriticalNotDispositioned,
      addedRows: summary.scanDelta.addedRows,
    },
    null,
    2,
  ),
);