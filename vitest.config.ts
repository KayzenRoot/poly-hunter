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
      "@web/identity/app-origin": fileURLToPath(
        new URL("./apps/web/src/identity/app-origin.ts", import.meta.url),
      ),
      "@web/identity/csrf-guard": fileURLToPath(
        new URL("./apps/web/src/identity/csrf-guard.ts", import.meta.url),
      ),
      "@web/handlers/select-tenant": fileURLToPath(
        new URL(
          "./apps/web/app/api/auth/select-tenant/handler.ts",
          import.meta.url,
        ),
      ),
      "@web/handlers/logout": fileURLToPath(
        new URL("./apps/web/app/api/auth/logout/handler.ts", import.meta.url),
      ),
      "@web/handlers/login": fileURLToPath(
        new URL("./apps/web/app/api/auth/login/handler.ts", import.meta.url),
      ),
      "@web/handlers/callback": fileURLToPath(
        new URL("./apps/web/app/auth/callback/handler.ts", import.meta.url),
      ),
      "@web/identity/auth-cache-headers": fileURLToPath(
        new URL(
          "./apps/web/src/identity/auth-cache-headers.ts",
          import.meta.url,
        ),
      ),
      "@web/identity": fileURLToPath(
        new URL("./apps/web/src/identity", import.meta.url),
      ),
      "@/identity": fileURLToPath(
        new URL("./apps/web/src/identity", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
  },
});
