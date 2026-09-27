import { spawn } from "node:child_process";
import { once } from "node:events";
import { expect, test } from "./fixtures";

test("production showcase gate is evaluated at runtime and returns HTTP 404", async ({
  request,
}) => {
  // The main test server builds with ATLAS_DEV_UI=1. Reuse that build with the flag off.
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", "3101"],
    {
      env: {
        ...process.env,
        ATLAS_DEV_UI: "0",
        DATABASE_URL: "pglite://.pglite/e2e-gate",
        SESSION_SECRET: "atlas-e2e-only-session-secret-32-characters",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = once(server, "exit");
  let logs = "";
  server.stdout.on("data", (data: Buffer) => {
    logs += data.toString();
  });
  server.stderr.on("data", (data: Buffer) => {
    logs += data.toString();
  });
  try {
    await expect
      .poll(
        async () => {
          if (server.exitCode !== null) throw new Error(`Gate test server exited: ${logs}`);
          return request
            .get("http://localhost:3101/dev/ui")
            .then((response) => response.status())
            .catch(() => 0);
        },
        { timeout: 20000 },
      )
      .toBe(404);
    const response = await request.get("http://localhost:3101/dev/ui");
    const html = await response.text();
    expect(html).toContain("Page not found");
    expect(html).not.toContain('id="colours"');
    expect((await request.get("http://localhost:3101/discover")).status()).toBe(200);
  } finally {
    server.kill();
    await exited;
  }
});
