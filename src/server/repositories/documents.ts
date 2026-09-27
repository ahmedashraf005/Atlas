import "server-only";
import { eq } from "drizzle-orm";
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
