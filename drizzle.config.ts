import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig } from "drizzle-kit";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return { url: pathToFileURL(resolve("scripts/server-only.ts")).href, shortCircuit: true };
    return next(specifier, context);
  },
});
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
});
