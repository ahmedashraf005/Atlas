import "server-only";
import { eq } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import { accessGrants } from "@/server/db/schema";
export async function list(db: Database, sandboxId: string) {
  return db.select().from(accessGrants).where(eq(accessGrants.sandboxId, sandboxId));
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  row: Omit<typeof accessGrants.$inferInsert, "sandboxId">,
): Promise<void> {
  await tx.insert(accessGrants).values({ ...row, sandboxId });
}
