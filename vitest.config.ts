import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@polyhunter/testkit": fileURLToPath(
        new URL("./packages/testkit/src/index.ts", import.meta.url),
      ),
      "@polyhunter/domain": fileURLToPath(
        new URL("./packages/domain/src/index.ts", import.meta.url),
      ),
      "@polyhunter/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url),
      ),
      "@web/identity/open-redirect": fileURLToPath(
        new URL("./apps/web/src/identity/open-redirect.ts", import.meta.url),
      ),
      "@web/identity/identity-sanitizer": fileURLToPath(
        new URL(
          "./apps/web/src/identity/identity-sanitizer.ts",
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
  },
});
