import "server-only";
import { z } from "zod";
import { validation } from "@/domain/errors";
import { parseMoneyInput } from "@/domain/money";
import { err, ok } from "@/domain/result";
import { type ActionDef, defineAction } from "@/server/actions/pipeline";
import { allocateListing, counterBid, ownedListing } from "@/server/allocation";
import { NotFoundError } from "@/server/errors";
import * as companies from "@/server/repositories/companies";
import * as listings from "@/server/repositories/listings";
import { runTransition, type TxContext } from "@/server/transitions";
export interface ListingActionData {
  listingId: string;
  slug: string;
  refs: string[];
  count: string;
}
async function resultData(
  ctx: TxContext,
  id: string,
  refs: string[] = [],
  count = "0",
): Promise<ListingActionData> {
  const l = await listings.findPublic(ctx.tx, ctx.sandbox.id, id);
  const c = l ? await companies.find(ctx.tx, ctx.sandbox.id, l.companyId) : null;
  if (!c) throw new NotFoundError();
  return { listingId: id, slug: c.slug, refs, count };
}
const revalidate = (d: ListingActionData) => [
  "/holdings",
  "/bids",
  `/listings/${d.listingId}`,
  `/listings/${d.listingId}/bid`,
  `/companies/${d.slug}`,
];
const counterInput = z.object({ listingId: z.uuid(), bidId: z.uuid(), price: z.string() });
export const counterDef: ActionDef<typeof counterInput, ListingActionData> = {
  name: "listing.counter",
  input: counterInput,
  revalidate,
  handler: async (ctx, i) => {
    const price = parseMoneyInput(i.price);
    if (!price.ok)
      return err(validation((price.error.issues ?? []).map((x) => ({ ...x, field: "price" }))));
    const r = await counterBid(ctx, i.listingId, i.bidId, price.value);
    return r.ok ? ok(await resultData(ctx, i.listingId)) : r;
  },
};
const allocateInput = z.strictObject({
  listingId: z.uuid(),
  bidIds: z.array(z.uuid()).max(100),
  backupBidId: z.uuid().nullable(),
});
export const allocateDef: ActionDef<typeof allocateInput, ListingActionData> = {
  name: "listing.allocate",
  input: allocateInput,
  revalidate,
  handler: async (ctx, i) => {
    const r = await allocateListing(ctx, i.listingId, i.bidIds, i.backupBidId);
    return r.ok ? ok(await resultData(ctx, i.listingId, r.value.refs, r.value.count)) : r;
  },
};
const declineInput = z.object({ listingId: z.uuid() });
export const declineAllDef: ActionDef<typeof declineInput, ListingActionData> = {
  name: "listing.declineAll",
  input: declineInput,
  revalidate,
  handler: async (ctx, i) => {
    await ownedListing(ctx, i.listingId);
    const r = await runTransition(ctx, "listing", i.listingId, "DECLINE_ALL", {});
    return r.ok ? ok(await resultData(ctx, i.listingId)) : r;
  },
};
export const counter = defineAction(counterDef);
export const acceptSelected = defineAction(allocateDef);
export const declineAll = defineAction(declineAllDef);
