import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return sourceFiles(path);
      }

      return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [path] : [];
    }),
  );

  return nested.flat();
}

async function manifestAt(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

describe("workspace boundaries", () => {
  it("keeps contracts free of runtime dependencies", async () => {
    const manifest = await manifestAt(
      resolve(repositoryRoot, "packages/contracts/package.json"),
    );
    const dependencies = (manifest.dependencies ?? {}) as Record<
      string,
      string
    >;

    expect(Object.keys(dependencies)).toEqual([]);
  });

  it("allows domain to depend only on contracts", async () => {
    const manifest = await manifestAt(
      resolve(repositoryRoot, "packages/domain/package.json"),
    );
    const dependencies = (manifest.dependencies ?? {}) as Record<
      string,
      string
    >;

    expect(Object.keys(dependencies)).toEqual(["@polyhunter/contracts"]);
  });

  it("exposes persistence only through a guarded server entry point", async () => {
    const manifest = await manifestAt(
      resolve(repositoryRoot, "packages/db/package.json"),
    );
    const exports = (manifest.exports ?? {}) as Record<string, unknown>;
    const serverEntry = await readFile(
      resolve(repositoryRoot, "packages/db/src/server/index.ts"),
      "utf8",
    );
    const webSources = await sourceFiles(
      resolve(repositoryRoot, "apps/web/app"),
    );

    expect(Object.keys(exports).sort()).toEqual([
      "./server",
      "./server/authorization",
      "./server/identity",
      "./server/vault",
    ]);
    // CR-01: the workspace publishes TypeScript SOURCE, never a build output.
    // Every export condition of every workspace must point at a tracked source
    // file. If any of them ever points back at `dist/`, a clean checkout loses
    // the module and the failure only shows up in CI — or, worse, is masked by a
    // stale `dist` left on a developer's machine.
    for (const [workspace, relative] of [
      ["packages/contracts", "package.json"],
      ["packages/domain", "package.json"],
      ["packages/testkit", "package.json"],
      ["packages/db", "package.json"],
    ] as const) {
      const manifest = await manifestAt(
        resolve(repositoryRoot, workspace, relative),
      );
      for (const [subpath, conditions] of Object.entries(
        (manifest.exports ?? {}) as Record<string, Record<string, string>>,
      )) {
        for (const [condition, target] of Object.entries(conditions)) {
          expect(
            target,
            `${workspace} "${subpath}" (${condition}) must resolve to a tracked source file`,
          ).toMatch(/^\.\/src\/.+\.ts$/);
          expect(
            target,
            `${workspace} "${subpath}" (${condition}) must not depend on a build output`,
          ).not.toContain("dist/");
        }
      }
    }
    expect(serverEntry).toContain('typeof window !== "undefined"');
    // The WO-002 identity data access is a second guarded server entry: it
    // must keep the same browser guard and stay free of provider imports.
    const identityEntry = await readFile(
      resolve(repositoryRoot, "packages/db/src/server/identity.ts"),
      "utf8",
    );
    expect(identityEntry).toContain('typeof window !== "undefined"');
    expect(identityEntry).not.toContain("@supabase");
    // WO-003 adds the secret vault as a third guarded server entry. Every file
    // that participates in it must carry the SAME browser guard: the envelope,
    // the keyring and the authorization predicate all hold key material or the
    // rule that gates it, so none of them may be reachable from a bundle.
    for (const relative of [
      "packages/db/src/server/vault/index.ts",
      "packages/db/src/server/vault/envelope.ts",
      "packages/db/src/server/vault/keyring.ts",
      "packages/db/src/server/authorization.ts",
    ]) {
      const source = await readFile(resolve(repositoryRoot, relative), "utf8");
      expect(source).toContain('typeof window !== "undefined"');
    }
    for (const path of webSources) {
      const source = await readFile(path, "utf8");
      expect(source).not.toContain("@polyhunter/db");
    }
  });

  it("keeps vault key material and the vault itself out of client-reachable web code", async () => {
    const clientSources = [
      ...(await sourceFiles(resolve(repositoryRoot, "apps/web/src"))),
      ...(await sourceFiles(resolve(repositoryRoot, "apps/web/app"))),
      ...(await sourceFiles(resolve(repositoryRoot, "apps/worker/src"))),
    ];
    const manifest = await manifestAt(resolve(repositoryRoot, "package.json"));
    const workspaces = (manifest.workspaces ?? []) as string[];

    expect(workspaces).toContain("apps/web");

    for (const path of clientSources) {
      const source = await readFile(path, "utf8");
      // No client-reachable file may read the keyring environment directly;
      // only the guarded server vault may, and it does so via its own entry.
      expect(source).not.toContain("POLYHUNTER_SECRET_KEYRING_JSON");
      expect(source).not.toContain("POLYHUNTER_SECRET_ACTIVE_KEY_VERSION");
      // And there is no plaintext accessor anywhere in the product code.
      expect(source).not.toMatch(/getPlaintextSecret/);
    }
  });

  it("keeps web, worker and provider imports out of domain", async () => {
    const paths = await sourceFiles(
      resolve(repositoryRoot, "packages/domain/src"),
    );

    expect(paths.length).toBeGreaterThan(0);

    for (const path of paths) {
      const source = await readFile(path, "utf8");
      const importPattern =
        /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];

        expect(specifier).toBeDefined();
        expect(specifier).not.toMatch(
          /^@polyhunter\/(?:web|worker|polymarket|provider)(?:\/|$)/,
        );
        expect(specifier).not.toMatch(/(?:^|\/)apps\/(?:web|worker)(?:\/|$)/);
        expect(specifier?.toLowerCase()).not.toContain("provider");
      }
    }
  });
});

