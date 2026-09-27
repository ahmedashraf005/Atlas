import "server-only";
import { and, eq, getTableColumns, notInArray } from "drizzle-orm";
import { can } from "@/domain/authz";
import { MACHINES } from "@/domain/machines";
import type { Actor } from "@/domain/roles";
import type { Listing } from "@/domain/types";
import type { Database, Tx } from "@/server/db/client";
import { listings } from "@/server/db/schema";
import { ConflictError } from "@/server/errors";
export function toListing(row: typeof listings.$inferSelect): Listing {
  return {
    id: row.id,
    sandboxId: row.sandboxId,
    holdingId: row.holdingId,
    sellerId: row.sellerId,
    companyId: row.companyId,
    shareClassId: row.shareClassId,
    currency: row.currency,
    quantity: row.quantity,
    minFill: row.minFill,
    reservePriceMinor: row.reservePriceMinor,
    windowDays: row.windowDays,
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
    countersSent: row.countersSent,
    status: row.status,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
    version: row.version,
  };
}
export async function find(db: Database, sandboxId: string, id: string): Promise<Listing | null> {
  const [row] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.sandboxId, sandboxId), eq(listings.id, id)));
  return row ? toListing(row) : null;
}
export async function list(db: Database, sandboxId: string): Promise<Listing[]> {
  return (await db.select().from(listings).where(eq(listings.sandboxId, sandboxId))).map(toListing);
}
export async function getForUpdate(tx: Tx, sandboxId: string, id: string): Promise<Listing | null> {
  const [row] = await tx
    .select()
    .from(listings)
    .where(and(eq(listings.sandboxId, sandboxId), eq(listings.id, id)))
    .for("update");
  return row ? toListing(row) : null;
}
export async function save(tx: Tx, next: Listing, expectedVersion: number): Promise<void> {
  const rows = await tx
    .update(listings)
    .set(next)
    .where(
      and(
        eq(listings.id, next.id),
        eq(listings.sandboxId, next.sandboxId),
        eq(listings.version, expectedVersion),
      ),
    )
    .returning();
  if (!rows.length) throw new ConflictError();
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  entity: Listing,
  ref: string,
): Promise<void> {
  if (entity.sandboxId !== sandboxId) throw new ConflictError();
  await tx.insert(listings).values({ ...entity, ref });
}

export type ListingPublicView = Omit<typeof listings.$inferSelect, "reservePriceMinor">;
export type ListingOwnerView = typeof listings.$inferSelect;
const { reservePriceMinor: _reserve, ...publicColumns } = getTableColumns(listings);
export const listingPublicColumns = publicColumns;
export async function findForViewer(
  db: Database,
  viewer: { sandboxId: string; actor: Actor },
  id: string,
): Promise<ListingOwnerView | ListingPublicView | null> {
  const [row] = await db
    .select(listingPublicColumns)
    .from(listings)
    .where(and(eq(listings.sandboxId, viewer.sandboxId), eq(listings.id, id)));
  if (!row) return null;
  const resource = {
    kind: "listing" as const,
    sandboxId: row.sandboxId,
    sellerId: row.sellerId,
    companyOrgId: "",
    status: row.status,
  };
  if (!can(viewer.actor, "listing.view", resource).allowed) return null;
  if (!can(viewer.actor, "listing.viewReserve", resource).allowed) return row;
  const [owner] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.sandboxId, viewer.sandboxId), eq(listings.id, id)));
  return owner ?? null;
}

export async function nonTerminal(db: Database, sandboxId: string): Promise<Listing[]> {
  return (
    await db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.sandboxId, sandboxId),
          notInArray(listings.status, [...MACHINES.listing.terminal]),
        ),
      )
  ).map(toListing);
}
