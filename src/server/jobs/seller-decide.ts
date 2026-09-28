import "server-only";
import { allocate, rankBids } from "@/domain/allocation";
import { ok } from "@/domain/result";
import { allocateListing, counterBid } from "@/server/allocation";
import { registerJobHandler } from "@/server/automation";
import * as bids from "@/server/repositories/bids";
import * as listings from "@/server/repositories/listings";
import { runTransition } from "@/server/transitions";

registerJobHandler("seller_decide", async (ctx, job) => {
  const listing = await listings.getForUpdate(ctx.tx, ctx.sandbox.id, job.entityId);
  if (!listing || !["Closed", "Negotiating"].includes(listing.status))
    return { status: "skipped", code: "ALREADY_DECIDED" };
  const all = await bids.forListing(ctx.tx, ctx.sandbox.id, listing.id);
  if (all.some((b) => b.status === "Countered" && b.counterOutcome === "pending"))
    return { status: "skipped", code: "AWAITING_COUNTER" };
  const submitted = rankBids(all.filter((b) => b.status === "Submitted")),
    candidates = submitted.filter((b) => b.priceMinor >= listing.reservePriceMinor);
  if (candidates.length) {
    const result = allocate(listing.quantity, candidates),
      ids = result.allocations.map((a) => a.bidId);
    if (ids.length) {
      const backup = submitted.find((b) => !ids.includes(b.id));
      return allocateListing(ctx, listing.id, ids, backup?.id ?? null);
    }
  }
  const top = submitted[0];
  if (
    top &&
    top.counterOutcome === null &&
    top.priceMinor * 100n >= listing.reservePriceMinor * 95n &&
    listing.countersSent < 3
  )
    return counterBid(ctx, listing.id, top.id, listing.reservePriceMinor);
  const r = await runTransition(ctx, "listing", listing.id, "DECLINE_ALL", {});
  return r.ok ? ok({ listingId: listing.id }) : r;
});
