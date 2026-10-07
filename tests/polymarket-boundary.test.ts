import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as publicSurface from "../packages/polymarket/src/index.ts";

/**
 * PH-M02-WO-001 package boundary + security containment.
 *
 * - ONLY `packages/polymarket` may import `@polymarket/*`;
 * - the public surface exports provider-neutral types/ports only — no SDK
 *   class, no signing surface, no order mutation;
 * - no trading-credential environment variable exists anywhere;
 * - `liveTradingAuthorized` is untouched by this package.
 */

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const packageRoot = join(repositoryRoot, "packages", "polymarket");

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (
      entry === "node_modules" ||
      entry === ".git" ||
      entry === "dist" ||
      entry === ".next"
    ) {
      continue;
    }
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walk(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

describe("polymarket package boundary", () => {
  it("confines every official-sdk import to packages/polymarket", () => {
    const offenders: string[] = [];
    // Match real import statements, not prose; the package name is split here
    // so this file does not match its own scan.
    const sdkImport = new RegExp(
      "(?:from|import)\\s*[\"']" + "@polymarket" + "/",
    );
    for (const top of ["apps", "packages", "tests"]) {
      for (const path of walk(join(repositoryRoot, top))) {
        if (!/\.(ts|tsx|mts|mjs)$/.test(path)) continue;
        if (path.replaceAll("\\", "/").includes("packages/polymarket/"))
          continue;
        const source = readFileSync(path, "utf8");
        if (sdkImport.test(source)) {
          offenders.push(path);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("exposes only the provider-neutral public surface", async () => {
    const exported = Object.keys(publicSurface).sort();
    expect(exported).toEqual(
      [
        "PolymarketProviderError",
        "compareDecimal",
        "createPolymarketBook",
        "createPolymarketDiscovery",
        "createPolymarketMarketStream",
        "isDecimalString",
        "normalizeDecimal",
        "normalizeWireMarketEvent",
      ].sort(),
    );
    // Exported VALUE surface must not include any official SDK namespace.
    for (const name of exported) {
      expect(
        /Client|Sdk|Signer|Order|Cancel|Credential|Session|Builder/i.test(name),
      ).toBe(false);
    }
  });

  it("has no order-mutation, signing or credential symbol anywhere in the package source", () => {
    const forbidden =
      /postOrder|postOrders|cancelOrder|cancelOrders|placeOrder|signOrder|signTypedData|privateKey|PRIVATE_KEY|passphrase|PASSPHRASE|sessionKey|SESSION_KEY|builderApiKey|L1|L2 credentials|createOrDerive/;
    for (const path of walk(packageRoot)) {
      if (!/\.(ts|json)$/.test(path)) continue;
      const source = readFileSync(path, "utf8");
      // Strip comments so prose that names the forbidden concepts is not a
      // false positive; the CODE must be free of them.
      const code = source
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("//"))
        .filter((line) => !line.trimStart().startsWith("*"))
        .join("\n");
      expect(code, path).not.toMatch(forbidden);
    }
  });

  it("requires no credential-bearing environment variable", () => {
    const allowedEnvPattern =
      /process\.env\.(DATABASE_URL|PORT|NODE_ENV|POLYHUNTER_[A-Z_]*|GAMMA_[A-Z_]*URL|CLOB_[A-Z_]*URL|npm_[A-Z_]*|VITEST_[A-Z_]*)?/g;
    for (const path of walk(packageRoot)) {
      if (!/\.ts$/.test(path)) continue;
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        const name = match[1] ?? "";
        expect(
          name.startsWith("POLYHUNTER_") ||
            name.startsWith("npm_") ||
            name.startsWith("VITEST_") ||
            name === "DATABASE_URL" ||
            name === "PORT" ||
            name === "NODE_ENV" ||
            name === "GAMMA_REST_URL" ||
            name === "CLOB_REST_URL",
          `${path} reads unexpected env ${name}`,
        ).toBe(true);
      }
    }
    // And the package itself reads none at all right now (endpoints are
    // injected by options, never from the environment).
    for (const path of walk(packageRoot)) {
      if (!/\.ts$/.test(path)) continue;
      expect(readFileSync(path, "utf8"), path).not.toMatch(/process\.env/);
    }
    void allowedEnvPattern;
  });

  it("keeps the official SDK dependency pinned and read-only-shaped", () => {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    ) as {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(manifest.dependencies["@polymarket" + "/client"]).toBe("0.12.0");
    expect(manifest.dependencies.ws).toBe("8.22.0");
    // No signing/credential dependency may appear (ethers/viem/wallets).
    for (const dependencies of [
      manifest.dependencies,
      manifest.devDependencies ?? {},
    ]) {
      for (const name of Object.keys(dependencies)) {
        expect(/ethers|viem|wallet|signer|keyring|私/i.test(name)).toBe(false);
      }
    }
  });
});
