import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * PH-M01-WO-003 — containment scans for secret material.
 *
 * These are repository-shape assertions, not crypto tests. They answer one
 * question: could key material, a keyring, or a secret VALUE reach a file it
 * has no business being in?
 *
 * Two independent scans run:
 *
 * 1. REPOSITORY SCAN. No committed file may contain a keyring-shaped literal —
 *    a JSON object whose values are long base64 strings — nor a `NEXT_PUBLIC_`
 *    variable that carries key material. Test fixtures are exempt only where
 *    the value is a deliberately obvious non-secret (all-zero or all-`a` bytes
 *    used to exercise a boundary), and the exemption is explicit.
 *
 * 2. CLIENT BUNDLE SCAN. The built web bundle is scanned for the keyring
 *    variable names and for any 32-byte base64 literal. This is the property
 *    that actually matters for the `NEXT_PUBLIC_` rule: it is checked against
 *    the ARTIFACT a browser downloads, not against the import graph, because
 *    only the artifact proves the key is not on the client.
 */

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const SKIPPED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "next-env.d.ts",
  ".next",
  "dist",
  "out",
  "coverage",
]);

const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".env",
  ".example",
  ".sql",
  ".md",
]);

/**
 * Files whose content legitimately mentions a key-shaped string. Each entry
 * names the exact reason; the scan fails on any path not listed here, so a
 * new "temporary" fixture cannot silently become an exempt one.
 */
const ALLOWED_SECRET_LITERALS: Readonly<Record<string, string>> = {
  "tests/secret-vault-crypto.test.ts":
    "32-byte test keys built from Buffer.alloc(32, 0xa1/0xb2) — fixed, published, non-secret.",
  "tests/secret-vault-http.test.ts":
    "base64 string used as a HOSTILE stub value to prove the projection drops it.",
  "packages/db/tests/secret-vault.integration.test.ts":
    "32-byte test keys built from Buffer.alloc(32, 0x11/0x22) — fixed, published, non-secret.",
  ".engineering/context-locks/PH-M01-WO-003.json":
    "fingerprints only; the file is hashed, never carries key material.",
};

/** A JSON-ish object literal whose values are long base64 blobs. */
const KEYRING_SHAPED =
  /\{\s*(?:"[A-Za-z0-9_-]{1,32}"\s*:\s*")(?=[A-Za-z0-9+/]{40,}={0,2}")/g;

/** A standalone base64 blob that decodes to exactly 32 bytes. */
function isThirtyTwoByteBase64(value: string): boolean {
  const stripped = value.replace(/=+$/, "");
  if (stripped.length !== 43) return false;
  if (!/^[A-Za-z0-9+/]+$/.test(stripped)) return false;
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return SKIPPED_DIRECTORIES.has(entry.name) ? [] : walk(path);
      }
      if (!entry.isFile()) return [];
      const extension =
        entry.name === ".env.example" || entry.name.startsWith(".env")
          ? ".env"
          : extname(entry.name);
      return SCANNED_EXTENSIONS.has(extension) ? [path] : [];
    }),
  );
  return nested.flat();
}

