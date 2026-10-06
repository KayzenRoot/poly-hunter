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
      "./server/identity",
      "./server/vault",
    ]);
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
