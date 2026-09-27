import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "scripts/db-runner.ts", "smoke"],
  { stdio: "inherit", env: process.env },
);
process.exitCode = result.status ?? 1;
