import "server-only";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import { bids, listings, notifications } from "@/server/db/schema";
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
export async function forRecipient(db: Database, sandboxId: string, recipientId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.sandboxId, sandboxId), eq(notifications.recipientId, recipientId)))
    .orderBy(desc(notifications.createdAt), desc(notifications.id));
}
export async function getForUpdate(tx: Tx, sandboxId: string, recipientId: string, id: string) {
  const [row] = await tx
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.sandboxId, sandboxId),
        eq(notifications.recipientId, recipientId),
        eq(notifications.id, id),
      ),
    )
    .for("update");
  return row ?? null;
}
export async function markRead(
  tx: Tx,
  sandboxId: string,
  recipientId: string,
  id: string,
  now: Date,
) {
  return tx
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.sandboxId, sandboxId),
        eq(notifications.recipientId, recipientId),
        eq(notifications.id, id),
        isNull(notifications.readAt),
      ),
    )
    .returning();
}
export async function markAllRead(tx: Tx, sandboxId: string, recipientId: string, now: Date) {
  return tx
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.sandboxId, sandboxId),
        eq(notifications.recipientId, recipientId),
        isNull(notifications.readAt),
      ),
    )
    .returning();
}

/** Notification linking needs party-owned bid IDs only, never bid prices. */
export async function bidTargets(
  db: Database,
  sandboxId: string,
  recipientId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  return db
    .select({ id: bids.id, listingId: listings.id })
    .from(bids)
    .innerJoin(listings, and(eq(listings.sandboxId, sandboxId), eq(listings.id, bids.listingId)))
    .where(
      and(
        eq(bids.sandboxId, sandboxId),
        inArray(bids.id, ids),
        or(eq(bids.buyerId, recipientId), eq(listings.sellerId, recipientId)),
      ),
    );
}
