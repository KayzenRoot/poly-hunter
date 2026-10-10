import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const packDir = realpathSync(dirname(fileURLToPath(import.meta.url)));
const repoRoot = realpathSync(resolve(packDir, "../../.."));
const packRelative = ".engineering/proposals/PH-GOV-WAVE-A-G1-G2";
const manifestRelative = `${packRelative}/SHA256SUMS.json`;
const manifestPath = resolve(repoRoot, ...manifestRelative.split("/"));
const baseSha = "85489b2d5f7745e9e4dd81495cda41dcaba1090e";
const requiredModules = [
  "PH-M03",
  "PH-M04",
  "PH-M05",
  "PH-M07",
  "PH-M08",
  "PH-M09",
  "PH-M11",
];
const candidateArtifactLabels = [
  "workOrder",
  "acceptance",
  "evidenceTemplate",
  "contractFreeze",
  "ownershipMatrix",
  "executionPlan",
];
const requiredFrozenSourcePaths = [
  ".engineering/API-CONTRACTS.md",
  ".engineering/ARCHITECTURE.md",
  ".engineering/BACKLOG.md",
  ".engineering/CHECKPOINT.json",
  ".engineering/CHECKPOINT.md",
  ".engineering/DATA-MODEL.md",
  ".engineering/DECISIONS-LEDGER.md",
  ".engineering/DEFINITION-OF-DONE.md",
  ".engineering/INTEGRATION-CONTRACTS.md",
  ".engineering/REQUIREMENTS.md",
  ".engineering/REVIEW-PROGRESS-REPORTING.md",
  ".engineering/SCOPE.md",
  ".engineering/SECURITY.md",
  ".engineering/SOURCE-HIERARCHY.md",
  ".engineering/TEST-BENCHMARK-PLAN.md",
  ".engineering/TRACEABILITY.md",
  ".engineering/decisions/ADR-0007-VEX-DISPOSITION-GATE.md",
  ".engineering/decisions/ADR-0008-PARALLEL-IMPLEMENTATION-WAVES.md",
  ".engineering/evidence/PH-M02-WO-001/CR-07-VEX.json",
  ".engineering/evidence/PH-M02-WO-001/PH-M02-WO-001-INDEPENDENT-AUDIT-MATRIX.json",
  ".engineering/evidence/PH-M02-WO-001/cr07-independent-per-occurrence-audit-20261009.json",
  ".engineering/evidence/PH-M02-WO-001/cr07-kev-epss-reconciliation.json",
  ".engineering/evidence/PH-M02-WO-001/cr07-vex-integrity-current-20261010.json",
  ".engineering/evidence/PH-M02-WO-001/dev-alpine-final-scan-receipt.json",
  ".engineering/evidence/PH-M02-WO-001/owner-approval-postgres-vex-20261010.json",
  ".engineering/modules/PH-M02-POLYMARKET-INTEGRATION.md",
  ".engineering/plans/PH-PARALLEL-WAVES-001.md",
  ".engineering/policies/JEV-PROMPT-POLICY.md",
  `${packRelative}/EXECUTION-PLAN.md`,
  `${packRelative}/G1-CONTRACT-FREEZE.md`,
  `${packRelative}/OWNERSHIP-MATRIX.md`,
  `${packRelative}/README.md`,
  `${packRelative}/receipts/cisa-kev-2026.10.08.json`,
  `${packRelative}/receipts/first-epss-2026-10-09.json`,
  `${packRelative}/receipts/jev-decisions-20261010.md`,
  `${packRelative}/receipts/vex-source-freshness-20261010.json`,
  "AGENTS.md",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
  "apps/worker/package.json",
  "apps/worker/src/index.ts",
  "apps/worker/tsconfig.json",
  "package-lock.json",
  "package.json",
  "packages/contracts/package.json",
  "packages/contracts/src/index.ts",
  "packages/contracts/src/polymarket.ts",
  "packages/contracts/src/wave-a.ts",
  "packages/contracts/tsconfig.json",
  "packages/domain/package.json",
  "packages/domain/src/index.ts",
  "packages/domain/tsconfig.json",
  "packages/testkit/package.json",
  "packages/testkit/src/index.ts",
  "packages/testkit/tsconfig.json",
  "tests/wave-a-contracts.test.ts",
  "tsconfig.base.json",
  "vitest.config.ts",
];
const requiredRuntimePaths = [
  "package.json",
  "package-lock.json",
  "vitest.config.ts",
  "packages/contracts/package.json",
  "packages/contracts/tsconfig.json",
  "packages/domain/package.json",
  "packages/domain/tsconfig.json",
  "packages/testkit/package.json",
  "packages/testkit/tsconfig.json",
  "apps/worker/package.json",
  "apps/worker/tsconfig.json",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
];
const failures = [];
const hashCache = new Map();

