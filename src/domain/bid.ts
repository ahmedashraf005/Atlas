import {
  BID_VALIDITY_DAYS_AFTER_WINDOW,
  COUNTER_RESPONSE_HOURS,
  MAX_COUNTERS_PER_LISTING,
  MAX_RATIONALE_LENGTH,
} from "@/domain/constants";
import { notify } from "@/domain/effects";
import {
  bidWindowClosed,
  type DomainError,
  duplicateBid,
  policyBlocked,
  selfDealing,
  validation,
} from "@/domain/errors";
import { defineMachine } from "@/domain/machine";
import type { BuyerPolicyResult } from "@/domain/policy";
import { err, ok, type Result } from "@/domain/result";
import type { Actor } from "@/domain/roles";
import { addDays, addHours } from "@/domain/time";
import type { Bid, BidStatus, BuyerProfile, Listing } from "@/domain/types";
import { formatShares } from "@/lib/format";
export interface BidInput {
  priceMinor: bigint;
  quantity: bigint;
  minFill: bigint;
  rationale: string;
}
export interface BidCtx {
  now: Date;
  listing: Listing;
  counterPriceMinor?: bigint;
  amendment?: BidInput;
  allocatedQty?: bigint;
  reason?: string;
}
const events = [
  "AMEND",
  "WITHDRAW",
  "COUNTER",
  "ACCEPT_COUNTER",
  "DECLINE_COUNTER",
  "COUNTER_EXPIRE",
  "ACCEPT",
  "KEEP_AS_BACKUP",
  "REJECT",
  "PROMOTE",
  "EXPIRE",
] as const;
export type BidEvent = (typeof events)[number];
export const windowOpen = (l: Listing, now: Date): boolean =>
  l.status === "Live" && l.windowClosesAt !== null && now < l.windowClosesAt;
export function bidFieldIssues(input: BidInput, l: Listing): NonNullable<DomainError["issues"]> {
  const issues = [];
  if (input.priceMinor <= 0n)
    issues.push({ field: "priceMinor", message: "Price must be greater than zero." });
  if (input.quantity < l.minFill)
    issues.push({
      field: "quantity",
      message: `Minimum for this listing is ${formatShares(l.minFill, "table")}.`,
    });
  if (input.quantity > l.quantity)
    issues.push({
      field: "quantity",
      message: `This listing offers ${formatShares(l.quantity, "table")}.`,
    });
  if (input.minFill < l.minFill)
    issues.push({
      field: "minFill",
      message: `Minimum for this listing is ${formatShares(l.minFill, "table")}.`,
    });
  if (input.minFill > input.quantity)
    issues.push({ field: "minFill", message: "Minimum fill can't exceed the bid quantity." });
  if (input.rationale.length > MAX_RATIONALE_LENGTH)
    issues.push({ field: "rationale", message: "Keep the rationale to 500 characters or fewer." });
  return issues;
}
const counterOpen = (b: Bid, c: BidCtx): true | string =>
  (b.counterExpiresAt !== null && c.now < b.counterExpiresAt) || "This counter has expired.";
const fillValid = (b: Bid, c: BidCtx): true | string =>
  (c.allocatedQty !== undefined && c.allocatedQty >= b.minFill && c.allocatedQty <= b.quantity) ||
  "Allocated quantity must be between the bid's minimum fill and quantity.";
