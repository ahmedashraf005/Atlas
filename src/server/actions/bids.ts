import "server-only";
import { z } from "zod";
import { ok } from "@/domain/result";
import { type ActionDef, defineAction } from "@/server/actions/pipeline";
import { parseBidFields, submitBid } from "@/server/bidding";
import { NotFoundError } from "@/server/errors";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as listings from "@/server/repositories/listings";
import { runTransition, type TxContext } from "@/server/transitions";

const fields = {
  price: z.string(),
  quantity: z.string(),
  minFill: z.string(),
  rationale: z.string().max(500).default(""),
};
const submitInput = z.object({
  listingId: z.uuid(),
  ...fields,
  idempotencyKey: z.string().min(1).max(200),
});
export interface BidData {
  bidId: string;
  listingId: string;
  slug: string;
  ref: string;
}
async function data(ctx: TxContext, bidId: string, listingId: string): Promise<BidData> {
  const l = await listings.findPublic(ctx.tx, ctx.sandbox.id, listingId);
  if (!l) throw new NotFoundError();
  const c = await companies.find(ctx.tx, ctx.sandbox.id, l.companyId);
  if (!c) throw new NotFoundError();
  return { bidId, listingId, slug: c.slug, ref: l.ref };
}
const revalidate = (d: BidData) => [
  "/bids",
  `/listings/${d.listingId}`,
  `/listings/${d.listingId}/bid`,
  `/companies/${d.slug}`,
];
export const submitBidDef: ActionDef<typeof submitInput, BidData> = {
  name: "bid.submit",
  input: submitInput,
  rateLimit: { max: 10, windowSeconds: 60 },
  revalidate,
  handler: async (ctx, i) => {
    const parsed = parseBidFields(i);
    if (!parsed.ok) return parsed;
    const r = await submitBid(ctx, i.listingId, parsed.value, i.idempotencyKey);
    return r.ok ? ok(await data(ctx, r.value.id, r.value.listingId)) : r;
  },
};
const amendInput = z.object({ bidId: z.uuid(), ...fields });
export const amendBidDef: ActionDef<typeof amendInput, BidData> = {
  name: "bid.amend",
  input: amendInput,
  revalidate,
  handler: async (ctx, i) => {
    const b = await bids.find(ctx.tx, ctx.sandbox.id, i.bidId);
    if (!b) throw new NotFoundError();
    const parsed = parseBidFields(i);
    if (!parsed.ok) return parsed;
    const r = await runTransition(ctx, "bid", b.id, "AMEND", { amendment: parsed.value });
    return r.ok ? ok(await data(ctx, b.id, b.listingId)) : r;
  },
};
const bidInput = z.object({ bidId: z.uuid() });
function eventAction(
  name: string,
  event: "WITHDRAW" | "ACCEPT_COUNTER" | "DECLINE_COUNTER",
): ActionDef<typeof bidInput, BidData> {
  return {
    name,
    input: bidInput,
    revalidate,
    handler: async (ctx, i) => {
      const r = await runTransition(ctx, "bid", i.bidId, event, {});
      return r.ok ? ok(await data(ctx, r.value.id, r.value.listingId)) : r;
    },
  };
}
export const withdrawBidDef = eventAction("bid.withdraw", "WITHDRAW");
export const acceptCounterDef = eventAction("bid.acceptCounter", "ACCEPT_COUNTER");
export const declineCounterDef = eventAction("bid.declineCounter", "DECLINE_COUNTER");
export const submit = defineAction(submitBidDef);
export const amend = defineAction(amendBidDef);
export const withdraw = defineAction(withdrawBidDef);
export const acceptCounter = defineAction(acceptCounterDef);
export const declineCounter = defineAction(declineCounterDef);
