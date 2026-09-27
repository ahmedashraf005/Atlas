import { rm } from "node:fs/promises";
export default async function globalSetup() {
  await rm(".pglite/e2e", { recursive: true, force: true });
  await rm(".pglite/e2e-gate", { recursive: true, force: true });
}
