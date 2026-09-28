import "server-only";
import { and, count, eq, notInArray } from "drizzle-orm";
import { MACHINES } from "@/domain/machines";
import type { Bid } from "@/domain/types";
import type { Database, Tx } from "@/server/db/client";
import { bids } from "@/server/db/schema";
import { ConflictError } from "@/server/errors";
export function toBid(row: typeof bids.$inferSelect): Bid {
  return {
    id: row.id,
    sandboxId: row.sandboxId,
    listingId: row.listingId,
    buyerId: row.buyerId,
    buyerOrgId: row.buyerOrgId,
    priceMinor: row.priceMinor,
    quantity: row.quantity,
    minFill: row.minFill,
    rationale: row.rationale,
    submittedAt: row.submittedAt,
    amendedAt: row.amendedAt,
    expiresAt: row.expiresAt,
    counterPriceMinor: row.counterPriceMinor,
    counterExpiresAt: row.counterExpiresAt,
    counterOutcome: row.counterOutcome,
    allocatedQty: row.allocatedQty,
    rejectionReason: row.rejectionReason,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    version: row.version,
  };
}
export async function find(db: Database, sandboxId: string, id: string): Promise<Bid | null> {
  const [row] = await db
    .select()
    .from(bids)
    .where(and(eq(bids.sandboxId, sandboxId), eq(bids.id, id)));
  return row ? toBid(row) : null;
}
export async function list(db: Database, sandboxId: string): Promise<Bid[]> {
  return (await db.select().from(bids).where(eq(bids.sandboxId, sandboxId))).map(toBid);
}
export async function getForUpdate(tx: Tx, sandboxId: string, id: string): Promise<Bid | null> {
  const [row] = await tx
    .select()
    .from(bids)
    .where(and(eq(bids.sandboxId, sandboxId), eq(bids.id, id)))
    .for("update");
  return row ? toBid(row) : null;
}
export async function save(tx: Tx, next: Bid, expectedVersion: number): Promise<void> {
  const rows = await tx
    .update(bids)
    .set(next)
    .where(
      and(
        eq(bids.id, next.id),
        eq(bids.sandboxId, next.sandboxId),
        eq(bids.version, expectedVersion),
      ),
    )
    .returning();
  if (!rows.length) throw new ConflictError();
}
export async function insert(tx: Tx, sandboxId: string, entity: Bid): Promise<void> {
  if (entity.sandboxId !== sandboxId) throw new ConflictError();
  await tx.insert(bids).values(entity);
}

export async function nonTerminal(db: Database, sandboxId: string): Promise<Bid[]> {
  return (
    await db
      .select()
      .from(bids)
      .where(
        and(eq(bids.sandboxId, sandboxId), notInArray(bids.status, [...MACHINES.bid.terminal])),
      )
  ).map(toBid);
}

export async function countForListing(
  db: Database,
  sandboxId: string,
  listingId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(bids)
    .where(
      and(
        eq(bids.sandboxId, sandboxId),
        eq(bids.listingId, listingId),
        notInArray(bids.status, ["Withdrawn", "Rejected", "Expired"]),
      ),
    );
  return row?.total ?? 0;
}
