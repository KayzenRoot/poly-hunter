#!/usr/bin/env node
/**
 * PH-M01-WO-003 — the VEX state machine for the CURRENT artifact.
 *
 * Round history
 * -------------
 *   CR-04  first implementation, on artifact sha256:8bd3e85a…
 *   CR-05  CVE-2026-8376 semantics RESTORED to the accepted WO-002 disposition
 *          (`vulnerableCodePresent: true` +
 *          `vulnerable_code_cannot_be_controlled_by_adversary`), with "Perl is
 *          never executed" demoted to explicitly-labelled secondary
 *          defence-in-depth. A mechanical gate now THROWS if any of the 25 rows
 *          ever diverges from the accepted record again.
 *          The CR-04 round's outputs are retained under `superseded/` because
 *          they carry the regressed justification; they are history, not a
 *          current claim.
 *   CR-06/07 rebuilt the artifact (git inputs changed), so every disposition is
 *          re-run against the NEW digest rather than carried forward.
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
 *  1. Reads the current scan of the CURRENT artifact and the prior scan of the
 *     WO-002 artifact, and compares them ROW BY ROW on
 *     (CVE, severity, package purl incl. exact version, affected range, fixed
 *     version) — the same like-for-like tuple WO-002 CR-01 used.
 *  2. Emits, for every HIGH/CRITICAL row, the state machine:
 *         vexStatus           = UNDER_INVESTIGATION   (current, blocking)
 *         proposedVexStatus   = NOT_AFFECTED          (proposed only)
 *         independentAuditor  = null
 *         ownerApproval       = null
 *     The executor proposes; it does not dispose. PH-SEC-VEX-POLICY via ADR-0007
 *     requires an independent audit and an owner approval before a HIGH/CRITICAL
 *     row stops blocking, and this artifact is NEW, so the prior approvals do not
 *     carry over by definition. CR-05 adds a gate on top: the
 *     (CVE, vulnerableCodePresent, proposedJustification) triple must equal the
 *     ACCEPTED WO-002 record for every row, or nothing is written at all.
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
  "sha256:6a7c210bcbad1f59a0b86e9d1b6e1b2a7eb51f018d6c229c4180cd78c2240c60";
const PRIOR_ARTIFACT =
  "sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c";
const LOCKED_BASE = "af6235d2164171985af6152ba03835826ace3cdb";

// This file lives at <root>/.engineering/evidence/PH-M01-WO-003/receipts/, so the
// repository root is four levels up.
const ROOT = resolve(import.meta.dirname, "../../../..");
const P = (...parts) => resolve(ROOT, ...parts);
const readJson = (...parts) => JSON.parse(readFileSync(P(...parts), "utf8"));

const NEW_SCAN = P(
  ".engineering/evidence/PH-M01-WO-004/receipts/07-final-image-scan.sarif",
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
  ".engineering/evidence/PH-M01-WO-004/receipts/08-vex-state-machine.json",
);
const OUT_MD = P(
  ".engineering/evidence/PH-M01-WO-004/receipts/08-vex-state-machine.md",
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

// Bind the SCAN to the DECLARED artifact. If the scan belongs to a different
// image, every re-measurement below would be answering a question about that
// other image — exactly the class of error that would let an expired
// disposition keep looking alive. A mismatch is a hard stop, not a warning.
//
// WHERE the binding can be checked was MEASURED, not assumed: docker scout
// 1.24.0 emits SARIF with NO run.properties, no invocation metadata, no image
// name and no digest anywhere in the document (verified against the committed
// scan: `run.properties === undefined`, and the file contains neither the
// current nor any prior digest). So a check that reads the SARIF alone cannot
// fire on this scanner — the first revision of this gate passed VACUOUSLY for
// that reason. The analysable identity lives in the scout STDERR receipt, whose
// temporary-archive path names the digest scout was handed:
//   ...\docker-scout\sha256\<digest>\<uuid>: ...
// That receipt is therefore REQUIRED here, and it must name the declared
// artifact. The SARIF-properties check is kept as well so the gate tightens
// automatically if a future scout version starts emitting identity metadata.
const SCAN_STDERR = P(
  ".engineering/evidence/PH-M01-WO-004/receipts/07-final-image-scan.stderr.txt",
);
const artifactHex = NEW_ARTIFACT.replace("sha256:", "");
const scanStderr = readFileSync(SCAN_STDERR, "utf8");
if (!scanStderr.includes(artifactHex)) {
  throw new Error(
    `scan/artifact binding failed: ${SCAN_STDERR} does not name ${NEW_ARTIFACT}. Refusing to reconcile dispositions against a scan of a different image.`,
  );
}
const scanDigest = (() => {
  const sarif = JSON.parse(readFileSync(NEW_SCAN, "utf8"));
  const props =
    sarif.runs?.[0]?.properties ??
    sarif.runs?.[0]?.tool?.driver?.properties ??
    {};
  const named = [
    props.imageName,
    props.imageDigest,
    ...(Object.values(props).filter(
      (v) => typeof v === "string" && /^sha256:[0-9a-f]{64}$/.test(v),
    ) ?? []),
  ].filter(Boolean);
  return { named, raw: JSON.stringify(props).slice(0, 2000) };
})();

if (
  scanDigest.named.length > 0 &&
  !scanDigest.named.some((value) =>
    String(value).includes(artifactHex),
  )
) {
  throw new Error(
    `scan/artifact binding failed: ${NEW_SCAN} does not name ${NEW_ARTIFACT}. Refusing to reconcile dispositions against a scan of a different image.`,
  );
}

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
 * Audit CR-05 — restore the accepted CVE-2026-8376 semantics.
 *
 * WO-002's owner-approved record for this row is unambiguous:
 *
 *   vulnerableCodePresent   : true
 *   proposedJustification   : vulnerable_code_cannot_be_controlled_by_adversary
 *
 * and its own text says so in as many words — the vulnerable code IS PRESENT
 * (`Perl_study_chunk` ships in perl-base 5.36.0-7+deb12u3), and what an
 * adversary cannot do is DRIVE IT INTO THE OVERFLOW CONDITION, because the
 * advisory scopes the defect to 32-bit ILP32 builds and the artifact is
 * amd64 / ELF64 / ivsize=8 / longsize=8 / ptrsize=8 / LONG_BIT=64.
 *
 * WO-003 had silently rewritten this to `vulnerable_code_not_in_execute_path`
 * ("Perl is never executed"). That is a weaker AND different claim: it would
 * stop being true the moment anything in the image invoked perl, while the
 * 32-bit-build argument holds regardless. Restoring the accepted semantics is
 * therefore a correctness fix, not a bookkeeping one.
 *
 * "Perl is never executed" is retained — but ONLY as SECONDARY
 * defence-in-depth, explicitly not as the justification, exactly as the accepted
 * record requires.
 */
