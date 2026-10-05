import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function parseEnvFile(contents: string): Record<string, string> {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((assignment) => assignment.split("=", 2)),
  );
}

describe("environment example", () => {
  it("documents local-only PostgreSQL defaults without application credentials", async () => {
    const example = await readFile(
      resolve(repositoryRoot, ".env.example"),
      "utf8",
    );
    const values = parseEnvFile(example);

    expect(example).toContain("Local Docker development only");
    expect(values).toMatchObject({
      POSTGRES_USER: "polyhunter",
      POSTGRES_PASSWORD: "polyhunter-local-only",
      POSTGRES_DB: "polyhunter_dev",
    });
    // Every provider/auth setting stays EMPTY: shipping the example file must
    // never hand out a usable credential or endpoint.
    expect(values.NEXT_PUBLIC_SUPABASE_URL).toBe("");
    expect(values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("");
    // No service-role / secret key may appear under any name. The check runs
    // over assigned VALUES only: the file's comments legitimately warn against
    // exactly these names.
    expect(Object.keys(values)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    for (const value of Object.values(values)) {
      expect(value).not.toMatch(
        /service[_-]?role|secret[_-]?key|private[_-]?key|eyJ[A-Za-z0-9_-]{10,}/i,
      );
    }
  });

  it("documents the server-side app origin used for OAuth redirects", async () => {
    const example = await readFile(
      resolve(repositoryRoot, ".env.example"),
      "utf8",
    );
    const values = parseEnvFile(example);

    expect(values.NEXT_PUBLIC_APP_ORIGIN).toBe("http://localhost:3000");
    // The origin is a routing/security configuration value, not a credential.
    expect(example).toContain("NEXT_PUBLIC_APP_ORIGIN");
  });
});
