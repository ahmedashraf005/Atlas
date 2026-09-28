import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import { documents } from "@/server/db/schema";
export async function list(db: Database, sandboxId: string) {
  return db.select().from(documents).where(eq(documents.sandboxId, sandboxId));
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  row: Omit<typeof documents.$inferInsert, "sandboxId">,
): Promise<void> {
  await tx.insert(documents).values({ ...row, sandboxId });
}
export async function forTrade(db: Database, sandboxId: string, tradeId: string) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.sandboxId, sandboxId), eq(documents.tradeId, tradeId)))
    .orderBy(asc(documents.createdAt), asc(documents.id));
}
