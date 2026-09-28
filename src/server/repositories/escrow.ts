import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import { escrowEvents } from "@/server/db/schema";
export async function list(db: Database, sandboxId: string) {
  return db.select().from(escrowEvents).where(eq(escrowEvents.sandboxId, sandboxId));
}
export async function forTrade(db: Database, sandboxId: string, tradeId: string) {
  return db
    .select()
    .from(escrowEvents)
    .where(and(eq(escrowEvents.sandboxId, sandboxId), eq(escrowEvents.tradeId, tradeId)))
    .orderBy(asc(escrowEvents.at), asc(escrowEvents.id));
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  row: Omit<typeof escrowEvents.$inferInsert, "sandboxId">,
): Promise<void> {
  await tx.insert(escrowEvents).values({ ...row, sandboxId });
}
