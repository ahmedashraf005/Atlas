import type { AllocationResult } from "@/domain/allocation";
import { rankBids } from "@/domain/allocation";
import { MAX_DISPUTE_REASON_LENGTH } from "@/domain/constants";
import { type Effect, notify } from "@/domain/effects";
import { defineMachine } from "@/domain/machine";
import type { Actor } from "@/domain/roles";
import { addDays } from "@/domain/time";
import type { Bid, Listing, Trade, TradeStatus, TransferPolicy } from "@/domain/types";
export interface TradeCtx {
  now: Date;
  policy: TransferPolicy;
  reason?: string /** Supplied and overwritten by the transition engine. */;
  actor?: Actor;
}
const events = [
  "SELLER_SIGN",
  "BUYER_SIGN",
  "WAIVE",
  "LAPSE",
  "EXERCISE",
  "REFUSE",
  "MARK_WIRE_SENT",
  "CONFIRM_FUNDS",
  "BUYER_DEFAULT",
  "UPLOAD_REGISTER",
  "APPROVE_RELEASE",
  "RAISE_DISPUTE",
  "RESOLVE_CONTINUE",
  "RESOLVE_CANCEL",
  "CANCEL_BY_OPERATOR",
] as const;
export type TradeEvent = (typeof events)[number];
const notices = (t: Trade, template: string): Effect[] => [
  notify("trade", t.id, "seller", template),
  notify("trade", t.id, "buyer", template),
];
const backup = (t: Trade): Effect => ({
  type: "BACKUP_OR_RELEASE",
  listingId: t.listingId,
  holdingId: t.holdingId,
  qty: t.quantity,
  backupBidId: t.backupBidId,
});
const release = (t: Trade): Effect => ({
  type: "RELEASE_SHARES",
  holdingId: t.holdingId,
  qty: t.quantity,
});
const rofrOpen = (t: Trade, c: TradeCtx): true | string =>
  (t.rofrDeadline !== null && c.now < t.rofrDeadline) || "The ROFR window has ended.";
const reasonGiven = (_: Trade, c: TradeCtx): true | string =>
  c.reason?.trim() ? true : "Give a reason for this action.";