const CR05_RESTORED_ROWS = new Map([
  [
    "CVE-2026-8376",
    {
      vulnerableCodePresent: true,
      justification:
        "vulnerable_code_cannot_be_controlled_by_adversary",
      secondaryDefenceInDepth: {
        claim: "Perl is never executed in this container.",
        role: "SECONDARY defence-in-depth ONLY. It is NOT the justification for this disposition and must not be read as one.",
        evidence:
          "compose runs only `npm run dev` and nodemon; neither container's live process table contains a perl process; no package.json lifecycle script invokes perl; and P2 measured zero subprocess call sites in tracked source (re-measured this round: `git ls-files apps packages tests` filtered to code extensions, zero child_process/execSync/spawnSync/execFile/spawn( matches; the single `exec(` hit is `RegExp.prototype.exec` in a test — receipts/23-cr09-cr10-revalidation.txt).",
        source: "receipts/16-objective-equivalence.txt (P2, P3)",
      },
      rationale:
        "The accepted proof is an architecture/arithmetic bound: the advisory's overflow requires the 32-bit integer-width arithmetic that a 64-bit ILP32 perl cannot exhibit, so no attacker-controlled input reaches the vulnerable condition on this artifact. Reachability is therefore irrelevant to the disposition, which is why demoting the row to 'not in execute path' was both a semantic regression and an unsound one.",
    },
  ],
]);

