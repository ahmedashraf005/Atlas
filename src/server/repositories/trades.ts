import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { MACHINES } from "@/domain/machines";
import type { Trade } from "@/domain/types";
import type { Database, Tx } from "@/server/db/client";
import { trades } from "@/server/db/schema";
import { ConflictError } from "@/server/errors";
export function toTrade(row: typeof trades.$inferSelect): Trade {
  return {
    id: row.id,
    sandboxId: row.sandboxId,
    listingId: row.listingId,
    bidId: row.bidId,
    holdingId: row.holdingId,
    sellerId: row.sellerId,
    buyerId: row.buyerId,
    companyId: row.companyId,
    shareClassId: row.shareClassId,
    currency: row.currency,
    quantity: row.quantity,
    priceMinor: row.priceMinor,
    sellerSignedAt: row.sellerSignedAt,
    buyerSignedAt: row.buyerSignedAt,
    rofrDeadline: row.rofrDeadline,
    fundingDeadline: row.fundingDeadline,
    wireSentAt: row.wireSentAt,
    fundedAt: row.fundedAt,
    registerUpdatedAt: row.registerUpdatedAt,
    releaseApprovals: row.releaseApprovals,
    backupBidId: row.backupBidId,
    escrowRef: row.escrowRef,
    disputeReason: row.disputeReason,
    disputedFrom: row.disputedFrom,
    cancelReason: row.cancelReason,
    settledAt: row.settledAt,
    createdAt: row.createdAt,
    status: row.status,
    version: row.version,
  };
}
export async function find(db: Database, sandboxId: string, id: string): Promise<Trade | null> {
  const [row] = await db
    .select()
    .from(trades)
    .where(and(eq(trades.sandboxId, sandboxId), eq(trades.id, id)));
  return row ? toTrade(row) : null;
}
export async function list(db: Database, sandboxId: string): Promise<Trade[]> {
  return (await db.select().from(trades).where(eq(trades.sandboxId, sandboxId))).map(toTrade);
}
export async function getForUpdate(tx: Tx, sandboxId: string, id: string): Promise<Trade | null> {
  const [row] = await tx
    .select()
    .from(trades)
    .where(and(eq(trades.sandboxId, sandboxId), eq(trades.id, id)))
    .for("update");
  return row ? toTrade(row) : null;
}
export async function save(tx: Tx, next: Trade, expectedVersion: number): Promise<void> {
  const rows = await tx
    .update(trades)
    .set(next)
    .where(
      and(
        eq(trades.id, next.id),
        eq(trades.sandboxId, next.sandboxId),
        eq(trades.version, expectedVersion),
      ),
    )
    .returning();
  if (!rows.length) throw new ConflictError();
}
export async function insert(tx: Tx, sandboxId: string, entity: Trade, ref: string): Promise<void> {
  if (entity.sandboxId !== sandboxId) throw new ConflictError();
  await tx.insert(trades).values({ ...entity, ref });
}

export async function nonTerminal(db: Database, sandboxId: string): Promise<Trade[]> {
  return (
    await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.sandboxId, sandboxId),
          notInArray(trades.status, [...MACHINES.trade.terminal]),
        ),
      )
  ).map(toTrade);
}

export async function forListing(db: Database, sandboxId: string, listingId: string) {
  return db
    .select()
    .from(trades)
    .where(and(eq(trades.sandboxId, sandboxId), eq(trades.listingId, listingId)));
}
export async function forBuyer(db: Database, sandboxId: string, buyerId: string) {
  return db
    .select()
    .from(trades)
    .where(and(eq(trades.sandboxId, sandboxId), eq(trades.buyerId, buyerId)));
}
