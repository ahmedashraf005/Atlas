import "server-only";
import { sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";

export async function checkDatabase(db: Database): Promise<void> {
  await db.execute(sql`SELECT 1`);
}
