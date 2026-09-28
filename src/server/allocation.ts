import "server-only";
import { allocate, rankBids } from "@/domain/allocation";
import { authorize } from "@/domain/authz";
import { guardFailed, validation } from "@/domain/errors";
import { err, ok, type Result } from "@/domain/result";
import type { Listing } from "@/domain/types";
import { appendAudit } from "@/server/audit";
import { type ActionError, NotFoundError } from "@/server/errors";
import * as bids from "@/server/repositories/bids";
import * as listings from "@/server/repositories/listings";
import * as trades from "@/server/repositories/trades";
import { runTransition, type TxContext } from "@/server/transitions";
export async function ownedListing(ctx: TxContext, id: string): Promise<Listing> {
  const listing = await listings.getForUpdate(ctx.tx, ctx.sandbox.id, id);
  if (!listing || listing.sellerId !== ctx.actor.userId) throw new NotFoundError();
  return listing;
}
export async function counterBid(
  ctx: TxContext,
  listingId: string,
  bidId: string,
  price: bigint,
): Promise<Result<{ listingId: string }, ActionError>> {
  const listing = await ownedListing(ctx, listingId),
    bid = await bids.getForUpdate(ctx.tx, ctx.sandbox.id, bidId);
  if (!bid || bid.listingId !== listing.id) throw new NotFoundError();
  const auth = authorize(ctx.actor, "bid.COUNTER", {
    kind: "bid",
    sandboxId: ctx.sandbox.id,
    buyerId: bid.buyerId,
    sellerId: listing.sellerId,
    listingStatus: listing.status,
  });
  if (!auth.ok) return auth;
  if (bid.counterOutcome !== null) return err(guardFailed("You can only counter a bid once."));
  const countered = await runTransition(ctx, "bid", bid.id, "COUNTER", {
    counterPriceMinor: price,
  });
  if (!countered.ok) return countered;
  const next = await runTransition(ctx, "listing", listing.id, "COUNTER_SENT", {});
  return next.ok ? ok({ listingId: listing.id }) : next;
}
export async function allocateListing(
  ctx: TxContext,
  listingId: string,
  bidIds: string[],
  backupBidId: string | null,
): Promise<Result<{ listingId: string; refs: string[]; count: string }, ActionError>> {
  const sid = ctx.sandbox.id,
    listing = await ownedListing(ctx, listingId);
  const auth = authorize(ctx.actor, "listing.ALLOCATE", {
    kind: "listing",
    sandboxId: sid,
    sellerId: listing.sellerId,
    companyOrgId: "",
    status: listing.status,
  });
  if (!auth.ok) return auth;
  const all = await bids.forListing(ctx.tx, sid, listing.id),
    selected = bidIds.map((id) => all.find((b) => b.id === id));
  if (
    new Set(bidIds).size !== bidIds.length ||
    selected.some((b) => !b || b.status !== "Submitted")
  )
    return err(
      validation([
        { field: "bidIds", message: "Choose submitted bids from this listing, once each." },
      ]),
    );
  const candidates = all.filter((b) => bidIds.includes(b.id));
  const allocation = allocate(listing.quantity, candidates);
  if (!allocation.allocations.length)
    return err(
      validation([{ field: "bidIds", message: "Select bids whose minimum fill can be met." }]),
    );
  const allocatedIds = allocation.allocations.map((a) => a.bidId),
    backup = backupBidId ? all.find((b) => b.id === backupBidId) : null;
  if (
    backupBidId &&
    (!backup || backup.status !== "Submitted" || allocatedIds.includes(backupBidId))
  )
    return err(
      validation([
        { field: "backupBidId", message: "Choose an unallocated submitted bid as backup." },
      ]),
    );
  const result = await runTransition(ctx, "listing", listing.id, "ALLOCATE", { allocation });
  if (!result.ok) return result;
  for (const a of allocation.allocations) {
    const r = await runTransition(ctx, "bid", a.bidId, "ACCEPT", { allocatedQty: a.qty });
    if (!r.ok) return r;
  }
  const created = await trades.forListing(ctx.tx, sid, listing.id);
  if (backup) {
    const r = await runTransition(ctx, "bid", backup.id, "KEEP_AS_BACKUP", {});
    if (!r.ok) return r;
    const lowest = rankBids(candidates.filter((b) => allocatedIds.includes(b.id))).at(-1);
    const row = created.find((t) => t.bidId === lowest?.id);
    if (!row) throw new Error("Allocated trade missing");
    const prev = trades.toTrade(row),
      next = { ...prev, backupBidId: backup.id, version: prev.version + 1 };
    await trades.save(ctx.tx, next, prev.version);
    await appendAudit(ctx, {
      action: "trade.setBackup",
      entity: "trade",
      entityId: next.id,
      before: prev,
      after: next,
    });
  }
  for (const b of all.filter(
    (b) =>
      ["Submitted", "Countered"].includes(b.status) &&
      !allocatedIds.includes(b.id) &&
      b.id !== backupBidId,
  )) {
    const r = await runTransition(ctx, "bid", b.id, "REJECT", {
      reason: "Not selected by the seller",
    });
    if (!r.ok) return r;
  }
  return ok({ listingId: listing.id, refs: created.map((t) => t.ref), count: `${created.length}` });
}
