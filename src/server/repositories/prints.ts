import "server-only";
import { eq } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import { tradePrints } from "@/server/db/schema";
export async function list(db: Database, sandboxId: string) {
  return db.select().from(tradePrints).where(eq(tradePrints.sandboxId, sandboxId));
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  row: Omit<typeof tradePrints.$inferInsert, "sandboxId">,
): Promise<void> {
  await tx.insert(tradePrints).values({ ...row, sandboxId });
}
