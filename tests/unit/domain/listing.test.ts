import { expect, it } from "vitest";
import { allocate } from "@/domain/allocation";
import {
  createListing,
  decisionDeadline,
  type ListingCtx,
  type ListingEvent,
  listingMachine,
} from "@/domain/listing";
import { transition } from "@/domain/machine";
import { addDays } from "@/domain/time";
import type { Listing, ListingStatus } from "@/domain/types";
import {
  actor,
  deepFreeze,
  type MachineCase,
  machineContract,
  makeBid,
  makeHolding,
  makeListing,
  N,
  NOW,
  unwrap,
} from "./helpers/fixtures";

const policyResult = { ok: true, maxSellable: 10000n, failures: [], nextEligibleAt: null },
  allocation = allocate(3000n, [makeBid()]),
  end = addDays(NOW, 7);
const cases: MachineCase<ListingStatus, ListingEvent, Listing, ListingCtx>[] = [
  {
    from: "Draft",
    event: "SUBMIT",
    to: "InReview",
    roles: ["seller"],
    ctx: { now: NOW, policyResult },
    effects: [
      { type: "RESERVE_SHARES", holdingId: "holding", qty: 5000n },
      N("listing", "listing", "operator", "listing_review_requested"),
    ],
  },
  {
    from: "InReview",
    event: "APPROVE",
    to: "Live",
    roles: ["operator"],
    ctx: { now: NOW },
    patch: { windowOpensAt: NOW, windowClosesAt: addDays(NOW, 5) },
    effects: [N("listing", "listing", "seller", "listing_live")],
  },
  {
    from: "InReview",
    event: "REJECT",
    to: "Rejected",
    roles: ["operator"],
    ctx: { now: NOW, reason: "Incomplete evidence." },
    patch: { rejectionReason: "Incomplete evidence." },
    effects: [
      { type: "RELEASE_SHARES", holdingId: "holding", qty: 5000n },
      N("listing", "listing", "seller", "listing_rejected"),
    ],
  },
  ...(["Draft", "InReview", "Live"] as const).map((from) => ({
    from,
    event: "WITHDRAW" as const,
    to: "Withdrawn" as const,
    roles: ["seller" as const],
    ctx: { now: NOW },
    effects: [
      ...(from === "Draft"
        ? []
        : [{ type: "RELEASE_SHARES" as const, holdingId: "holding", qty: 5000n }]),
      {
        type: "REJECT_ACTIVE_BIDS" as const,
        listingId: "listing",
        reason: "Listing withdrawn by the seller",
      },
    ],
  })),
  {
    from: "Live",
    event: "CLOSE_WINDOW",
    to: "Closed",
    roles: ["system"],
    ctx: { now: NOW },
    effects: [N("listing", "listing", "seller", "window_closed")],
  },
  ...(["Closed", "Negotiating"] as const).flatMap((from) => [
    {
      from,
      event: "COUNTER_SENT" as const,
      to: "Negotiating" as const,
      roles: ["seller" as const],
      ctx: { now: NOW },
      patch: { countersSent: 1 },
    },
    {
      from,
      event: "ALLOCATE" as const,
      to: "Allocated" as const,
      roles: ["seller" as const],
      ctx: { now: NOW, allocation },
      effects: [
        {
          type: "CREATE_TRADES" as const,
          listingId: "listing",
          allocations: allocation.allocations,
        },
        { type: "RELEASE_SHARES" as const, holdingId: "holding", qty: 2000n },
      ],
    },
    {
      from,
      event: "DECLINE_ALL" as const,
      to: "Expired" as const,
      roles: ["seller" as const],
      ctx: { now: NOW },
      effects: [
        { type: "RELEASE_SHARES" as const, holdingId: "holding", qty: 5000n },
        {
          type: "REJECT_ACTIVE_BIDS" as const,
          listingId: "listing",
          reason: "The seller declined all bids",
        },
      ],
    },
    {
      from,
      event: "EXPIRE" as const,
      to: "Expired" as const,
      roles: ["system" as const],
      ctx: { now: end },
      effects: [
        { type: "RELEASE_SHARES" as const, holdingId: "holding", qty: 5000n },
        {
          type: "REJECT_ACTIVE_BIDS" as const,
          listingId: "listing",
          reason: "The seller did not accept a bid in time",
        },
        N("listing", "listing", "seller", "listing_expired"),
      ],
    },
  ]),
  {
    from: "Allocated",
    event: "COMPLETE",
    to: "Completed",
    roles: ["system"],
    ctx: { now: NOW, allTradesTerminal: true },
  },
];
machineContract(listingMachine, makeListing, cases, { now: NOW });
it.each([
  ["Draft", "SUBMIT", "seller", {}, "This listing doesn't meet the company's transfer policy."],
  [
    "Draft",
    "SUBMIT",
    "seller",
    { policyResult: { ...policyResult, ok: false } },
    "This listing doesn't meet the company's transfer policy.",
  ],
  ["InReview", "REJECT", "operator", { reason: "  " }, "Give a reason for rejecting this listing."],
  ["Live", "CLOSE_WINDOW", "system", { now: addDays(NOW, -1) }, "The bid window is still open."],
  ["Closed", "COUNTER_SENT", "seller", { now: end }, "The decision period has ended."],
  ["Closed", "ALLOCATE", "seller", {}, "Accept at least one bid."],
  ["Closed", "ALLOCATE", "seller", { allocation: allocate(0n, []) }, "Accept at least one bid."],
  ["Closed", "ALLOCATE", "seller", { allocation, now: end }, "The decision period has ended."],
  ["Closed", "EXPIRE", "system", {}, "The decision period hasn't ended."],
  ["Allocated", "COMPLETE", "system", {}, "Trades are still in progress."],
  [
    "Allocated",
    "COMPLETE",
    "system",
    { allTradesTerminal: false },
    "Trades are still in progress.",
  ],
] as const)("guard %s %s", (status, event, role, ctx, message) =>
  expect(
    transition(listingMachine, deepFreeze(makeListing({ status })), event, actor(role), {
      now: NOW,
      ...ctx,
    }),
  ).toEqual({ ok: false, error: { code: "GUARD_FAILED", message } }));
