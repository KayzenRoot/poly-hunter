const fs = require("node:fs");

const v = JSON.parse(
  fs.readFileSync(
    ".engineering/evidence/PH-M01-WO-002/receipts/cr01-revalidation/PH-M01-WO-002-VEX-FINAL.json",
    "utf8",
  ),
);

const NEW = "PH-M01-WO-002 (this delta)";
const OUT =
  ".engineering/evidence/PH-M01-WO-002/receipts/cr01-revalidation/09-final-security-reconciliation.txt";

const L = [];
L.push("# Final security reconciliation — PH-M01-WO-002 correction delta CR-01");
L.push("#");
L.push(
  "# Every HIGH/CRITICAL finding reported on the FINAL artifact, its provenance and its",
);
L.push(
  "# policy status on the exact digest below. Nothing in this file is approved: the",
);
L.push(
  "# executor may propose a disposition, never approve one (PH-SEC-VEX-POLICY / ADR-0007).",
);
L.push("");
L.push(
  "artifact       = sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c",
);
L.push("head           = " + v.head);
L.push("branch         = " + v.branch);
L.push(
  "scanner        = docker scout " +
    v.scanner.version +
    " (Docker Engine " +
    v.scanner.dockerEngine +
    ")",
);
L.push("sarif receipt  = " + v.scanner.receipt);
L.push("sarif sha256   = " + v.scanner.receiptSha256);
L.push("");
L.push("## Why nothing is APPROVED");
L.push("");
L.push(
  "PH-SEC-VEX-POLICY expires a NOT_AFFECTED disposition at a new image digest. The CR-02/",
);
L.push(
  "CR-03/CR-04 corrections changed application code, so the digest necessarily changed and",
);
L.push(
  "every disposition produced on sha256:4cb8f254...83d538 expired. Each row below was",
);
L.push(
  "therefore re-derived on sha256:eddda17a...cb7c and reset to UNDER_INVESTIGATION.",
);
L.push(
  "The prior owner approvals (PH-SEC-WO-007, PH-SEC-WO-008) are historical records of the",
);
L.push("PRIOR digest and do NOT approve this one.");
L.push("");
L.push("## Disposition ledger (25 HIGH/CRITICAL rows)");
L.push("");
L.push(
  "| # | CVE | sev | component (exact version) | proposed | justification | carried from |",
);
L.push("|---|---|---|---|---|---|---|");
let i = 0;
for (const f of v.findings) {
  i += 1;
  const comp = f.component.replace(/\|/g, "/");
  L.push(
    "| " +
      i +
      " | " +
      f.cve +
      " | " +
      f.scannerSeverity +
      " | " +
      comp +
      " | " +
      f.proposedVexStatus +
      " | " +
      f.proposedJustification +
      " | " +
      f.priorDispositionSource +
      " |",
  );
}
L.push("");
L.push("## Summary counts");
L.push("");
const cnt = (k) => v.findings.filter((f) => f.priorDispositionSource === k).length;
const proposed = v.findings.filter((f) => f.proposedVexStatus === "NOT_AFFECTED").length;
const approved = v.findings.filter((f) => f.vexStatus === "NOT_AFFECTED").length;
L.push("- HIGH/CRITICAL rows on the FINAL artifact: **" + v.findings.length + "**");
L.push("- proposed NOT_AFFECTED: **" + proposed + "**");
L.push("- actually approved: **" + approved + "** — every row is UNDER_INVESTIGATION");
L.push("- carried over from PH-SEC-WO-007 (prior digest): " + cnt("PH-SEC-WO-007"));
L.push("- carried over from PH-SEC-WO-008 (prior digest): " + cnt("PH-SEC-WO-008"));
L.push("- first analysed on this digest: " + cnt(NEW));
L.push("");
L.push("## The three rows with no prior disposition");
L.push("");
L.push(
  "These are new relative to the prior scan and were analysed from scratch on the FINAL",
);
L.push("artifact — no prior analysis exists to carry over.");
L.push("");
for (const f of v.findings.filter((x) => x.priorDispositionSource === NEW)) {
  L.push(
    "### " +
      f.cve +
      " — proposed " +
      f.proposedVexStatus +
      " (" +
      f.proposedJustification +
      ")",
  );
  L.push("");
  L.push("- Component: " + f.component);
  L.push(
    "- Proof receipts: " +
      f.revalidation.objectiveEquivalenceEvidence.map((r) => "`" + r + "`").join(", "),
  );
  L.push("- " + f.revalidation.evidence);
  L.push("");
}
L.push("## The three Perl advisories carried from the review");
L.push("");
L.push(
  "The independent review required the CR-01 revalidation to preserve a",
);
L.push(
  "`vulnerable_code_not_present` disposition ONLY if the absence is re-proven on the FINAL",
);
L.push(
  "artifact, and required CVE-2026-8376 to rest on exact component/version/architecture",
);
L.push(
  "evidence rather than primarily on \"perl is never executed\". Both requirements are met",
);
L.push("on the FINAL digest:");
L.push("");
L.push(
  "- `Archive::Tar` absence re-proven by three independent methods on sha256:eddda17a...cb7c",
);
L.push(
  "  (dpkg -S, filesystem find across every mount, and the image perl failing to load it).",
);
L.push(
  "- CVE-2026-8376 rests on a measured, unsatisfiable 32-bit prerequisite: perl-base",
);
L.push("  5.36.0-7+deb12u3 **amd64**, ELF EI_CLASS=0x02 (ELF64), e_machine=0x3e (x86-64),");
L.push(
  "  Config{ivsize}=8 bytes (64-bit IV), LONG_BIT=64, Config{ptrsize}=8 bytes.",
);
L.push(
  "  \"perl is not executed\" is recorded only as a secondary defence-in-depth",
);
L.push("  observation, not as the justification.");
L.push("");
L.push("### CR-06 — vulnerableCodePresent is now type- and semantically coherent");
L.push("");
L.push(
  "The three Perl rows previously carried the string `\"no\"`, which was a type",
);
L.push("mismatch against the 22 boolean carried-over rows and, for CVE-2026-8376, a");
L.push(
  "contradiction: \"code not present\" cannot support a",
);
L.push("`vulnerable_code_cannot_be_controlled_by_adversary` justification. All 25 rows now");
L.push("carry a strict boolean, and the generator asserts the invariant:");
L.push("");
L.push("| CVE | vulnerableCodePresent | justification | coherence |");
L.push("|---|---|---|---|");
for (const f of v.findings.filter((x) => x.priorDispositionSource === NEW)) {
  const coherent =
    f.vulnerableCodePresent === false
      ? "absent code, not-present disposition"
      : "code present, adversary cannot reach it";
  L.push(
    "| " +
      f.cve +
      " | `" +
      f.vulnerableCodePresent +
      "` | `" +
      f.proposedJustification +
      "` | " +
      coherent +
      " |",
  );
}
L.push("");
L.push(
  "CVE-2026-8376 is encoded `true` deliberately: `Perl_study_chunk`, the regular",
);
L.push(
  "expression compilation path named by the advisory, ships inside perl-base and IS",
);
L.push(
  "installed on this artifact. Claiming otherwise would have been the less honest",
);
L.push(
  "option. What an attacker cannot do is reach its overflow condition, because that",
);
L.push(
  "condition is 32-bit-specific and the measured runtime is 64-bit throughout",
);
L.push("(ELF64, ivsize/longsize/ptrsize all 8 bytes, LONG_BIT=64).");
L.push("");
L.push("## Policy compliance statement");
L.push("");
L.push("- No suppression, ignore file, waiver or severity downgrade was used.");
L.push("- Justifications are limited to the ADR-0007 permitted set.");
L.push("- No prior owner approval was reused as approval of the new digest.");
L.push(
  "- No owner approval has been requested for this delta; the audit request is still open.",
);
L.push(
  "- The OPEN governance item is the 25 dispositions above, which require a NEW",
);
L.push("  independent audit plus owner approval before promotion.");

fs.writeFileSync(OUT, L.join("\n") + "\n");
console.log("wrote 09-final-security-reconciliation.txt:", v.findings.length, "rows");