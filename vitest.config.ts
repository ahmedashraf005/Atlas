import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/lib/**"],
      reporter: ["text", "json", "json-summary", "html"],
      thresholds: { lines: 95, branches: 90, functions: 95, statements: 95 },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/setup/server-only.ts", import.meta.url)),
    },
  },
  esbuild: { jsx: "automatic" },
});
