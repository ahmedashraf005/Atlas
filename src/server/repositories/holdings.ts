import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { addMonthsUtc } from "@/domain/time";
import type { Holding } from "@/domain/types";
import type { Database, Tx } from "@/server/db/client";
import { holdings, trades } from "@/server/db/schema";
import { ConflictError, NotFoundError } from "@/server/errors";
export function toHolding(row: typeof holdings.$inferSelect): Holding {
  return {
    id: row.id,
    sandboxId: row.sandboxId,
    ownerId: row.ownerId,
    companyId: row.companyId,
    shareClassId: row.shareClassId,
    quantity: row.quantity,
    reservedQty: row.reservedQty,
    soldQty: row.soldQty,
    acquiredAt: row.acquiredAt,
    status: row.status,
    rejectionReason: row.rejectionReason,
    version: row.version,
  };
}
export async function find(db: Database, sandboxId: string, id: string): Promise<Holding | null> {
  const [row] = await db
    .select()
    .from(holdings)
    .where(and(eq(holdings.sandboxId, sandboxId), eq(holdings.id, id)));
  return row ? toHolding(row) : null;
}
export async function list(db: Database, sandboxId: string): Promise<Holding[]> {
  return (await db.select().from(holdings).where(eq(holdings.sandboxId, sandboxId))).map(toHolding);
}
export async function getForUpdate(tx: Tx, sandboxId: string, id: string): Promise<Holding | null> {
  const [row] = await tx
    .select()
    .from(holdings)
    .where(and(eq(holdings.sandboxId, sandboxId), eq(holdings.id, id)))
    .for("update");
  return row ? toHolding(row) : null;
}
export async function save(tx: Tx, next: Holding, expectedVersion: number): Promise<void> {
  const rows = await tx
    .update(holdings)
    .set(next)
    .where(
      and(
        eq(holdings.id, next.id),
        eq(holdings.sandboxId, next.sandboxId),
        eq(holdings.version, expectedVersion),
      ),
    )
    .returning();
  if (!rows.length) throw new ConflictError();
}
export async function insert(tx: Tx, sandboxId: string, entity: Holding): Promise<void> {
  if (entity.sandboxId !== sandboxId) throw new ConflictError();
  await tx.insert(holdings).values(entity);
}

export async function committedQty(
  db: Database,
  sandboxId: string,
  holdingId: string,
  now: Date,
): Promise<bigint> {
  const holding = await find(db, sandboxId, holdingId);
  if (!holding) throw new NotFoundError();
  const since = addMonthsUtc(now, -12);
  const settled = await db
    .select({ quantity: trades.quantity })
    .from(trades)
    .where(
      and(
        eq(trades.sandboxId, sandboxId),
        eq(trades.holdingId, holdingId),
        eq(trades.status, "Settled"),
        gte(trades.settledAt, since),
        lte(trades.settledAt, now),
      ),
    );
  return holding.reservedQty + settled.reduce((sum, t) => sum + t.quantity, 0n);
}
export async function buyerHolding(
  tx: Tx,
  sandboxId: string,
  ownerId: string,
  shareClassId: string,
): Promise<Holding | null> {
  const [row] = await tx
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.sandboxId, sandboxId),
        eq(holdings.ownerId, ownerId),
        eq(holdings.shareClassId, shareClassId),
      ),
    )
    .for("update");
  return row ? toHolding(row) : null;
}