const operatorId = (c: TradeCtx): string => {
  if (!c.actor) throw new Error("The transition engine must supply the actor.");
  return c.actor.userId;
};
export const tradeMachine = defineMachine<TradeStatus, TradeEvent, Trade, TradeCtx>({
  name: "trade",
  initial: "AwaitingDocs",
  states: [
    "AwaitingDocs",
    "RofrPending",
    "RofrExercised",
    "AwaitingFunds",
    "Funded",
    "TransferPending",
    "Settled",
    "Cancelled",
    "Disputed",
  ],
  terminal: ["Settled", "Cancelled", "RofrExercised"],
  events,
  rows: [
    {
      from: "AwaitingDocs",
      event: "SELLER_SIGN",
      to: "AwaitingDocs",
      roles: ["seller"],
      guard: (t) =>
        t.sellerSignedAt
          ? "You've already signed."
          : !t.buyerSignedAt || "The buyer has already signed.",
      apply: (_, c) => ({ sellerSignedAt: new Date(c.now.getTime()) }),
      effects: (t) => [notify("trade", t.id, "buyer", "counterparty_signed")],
    },
    {
      from: "AwaitingDocs",
      event: "SELLER_SIGN",
      to: "RofrPending",
      roles: ["seller"],
      guard: (t) =>
        t.sellerSignedAt
          ? "You've already signed."
          : !!t.buyerSignedAt || "The buyer hasn't signed yet.",
      apply: (_, c) => ({
        sellerSignedAt: new Date(c.now.getTime()),
        rofrDeadline: addDays(c.now, c.policy.rofrDays),
      }),
      effects: (t) => [notify("trade", t.id, "company", "rofr_notice")],
    },
    {
      from: "AwaitingDocs",
      event: "BUYER_SIGN",
      to: "AwaitingDocs",
      roles: ["buyer"],
      guard: (t) =>
        t.buyerSignedAt
          ? "You've already signed."
          : !t.sellerSignedAt || "The seller has already signed.",
      apply: (_, c) => ({ buyerSignedAt: new Date(c.now.getTime()) }),
      effects: (t) => [notify("trade", t.id, "seller", "counterparty_signed")],
    },
    {
      from: "AwaitingDocs",
      event: "BUYER_SIGN",
      to: "RofrPending",
      roles: ["buyer"],
      guard: (t) =>
        t.buyerSignedAt
          ? "You've already signed."
          : !!t.sellerSignedAt || "The seller hasn't signed yet.",
      apply: (_, c) => ({
        buyerSignedAt: new Date(c.now.getTime()),
        rofrDeadline: addDays(c.now, c.policy.rofrDays),
      }),
      effects: (t) => [notify("trade", t.id, "company", "rofr_notice")],
    },
    {
      from: "RofrPending",
      event: "WAIVE",
      to: "AwaitingFunds",
      roles: ["company_admin"],
      guard: rofrOpen,
      apply: (_, c) => ({ fundingDeadline: addDays(c.now, c.policy.fundingDays) }),
      effects: (t) => [
        notify("trade", t.id, "buyer", "funds_due"),
        notify("trade", t.id, "seller", "rofr_waived"),
      ],
    },
    {
      from: "RofrPending",
      event: "LAPSE",
      to: "AwaitingFunds",
      roles: ["system"],
      guard: (t, c) =>
        (t.rofrDeadline !== null && c.now >= t.rofrDeadline) || "The ROFR window hasn't ended.",
      apply: (_, c) => ({ fundingDeadline: addDays(c.now, c.policy.fundingDays) }),
      effects: (t) => [
        notify("trade", t.id, "buyer", "funds_due"),
        notify("trade", t.id, "seller", "rofr_waived"),
      ],
    },
    {
      from: "RofrPending",
      event: "EXERCISE",
      to: "RofrExercised",
      roles: ["company_admin"],
      guard: rofrOpen,
      effects: (t) => [
        { type: "MARK_SHARES_SOLD", holdingId: t.holdingId, qty: t.quantity },
        notify("trade", t.id, "buyer", "rofr_exercised"),
        notify("trade", t.id, "seller", "rofr_exercised"),
      ],
    },
    {
      from: "RofrPending",
      event: "REFUSE",
      to: "Cancelled",
      roles: ["company_admin"],
      guard: reasonGiven,
      apply: () => ({ cancelReason: "company_refused" }),
      effects: (t) => [
        backup(t),
        notify("trade", t.id, "buyer", "trade_cancelled"),
        notify("trade", t.id, "seller", "trade_cancelled"),
      ],
    },
    {
      from: "AwaitingFunds",
      event: "MARK_WIRE_SENT",
      to: "AwaitingFunds",
      roles: ["buyer"],
      guard: (t) => t.wireSentAt === null || "You've already marked the wire as sent.",
      apply: (_, c) => ({ wireSentAt: new Date(c.now.getTime()) }),
      effects: (t) => [notify("trade", t.id, "operator", "wire_sent")],
    },
    {
      from: "AwaitingFunds",
      event: "CONFIRM_FUNDS",
      to: "Funded",
      roles: ["operator"],
      guard: (t) => t.wireSentAt !== null || "The buyer hasn't sent the wire yet.",
      apply: (_, c) => ({ fundedAt: new Date(c.now.getTime()) }),
      effects: (t) => [
        notify("trade", t.id, "company", "register_update_due"),
        notify("trade", t.id, "seller", "funds_confirmed"),
      ],
    },
    {
      from: "AwaitingFunds",
      event: "BUYER_DEFAULT",
      to: "Cancelled",
      roles: ["system"],
      guard: (t, c) =>
        (t.fundingDeadline !== null && c.now >= t.fundingDeadline) ||
        "The funding deadline hasn't passed.",
      apply: () => ({ cancelReason: "buyer_default" }),
      effects: (t) => [
        backup(t),
        notify("trade", t.id, "buyer", "trade_cancelled"),
        notify("trade", t.id, "seller", "trade_cancelled"),
      ],
    },
    {
      from: "Funded",
      event: "UPLOAD_REGISTER",
      to: "TransferPending",
      roles: ["company_admin"],
      apply: (_, c) => ({ registerUpdatedAt: new Date(c.now.getTime()) }),
      effects: (t) => [notify("trade", t.id, "operator", "release_due")],
    },
    {
      from: "TransferPending",
      event: "APPROVE_RELEASE",
      to: "TransferPending",
      roles: ["operator"],
      guard: (t) =>
        t.releaseApprovals.length === 0 || "A second operator must approve the release.",
      apply: (_, c) => ({ releaseApprovals: [operatorId(c)] }),
    },
    {
      from: "TransferPending",
      event: "APPROVE_RELEASE",
      to: "Settled",
      roles: ["operator"],
      guard: (t, c) =>
        (t.releaseApprovals.length === 1 && operatorId(c) !== t.releaseApprovals[0]) ||
        "A second operator must approve the release.",
      apply: (t, c) => ({
        releaseApprovals: [...t.releaseApprovals, operatorId(c)],
        settledAt: new Date(c.now.getTime()),
      }),
      effects: (t) => [
        { type: "MARK_SHARES_SOLD", holdingId: t.holdingId, qty: t.quantity },
        {
          type: "TRANSFER_TO_BUYER",
          tradeId: t.id,
          buyerId: t.buyerId,
          companyId: t.companyId,
          shareClassId: t.shareClassId,
          qty: t.quantity,
        },
        { type: "ESCROW_RELEASE", tradeId: t.id },
        ...notices(t, "settled"),
      ],
    },
    {
      from: ["Funded", "TransferPending"],
      event: "RAISE_DISPUTE",
      to: "Disputed",
      roles: ["seller", "buyer", "operator"],
      guard: (_, c) =>
        !c.reason?.trim()
          ? "Give a reason for the dispute."
          : c.reason.length <= MAX_DISPUTE_REASON_LENGTH ||
            "Keep the dispute reason to 1,000 characters or fewer.",
      apply: (t, c) => ({
        disputeReason: c.reason?.trim() ?? null,
        disputedFrom: t.status === "Funded" ? "Funded" : "TransferPending",
      }),
      effects: (t) => [notify("trade", t.id, "operator", "dispute_raised")],
    },
    {
      from: "Disputed",
      event: "RESOLVE_CONTINUE",
      to: "Funded",
      roles: ["operator"],
      guard: (t) => t.disputedFrom === "Funded" || "This dispute did not start in Funded.",
      apply: () => ({ disputeReason: null, disputedFrom: null }),
      effects: (t) => notices(t, "dispute_resolved"),
    },
    {
      from: "Disputed",
      event: "RESOLVE_CONTINUE",
      to: "TransferPending",
      roles: ["operator"],
      guard: (t) =>
        t.disputedFrom === "TransferPending" || "This dispute did not start in TransferPending.",
      apply: () => ({ disputeReason: null, disputedFrom: null }),
      effects: (t) => notices(t, "dispute_resolved"),
    },
    {
      from: "Disputed",
      event: "RESOLVE_CANCEL",
      to: "Cancelled",
      roles: ["operator"],
      guard: reasonGiven,
      apply: () => ({ cancelReason: "dispute_resolved" }),
      effects: (t) => [
        { type: "ESCROW_REFUND", tradeId: t.id },
        release(t),
        ...notices(t, "trade_cancelled"),
      ],
    },
    {
      from: ["AwaitingDocs", "RofrPending", "AwaitingFunds", "Funded", "TransferPending"],
      event: "CANCEL_BY_OPERATOR",
      to: "Cancelled",
      roles: ["operator"],
      guard: reasonGiven,
      apply: () => ({ cancelReason: "operator" }),
      effects: (t) => [
        ...(t.fundedAt ? [{ type: "ESCROW_REFUND" as const, tradeId: t.id }] : []),
        release(t),
        ...notices(t, "trade_cancelled"),
      ],
    },
  ],
});
export function createTradesFromAllocation(
  listing: Listing,
  allocation: AllocationResult,
  bidsById: ReadonlyMap<string, Bid>,
  ctx: {
    now: Date;
    newId: () => string;
    escrowRef: (tradeId: string) => string;
    backupBidId: string | null;
  },
): Trade[] {
  const selected = allocation.allocations.map((a) => {
    const b = bidsById.get(a.bidId);
    if (
      !b ||
      b.listingId !== listing.id ||
      b.sandboxId !== listing.sandboxId ||
      a.qty < b.minFill ||
      a.qty > b.quantity
    )
      throw new Error("Allocation must reference eligible bids from this listing.");
    return { allocation: a, bid: b };
  });
  const total = selected.reduce((n, a) => n + a.allocation.qty, 0n);
  if (
    total !== allocation.allocatedQty ||
    total > listing.quantity ||
    new Set(selected.map((a) => a.bid.id)).size !== selected.length
  )
    throw new Error("Allocation quantities must be consistent and unique.");
  // Only the lowest-priced allocation receives the backup. For ties, the last ranked bid is replaced.
  const ranked = rankBids(selected.map((a) => a.bid));
  const lowestId = ranked.at(-1)?.id;
  const ids = new Set<string>();
  return selected.map(({ allocation: a, bid: b }) => {
    const id = ctx.newId();
    if (ids.has(id)) throw new Error("Trade ids must be unique.");
    ids.add(id);
    return {
      id,
      sandboxId: listing.sandboxId,
      listingId: listing.id,
      bidId: b.id,
      holdingId: listing.holdingId,
      sellerId: listing.sellerId,
      buyerId: b.buyerId,
      companyId: listing.companyId,
      shareClassId: listing.shareClassId,
      currency: listing.currency,
      quantity: a.qty,
      priceMinor: b.priceMinor,
      sellerSignedAt: null,
      buyerSignedAt: null,
      rofrDeadline: null,
      fundingDeadline: null,
      wireSentAt: null,
      fundedAt: null,
      registerUpdatedAt: null,
      releaseApprovals: [],
      backupBidId: b.id === lowestId ? ctx.backupBidId : null,
      escrowRef: ctx.escrowRef(id),
      disputeReason: null,
      disputedFrom: null,
      cancelReason: null,
      settledAt: null,
      createdAt: new Date(ctx.now.getTime()),
      status: "AwaitingDocs",
      version: 1,
    };
  });
}
