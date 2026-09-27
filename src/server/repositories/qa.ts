import "server-only";
import { eq } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import { qaEntries } from "@/server/db/schema";
export async function list(db: Database, sandboxId: string) {
  return db.select().from(qaEntries).where(eq(qaEntries.sandboxId, sandboxId));
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  row: Omit<typeof qaEntries.$inferInsert, "sandboxId">,
): Promise<void> {
  await tx.insert(qaEntries).values({ ...row, sandboxId });
}
