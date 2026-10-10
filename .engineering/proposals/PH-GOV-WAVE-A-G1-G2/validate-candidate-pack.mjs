import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packDir, "../../..");
const baseSha = "85489b2d5f7745e9e4dd81495cda41dcaba1090e";
const manifestPath = resolve(packDir, "SHA256SUMS.json");
const requiredModules = [
  "PH-M03",
  "PH-M04",
  "PH-M05",
  "PH-M07",
  "PH-M08",
  "PH-M09",
  "PH-M11",
];
const hashCache = new Map();
const blobCache = new Map();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function bytes(path) {
  return readFileSync(resolve(repoRoot, path));
}

function sha256(path) {
  if (!hashCache.has(path)) {
    hashCache.set(path, createHash("sha256").update(bytes(path)).digest("hex"));
  }
  return hashCache.get(path);
}

function gitBlobSha(path) {
  if (!blobCache.has(path)) {
    blobCache.set(
      path,
      execFileSync("git", ["hash-object", path], {
        cwd: repoRoot,
        encoding: "utf8",
      }).trim(),
    );
  }
  return blobCache.get(path);
}

function listFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

function checkCandidateLocks() {
  const lockDir = resolve(packDir, "context-locks");
  const lockPaths = readdirSync(lockDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const expectedLocks = requiredModules.map((module) => `${module}-WO-001.json`).sort();
  if (JSON.stringify(lockPaths) !== JSON.stringify(expectedLocks)) {
    fail(`expected exactly seven candidate Context Locks; found ${lockPaths.length}`);
  }

  const exclusiveRoots = [];
  for (const module of requiredModules) {
    const stem = `${module}-WO-001`;
    const lockRel = `.engineering/proposals/PH-GOV-WAVE-A-G1-G2/context-locks/${stem}.json`;
    const lock = JSON.parse(bytes(lockRel).toString("utf8"));
    if (lock.base.sha !== baseSha || lock.base.requiredMergeBase !== baseSha) {
      fail(`${stem} baseline drift`);
    }
    if (lock.status !== "CANDIDATE_NOT_ADMITTED") fail(`${stem} status is not candidate`);
    if (lock.candidateAdmission.executionAuthorized !== false) {
      fail(`${stem} unexpectedly authorizes execution`);
    }
    if (lock.executionState.liveTradingAuthorized !== false) {
      fail(`${stem} changes LIVE state`);
    }

    const workOrder = lock.workOrderFingerprint;
    if (sha256(workOrder.path) !== workOrder.sha256) fail(`${stem} Work Order SHA-256 mismatch`);
    if (gitBlobSha(workOrder.path) !== workOrder.sha) fail(`${stem} Work Order Git blob mismatch`);
    if (sha256(lock.contractFingerprint.path) !== lock.contractFingerprint.sha256) {
      fail(`${stem} contract SHA-256 mismatch`);
    }
    if (gitBlobSha(lock.contractFingerprint.path) !== lock.contractFingerprint.sha) {
      fail(`${stem} contract Git blob mismatch`);
    }
    for (const [path, fingerprint] of Object.entries(lock.frozenSources)) {
      if (sha256(path) !== lock.sha256Fingerprints[path]) {
        fail(`${stem} frozen source SHA-256 mismatch: ${path}`);
      }
      if (gitBlobSha(path) !== fingerprint) fail(`${stem} frozen source Git blob mismatch: ${path}`);
    }
    for (const [path, fingerprint] of Object.entries(lock.runtimeFingerprints)) {
      if (gitBlobSha(path) !== fingerprint) fail(`${stem} runtime fingerprint mismatch: ${path}`);
      if (sha256(path) !== lock.runtimeSha256Fingerprints[path]) {
        fail(`${stem} runtime SHA-256 fingerprint mismatch: ${path}`);
      }
    }
    for (const [label, fingerprint] of Object.entries(lock.candidateArtifactFingerprints)) {
      if (sha256(fingerprint.path) !== fingerprint.sha256) {
        fail(`${stem} candidate ${label} SHA-256 mismatch`);
      }
      if (gitBlobSha(fingerprint.path) !== fingerprint.sha) {
        fail(`${stem} candidate ${label} Git blob mismatch`);
      }
    }

    const vex = lock.security.postgresVex;
    if (vex.imageDigest !== "sha256:f9359595fb9e6fe86f20e64d73db8c3753b3e0828f72fe7093476ff49f2d2744") {
      fail(`${stem} PostgreSQL VEX digest drift`);
    }
    if (vex.expiresAtUtc !== "2026-10-15T13:00:00Z" || vex.transferAllowed !== false) {
      fail(`${stem} PostgreSQL VEX expiry/transfer boundary drift`);
    }
    for (const path of lock.laneOwnership.exclusiveWritePaths) {
      exclusiveRoots.push({ module, path: path.replace(/\\/g, "/").replace(/\/\*\*$/, "") });
    }
  }

  for (let i = 0; i < exclusiveRoots.length; i += 1) {
    for (let j = i + 1; j < exclusiveRoots.length; j += 1) {
      const left = exclusiveRoots[i];
      const right = exclusiveRoots[j];
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

function checkExactCandidateCounts() {
  const groups = ["work-orders", "context-locks", "acceptance", "evidence-templates"];
  const expected = requiredModules.length;
  for (const group of groups) {
    const count = readdirSync(resolve(packDir, group)).filter((name) =>
      name.startsWith("PH-M"),
    ).length;
    if (count !== expected) fail(`${group} has ${count} lane files; expected ${expected}`);
  }
}

function checkManifest(writeManifest) {
  const absoluteFiles = listFiles(packDir).filter((path) => path !== manifestPath).sort();
  const entries = absoluteFiles.map((absolute) => ({
    path: relative(repoRoot, absolute).split(sep).join("/"),
    sha256: createHash("sha256").update(readFileSync(absolute)).digest("hex"),
  }));
  if (writeManifest) {
    writeFileSync(
      manifestPath,
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          sourceBaseline: baseSha,
          scope: "All proposal-pack files except this manifest and the external evidence bundle.",
          entries,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Wrote ${entries.length} entries to ${relative(repoRoot, manifestPath)}`);
    return;
  }

  if (!statSync(manifestPath, { throwIfNoEntry: false })) {
    fail("SHA256SUMS.json is missing; run with --write-manifest after the candidate files are final");
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const listed = new Map(manifest.entries.map((entry) => [entry.path, entry.sha256]));
  const actual = new Map(entries.map((entry) => [entry.path, entry.sha256]));
  if (manifest.sourceBaseline !== baseSha) fail("manifest baseline mismatch");
  if (listed.size !== actual.size) fail("manifest entry count mismatch");
  for (const [path, digest] of actual) {
    if (listed.get(path) !== digest) fail(`manifest mismatch: ${path}`);
  }
}

const args = new Set(process.argv.slice(2));
if ([...args].some((arg) => arg !== "--write-manifest")) {
  fail("unsupported argument; use only --write-manifest or no arguments");
}

checkExactCandidateCounts();
checkCandidateLocks();
checkManifest(args.has("--write-manifest"));

if (process.exitCode !== 1) console.log("PASS: seven candidate lanes, ownership, source/contract hashes, VEX boundary, and manifest.");
