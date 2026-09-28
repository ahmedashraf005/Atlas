import { rm } from "node:fs/promises";
export default async function globalSetup() {
  await rm(`.pglite/e2e-${Number(process.env.E2E_PORT ?? 3100)}`, { recursive: true, force: true });
  await rm(".pglite/e2e-gate", {
    recursive: true,
    force: true,
  });
}
