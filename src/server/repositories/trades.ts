import "server-only";
import { and, eq, inArray, notInArray, or } from "drizzle-orm";
import { MACHINES } from "@/domain/machines";
import type { Actor } from "@/domain/roles";
import type { Trade } from "@/domain/types";
import type { Database, Tx } from "@/server/db/client";
import { auditLog, companies, trades } from "@/server/db/schema";
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
export async function findByRef(db: Database, sandboxId: string, ref: string) {
  const [row] = await db
    .select()
    .from(trades)
    .where(and(eq(trades.sandboxId, sandboxId), eq(trades.ref, ref)));
  return row ?? null;
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
export async function findRow(db: Database, sandboxId: string, id: string) {
  const [row] = await db
    .select()
    .from(trades)
    .where(and(eq(trades.sandboxId, sandboxId), eq(trades.id, id)));
  return row ?? null;
}
export async function visibleRows(db: Database, sandboxId: string, actor: Actor) {
  if (actor.sandboxId !== sandboxId || actor.role === "system") return [];
  if (actor.role === "company_admin")
    return (
      await db
        .select({ trade: trades })
        .from(trades)
        .innerJoin(
          companies,
          and(eq(companies.id, trades.companyId), eq(companies.sandboxId, sandboxId)),
        )
        .where(
          and(
            eq(trades.sandboxId, sandboxId),
            eq(companies.orgId, actor.orgId ?? "00000000-0000-0000-0000-000000000000"),
          ),
        )
    ).map((r) => r.trade);
  return db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.sandboxId, sandboxId),
        actor.role === "seller"
          ? eq(trades.sellerId, actor.userId)
          : actor.role === "buyer"
            ? eq(trades.buyerId, actor.userId)
            : undefined,
      ),
    );
}
/** Quantity history only; document generation never needs other trades' prices. */
export async function registerHistory(
  db: Database,
  sandboxId: string,
  holdingId: string,
  buyerId: string,
  shareClassId: string,
) {
  return db
    .select({
      id: trades.id,
      holdingId: trades.holdingId,
      sellerId: trades.sellerId,
      buyerId: trades.buyerId,
      quantity: trades.quantity,
      status: trades.status,
      settledAt: trades.settledAt,
      exercisedAt: auditLog.at,
    })
    .from(trades)
    .leftJoin(
      auditLog,
      and(
        eq(auditLog.sandboxId, sandboxId),
        eq(auditLog.entityId, trades.id),
        eq(auditLog.entity, "trade"),
        eq(auditLog.action, "trade.EXERCISE"),
      ),
    )
    .where(
      and(
        eq(trades.sandboxId, sandboxId),
        inArray(trades.status, ["Settled", "RofrExercised"]),
        or(
          eq(trades.holdingId, holdingId),
          and(eq(trades.buyerId, buyerId), eq(trades.shareClassId, shareClassId)),
          and(eq(trades.sellerId, buyerId), eq(trades.shareClassId, shareClassId)),
        ),
      ),
    );
}
