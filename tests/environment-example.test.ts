import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

describe("environment example", () => {
  it("documents that PH-M00 does not require values or credentials", async () => {
    const example = await readFile(
      resolve(repositoryRoot, ".env.example"),
      "utf8",
    );
    const assignments = example
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    expect(example).toContain(
      "PH-M00 requires no environment variables or credentials.",
    );
    expect(assignments).toEqual([]);
  });
});
