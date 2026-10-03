import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

describe("environment example", () => {
  it("documents local-only PostgreSQL defaults without application credentials", async () => {
    const example = await readFile(
      resolve(repositoryRoot, ".env.example"),
      "utf8",
    );
    const values = Object.fromEntries(
      example
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
        .map((assignment) => assignment.split("=", 2)),
    );

    expect(example).toContain("Local Docker development only");
    expect(values).toEqual({
      POSTGRES_USER: "polyhunter",
      POSTGRES_PASSWORD: "polyhunter-local-only",
      POSTGRES_DB: "polyhunter_dev",
    });
    expect(example).not.toMatch(/SUPABASE|POLYMARKET|SECRET|TOKEN/i);
  });
});