function fail(message) {
  failures.push(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeRepoRelativePath(path) {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.includes("\\") ||
    path.includes("\0") ||
    isAbsolute(path)
  ) {
    return false;
  }
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function resolveRepoFile(path, label) {
  if (!isSafeRepoRelativePath(path)) {
    fail(`${label} has an unsafe repository-relative path`);
    return null;
  }

  const absolutePath = resolve(repoRoot, ...path.split("/"));
  const relativePath = relative(repoRoot, absolutePath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    fail(`${label} escapes the repository root`);
    return null;
  }

  let currentPath = repoRoot;
  const segments = path.split("/");
  for (let index = 0; index < segments.length; index += 1) {
    currentPath = resolve(currentPath, segments[index]);
    let entry;
    try {
      entry = lstatSync(currentPath);
    } catch {
      fail(`${label} is missing: ${path}`);
      return null;
    }
    if (entry.isSymbolicLink()) {
      fail(`${label} traverses a symbolic link: ${path}`);
      return null;
    }
    if (index < segments.length - 1 && !entry.isDirectory()) {
      fail(`${label} has a non-directory path component: ${path}`);
      return null;
    }
    if (index === segments.length - 1 && !entry.isFile()) {
      fail(`${label} is not a regular file: ${path}`);
      return null;
    }
  }
  return absolutePath;
}

function readRepoFile(path, label) {
  const absolutePath = resolveRepoFile(path, label);
  if (!absolutePath) return null;
  try {
    return readFileSync(absolutePath);
  } catch (error) {
    fail(`${label} cannot be read: ${error.message}`);
    return null;
  }
}

function parseJson(source, label) {
  try {
    assertUniqueJsonKeys(source);
    return JSON.parse(source);
  } catch (error) {
    fail(`${label} is malformed JSON: ${error.message}`);
    return null;
  }
}

function assertUniqueJsonKeys(source) {
  let index = 0;

  function skipWhitespace() {
    while (/\s/.test(source[index] ?? "")) index += 1;
  }

  function parseString() {
    const start = index;
    if (source[index] !== '"') throw new Error("expected a JSON string");
    index += 1;
    while (index < source.length) {
      const character = source[index];
      if (character === "\\") {
        index += 2;
        continue;
      }
      index += 1;
      if (character === '"') {
        return JSON.parse(source.slice(start, index));
      }
    }
    throw new Error("unterminated JSON string");
  }

  function parseValue() {
    skipWhitespace();
    const character = source[index];
    if (character === '"') {
      parseString();
      return;
    }
    if (character === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (source[index] === "}") {
        index += 1;
        return;
      }
      while (index < source.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) throw new Error(`duplicate object key: ${key}`);
        keys.add(key);
        skipWhitespace();
        if (source[index] !== ":") throw new Error("expected ':' after object key");
        index += 1;
        parseValue();
        skipWhitespace();
        if (source[index] === "}") {
          index += 1;
          return;
        }
        if (source[index] !== ",") throw new Error("expected ',' or '}' in object");
        index += 1;
      }
      throw new Error("unterminated JSON object");
    }
    if (character === "[") {
      index += 1;
      skipWhitespace();
      if (source[index] === "]") {
        index += 1;
        return;
      }
      while (index < source.length) {
        parseValue();
        skipWhitespace();
        if (source[index] === "]") {
          index += 1;
          return;
        }
        if (source[index] !== ",") throw new Error("expected ',' or ']' in array");
        index += 1;
      }
      throw new Error("unterminated JSON array");
    }

    const start = index;
    while (index < source.length && !/[\s,\]}]/.test(source[index])) index += 1;
    if (start === index) throw new Error("expected a JSON value");
    JSON.parse(source.slice(start, index));
  }

  parseValue();
  skipWhitespace();
  if (index !== source.length) throw new Error("unexpected trailing JSON data");
}

