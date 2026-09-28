import "server-only";
import { and, eq } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import { accessGrants } from "@/server/db/schema";
import { ConflictError } from "@/server/errors";
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

export async function getForUpdate(tx: Tx, sandboxId: string, id: string) {
  const [row] = await tx
    .select()
    .from(accessGrants)
    .where(and(eq(accessGrants.sandboxId, sandboxId), eq(accessGrants.id, id)))
    .for("update");
  return row ?? null;
}
export async function find(db: Database, sandboxId: string, companyId: string, buyerId: string) {
  const [row] = await db
    .select()
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.sandboxId, sandboxId),
        eq(accessGrants.companyId, companyId),
        eq(accessGrants.buyerId, buyerId),
      ),
    );
  return row ?? null;
}
export async function decide(
  tx: Tx,
  sandboxId: string,
  prev: typeof accessGrants.$inferSelect,
  status: "approved" | "denied",
  decidedBy: string,
  now: Date,
) {
  const [row] = await tx
    .update(accessGrants)
    .set({ status, decidedBy, decidedAt: now, version: prev.version + 1 })
    .where(
      and(
        eq(accessGrants.sandboxId, sandboxId),
        eq(accessGrants.id, prev.id),
        eq(accessGrants.version, prev.version),
        eq(accessGrants.status, "pending"),
      ),
    )
    .returning();
  if (!row) throw new ConflictError();
  return row;
}
