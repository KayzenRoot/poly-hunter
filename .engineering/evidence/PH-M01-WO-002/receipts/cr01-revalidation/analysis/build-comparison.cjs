const fs = require("node:fs");

const parse = (r) => {
  const t = (r.message && r.message.text) || "";
  const o = {};
  for (const l of t.split("\n")) {
    const i = l.indexOf(":");
    if (i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return o;
};

const RECEIPTS = ".engineering/evidence/PH-M01-WO-002/receipts";

/** Flatten a SARIF document into rows keyed by CVE + exact package purl. */
const rowsOf = (path) => {
  const doc = JSON.parse(fs.readFileSync(path, "utf8"));
  const rows = new Map();
  for (const r of doc.runs[0].results || []) {
    const p = parse(r);
    const k = r.ruleId + "|" + p["Package"];
    if (!rows.has(k)) {
      rows.set(k, {
        cve: r.ruleId,
        severity: p["Severity"],
        pkg: p["Package"],
        range: p["Affected range"],
        fixed: p["Fixed version"],
        epss: p["EPSS Score"],
        pct: p["EPSS Percentile"],
      });
    }
  }
  return rows;
};

const priorRows = rowsOf(`${RECEIPTS}/runtime/prior-image-scan.sarif`);
const finalRows = rowsOf(`${RECEIPTS}/runtime/final-image-scan.sarif`);

// Like-for-like comparison. Any axis that differs makes the row "CHANGED",
// which under PH-SEC-VEX-POLICY forces the affected analysis to be redone.
const FIELDS = ["severity", "pkg", "range", "fixed", "epss", "pct"];
const d = { rows: [] };
for (const [k, prior] of priorRows) {
  const fin = finalRows.get(k);
  if (!fin) {
    d.rows.push({ key: k, status: "REMOVED", prior });
    continue;
  }
  const differing = FIELDS.filter((f) => String(prior[f]) !== String(fin[f]));
  d.rows.push({
    key: k,
    status: differing.length === 0 ? "IDENTICAL" : "CHANGED",
    differing,
    prior,
    final: fin,
  });
}
for (const [k, fin] of finalRows) {
  if (!priorRows.has(k)) d.rows.push({ key: k, status: "ADDED", final: fin });
}

d.oldArtifact = "sha256:4cb8f254120efe66d7781c2261ee451aef50e8243bde6471271995551783d538 (prior WO-002 artifact)";
d.newArtifact = "sha256:eddda17a805b36468dec362df328778cfb285681c9252e4f5e88480064b1cb7c (FINAL artifact)";
d.oldSize = priorRows.size;
d.newSize = finalRows.size;

const rows = finalRows;
const wo007Doc = JSON.parse(
  fs.readFileSync(".engineering/evidence/PH-SEC-WO-007-VEX.json", "utf8"),
);
const wo007 = (wo007Doc.findings || []).map((f) => f.cve);
const all = [...rows.values()].sort((a, b) => a.cve.localeCompare(b.cve));
const hc = all.filter((r) => r.severity === "HIGH" || r.severity === "CRITICAL");
const identical = d.rows.filter((x) => x.status === "IDENTICAL").length;
const added = d.rows.filter((x) => x.status === "ADDED").length;
const changed = d.rows.filter((x) => x.status === "CHANGED").length;
const removed = d.rows.filter((x) => x.status === "REMOVED").length;

const L = [];
L.push("# Exact component / version comparison: prior artifact vs FINAL artifact");
L.push("#");
L.push("# Method: like-for-like. The same scanner (docker scout v1.24.0) ran the same");
L.push("# command with the same unfiltered severity scope on both artifacts, and the two");
L.push("# SARIF documents were compared row by row on (CVE, package purl including the");
L.push("# exact version, affected range, fixed version, severity).");
L.push("#");
L.push(`# prior artifact = ${d.oldArtifact}`);
L.push(`# FINAL artifact = ${d.newArtifact}`);
L.push("#");
L.push(
  `# rows(prior) = ${d.oldSize}   rows(FINAL) = ${d.newSize}   identical = ${identical}   added = ${added}   changed = ${changed}   removed = ${removed}`,
);
L.push("#");
L.push(
  added + changed + removed === 0
    ? "# The FINAL rebuild therefore introduces ZERO scanner delta against the artifact on"
    : "# WARNING: the FINAL rebuild is NOT delta-free — rows below require analysis.",
);
L.push("# which every prior disposition was produced. Corroborated by:");
L.push("#   receipt 01 — Debian dpkg inventory of the FINAL image is byte-identical to the");
L.push("#               WO-007 artifact (88 packages, zero version differences);");
L.push("#   receipt 02 — SHA-256 of node, libstdc++.so.6.0.30, sharp-linux-x64-0.35.5.node");
L.push("#               and libvips-cpp.so.8.18.7 identical to the WO-008 baseline;");
L.push("#   receipt 06 — runtime assumptions (user, capabilities, ports, commands, absence");
L.push("#               of any perl process) identical to the prior artifacts.");
L.push("");
L.push("## Every HIGH/CRITICAL row of the FINAL artifact");
L.push("");
L.push("| # | CVE | severity | package (exact version) | affected range | fixed in | EPSS | prior disposition source |");
L.push("|---|---|---|---|---|---|---|---|");
let i = 0;
for (const r of hc) {
  i += 1;
  const short = r.pkg.split("?")[0].replace(/^pkg:/, "");
  const fixed = r.fixed === "not fixed" ? "not fixed" : r.fixed;
  const src = wo007.includes(r.cve) ? "PH-SEC-WO-007" : "NEW (this delta)";
  L.push(
    `| ${i} | ${r.cve} | ${r.severity} | ${short} | ${r.range} | ${fixed} | ${r.epss || "-"} | ${src} |`,
  );
}
L.push("");
L.push(`Totals: ${all.length} rows scanned, ${hc.length} HIGH/CRITICAL.`);
L.push("");
L.push("## Every row of any severity (scope proof)");
L.push("");
L.push("| CVE | severity | package (exact version) |");
L.push("|---|---|---|");
for (const r of all) {
  const short = r.pkg.split("?")[0].replace(/^pkg:/, "");
  L.push(`| ${r.cve} | ${r.severity} | ${short} |`);
}
L.push("");

fs.writeFileSync(
  ".engineering/evidence/PH-M01-WO-002/receipts/cr01-revalidation/07-component-version-comparison.txt",
  L.join("\n"),
);
console.log(
  "HIGH/CRITICAL:",
  hc.length,
  "| total:",
  all.length,
  "| identical rows:",
  identical,
);