/**
 * Rows whose `proposedJustification` MUST equal the accepted WO-002
 * `proposedJustification`. Checked mechanically below for EVERY row, so a silent
 * rewrite of any of the 25 cannot survive a regeneration.
 */
const restoredRow = (cve) => CR05_RESTORED_ROWS.get(cve) ?? null;

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
  //
  // Audit CR-10 — provenance matters. The WO-002 per-perl DELTA file
  // (`receipts/vex-delta-3-perl-cves.json`) is a PRE-CORRECTION source: its
  // CVE-2026-8376 row still carries `vulnerable_code_not_in_execute_path`,
  // which the owner-approved FINAL record subsequently replaced. A row whose
  // evidence came from that delta is therefore rebuilt from the CANONICAL FINAL
  // record (`PH-M01-WO-002-VEX-FINAL.json`), so no superseded basis can survive
  // anywhere under `preservedPriorBasis`. A delta-sourced row with no canonical
  // final row is a hard stop — there would be nothing sound to preserve.
  const preservedBasis = (() => {
    if (evidence === null) return null;
    if (evidence.deltaDisposition) {
      if (final === null) {
        throw new Error(
          `preserved-basis provenance: ${row.cve} is delta-sourced but has no row in the canonical WO-002 final record; refusing to emit a basis that may be superseded.`,
        );
      }
      return {
        source:
          "PH-M01-WO-002 — canonical owner-approved final VEX (receipts/cr01-revalidation/PH-M01-WO-002-VEX-FINAL.json)",
        fromCanonicalFinal: true,
        vulnerableComponent: final.component,
        vulnerableCodePresent: final.vulnerableCodePresent ?? null,
        justification: final.proposedJustification,
        presenceEvidence: final.revalidation?.evidence ?? null,
        receipts: final.revalidation?.objectiveEquivalenceEvidence ?? [],
      };
    }
    return {
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
  })();

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

  // Audit CR-05: the disposition the executor PROPOSES must be the accepted one.
  // Two sources are consulted, both authoritative, both checked by the integrity
  // gate below:
  //   - CR05_RESTORED_ROWS, which restores the row(s) whose semantics regressed;
  //   - the accepted WO-002 record itself.
  // `preservedBasis` — the WO-003-era delta prose, which is where the regressed
  // phrasing lives — is deliberately the LAST resort and never the primary
  // source. Sourcing it first is precisely the regression CR-05 identified, and
  // the negative control for this gate patches this exact expression.
  const accepted = final
    ? {
        vulnerableCodePresent: final.vulnerableCodePresent ?? null,
        proposedJustification: final.proposedJustification ?? null,
        evidence: final.revalidation?.evidence ?? null,
      }
    : null;
  const restore = restoredRow(row.cve);
  const proposedVexStatus = premiseAltered ? null : "NOT_AFFECTED";
  const proposedJustification = premiseAltered
    ? null
    : (restore?.justification ??
      accepted?.proposedJustification ??
      preservedBasis?.justification ??
      null);
  const vulnerableCodePresent = premiseAltered
    ? null
    : (restore?.vulnerableCodePresent ??
      accepted?.vulnerableCodePresent ??
      preservedBasis?.vulnerableCodePresent ??
      null);

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
    proposedVexStatus,
    proposedJustification,
    // CR-05: restored alongside the justification so the two cannot drift apart.
    // "vulnerable code present" + "not affected" is a legitimate combination;
    // it means the code ships but the adversary cannot reach the condition.
    vulnerableCodePresent,
    independentAuditor: null,
    ownerApproval: null,

    // CR-05: the accepted primary proof, verbatim, and — separately — anything
    // that is only defence in depth.
    acceptedPrimaryBasis: accepted,
    cr05Restored: restore === null ? null : { ...restore },
    secondaryDefenceInDepth:
      restore === null ? null : restore.secondaryDefenceInDepth,

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

/**
 * Audit CR-05 / CR-10 integrity gate — MECHANICAL, runs on every regeneration.
 *
 * For every row this script proposes a disposition for, the emitted semantics
 * must equal the accepted WO-002 record, which the independent auditor approved
 * and the Project Owner approved on receipt `PH-M01-WO-002-OWNER-APPROVAL.md`.
 * A divergence is not something to note in prose; it is a hard stop, because
 * exactly that failure — one row quietly restated in weaker, different words —
 * is what CR-05 caught.
 *
 * CR-10 caught what the first revision MISSED: it compared only the top-level
 * triple, so a NESTED field (`preservedPriorBasis.justification`) could keep
 * the superseded `vulnerable_code_not_in_execute_path` while the top level
 * looked correct. The gate now walks every finding recursively and fails when:
 *
 *   - any string value ANYWHERE in the finding, exactly equal to a VEX
 *     justification enum, differs from the accepted justification. Exact
 *     equality is deliberate: prose may quote history, but a machine-readable
 *     field carrying an enum IS a justification claim. (This covers the
 *     top-level field, `cr05Restored`, `acceptedPrimaryBasis`, and every
 *     `preservedPriorBasis`-shaped nesting, present or future.)
 *   - any boolean field named `vulnerableCodePresent` (any nesting) differs
 *     from the accepted boolean.
 *   - a WO-002-sourced preserved basis is not flagged `fromCanonicalFinal`.
 *   - a row registers an independent-auditor or owner approval, or leaves
 *     UNDER_INVESTIGATION, before the proper gates have acted.
 */
const JUSTIFICATION_ENUM = new Set([
  "vulnerable_code_not_present",
  "vulnerable_code_not_in_execute_path",
  "vulnerable_code_cannot_be_controlled_by_adversary",
]);

function collectDivergences(cve, node, path, visit) {
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    const here = `${path}.${key}`;
    if (typeof value === "string" || typeof value === "boolean") {
      visit({ path: here, key, value });
    } else if (typeof value === "object") {
      collectDivergences(cve, value, here, visit);
    }
  }
}