function exactKeys(value, expectedKeys, label) {
  if (!isRecord(value)) {
    fail(`${label} must be a JSON object`);
    return false;
  }
  const expected = [...expectedKeys].sort();
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      `${label} keys differ; expected [${expected.join(", ")}], found [${actual.join(", ")}]`,
    );
    return false;
  }
  return true;
}

function exactCanonicalPath(value, expected, label) {
  if (!isSafeRepoRelativePath(value) || value !== expected) {
    fail(`${label} path is not canonical; expected ${expected}`);
    return false;
  }
  return true;
}

function expectedCandidateArtifactPaths(stem) {
  return {
    workOrder: `${packRelative}/work-orders/${stem}.md`,
    acceptance: `${packRelative}/acceptance/${stem}-ACCEPTANCE.md`,
    evidenceTemplate: `${packRelative}/evidence-templates/${stem}-EVIDENCE-TEMPLATE.md`,
    contractFreeze: `${packRelative}/G1-CONTRACT-FREEZE.md`,
    ownershipMatrix: `${packRelative}/OWNERSHIP-MATRIX.md`,
    executionPlan: `${packRelative}/EXECUTION-PLAN.md`,
  };
}

function checkFingerprint(path, gitSha, sha256, label) {
  if (typeof gitSha !== "string" || !/^[a-f0-9]{40}$/.test(gitSha)) {
    fail(`${label} Git blob SHA is malformed`);
  }
  if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) {
    fail(`${label} SHA-256 is malformed`);
  }

  if (!hashCache.has(path)) {
    const content = readRepoFile(path, label);
    if (content === null) return;
    hashCache.set(path, {
      gitSha: execFileSync("git", ["hash-object", path], {
        cwd: repoRoot,
        encoding: "utf8",
      }).trim(),
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  const actual = hashCache.get(path);
  if (actual.gitSha !== gitSha) fail(`${label} Git blob mismatch: ${path}`);
  if (actual.sha256 !== sha256) fail(`${label} SHA-256 mismatch: ${path}`);
}

function checkFingerprintObject(value, expectedPath, label) {
  if (!exactKeys(value, ["path", "sha", "sha256"], label)) return false;
  if (!exactCanonicalPath(value.path, expectedPath, label)) return false;
  if (typeof value.sha !== "string" || !/^[a-f0-9]{40}$/.test(value.sha)) {
    fail(`${label} Git blob SHA is malformed`);
    return false;
  }
  if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)) {
    fail(`${label} SHA-256 is malformed`);
    return false;
  }
  return true;
}

function checkExactCandidateCounts() {
  const expectedNames = {
    "work-orders": requiredModules.map((module) => `${module}-WO-001.md`).sort(),
    "context-locks": requiredModules.map((module) => `${module}-WO-001.json`).sort(),
    acceptance: requiredModules
      .map((module) => `${module}-WO-001-ACCEPTANCE.md`)
      .sort(),
    "evidence-templates": requiredModules
      .map((module) => `${module}-WO-001-EVIDENCE-TEMPLATE.md`)
      .sort(),
  };

  for (const [group, expected] of Object.entries(expectedNames)) {
    const groupPath = resolve(packDir, group);
    let actual;
    try {
      actual = readdirSync(groupPath).filter((name) => name.startsWith("PH-M")).sort();
    } catch (error) {
      fail(`${group} cannot be listed: ${error.message}`);
      continue;
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      fail(`${group} files differ from the exact seven-lane candidate set`);
    }
  }
}

