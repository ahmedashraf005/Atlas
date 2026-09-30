import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { closeDatabase, type Db } from "@/server/db/client";
import { checkDatabase } from "@/server/health";
import { createTestDb } from "./helpers/db";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
}, 20000);
afterAll(async () => {
  await closeDatabase(db);
});
it("checks database readiness without a sandbox or session", async () => {
  await expect(checkDatabase(db)).resolves.toBeUndefined();
  const rows = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM sandboxes`,
  );
  expect(rows.rows[0]?.count).toBe(0);
});