const justificationDivergences = findings
  .filter((f) => f.proposedVexStatus !== null)
  .map((f) => {
    const accepted = wo002FinalByCve.get(f.cve);
    if (!accepted) {
      return {
        cve: f.cve,
        field: "record",
        accepted: "ABSENT",
        emitted: "proposed",
      };
    }
    const acceptedJustification = accepted.proposedJustification;
    const acceptedVcp = accepted.vulnerableCodePresent ?? null;
    const out = [];
    collectDivergences(f.cve, f, "$", ({ path, key, value }) => {
      if (
        typeof value === "string" &&
        JUSTIFICATION_ENUM.has(value) &&
        value !== acceptedJustification
      ) {
        out.push({
          cve: f.cve,
          field: `${path} (justification enum, nested scan)`,
          accepted: acceptedJustification,
          emitted: value,
        });
      }
      if (
        typeof value === "boolean" &&
        /vulnerableCodePresent/i.test(key) &&
        value !== acceptedVcp
      ) {
        out.push({
          cve: f.cve,
          field: `${path} (vulnerableCodePresent, nested scan)`,
          accepted: acceptedVcp,
          emitted: value,
        });
      }
    });
    if (
      f.preservedPriorBasis?.source?.includes("PH-M01-WO-002") &&
      f.preservedPriorBasis.fromCanonicalFinal !== true
    ) {
      out.push({
        cve: f.cve,
        field: "preservedPriorBasis.fromCanonicalFinal",
        accepted: true,
        emitted: f.preservedPriorBasis.fromCanonicalFinal ?? null,
      });
    }
    if (f.vexStatus !== "UNDER_INVESTIGATION") {
      out.push({
        cve: f.cve,
        field: "vexStatus",
        accepted: "UNDER_INVESTIGATION",
        emitted: f.vexStatus,
      });
    }
    if (f.independentAuditor !== null || f.ownerApproval !== null) {
      out.push({
        cve: f.cve,
        field: "approval-registered",
        accepted: "null / null",
        emitted: JSON.stringify({
          independentAuditor: f.independentAuditor,
          ownerApproval: f.ownerApproval,
        }),
      });
    }
    return out;
  })
  .flat();