export const bidMachine = defineMachine<BidStatus, BidEvent, Bid, BidCtx>({
  name: "bid",
  initial: "Submitted",
  states: ["Submitted", "Countered", "Backup", "Accepted", "Rejected", "Expired", "Withdrawn"],
  terminal: ["Accepted", "Rejected", "Expired", "Withdrawn"],
  events,
  rows: [
    {
      from: "Submitted",
      event: "AMEND",
      to: "Submitted",
      roles: ["buyer"],
      guard: (_, c) =>
        !windowOpen(c.listing, c.now)
          ? "Bids can only be changed while the window is open."
          : !c.amendment
            ? "Provide the amended bid values."
            : (bidFieldIssues(c.amendment, c.listing)[0]?.message ?? true),
      apply: (_, c) => ({ ...c.amendment, amendedAt: new Date(c.now.getTime()) }),
    },
    {
      from: "Submitted",
      event: "WITHDRAW",
      to: "Withdrawn",
      roles: ["buyer"],
      guard: (_, c) => windowOpen(c.listing, c.now) || "Bids are binding once the window closes.",
    },
    {
      from: "Submitted",
      event: "COUNTER",
      to: "Countered",
      roles: ["seller"],
      guard: (b, c) =>
        !["Closed", "Negotiating"].includes(c.listing.status)
          ? "Counters can only be sent after the bid window closes."
          : c.listing.countersSent >= MAX_COUNTERS_PER_LISTING
            ? "You can counter at most 3 bids."
            : (c.counterPriceMinor !== undefined && c.counterPriceMinor > b.priceMinor) ||
              "A counter must be above the bid.",
      apply: (_, c) => ({
        counterPriceMinor: c.counterPriceMinor ?? null,
        counterExpiresAt: addHours(c.now, COUNTER_RESPONSE_HOURS),
        counterOutcome: "pending",
      }),
      effects: (b) => [notify("bid", b.id, "buyer", "countered")],
    },
    {
      from: "Countered",
      event: "ACCEPT_COUNTER",
      to: "Submitted",
      roles: ["buyer"],
      guard: counterOpen,
      apply: (b) => ({
        priceMinor: b.counterPriceMinor ?? b.priceMinor,
        counterOutcome: "accepted",
      }),
      effects: (b) => [notify("bid", b.id, "seller", "counter_accepted")],
    },
    {
      from: "Countered",
      event: "DECLINE_COUNTER",
      to: "Submitted",
      roles: ["buyer"],
      guard: counterOpen,
      apply: () => ({ counterOutcome: "declined" }),
      effects: (b) => [notify("bid", b.id, "seller", "counter_declined")],
    },
    {
      from: "Countered",
      event: "COUNTER_EXPIRE",
      to: "Submitted",
      roles: ["system"],
      guard: (b, c) =>
        (b.counterExpiresAt !== null && c.now >= b.counterExpiresAt) ||
        "The counter hasn't expired.",
      apply: () => ({ counterOutcome: "lapsed" }),
      effects: (b) => [notify("bid", b.id, "seller", "counter_lapsed")],
    },
    {
      from: "Submitted",
      event: "ACCEPT",
      to: "Accepted",
      roles: ["seller", "system"],
      guard: fillValid,
      apply: (_, c) => ({ allocatedQty: c.allocatedQty ?? null }),
      effects: (b) => [notify("bid", b.id, "buyer", "bid_accepted")],
    },
    {
      from: "Submitted",
      event: "KEEP_AS_BACKUP",
      to: "Backup",
      roles: ["seller"],
      guard: (_, c) =>
        c.listing.status === "Allocated" || "Allocate the listing before choosing a backup.",
      effects: (b) => [notify("bid", b.id, "buyer", "bid_backup")],
    },
    {
      from: ["Submitted", "Countered", "Backup"],
      event: "REJECT",
      to: "Rejected",
      roles: ["seller", "system"],
      guard: (_, c) => (c.reason?.trim() ? true : "Give a reason for rejecting this bid."),
      apply: (_, c) => ({ rejectionReason: c.reason?.trim() ?? null }),
      effects: (b) => [notify("bid", b.id, "buyer", "bid_rejected")],
    },
    {
      from: "Backup",
      event: "PROMOTE",
      to: "Accepted",
      roles: ["seller", "system"],
      guard: fillValid,
      apply: (_, c) => ({ allocatedQty: c.allocatedQty ?? null }),
      effects: (b) => [notify("bid", b.id, "buyer", "bid_accepted")],
    },
    {
      from: ["Submitted", "Backup"],
      event: "EXPIRE",
      to: "Expired",
      roles: ["system"],
      guard: (b, c) => c.now >= b.expiresAt || "The bid hasn't expired.",
    },
  ],
});
export function createBid(
  input: BidInput,
  ctx: {
    id: string;
    now: Date;
    actor: Actor;
    listing: Listing;
    buyer: BuyerProfile;
    buyerPolicy: BuyerPolicyResult;
    relatedParty: boolean;
    existingActiveBidId: string | null;
    idempotencyKey: string;
  },
): Result<Bid> {
  if (!windowOpen(ctx.listing, ctx.now)) return err(bidWindowClosed());
  if (ctx.actor.userId === ctx.listing.sellerId || ctx.relatedParty) return err(selfDealing());
  if (!ctx.buyerPolicy.ok) return err(policyBlocked(ctx.buyerPolicy.failures));
  if (ctx.existingActiveBidId !== null) return err(duplicateBid());
  const issues = bidFieldIssues(input, ctx.listing);
  if (issues.length) return err(validation(issues));
  const closes = ctx.listing.windowClosesAt;
  if (!closes) return err(bidWindowClosed());
  return ok({
    ...input,
    id: ctx.id,
    sandboxId: ctx.listing.sandboxId,
    listingId: ctx.listing.id,
    buyerId: ctx.actor.userId,
    buyerOrgId: ctx.buyer.orgId,
    submittedAt: new Date(ctx.now.getTime()),
    amendedAt: null,
    expiresAt: addDays(closes, BID_VALIDITY_DAYS_AFTER_WINDOW),
    counterPriceMinor: null,
    counterExpiresAt: null,
    counterOutcome: null,
    allocatedQty: null,
    rejectionReason: null,
    idempotencyKey: ctx.idempotencyKey,
    status: "Submitted",
    version: 1,
  });
}