it("enforces counter budget and null deadlines, and releases no surplus on exact allocation", () => {
  expect(
    transition(
      listingMachine,
      deepFreeze(makeListing({ countersSent: 3 })),
      "COUNTER_SENT",
      actor("seller"),
      { now: NOW },
    ),
  ).toMatchObject({ ok: false, error: { message: "You can counter at most 3 bids." } });
  for (const [event, role] of [
    ["COUNTER_SENT", "seller"],
    ["EXPIRE", "system"],
    ["CLOSE_WINDOW", "system"],
  ] as const)
    expect(
      transition(
        listingMachine,
        deepFreeze(
          makeListing({
            status: event === "CLOSE_WINDOW" ? "Live" : "Closed",
            windowClosesAt: null,
          }),
        ),
        event,
        actor(role),
        { now: NOW },
      ),
    ).toMatchObject({ ok: false, error: { code: "GUARD_FAILED" } });
  expect(decisionDeadline(makeListing({ windowClosesAt: null }))).toBeNull();
  expect(decisionDeadline(makeListing())).toEqual(end);
  const exact = allocate(5000n, [makeBid({ quantity: 5000n })]);
  expect(
    unwrap(
      transition(listingMachine, deepFreeze(makeListing()), "ALLOCATE", actor("seller"), {
        now: NOW,
        allocation: exact,
      }),
    ).effects,
  ).toEqual([
    {
      type: "AUDIT",
      entity: "listing",
      entityId: "listing",
      action: "listing.ALLOCATE",
      from: "Closed",
      to: "Allocated",
    },
    { type: "CREATE_TRADES", listingId: "listing", allocations: exact.allocations },
  ]);
});
it("validates every creation field without reserving or running policy", () => {
  const input = {
      holding: makeHolding(),
      quantity: 5000n,
      minFill: 1000n,
      reservePriceMinor: 3500n,
      windowDays: 5 as const,
      currency: "AED" as const,
    },
    ctx = { id: "new", now: NOW, actor: actor("seller") };
  expect(unwrap(createListing(input, ctx))).toMatchObject({
    id: "new",
    status: "Draft",
    version: 1,
    countersSent: 0,
    windowOpensAt: null,
    windowClosesAt: null,
  });
  expect(input.holding.reservedQty).toBe(0n);
  const r = createListing(
    {
      ...input,
      holding: makeHolding({ ownerId: "other", status: "Unverified" }),
      quantity: 0n,
      minFill: 0n,
      reservePriceMinor: 0n,
      windowDays: 4 as 5,
    },
    ctx,
  );
  expect(r).toMatchObject({
    ok: false,
    error: {
      code: "VALIDATION",
      issues: [
        { field: "quantity" },
        { field: "minFill" },
        { field: "reservePriceMinor" },
        { field: "windowDays" },
        { field: "holding" },
        { field: "holding" },
      ],
    },
  });
  expect(createListing({ ...input, minFill: 5001n }, ctx)).toMatchObject({
    ok: false,
    error: { issues: [{ field: "minFill" }] },
  });
});