/**
 * Audit CR-06 — close the vault side door.
 *
 * The product must not hand out a generic decrypt function or a bare keyring.
 * A consumer holding either could open any ciphertext without tenant
 * authorization, without a purpose scope and without the `withDecryptedSecret`
 * lifecycle that zeroes the buffer. These tests FAIL if the raw primitives ever
 * become publicly reachable again, whether by a new package subpath export or
 * by re-exporting them from the vault entry.
 */
describe("vault public surface", () => {
  const forbiddenRuntimeExports = [
    "openSecret",
    "sealSecret",
    "randomNonceSource",
    "secretEnvelopeAad",
    "assertProtocolNonce",
    "assertSecretPlaintextBytes",
    "parseVaultKeyring",
    "readVaultKeyringFromEnvironment",
    "isVaultKeyringConfigured",
    "keyringEnvironmentVariables",
  ];

  it("exposes no envelope or keyring subpath from the db package", async () => {
    const manifest = await manifestAt(
      resolve(repositoryRoot, "packages/db/package.json"),
    );
    const subpaths = Object.keys(
      (manifest.exports ?? {}) as Record<string, unknown>,
    );

    for (const subpath of subpaths) {
      expect(subpath).not.toMatch(/envelope/i);
      expect(subpath).not.toMatch(/keyring/i);
      expect(subpath).toMatch(/^\.\/server(?:[a-z/-]*)$/);
    }
    // The vault subpath itself must never point below `vault/index.ts`; an
    // export target of `.../envelope.ts` or `.../keyring.ts` would re-open the
    // door under the same, innocuous-looking subpath name.
    const vault = (
      (manifest.exports ?? {}) as Record<string, Record<string, string>>
    )["./server/vault"];
    for (const target of Object.values(vault ?? {})) {
      expect(target).toBe("./src/server/vault/index.ts");
    }
  });

  // The import below pulls in the real vault entry, so it loads pg, drizzle and
  // the domain package. Under the full suite that is seconds of module work and
  // the default 5s budget is not enough — a timeout here would read as "the
  // export surface is wrong" when it is not. The explicit budget is for the
  // import cost, and the assertions themselves are instant.
  it("exports no raw decrypt or keyring resolver from the vault entry", async () => {
    const entry = await import("../packages/db/src/server/vault/index.ts");
    const runtimeExports = Object.keys(entry).sort();

    for (const forbidden of forbiddenRuntimeExports) {
      expect(runtimeExports).not.toContain(forbidden);
    }
    // A type-only export compiles away; if one of these ever became a value
    // the runtime list above would change. Pin the whole surface instead.
    expect(runtimeExports).toEqual(
      [
        "ACTIVE_KEY_VERSION_ENV",
        "KEYRING_JSON_ENV",
        "createSecretVault",
      ].sort(),
    );
  }, 30_000);

  it("gives the product exactly one plaintext path, and it is scoped", async () => {
    const productSources = [
      ...(await sourceFiles(resolve(repositoryRoot, "apps/web/app"))),
      ...(await sourceFiles(resolve(repositoryRoot, "apps/web/src"))),
      ...(await sourceFiles(resolve(repositoryRoot, "apps/worker/src"))),
    ];

    // Any production file that mentions the decrypt surface must be inside the
    // vault itself; nothing else may even name it.
    for (const path of productSources) {
      const source = await readFile(path, "utf8");
      expect(source, path).not.toMatch(
        /\b(?:openSecret|sealSecret|readVaultKeyringFromEnvironment|parseVaultKeyring)\b/,
      );
    }
    // And the one admitted consumer path keeps its tenant + purpose + lifecycle
    // contract.
    const index = await readFile(
      resolve(repositoryRoot, "packages/db/src/server/vault/index.ts"),
      "utf8",
    );
    expect(index).toContain("withDecryptedSecret");
    // Comment lines are stripped first: the vault's own documentation names
    // `getPlaintextSecret()` precisely to say it does not exist, and matching
    // prose would make this assertion pass for the wrong reason or fail for a
    // doc edit. What must not exist is the DECLARATION.
    const code = index
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("*"))
      .join("\n");
    expect(code).not.toMatch(/getPlaintextSecret/);
    expect(code).not.toMatch(/\bfunction\s+getPlaintext/i);
  });
});
