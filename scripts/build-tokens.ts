import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generateTokensCss, parseTokens } from "./lib/tokens";

async function main() {
  const input = new URL("../docs/design/tokens.json", import.meta.url);
  const output = new URL("../src/styles/tokens.css", import.meta.url);
  const css = generateTokensCss(parseTokens(JSON.parse(await readFile(input, "utf8"))));
  if (process.argv.includes("--check")) {
    const existing = await readFile(output, "utf8").catch(() => "");
    if (existing !== css) throw new Error("tokens.css is out of date — run pnpm tokens");
  } else {
    await mkdir(new URL("../src/styles/", import.meta.url), { recursive: true });
    await writeFile(output, css);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Token generation failed");
  process.exitCode = 1;
});
