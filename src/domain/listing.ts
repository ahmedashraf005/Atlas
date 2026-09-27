import type { AllocationResult } from "@/domain/allocation";
import {
  BID_WINDOW_DAY_OPTIONS,
  DECISION_DAYS_AFTER_WINDOW,
  MAX_COUNTERS_PER_LISTING,
} from "@/domain/constants";
import { type Effect, notify } from "@/domain/effects";
import { validation } from "@/domain/errors";
import { defineMachine } from "@/domain/machine";
import type { ListingPolicyResult } from "@/domain/policy";
import { err, ok, type Result } from "@/domain/result";
import type { Actor } from "@/domain/roles";
import { addDays } from "@/domain/time";
import type { Holding, Listing, ListingStatus } from "@/domain/types";
import type { Currency } from "@/lib/format";
export interface ListingCtx {
  now: Date;
  policyResult?: ListingPolicyResult;
  allocation?: AllocationResult;
  allTradesTerminal?: boolean;
  reason?: string;
}
const events = [
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "WITHDRAW",
  "CLOSE_WINDOW",
  "COUNTER_SENT",
  "ALLOCATE",
  "DECLINE_ALL",
  "EXPIRE",
  "COMPLETE",
] as const;
export type ListingEvent = (typeof events)[number];
export const decisionDeadline = (l: Listing): Date | null =>
  l.windowClosesAt ? addDays(l.windowClosesAt, DECISION_DAYS_AFTER_WINDOW) : null;
