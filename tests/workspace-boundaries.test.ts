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

    expect(Object.keys(exports)).toEqual(["./server"]);
    expect(serverEntry).toContain('typeof window !== "undefined"');
    for (const path of webSources) {
      const source = await readFile(path, "utf8");
      expect(source).not.toContain("@polyhunter/db");
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