function checkCandidateLocks() {
  const lockDir = resolve(packDir, "context-locks");
  let lockNames;
  try {
    lockNames = readdirSync(lockDir).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    fail(`candidate Context Lock directory cannot be listed: ${error.message}`);
    return;
  }
  const expectedLockNames = requiredModules
    .map((module) => `${module}-WO-001.json`)
    .sort();
  if (JSON.stringify(lockNames) !== JSON.stringify(expectedLockNames)) {
    fail(`expected exactly seven candidate Context Locks; found ${lockNames.length}`);
  }

  const exclusiveRoots = [];
  for (const module of requiredModules) {
    const stem = `${module}-WO-001`;
    const lockRelative = `${packRelative}/context-locks/${stem}.json`;
    const lockBytes = readRepoFile(lockRelative, `${stem} Context Lock`);
    if (lockBytes === null) continue;
    const lock = parseJson(lockBytes.toString("utf8"), `${stem} Context Lock`);
    if (!isRecord(lock)) continue;

    const errorsBeforeLock = failures.length;
    const expectedArtifactPaths = expectedCandidateArtifactPaths(stem);
    const workOrderPath = expectedArtifactPaths.workOrder;
    const contractPath = "packages/contracts/src/wave-a.ts";

    if (!isRecord(lock.base) || lock.base.sha !== baseSha || lock.base.requiredMergeBase !== baseSha) {
      fail(`${stem} baseline drift`);
    }
    if (lock.status !== "CANDIDATE_NOT_ADMITTED") fail(`${stem} status is not candidate`);
    if (!isRecord(lock.candidateAdmission) || lock.candidateAdmission.executionAuthorized !== false) {
      fail(`${stem} unexpectedly authorizes execution or has malformed admission metadata`);
    }
    if (!isRecord(lock.executionState) || lock.executionState.liveTradingAuthorized !== false) {
      fail(`${stem} changes LIVE state or has malformed execution metadata`);
    }

    checkFingerprintObject(
      lock.workOrderFingerprint,
      workOrderPath,
      `${stem} workOrderFingerprint`,
    );
    checkFingerprintObject(
      lock.contractFingerprint,
      contractPath,
      `${stem} contractFingerprint`,
    );
    const artifactsValid = exactKeys(
      lock.candidateArtifactFingerprints,
      candidateArtifactLabels,
      `${stem} candidateArtifactFingerprints`,
    );
    if (artifactsValid) {
      for (const label of candidateArtifactLabels) {
        checkFingerprintObject(
          lock.candidateArtifactFingerprints[label],
          expectedArtifactPaths[label],
          `${stem} candidateArtifactFingerprints.${label}`,
        );
      }
    }

    const frozenKeysValid = exactKeys(
      lock.frozenSources,
      requiredFrozenSourcePaths,
      `${stem} frozenSources`,
    );
    const frozenShaKeysValid = exactKeys(
      lock.sha256Fingerprints,
      requiredFrozenSourcePaths,
      `${stem} sha256Fingerprints`,
    );
    if (
      isRecord(lock.frozenSources) &&
      isRecord(lock.sha256Fingerprints) &&
      JSON.stringify(Object.keys(lock.frozenSources).sort()) !==
        JSON.stringify(Object.keys(lock.sha256Fingerprints).sort())
    ) {
      fail(`${stem} frozen-source and companion SHA-256 key sets differ`);
    }

    const runtimeKeysValid = exactKeys(
      lock.runtimeFingerprints,
      requiredRuntimePaths,
      `${stem} runtimeFingerprints`,
    );
    const runtimeShaKeysValid = exactKeys(
      lock.runtimeSha256Fingerprints,
      requiredRuntimePaths,
      `${stem} runtimeSha256Fingerprints`,
    );
    if (
      isRecord(lock.runtimeFingerprints) &&
      isRecord(lock.runtimeSha256Fingerprints) &&
      JSON.stringify(Object.keys(lock.runtimeFingerprints).sort()) !==
        JSON.stringify(Object.keys(lock.runtimeSha256Fingerprints).sort())
    ) {
      fail(`${stem} runtime and companion SHA-256 key sets differ`);
    }

    if (failures.length !== errorsBeforeLock) continue;

    checkFingerprint(
      workOrderPath,
      lock.workOrderFingerprint.sha,
      lock.workOrderFingerprint.sha256,
      `${stem} Work Order`,
    );
    checkFingerprint(
      contractPath,
      lock.contractFingerprint.sha,
      lock.contractFingerprint.sha256,
      `${stem} contract`,
    );
    for (const label of candidateArtifactLabels) {
      const fingerprint = lock.candidateArtifactFingerprints[label];
      checkFingerprint(
        expectedArtifactPaths[label],
        fingerprint.sha,
        fingerprint.sha256,
        `${stem} candidate ${label}`,
      );
    }
    if (frozenKeysValid && frozenShaKeysValid) {
      for (const path of requiredFrozenSourcePaths) {
        checkFingerprint(
          path,
          lock.frozenSources[path],
          lock.sha256Fingerprints[path],
          `${stem} frozen source`,
        );
      }
    }
    if (runtimeKeysValid && runtimeShaKeysValid) {
      for (const path of requiredRuntimePaths) {
        checkFingerprint(
          path,
          lock.runtimeFingerprints[path],
          lock.runtimeSha256Fingerprints[path],
          `${stem} runtime`,
        );
      }
    }

    const vex = isRecord(lock.security) ? lock.security.postgresVex : null;
    if (
      !isRecord(vex) ||
      vex.imageDigest !== "sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744"
    ) {
      fail(`${stem} PostgreSQL VEX digest drift`);
    }
    if (!isRecord(vex) || vex.expiresAtUtc !== "2026-10-15T13:00:00Z" || vex.transferAllowed !== false) {
      fail(`${stem} PostgreSQL VEX expiry/transfer boundary drift`);
    }

    if (!isRecord(lock.laneOwnership)) {
      fail(`${stem} lane ownership metadata is malformed`);
      continue;
    }
    const lanePaths = lock.laneOwnership.exclusiveWritePaths;
    const coordinatorPaths = lock.laneOwnership.coordinatorOnlyPaths;
    if (!Array.isArray(lanePaths) || !lanePaths.every(isSafeRepoRelativePath)) {
      fail(`${stem} exclusive ownership paths are malformed or unsafe`);
    } else {
      for (const path of lanePaths) {
        exclusiveRoots.push({
          module,
          path: path.replace(/\*\*$/, "").replace(/\/$/, ""),
        });
      }
    }
    if (!Array.isArray(coordinatorPaths) || !coordinatorPaths.every(isSafeRepoRelativePath)) {
      fail(`${stem} coordinator ownership paths are malformed or unsafe`);
    }
  }

  for (let leftIndex = 0; leftIndex < exclusiveRoots.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < exclusiveRoots.length; rightIndex += 1) {
      const left = exclusiveRoots[leftIndex];
      const right = exclusiveRoots[rightIndex];
      if (left.module === right.module) continue;
      if (
        left.path === right.path ||
        left.path.startsWith(`${right.path}/`) ||
        right.path.startsWith(`${left.path}/`)
      ) {
        fail(`exclusive ownership overlap: ${left.module}:${left.path} / ${right.module}:${right.path}`);
      }
    }
  }
}

