import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [baselinePath, finalPath, goMapPath] = process.argv.slice(2);
if (!baselinePath || !finalPath || !goMapPath) {
  throw new Error("usage: node summarize-scout-sarif.mjs <baseline.sarif> <final.sarif> <wo004-go-map.json>");
}

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function findings(path) {
  const sarif = readJson(path);
  const run = sarif.runs[0];
  const rules = new Map(run.tool.driver.rules.map((rule) => [rule.id, rule]));
  return run.results.map((result) => {
    const rule = rules.get(result.ruleId);
    const tags = rule?.properties?.tags ?? [];
    const severity = tags.includes("CRITICAL") ? "CRITICAL" : tags.includes("HIGH") ? "HIGH" : null;
    const purl = rule?.properties?.purls?.[0] ?? "";
    const locations = (result.locations ?? []).map((location) =>
      location.physicalLocation?.artifactLocation?.uri ?? "",
    );
    const tuple = `${result.ruleId}|${severity ?? ""}|${purl}|${locations.sort().join(",")}`;
    return { id: result.ruleId, severity, purl, locations, tuple };
  });
}

const before = findings(baselinePath);
const after = findings(finalPath);
const originalGoCves = new Set(readJson(goMapPath).perCve.map((entry) => entry.cve));
const hc = (items) => items.filter((item) => item.severity !== null);
const hcBefore = hc(before);
const hcAfter = hc(after);
const beforeTuples = new Set(hcBefore.map((item) => item.tuple));
const afterTuples = new Set(hcAfter.map((item) => item.tuple));
const goAfter = hcAfter.filter((item) => originalGoCves.has(item.id));
const countSeverity = (items, severity) => items.filter((item) => item.severity === severity).length;

console.log(JSON.stringify({
  baseline: {
    sha256: sha256(baselinePath),
    totalResults: before.length,
    highOccurrences: countSeverity(hcBefore, "HIGH"),
    criticalOccurrences: countSeverity(hcBefore, "CRITICAL"),
    highCriticalUniqueCves: new Set(hcBefore.map((item) => item.id)).size,
  },
  final: {
    sha256: sha256(finalPath),
    totalResults: after.length,
    highOccurrences: countSeverity(hcAfter, "HIGH"),
    criticalOccurrences: countSeverity(hcAfter, "CRITICAL"),
    highCriticalUniqueCves: new Set(hcAfter.map((item) => item.id)).size,
    originalGoUniqueCves: originalGoCves.size,
    originalGoHighCriticalOccurrences: goAfter.length,
    originalGoHighCriticalUniqueCves: new Set(goAfter.map((item) => item.id)).size,
    newHighCriticalTuplesComparedToBaseline: [...afterTuples].filter((tuple) => !beforeTuples.has(tuple)).length,
  },
}, null, 2));