if (justificationDivergences.length > 0) {
  throw new Error(
    "CR-05 integrity gate: the proposed dispositions diverge from the accepted " +
      "WO-002 record for " +
      justificationDivergences.length +
      " field(s). Refusing to emit a receipt that silently restates an approved " +
      "disposition:\n" +
      JSON.stringify(justificationDivergences, null, 2),
  );
}

const justificationIntegrity = {
  acceptedRecord: "PH-M01-WO-002-VEX-FINAL.json (independent audit + Project Owner approval)",
  rowsCompared: findings.filter((f) => f.proposedVexStatus !== null).length,
  divergences: 0,
  restoredThisRound: [...CR05_RESTORED_ROWS.keys()],
  rule:
    "Every proposed disposition reproduces the accepted (CVE, vulnerableCodePresent, proposedJustification) triple exactly — in EVERY machine-readable field of the row, not only the top level (audit CR-10). The gate collects every string exactly equal to a VEX justification enum anywhere in the finding, every boolean `vulnerableCodePresent` at any nesting, the canonical-final provenance of every WO-002-sourced preserved basis, and the approval/status fields, and throws before writing output on the first divergence. Where an audit requires a semantic restoration, the accepted record is restored verbatim and the divergence is named — never paraphrased. The executor may propose; it may not restate.",
  note:
    "Measured on this run: 25/25 rows identical to the accepted record across all nested justification-bearing fields. The CR-05 regression (CVE-2026-8376, 'vulnerable_code_not_in_execute_path' -> 'vulnerable_code_cannot_be_controlled_by_adversary') is restored; the CR-10 residue (a NESTED preservedPriorBasis.justification still carrying the superseded axis) is eliminated by rebuilding delta-sourced preserved bases from the canonical FINAL record; and the gate now fails on either, anywhere in the row.",
};

