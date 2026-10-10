import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidatePackRelative = ".engineering/proposals/PH-GOV-WAVE-A-G1-G2";
const sourcePack = join(repositoryRoot, candidatePackRelative);
const validatorRelative = `${candidatePackRelative}/validate-candidate-pack.mjs`;
const manifestRelative = `${candidatePackRelative}/SHA256SUMS.json`;

type ContextLock = {
  candidateArtifactFingerprints: Partial<Record<string, { path: string }>>;
  contractFingerprint: { path: string };
  frozenSources: Record<string, string>;
  laneOwnership: {
    coordinatorOnlyPaths: string[];
    exclusiveWritePaths: string[];
  };
  runtimeFingerprints: Record<string, string>;
  runtimeSha256Fingerprints: Record<string, string>;
  sha256Fingerprints: Record<string, string>;
  security: {
    postgresVex: {
      expiresAtUtc: string;
      imageDigest: string;
      transferAllowed: boolean;
    };
  };
  workOrderFingerprint: { path: string };
};

function makeIsolatedFixture(): {
  root: string;
  lockPaths: string[];
  manifestPath: string;
  validatorPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), "polyhunter-wave-a-lock-"));
  const packDestination = join(root, candidatePackRelative);
  for (const group of [
    "context-locks",
    "work-orders",
    "acceptance",
    "evidence-templates",
  ]) {
    mkdirSync(join(packDestination, group), { recursive: true });
  }

  for (const sourcePath of [
    ".engineering/SCOPE.md",
    "apps/web/tsconfig.json",
  ]) {
    const destination = join(root, sourcePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(repositoryRoot, sourcePath), destination);
  }
  const gitInit = spawnSync("git", ["init", "--quiet"], {
    cwd: root,
    encoding: "utf8",
  });
  if (gitInit.error) throw gitInit.error;
  if (gitInit.status !== 0) {
    throw new Error(
      `could not initialize isolated fixture repository: ${gitInit.stderr}`,
    );
  }

  const sourceLockDir = join(sourcePack, "context-locks");
  const lockNames = readdirSync(sourceLockDir).filter((name) =>
    name.endsWith(".json"),
  );
  for (const lockName of lockNames) {
    copyFileSync(
      join(sourceLockDir, lockName),
      join(packDestination, "context-locks", lockName),
    );
  }
  for (const module of [
    "PH-M03",
    "PH-M04",
    "PH-M05",
    "PH-M07",
    "PH-M08",
    "PH-M09",
    "PH-M11",
  ]) {
    const stem = `${module}-WO-001`;
    writeFileSync(
      join(packDestination, "work-orders", `${stem}.md`),
      "fixture\n",
    );
    writeFileSync(
      join(packDestination, "acceptance", `${stem}-ACCEPTANCE.md`),
      "fixture\n",
    );
    writeFileSync(
      join(
        packDestination,
        "evidence-templates",
        `${stem}-EVIDENCE-TEMPLATE.md`,
      ),
      "fixture\n",
    );
  }
  copyFileSync(
    join(sourcePack, "validate-candidate-pack.mjs"),
    join(packDestination, "validate-candidate-pack.mjs"),
  );
  const manifestPath = join(packDestination, "SHA256SUMS.json");
  writeFileSync(manifestPath, "manifest sentinel: unchanged on failure\n");

  return {
    root,
    lockPaths: lockNames.map((name) =>
      join(packDestination, "context-locks", name),
    ),
    manifestPath,
    validatorPath: join(root, validatorRelative),
  };
}

