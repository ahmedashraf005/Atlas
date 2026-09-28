import "server-only";
import { and, eq, or } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { bids, holdings, listings, trades } from "@/server/db/schema";
import { listingPublicColumns } from "@/server/repositories/listings";
export async function publicListings(db: Database, sandboxId: string) {
  return db.select(listingPublicColumns).from(listings).where(eq(listings.sandboxId, sandboxId));
}
export async function ownBids(db: Database, sandboxId: string, userId: string) {
  return db
    .select()
    .from(bids)
    .where(and(eq(bids.sandboxId, sandboxId), eq(bids.buyerId, userId)));
}
export async function participates(
  db: Database,
  sandboxId: string,
  companyId: string,
  userId: string,
) {
  const ownHoldings = await db
    .select({ quantity: holdings.quantity, soldQty: holdings.soldQty })
    .from(holdings)
    .where(
      and(
        eq(holdings.sandboxId, sandboxId),
        eq(holdings.companyId, companyId),
        eq(holdings.ownerId, userId),
      ),
    );
  if (ownHoldings.some((h) => h.quantity > h.soldQty)) return true;
  const ownTrades = await db
    .select({ id: trades.id })
    .from(trades)
    .where(
      and(
        eq(trades.sandboxId, sandboxId),
        eq(trades.companyId, companyId),
        or(eq(trades.buyerId, userId), eq(trades.sellerId, userId)),
      ),
    );
  if (ownTrades.length) return true;
  const own = await db
    .select({ id: bids.id })
    .from(bids)
    .innerJoin(listings, and(eq(listings.id, bids.listingId), eq(listings.sandboxId, sandboxId)))
    .where(
      and(
        eq(bids.sandboxId, sandboxId),
        eq(bids.buyerId, userId),
        eq(listings.companyId, companyId),
      ),
    );
  return own.length > 0;
}