function listPackFiles(directory) {
  const result = [];
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    fail(`candidate pack directory cannot be listed: ${error.message}`);
    return result;
  }
  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      fail(`candidate pack contains a symbolic link: ${relative(packDir, absolutePath)}`);
    } else if (entry.isDirectory()) {
      result.push(...listPackFiles(absolutePath));
    } else if (entry.isFile()) {
      result.push(absolutePath);
    } else {
      fail(`candidate pack contains a non-regular entry: ${relative(packDir, absolutePath)}`);
    }
  }
  return result;
}

function currentManifestEntries() {
  return listPackFiles(packDir)
    .filter((path) => path !== manifestPath)
    .sort()
    .map((absolutePath) => ({
      path: relative(repoRoot, absolutePath).split(sep).join("/"),
      sha256: createHash("sha256").update(readFileSync(absolutePath)).digest("hex"),
    }));
}

function checkManifest(writeManifest) {
  if (writeManifest) {
    writeManifestAfterValidation();
    return;
  }

  const manifestBytes = readRepoFile(manifestRelative, "SHA256SUMS.json");
  if (manifestBytes === null) return;
  const manifest = parseJson(manifestBytes.toString("utf8"), "SHA256SUMS.json");
  if (!isRecord(manifest)) return;
  if (
    !exactKeys(
      manifest,
      ["schemaVersion", "sourceBaseline", "scope", "entries"],
      "SHA256SUMS.json",
    )
  ) {
    return;
  }
  if (manifest.schemaVersion !== "1.0.0") fail("manifest schema version mismatch");
  if (manifest.sourceBaseline !== baseSha) fail("manifest baseline mismatch");
  if (!Array.isArray(manifest.entries)) {
    fail("manifest entries must be an array");
    return;
  }

  const listed = new Map();
  for (const [index, entry] of manifest.entries.entries()) {
    if (!exactKeys(entry, ["path", "sha256"], `manifest.entries[${index}]`)) continue;
    if (
      !isSafeRepoRelativePath(entry.path) ||
      !entry.path.startsWith(`${packRelative}/`) ||
      entry.path === manifestRelative
    ) {
      fail(`manifest.entries[${index}] path is unsafe or outside the candidate pack`);
      continue;
    }
    if (listed.has(entry.path)) fail(`manifest has a duplicate path: ${entry.path}`);
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      fail(`manifest.entries[${index}] SHA-256 is malformed`);
    }
    listed.set(entry.path, entry.sha256);
  }

  const entries = currentManifestEntries();
  const actual = new Map(entries.map((entry) => [entry.path, entry.sha256]));
  if (listed.size !== actual.size) fail("manifest entry count mismatch");
  for (const [path, digest] of actual) {
    if (listed.get(path) !== digest) fail(`manifest mismatch: ${path}`);
  }
}

