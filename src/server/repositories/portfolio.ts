import "server-only";
import { and, eq, gt } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { companies, holdings, shareClasses, trades } from "@/server/db/schema";
export async function forOwner(db: Database, sandboxId: string, ownerId: string) {
  return db
    .select({
      holdingId: holdings.id,
      quantity: holdings.quantity,
      soldQty: holdings.soldQty,
      acquiredAt: holdings.acquiredAt,
      company: companies.name,
      shareClass: shareClasses.name,
      tradeId: trades.id,
      ref: trades.ref,
      purchasedQty: trades.quantity,
    })
    .from(holdings)
    .innerJoin(
      companies,
      and(eq(companies.sandboxId, sandboxId), eq(companies.id, holdings.companyId)),
    )
    .innerJoin(
      shareClasses,
      and(eq(shareClasses.sandboxId, sandboxId), eq(shareClasses.id, holdings.shareClassId)),
    )
    .innerJoin(
      trades,
      and(
        eq(trades.sandboxId, sandboxId),
        eq(trades.buyerId, ownerId),
        eq(trades.shareClassId, holdings.shareClassId),
        eq(trades.status, "Settled"),
      ),
    )
    .where(
      and(
        eq(holdings.sandboxId, sandboxId),
        eq(holdings.ownerId, ownerId),
        gt(holdings.quantity, holdings.soldQty),
      ),
    );
}
