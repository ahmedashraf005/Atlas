import { sql } from "drizzle-orm";
import { getServerEnv } from "../src/env";
import { closeDatabase, connectDatabase } from "../src/server/db/client";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* CI supplies env directly. */
}
const url = getServerEnv().DATABASE_URL;
const db = await connectDatabase(url, process.argv[2] === "migrate");
try {
  if (process.argv[2] === "smoke") {
    await db.execute(sql`SELECT 1`);
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1`);
    });
    console.log(
      `Database smoke passed (${url.startsWith("pglite://") ? "PGlite" : "Neon WebSocket Pool"}).`,
    );
  } else console.log("Migrations applied.");
} finally {
  await closeDatabase(db);
}