function runValidator(validatorPath: string, writeManifest: boolean) {
  const result = spawnSync(
    process.execPath,
    [validatorPath, ...(writeManifest ? ["--write-manifest"] : [])],
    { encoding: "utf8" },
  );
  if (result.error) throw result.error;
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

function ownershipPathCase(
  name: string,
  owner: keyof ContextLock["laneOwnership"],
  path: string,
) {
  const isExclusive = owner === "exclusiveWritePaths";
  return {
    name,
    expectedError: isExclusive
      ? "exclusive ownership paths are malformed or unsafe"
      : "coordinator ownership paths are malformed or unsafe",
    mutate: (lock: ContextLock) => {
      lock.laneOwnership[owner] = [path];
    },
  };
}

describe("Wave A Context Lock validator", () => {
  it("rejects malformed or incomplete locks in both modes without rewriting the manifest", () => {
    const fixture = makeIsolatedFixture();
    const originalRepositoryManifest = readFileSync(
      join(repositoryRoot, manifestRelative),
    );
    const originalLocks = new Map(
      fixture.lockPaths.map((lockPath) => [
        lockPath,
        readFileSync(lockPath, "utf8"),
      ]),
    );
    const cases: Array<{
      name: string;
      expectedError: string;
      mutate: (lock: ContextLock) => void;
      mutateJson?: (source: string) => string;
    }> = [
      {
        name: "missing candidate artifact label",
        expectedError: "candidateArtifactFingerprints keys differ",
        mutate: (lock) => {
          delete lock.candidateArtifactFingerprints.acceptance;
        },
      },
      {
        name: "unexpected candidate artifact label",
        expectedError: "candidateArtifactFingerprints keys differ",
        mutate: (lock) => {
          lock.candidateArtifactFingerprints.unexpected = {
            path: "../outside",
          };
        },
      },
      {
        name: "candidate path substitution and traversal",
        expectedError:
          "candidateArtifactFingerprints.acceptance path is not canonical",
        mutate: (lock) => {
          const acceptance = lock.candidateArtifactFingerprints.acceptance;
          if (acceptance) acceptance.path = "../../outside/acceptance.md";
        },
      },
      {
        name: "missing frozen source and companion hash",
        expectedError: "frozenSources keys differ",
        mutate: (lock) => {
          delete lock.frozenSources[".engineering/SCOPE.md"];
          delete lock.sha256Fingerprints[".engineering/SCOPE.md"];
        },
      },
      {
        name: "unexpected frozen source path",
        expectedError: "frozenSources keys differ",
        mutate: (lock) => {
          lock.frozenSources["../../outside.md"] = "0".repeat(40);
          lock.sha256Fingerprints["../../outside.md"] = "0".repeat(64);
        },
      },
      {
        name: "missing runtime fingerprint pair",
        expectedError: "runtimeFingerprints keys differ",
        mutate: (lock) => {
          delete lock.runtimeFingerprints["apps/worker/tsconfig.json"];
          delete lock.runtimeSha256Fingerprints["apps/worker/tsconfig.json"];
        },
      },
      {
        name: "unexpected runtime path",
        expectedError: "runtimeFingerprints keys differ",
        mutate: (lock) => {
          lock.runtimeFingerprints["../outside.json"] = "0".repeat(40);
          lock.runtimeSha256Fingerprints["../outside.json"] = "0".repeat(64);
        },
      },
      {
        name: "incomplete companion SHA-256 key set",
        expectedError: "sha256Fingerprints keys differ",
        mutate: (lock) => {
          delete lock.sha256Fingerprints[".engineering/SCOPE.md"];
        },
      },
      {
        name: "altered frozen-source SHA-256 value",
        expectedError: "frozen source SHA-256 mismatch: .engineering/SCOPE.md",
        mutate: (lock) => {
          lock.sha256Fingerprints[".engineering/SCOPE.md"] = "0".repeat(64);
        },
      },
      {
        name: "runtime companion SHA-256 key set mismatch",
        expectedError: "runtimeSha256Fingerprints keys differ",
        mutate: (lock) => {
          delete lock.runtimeSha256Fingerprints["apps/web/tsconfig.json"];
        },
      },
      {
        name: "altered runtime SHA-256 value",
        expectedError: "runtime SHA-256 mismatch: apps/web/tsconfig.json",
        mutate: (lock) => {
          lock.runtimeSha256Fingerprints["apps/web/tsconfig.json"] = "f".repeat(
            64,
          );
        },
      },
      ownershipPathCase(
        "whole-repository ownership glob",
        "exclusiveWritePaths",
        "**",
      ),
      ownershipPathCase(
        "embedded ownership glob",
        "exclusiveWritePaths",
        "packages/*/src/**",
      ),
      ownershipPathCase(
        "ownership extglob alternative",
        "exclusiveWritePaths",
        "packages/@(domain)/src/**",
      ),
      ownershipPathCase(
        "ownership extglob repetition",
        "exclusiveWritePaths",
        "packages/+(domain)/src/**",
      ),
      ownershipPathCase(
        "ownership extglob negation",
        "exclusiveWritePaths",
        "packages/!(domain)/src/**",
      ),
      ownershipPathCase(
        "ownership Git pathspec long magic",
        "exclusiveWritePaths",
        ":(literal)packages/contracts",
      ),
      ownershipPathCase(
        "ownership Git pathspec short magic",
        "exclusiveWritePaths",
        ":!packages/contracts",
      ),
      ownershipPathCase(
        "coordinator Git pathspec long magic",
        "coordinatorOnlyPaths",
        ":(literal)packages/contracts",
      ),
      ownershipPathCase(
        "coordinator Git pathspec short magic",
        "coordinatorOnlyPaths",
        ":!packages/contracts",
      ),
      {
        name: "expired PostgreSQL VEX proposal",
        expectedError: "PostgreSQL VEX proposal is expired",
        mutate: (lock) => {
          lock.security.postgresVex.expiresAtUtc = "2000-01-01T00:00:00Z";
        },
      },
      {
        name: "malformed JSON",
        expectedError: "Context Lock is malformed JSON",
        mutate: () => undefined,
        mutateJson: () => "{ malformed Context Lock",
      },
      {
        name: "duplicate JSON object key",
        expectedError: "duplicate object key: candidateArtifactFingerprints",
        mutate: () => undefined,
        mutateJson: (source) =>
          source.replace(
            '  "candidateArtifactFingerprints": {',
            '  "candidateArtifactFingerprints": {},\n  "candidateArtifactFingerprints": {',
          ),
      },
    ];

    try {
      const canonicalLockResult = runValidator(
        join(repositoryRoot, validatorRelative),
        false,
      );
      expect(
        canonicalLockResult.status,
        `canonical coordinator globs: ${canonicalLockResult.output}`,
      ).toBe(0);

      for (const testCase of cases) {
        const originalManifest = readFileSync(fixture.manifestPath);
        for (const [lockPath, originalLockText] of originalLocks) {
          if (testCase.mutateJson) {
            writeFileSync(lockPath, testCase.mutateJson(originalLockText));
          } else {
            const lock = JSON.parse(originalLockText) as ContextLock;
            testCase.mutate(lock);
            writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
          }
        }

        for (const writeManifest of [false, true]) {
          const result = runValidator(fixture.validatorPath, writeManifest);
          expect(
            result.status,
            `${testCase.name} (write=${writeManifest})`,
          ).not.toBe(0);
          expect(result.output).toContain("FAIL:");
          expect(result.output).toContain(testCase.expectedError);
          expect(readFileSync(fixture.manifestPath)).toEqual(originalManifest);
        }

        for (const [lockPath, originalLockText] of originalLocks) {
          writeFileSync(lockPath, originalLockText);
        }
      }

      expect(readFileSync(join(repositoryRoot, manifestRelative))).toEqual(
        originalRepositoryManifest,
      );
    } finally {
      const tempRoot = resolve(fixture.root);
      const tempRootDirectory = resolve(tmpdir());
      expect(
        tempRoot === tempRootDirectory ||
          tempRoot.startsWith(`${tempRootDirectory}${sep}`),
      ).toBe(true);
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }, 300_000);
});