const decisionOpen = (l: Listing, c: ListingCtx) => {
  const d = decisionDeadline(l);
  return d !== null && c.now < d;
};
export const listingMachine = defineMachine<ListingStatus, ListingEvent, Listing, ListingCtx>({
  name: "listing",
  initial: "Draft",
  states: [
    "Draft",
    "InReview",
    "Rejected",
    "Live",
    "Withdrawn",
    "Closed",
    "Negotiating",
    "Allocated",
    "Expired",
    "Completed",
  ],
  terminal: ["Rejected", "Withdrawn", "Expired", "Completed"],
  events,
  rows: [
    {
      from: "Draft",
      event: "SUBMIT",
      to: "InReview",
      roles: ["seller"],
      guard: (_, c) =>
        c.policyResult?.ok === true || "This listing doesn't meet the company's transfer policy.",
      effects: (l) => [
        { type: "RESERVE_SHARES", holdingId: l.holdingId, qty: l.quantity },
        notify("listing", l.id, "operator", "listing_review_requested"),
      ],
    },
    {
      from: "InReview",
      event: "APPROVE",
      to: "Live",
      roles: ["operator"],
      apply: (l, c) => ({
        windowOpensAt: new Date(c.now.getTime()),
        windowClosesAt: addDays(c.now, l.windowDays),
      }),
      effects: (l) => [notify("listing", l.id, "seller", "listing_live")],
    },
    {
      from: "InReview",
      event: "REJECT",
      to: "Rejected",
      roles: ["operator"],
      guard: (_, c) => (c.reason?.trim() ? true : "Give a reason for rejecting this listing."),
      apply: (_, c) => ({ rejectionReason: c.reason?.trim() ?? null }),
      effects: (l) => [
        { type: "RELEASE_SHARES", holdingId: l.holdingId, qty: l.quantity },
        notify("listing", l.id, "seller", "listing_rejected"),
      ],
    },
    {
      from: ["Draft", "InReview", "Live"],
      event: "WITHDRAW",
      to: "Withdrawn",
      roles: ["seller"],
      effects: (l) => [
        ...(l.status === "Draft"
          ? []
          : [{ type: "RELEASE_SHARES" as const, holdingId: l.holdingId, qty: l.quantity }]),
        { type: "REJECT_ACTIVE_BIDS", listingId: l.id, reason: "Listing withdrawn by the seller" },
      ],
    },
    {
      from: "Live",
      event: "CLOSE_WINDOW",
      to: "Closed",
      roles: ["system"],
      guard: (l, c) =>
        (l.windowClosesAt !== null && c.now >= l.windowClosesAt) || "The bid window is still open.",
      effects: (l) => [notify("listing", l.id, "seller", "window_closed")],
    },
    {
      from: ["Closed", "Negotiating"],
      event: "COUNTER_SENT",
      to: "Negotiating",
      roles: ["seller"],
      guard: (l, c) =>
        l.countersSent >= MAX_COUNTERS_PER_LISTING
          ? "You can counter at most 3 bids."
          : decisionOpen(l, c) || "The decision period has ended.",
      apply: (l) => ({ countersSent: l.countersSent + 1 }),
    },
    {
      from: ["Closed", "Negotiating"],
      event: "ALLOCATE",
      to: "Allocated",
      roles: ["seller"],
      guard: (l, c) =>
        !c.allocation || c.allocation.allocatedQty <= 0n
          ? "Accept at least one bid."
          : decisionOpen(l, c) || "The decision period has ended.",
      effects: (l, _, c) => {
        const a = c.allocation;
        if (!a) return [];
        const effects: Effect[] = [
          { type: "CREATE_TRADES", listingId: l.id, allocations: a.allocations },
        ];
        if (l.quantity > a.allocatedQty)
          effects.push({
            type: "RELEASE_SHARES",
            holdingId: l.holdingId,
            qty: l.quantity - a.allocatedQty,
          });
        return effects;
      },
    },
    {
      from: ["Closed", "Negotiating"],
      event: "DECLINE_ALL",
      to: "Expired",
      roles: ["seller"],
      effects: (l) => [
        { type: "RELEASE_SHARES", holdingId: l.holdingId, qty: l.quantity },
        { type: "REJECT_ACTIVE_BIDS", listingId: l.id, reason: "The seller declined all bids" },
      ],
    },
    {
      from: ["Closed", "Negotiating"],
      event: "EXPIRE",
      to: "Expired",
      roles: ["system"],
      guard: (l, c) => {
        const d = decisionDeadline(l);
        return (d !== null && c.now >= d) || "The decision period hasn't ended.";
      },
      effects: (l) => [
        { type: "RELEASE_SHARES", holdingId: l.holdingId, qty: l.quantity },
        {
          type: "REJECT_ACTIVE_BIDS",
          listingId: l.id,
          reason: "The seller did not accept a bid in time",
        },
        notify("listing", l.id, "seller", "listing_expired"),
      ],
    },
    {
      from: "Allocated",
      event: "COMPLETE",
      to: "Completed",
      roles: ["system"],
      guard: (_, c) => c.allTradesTerminal === true || "Trades are still in progress.",
    },
  ],
});
export function createListing(
  input: {
    holding: Holding;
    quantity: bigint;
    minFill: bigint;
    reservePriceMinor: bigint;
    windowDays: 3 | 5 | 7;
    currency: Currency;
  },
  ctx: { id: string; now: Date; actor: Actor },
): Result<Listing> {
  const issues = [];
  if (input.quantity <= 0n)
    issues.push({ field: "quantity", message: "Share quantity must be greater than zero." });
  if (input.minFill < 1n || input.minFill > input.quantity)
    issues.push({
      field: "minFill",
      message: "Minimum fill must be between one share and the listing quantity.",
    });
  if (input.reservePriceMinor <= 0n)
    issues.push({
      field: "reservePriceMinor",
      message: "Reserve price must be greater than zero.",
    });
  if (!BID_WINDOW_DAY_OPTIONS.includes(input.windowDays))
    issues.push({ field: "windowDays", message: "Choose a bid window of 3, 5, or 7 days." });
  if (input.holding.ownerId !== ctx.actor.userId)
    issues.push({ field: "holding", message: "You can only list your own holding." });
  if (input.holding.status !== "Verified")
    issues.push({ field: "holding", message: "The company hasn't verified this holding yet." });
  if (issues.length) return err(validation(issues));
  return ok({
    id: ctx.id,
    sandboxId: input.holding.sandboxId,
    holdingId: input.holding.id,
    sellerId: input.holding.ownerId,
    companyId: input.holding.companyId,
    shareClassId: input.holding.shareClassId,
    currency: input.currency,
    quantity: input.quantity,
    minFill: input.minFill,
    reservePriceMinor: input.reservePriceMinor,
    windowDays: input.windowDays,
    windowOpensAt: null,
    windowClosesAt: null,
    countersSent: 0,
    status: "Draft",
    rejectionReason: null,
    createdAt: new Date(ctx.now.getTime()),
    version: 1,
  });
}