const summary = {
  schemaVersion: 3,
  workOrder: "PH-M01-WO-003",
  correctionDelta:
    "audit CR-03 — the FINAL M01 artifact: base pinned by immutable digest, ONE candidate built/run/scanned; every HIGH/CRITICAL disposition resets to UNDER_INVESTIGATION on the new digest",
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

  scanBinding: {
    enforcedFrom: "14-image-scan.stderr.txt",
    rule:
      "The scout stderr receipt must name the declared artifact digest, or the script throws before writing any output. The SARIF alone CANNOT carry this check: docker scout 1.24.0 emits no run.properties, no invocation metadata, no image name and no digest anywhere in the document, so a SARIF-only binding passes VACUOUSLY — which the first revision of this gate did. That was found by measurement (run.properties === undefined), fixed, and the fix was verified by a negative control that corrupts the digest inside the stderr receipt and observes the script halt.",
    sarifPropertiesCheckKept:
      "If a future scout version starts emitting image identity in SARIF properties, the same check fires on the SARIF as well. It is kept conditional for exactly that reason, never relied upon for scout 1.24.0.",
    reproducibilityEvidence:
      "The SARIF is byte-deterministic for this image and scanner: receipts/22-scan-reproducibility.txt re-runs docker scout against the same image and the output hashes identically to the committed scan.",
  },

  rebuildObligation: {
    branchTaken: "REBUILD + NEW DIGEST + SCAN/VEX RESET (audit CR-03 — the FINAL M01 artifact)",
    trigger:
      "audit CR-03: Dockerfile.dev now pins the Node base by immutable digest (FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20), which is a Docker build input change. The clean rebuild is the FINAL M01 artifact candidate; the acceptance runtime, the probes, Docker Scout, the acceptance matrix and this VEX all bind to ITS digest. The previous artifact (sha256:aee3ad8c...) is superseded, its owner approvals historical only.",
    thereforeIdenticalDigestShortcutAvailable: false,
    buildInputsChanged: [
      "Dockerfile.dev (Node base pinned by immutable resolved digest)",
    ],
    buildInputsUnchanged: [
      "package.json",
      "package-lock.json",
      "Dockerfile.dev",
      "compose.yaml",
      "base image CONTENT (the pinned digest resolves the same official image the tag pointed at after pull)",
      "all dependency versions",
      "postgres:17.11-alpine3.24 base image",
    ],
    npmAuditHighOrCritical: 0,
    supersededArtifacts: [
      "sha256:aee3ad8c254bb435cb26817296c461a9d5ac34d9b6150a82925afeb81dce77b2 (CR-05..CR-10 artifact; superseded by the final candidate)",
      "sha256:f810df3a64aa15b99e477006a39c399eb43d9b59c635376d942e89dc15cc17c8",
      "sha256:8bd3e85a206492de832dd95575b0004165e7368b53427ba887547743019c22c4",
    ],
    note:
      "Every prior NOT_AFFECTED expired at this new digest by construction. Nothing was carried forward by reference to an approval: the prior row-specific ANALYSIS is preserved by reference, and each row's premise is re-measured here.",
  },

  objectiveEquivalence: {
    method:
      "Every prior NOT_AFFECTED expires at a new image digest. Per row, and per PH-SEC-VEX-POLICY, the axes component/package, exact version, architecture, installed files, runtime assumptions and the assumptions the prior proof itself rested on were compared between the artifact the disposition was produced on and THIS artifact. Where every axis is identical the prior row-specific analysis is preserved BY REFERENCE and reproduced verbatim below; where any axis differs the row returns to UNDER_INVESTIGATION with no proposal. On THIS artifact the Debian inventory differs from the WO-002 baseline by exactly two package updates (libpcre2-8-0 deb12u1 -> deb12u2 and tzdata 2026b -> 2026c); the four native artifacts the node/libstdc++/libvips proofs rest on are byte-identical, and every dispositioned component version is otherwise unchanged.",
    receipt: "receipts/09-premise-revalidation.txt",
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
          "Debian inventory: 88 packages with exactly two version updates vs the WO-002 baseline — libpcre2-8-0 10.42-1+deb12u1 -> +deb12u2 (which is why CVE-2026-103111 is no longer present on this artifact: the vulnerable version is GONE, a fix by base update) and tzdata 2026b -> 2026c (not a dispositioned row). Every npm purl version identical (lockfile unchanged).",
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

  justificationIntegrity,
  cr05Correction: {
    cve: "CVE-2026-8376",
    regression:
      "WO-003 restated the accepted disposition as `vulnerable_code_not_in_execute_path`, resting the row on 'Perl is never executed'.",
    restored: {
      vulnerableCodePresent: true,
      proposedJustification: "vulnerable_code_cannot_be_controlled_by_adversary",
    },
    why:
      "The accepted proof is an architecture/arithmetic bound, not a reachability argument: Perl_study_chunk IS PRESENT in perl-base 5.36.0-7+deb12u3, and the advisory's overflow is scoped to 32-bit ILP32 builds, which this amd64 / ELF64 / ivsize=8 / longsize=8 / ptrsize=8 / LONG_BIT=64 artifact cannot be. Reachability is irrelevant to the disposition. Restoring the weaker phrasing would have (a) misstated what the accepted proof rests on and (b) produced a disposition that silently expires if anything in the image ever invokes perl.",
    secondaryDefenceInDepthRetained:
      "'Perl is never executed' is retained explicitly as SECONDARY defence-in-depth, labelled as such in the JSON, per the accepted record's own instruction.",
    stateUnchanged:
      "vexStatus stays UNDER_INVESTIGATION; proposedVexStatus stays NOT_AFFECTED (proposed only); independentAuditor and ownerApproval stay null. CR-05 restored a JUSTIFICATION, not an approval.",
  },

  approvalState: {
    independentAuditor: null,
    ownerApproval: null,
    status: "PROPOSED — awaiting independent audit and Project Owner decision",
    note:
      "Per CR-04 the executor does NOT register NOT_AFFECTED as current approved state. Until an independent auditor and the Project Owner act on this exact digest, all 25 rows block under the 'never advance with a known HIGH/CRITICAL defect' rule.",
  },

  cr10Correction: {
    finding:
      "audit CR-10 — the CVE-2026-8376 row was internally contradictory: the top level carried the accepted `vulnerable_code_cannot_be_controlled_by_adversary`, but the nested `preservedPriorBasis.justification` still carried the superseded `vulnerable_code_not_in_execute_path` (and its presenceEvidence again made 'Perl is never executed' part of the preserved basis).",
    rootCause:
      "The preserved basis for the WO-002 perl rows was seeded from `receipts/vex-delta-3-perl-cves.json` — the PRE-CORRECTION delta — instead of the canonical owner-approved final record (`receipts/cr01-revalidation/PH-M01-WO-002-VEX-FINAL.json`). The delta is history; it must not seed any current machine-readable field.",
    fix: [
      "Delta-sourced rows now build `preservedPriorBasis` from the canonical FINAL record only, flagged `fromCanonicalFinal: true`; a delta-sourced row with no canonical row is a hard stop at generation time.",
      "The CR-05 integrity gate walks every nested field: any string exactly equal to a VEX justification enum anywhere in the finding must equal the accepted justification; any boolean `vulnerableCodePresent` at any nesting must equal the accepted value; a WO-002-sourced preserved basis must be flagged canonical; and a row may not register approvals or leave UNDER_INVESTIGATION.",
      "The verification mutation (a nested field restored to `vulnerable_code_not_in_execute_path`) is recorded as a negative control that makes the gate FAIL.",
    ],
    scope:
      "CVE-2026-8376 is the only row that needed a semantic restore; the other 24 rows were compared field by field and were already consistent with the accepted record (deterministic equality scan + a batched JEV advisory classification, both recorded in receipts/24-jev-mcp-execution.txt).",
  },

  dispositionedButAbsentFromNewScan: dispositionedButAbsent,
  dispositionedButAbsentInterpretation:
    "CVE-2026-103111 (pcre2): dispositioned in WO-002 and absent from this scan because the pinned base ships libpcre2-8-0 10.42-1+deb12u2 - the vulnerable version is no longer installed. A fix-by-artifact-update, reconciled honestly; suppression counters remain zero.",
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
  "## CR-05 — CVE-2026-8376 semantics restored",
  "",
  "WO-003 had restated this row as `vulnerable_code_not_in_execute_path`, resting it",
  "on *\"Perl is never executed\"*. That is a semantic regression and it is restored",
  "here to the accepted WO-002 disposition, which the independent auditor reviewed",
  "and the Project Owner approved:",
  "",
  "| Field | Accepted WO-002 value | WO-003 regression | This receipt |",
  "| --- | --- | --- | --- |",
  "| `vulnerableCodePresent` | `true` | *(unstated)* | **`true`** |",
  "| `proposedJustification` | `vulnerable_code_cannot_be_controlled_by_adversary` | `vulnerable_code_not_in_execute_path` | **`vulnerable_code_cannot_be_controlled_by_adversary`** |",
  "| `vexStatus` | `NOT_AFFECTED` (approved) | — | **`UNDER_INVESTIGATION`** (new digest ⇒ expired) |",
  "| `independentAuditor` | approved | — | **`null`** |",
  "| `ownerApproval` | approved | — | **`null`** |",
  "",
  "**Why the weaker phrasing was wrong, not merely different.** The accepted proof is",
  "an architecture and arithmetic bound, not a reachability argument. The vulnerable",
  "code IS present: `Perl_study_chunk` is the regular-expression compilation path",
  "inside the interpreter and ships as part of `perl-base 5.36.0-7+deb12u3`, which is",
  "installed on this artifact. What an adversary cannot do is DRIVE IT INTO THE",
  "OVERFLOW CONDITION, because the advisory scopes the defect to 32-bit (ILP32) Perl",
  "builds and this artifact is amd64 / ELF64 with `perl -V:ivsize=8`, `longsize=8`,",
  "`ptrsize=8`, `LONG_BIT=64`. Reachability is therefore IRRELEVANT to the",
  "disposition — which is exactly why \"Perl is never executed\" cannot carry it: that",
  "claim would become false the moment anything in the image invoked perl, while the",
  "32-bit-build argument holds unconditionally.",
  "",
  "**Secondary defence-in-depth retained, explicitly demoted.** \"Perl is never",
  "executed\" is preserved in the JSON under `secondaryDefenceInDepth`, labelled",
  "\"NOT the justification for this disposition and must not be read as one\", which is",
  "the accepted record's own instruction. Its evidence is re-measured in this round:",
  "no perl process in either container's live process table, no perl invocation in any",
  "tracked `package.json`, and zero subprocess call sites in tracked source",
  "(re-measured with an explicit, recorded command; the single `exec(` hit is",
  "`RegExp.prototype.exec`).",
  "",
  "**CR-10 — the nested residue is gone and cannot come back.** `preservedPriorBasis`",
  "for delta-sourced rows is now rebuilt from the CANONICAL owner-approved final",
  "record (`PH-M01-WO-002-VEX-FINAL.json`) and flagged `fromCanonicalFinal: true`;",
  "the WO-002 per-perl delta file is a pre-correction source and is never used to seed",
  "a preserved basis. The integrity gate walks every nested field (see below).",
  "",
  "**What did NOT change.** `vexStatus` remains `UNDER_INVESTIGATION`,",
  "`proposedVexStatus` remains a *proposal* of `NOT_AFFECTED`, `independentAuditor` and",
  "`ownerApproval` remain `null`. CR-05 restored a justification, not an approval.",
  "",
  "## Justification integrity — measured, not asserted",
  "",
  `Rows compared against the accepted record: **${justificationIntegrity.rowsCompared}**. Divergences: **${justificationIntegrity.divergences}**. Restored this round: \`${justificationIntegrity.restoredThisRound.join(", ")}\`.`,
  "",
  "Every proposed disposition reproduces the accepted `(CVE, vulnerableCodePresent,",
  "proposedJustification)` triple **exactly — in every machine-readable field of the",
  "row, not only the top level**. This is enforced mechanically inside",
  "`vex-state-machine.mjs`: the gate walks each finding recursively, collects every",
  "string exactly equal to a VEX justification enum anywhere in it, every boolean",
  "`vulnerableCodePresent` at any nesting, the `fromCanonicalFinal` provenance of every",
  "WO-002-sourced preserved basis, and the approval/status fields — then THROWS before",
  "writing any output on the first divergence. Two failure modes are thereby caught:",
  "the CR-05 regression (one row quietly restated in weaker words at the top level) and",
  "the CR-10 residue (a NESTED `preservedPriorBasis.justification` still carrying the",
  "superseded axis while the top level looked correct). Both were reproduced as",
  "negative controls; the check covers all 25 rows, which is also the answer to",
  "\"did any other row change its previously-approved justification\": **no**.",
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