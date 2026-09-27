import "server-only";
import { eq } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
export async function list(db: Database, sandboxId: string) {
  return db.select().from(notifications).where(eq(notifications.sandboxId, sandboxId));
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  row: Omit<typeof notifications.$inferInsert, "sandboxId">,
): Promise<void> {
  await tx.insert(notifications).values({ ...row, sandboxId });
}