function writeManifestAfterValidation() {
  const targetRelative = manifestRelative;
  if (!isSafeRepoRelativePath(targetRelative)) {
    fail("manifest target path is unsafe");
    return;
  }
  const destinationRelative = relative(repoRoot, manifestPath);
  if (
    destinationRelative === ".." ||
    destinationRelative.startsWith(`..${sep}`) ||
    isAbsolute(destinationRelative)
  ) {
    fail("manifest target escapes the repository root");
    return;
  }

  try {
    const targetStat = lstatSync(manifestPath);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      fail("manifest target must be a regular, non-symlink file");
      return;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      fail(`manifest target cannot be inspected: ${error.message}`);
      return;
    }
  }

  const entries = currentManifestEntries();
  if (failures.length > 0) return;
  const payload = `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      sourceBaseline: baseSha,
      scope: "All proposal-pack files except this manifest and the external evidence bundle.",
      entries,
    },
    null,
    2,
  )}\n`;
  const temporaryPath = resolve(packDir, `.SHA256SUMS.json.tmp-${randomUUID()}`);

  try {
    writeFileSync(temporaryPath, payload, { flag: "wx" });
    renameSync(temporaryPath, manifestPath);
    console.log(`Wrote ${entries.length} entries to ${manifestRelative}`);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // A failed write/rename leaves the canonical manifest untouched.
    }
    fail(`manifest write failed without replacing the existing manifest: ${error.message}`);
  }
}

function printFailures() {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exitCode = 1;
}

function main() {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    args.some((argument) => argument !== "--write-manifest")
  ) {
    fail("unsupported argument; use only --write-manifest or no arguments");
    printFailures();
    return;
  }

  try {
    checkExactCandidateCounts();
    checkCandidateLocks();
  } catch (error) {
    fail(`candidate validation failed closed: ${error.message}`);
  }
  if (failures.length > 0) {
    printFailures();
    return;
  }

  try {
    checkManifest(args.includes("--write-manifest"));
  } catch (error) {
    fail(`manifest validation failed closed: ${error.message}`);
  }
  if (failures.length > 0) {
    printFailures();
    return;
  }
  if (!args.includes("--write-manifest")) {
    console.log(
      "PASS: seven candidate lanes, exact Context Lock fingerprint sets, ownership, VEX boundary, and manifest.",
    );
  }
}

main();