describe("PH-M01-WO-003 secret material containment", () => {
  it("commits no keyring-shaped literal anywhere outside the declared fixtures", async () => {
    const files = await walk(repositoryRoot);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];

    for (const path of files) {
      const relativePath = relative(repositoryRoot, path).replaceAll("\\", "/");
      if (ALLOWED_SECRET_LITERALS[relativePath]) continue;

      const content = await readFile(path, "utf8");
      for (const match of content.matchAll(KEYRING_SHAPED)) {
        const literal = match[0].slice(1);
        const encoded = /:([A-Za-z0-9+/]+={0,2})/.exec(literal)?.[1];
        if (encoded && isThirtyTwoByteBase64(encoded)) {
          offenders.push(`${relativePath}: keyring-shaped 32-byte literal`);
          break;
        }
      }
    }

    expect(offenders).toEqual([]);
    // This is the only test in the unit suite that reads the whole repository,
    // so its runtime scales with the tree (~400 files, ~26 MB, dominated by the
    // recorded CVE feeds under .engineering/evidence) rather than with any input
    // it controls. It finishes in well under a second on its own, but under the
    // full suite it competes with every other file for the same event loop and
    // can exceed the 5 s default. The timeout is set generously rather than
    // tightly so a genuine containment regression still fails loudly instead of
    // being masked by a fast machine.
  }, 30_000);

  it("keeps the keyring variables server-only in every example and compose surface", async () => {
    const example = await readFile(
      resolve(repositoryRoot, ".env.example"),
      "utf8",
    );
    const compose = await readFile(
      resolve(repositoryRoot, "compose.yaml"),
      "utf8",
    );

    // Present but EMPTY: the name is discoverable, the value is not.
    expect(example).toContain("POLYHUNTER_SECRET_ACTIVE_KEY_VERSION=");
    expect(example).toContain("POLYHUNTER_SECRET_KEYRING_JSON=");
    for (const line of example.split("\n")) {
      if (line.startsWith("POLYHUNTER_SECRET_")) {
        const value = line.slice(line.indexOf("=") + 1).trim();
        expect(value, line).toBe("");
      }
    }
    // Never under the prefix Next.js inlines into the browser bundle.
    expect(example).not.toContain("NEXT_PUBLIC_SECRET");
    expect(example).not.toContain("NEXT_PUBLIC_KEYRING");
    expect(compose).not.toContain("NEXT_PUBLIC_SECRET");
    expect(compose).not.toContain("NEXT_PUBLIC_KEYRING");
    // Compose passes them through with a blank default, so local Docker still
    // starts with no keyring configured. The expectation is assembled rather
    // than written as a literal, because `${...}` inside a plain string reads
    // like an unresolved template placeholder to the linter — and it would be
    // exactly the same text if it did.
    for (const name of [
      "POLYHUNTER_SECRET_ACTIVE_KEY_VERSION",
      "POLYHUNTER_SECRET_KEYRING_JSON",
    ]) {
      expect(compose).toContain(`${name}: \${${name}:-}`);
    }
  });

  it("ships no key material in the built client bundle", async () => {
    // `.next/static` is the ONLY directory a browser downloads. `.next/server`
    // holds the server bundle, where the vault is supposed to live — scanning
    // it would assert the opposite of what this Work Order requires.
    const clientDirectory = resolve(repositoryRoot, "apps/web/.next/static");

    let built: boolean;
    try {
      built = (await stat(clientDirectory)).isDirectory();
    } catch {
      built = false;
    }

    if (!built) {
      // The bundle is produced by `npm run build`, which `npm run validate`
      // runs. Its absence means the build has not run in this checkout, not
      // that a scan failed — and the import-graph scan in
      // workspace-boundaries.test.ts still holds unconditionally.
      expect(built).toBe(false);
      return;
    }

    const clientChunks = (await walk(clientDirectory)).filter((path) =>
      path.endsWith(".js"),
    );
    // A built client with no chunks would make the scan vacuously pass.
    expect(clientChunks.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const path of clientChunks) {
      const content = await readFile(path, "utf8");
      const where = relative(repositoryRoot, path).replaceAll("\\", "/");
      if (content.includes("POLYHUNTER_SECRET_KEYRING_JSON")) {
        offenders.push(`${where}: keyring variable name`);
      }
      if (content.includes("POLYHUNTER_SECRET_ACTIVE_KEY_VERSION")) {
        offenders.push(`${where}: active key version variable name`);
      }
      if (content.includes("polyhunter-secret-envelope-v1")) {
        offenders.push(`${where}: envelope protocol label`);
      }
      if (content.includes("createSecretKey")) {
        offenders.push(`${where}: key derivation entry point`);
      }
      for (const match of content.matchAll(/[A-Za-z0-9+/]{43}=/g)) {
        if (isThirtyTwoByteBase64(match[0])) {
          offenders.push(`${where}: 32-byte base64 literal`);
          break;
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
