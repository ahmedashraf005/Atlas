import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  globalSetup: "./tests/e2e/global-setup.ts",
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${port}`, trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: `pnpm build && pnpm start -p ${port}`,
      url: `http://localhost:${port}/icon.svg`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        DATABASE_URL: `pglite://.pglite/e2e-${port}`,
        SESSION_SECRET: "atlas-e2e-only-session-secret-32-characters",
      },
    },
    {
      // Preserve all foundation showcase assertions in its supported development mode.
      // Next 16 keeps development output in .next/dev, separate from the finished production build.
      command: `pnpm dev -p ${port + 2}`,
      url: `http://localhost:${port + 2}/icon.svg`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        DATABASE_URL: `pglite://.pglite/e2e-showcase-${port}`,
        SESSION_SECRET: "atlas-e2e-only-session-secret-32-characters",
      },
    },
  ],
});
