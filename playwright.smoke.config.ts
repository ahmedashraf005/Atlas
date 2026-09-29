import { defineConfig } from "@playwright/test";

const baseURL = process.env.SMOKE_URL;
if (!baseURL || !/^https?:\/\//.test(baseURL)) throw new Error("SMOKE_URL must be an http(s) URL");
export default defineConfig({
  testDir: "tests/smoke",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  timeout: 60000,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
});
