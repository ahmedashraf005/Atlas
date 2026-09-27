import { expect, it } from "vitest";
import {
  type BidCtx,
  type BidEvent,
  type BidInput,
  bidMachine,
  createBid,
  windowOpen,
} from "@/domain/bid";
import { transition } from "@/domain/machine";
import { addDays, addHours } from "@/domain/time";
import type { Bid, BidStatus } from "@/domain/types";
import {
  actor,
  deepFreeze,
  type MachineCase,
  machineContract,
  makeBid,
  makeBuyer,
  makeListing,
  N,
  NOW,
  unwrap,
} from "./helpers/fixtures";

const live = makeListing({ status: "Live", windowClosesAt: addDays(NOW, 1) }),
  closed = makeListing(),
  amendment = { priceMinor: 3600n, quantity: 2000n, minFill: 1000n, rationale: "Updated." },
  counterEnd = addHours(NOW, 48);
const cases: MachineCase<BidStatus, BidEvent, Bid, BidCtx>[] = [
  {
    from: "Submitted",
    event: "AMEND",
    to: "Submitted",
    roles: ["buyer"],
    ctx: { now: NOW, listing: live, amendment },
    patch: { ...amendment, amendedAt: NOW },
  },
  {
    from: "Submitted",
    event: "WITHDRAW",
    to: "Withdrawn",
    roles: ["buyer"],
    ctx: { now: NOW, listing: live },
  },
  {
    from: "Submitted",
    event: "COUNTER",
    to: "Countered",
    roles: ["seller"],
    ctx: { now: NOW, listing: closed, counterPriceMinor: 3600n },
    patch: { counterPriceMinor: 3600n, counterExpiresAt: counterEnd, counterOutcome: "pending" },
    effects: [N("bid", "bid", "buyer", "countered")],
  },
  {
    from: "Countered",
    event: "ACCEPT_COUNTER",
    to: "Submitted",
    roles: ["buyer"],
    entity: { counterPriceMinor: 3600n, counterExpiresAt: counterEnd, counterOutcome: "pending" },
    ctx: { now: NOW, listing: closed },
    patch: { priceMinor: 3600n, counterOutcome: "accepted" },
    effects: [N("bid", "bid", "seller", "counter_accepted")],
  },
  {
    from: "Countered",
    event: "DECLINE_COUNTER",
    to: "Submitted",
    roles: ["buyer"],
    entity: { counterPriceMinor: 3600n, counterExpiresAt: counterEnd, counterOutcome: "pending" },
    ctx: { now: NOW, listing: closed },
    patch: { counterOutcome: "declined" },
    effects: [N("bid", "bid", "seller", "counter_declined")],
  },
  {
    from: "Countered",
    event: "COUNTER_EXPIRE",
    to: "Submitted",
    roles: ["system"],
    entity: { counterExpiresAt: NOW, counterOutcome: "pending" },
    ctx: { now: NOW, listing: closed },
    patch: { counterOutcome: "lapsed" },
    effects: [N("bid", "bid", "seller", "counter_lapsed")],
  },
  {
    from: "Submitted",
    event: "ACCEPT",
    to: "Accepted",
    roles: ["seller", "system"],
    ctx: { now: NOW, listing: closed, allocatedQty: 2000n },
    patch: { allocatedQty: 2000n },
    effects: [N("bid", "bid", "buyer", "bid_accepted")],
  },
  {
    from: "Submitted",
    event: "KEEP_AS_BACKUP",
    to: "Backup",
    roles: ["seller"],
    ctx: { now: NOW, listing: makeListing({ status: "Allocated" }) },
    effects: [N("bid", "bid", "buyer", "bid_backup")],
  },
  ...(["Submitted", "Countered", "Backup"] as const).map((from) => ({
    from,
    event: "REJECT" as const,
    to: "Rejected" as const,
    roles: ["seller" as const, "system" as const],
    ctx: { now: NOW, listing: closed, reason: "Not selected." },
    patch: { rejectionReason: "Not selected." },
    effects: [N("bid", "bid", "buyer", "bid_rejected")],
  })),
  {
    from: "Backup",
    event: "PROMOTE",
    to: "Accepted",
    roles: ["seller", "system"],
    ctx: { now: NOW, listing: closed, allocatedQty: 1000n },
    patch: { allocatedQty: 1000n },
    effects: [N("bid", "bid", "buyer", "bid_accepted")],
  },
  ...(["Submitted", "Backup"] as const).map((from) => ({
    from,
    event: "EXPIRE" as const,
    to: "Expired" as const,
    roles: ["system" as const],
    entity: { expiresAt: NOW },
    ctx: { now: NOW, listing: closed },
  })),
];
machineContract(bidMachine, makeBid, cases, { now: NOW, listing: closed });
it.each([
  [
    "Submitted",
    "AMEND",
    "buyer",
    { listing: closed, amendment },
    "Bids can only be changed while the window is open.",
  ],
  ["Submitted", "AMEND", "buyer", { listing: live }, "Provide the amended bid values."],
  [
    "Submitted",
    "AMEND",
    "buyer",
    { listing: live, amendment: { ...amendment, priceMinor: 0n } },
    "Price must be greater than zero.",
  ],
  [
    "Submitted",
    "WITHDRAW",
    "buyer",
    { listing: closed },
    "Bids are binding once the window closes.",
  ],
  [
    "Submitted",
    "COUNTER",
    "seller",
    { listing: live, counterPriceMinor: 3600n },
    "Counters can only be sent after the bid window closes.",
  ],
  [
    "Submitted",
    "COUNTER",
    "seller",
    { listing: makeListing({ countersSent: 3 }), counterPriceMinor: 3600n },
    "You can counter at most 3 bids.",
  ],
  ["Submitted", "COUNTER", "seller", {}, "A counter must be above the bid."],
  [
    "Submitted",
    "COUNTER",
    "seller",
    { counterPriceMinor: 3500n },
    "A counter must be above the bid.",
  ],
  [
    "Submitted",
    "COUNTER",
    "seller",
    { counterPriceMinor: 3400n },
    "A counter must be above the bid.",
  ],
  ["Submitted", "KEEP_AS_BACKUP", "seller", {}, "Allocate the listing before choosing a backup."],
  ["Submitted", "REJECT", "seller", { reason: "  " }, "Give a reason for rejecting this bid."],
  ["Submitted", "EXPIRE", "system", {}, "The bid hasn't expired."],
] as const)("guard %s %s", (status, event, role, ctx, message) =>
  expect(
    transition(bidMachine, deepFreeze(makeBid({ status })), event, actor(role), {
      now: NOW,
      listing: closed,
      ...ctx,
    }),
  ).toEqual({ ok: false, error: { code: "GUARD_FAILED", message } }));
it("checks counter deadlines and allocated quantities at every edge", () => {
  for (const event of ["ACCEPT_COUNTER", "DECLINE_COUNTER"] as const)
    for (const counterExpiresAt of [null, NOW])
      expect(
        transition(
          bidMachine,
          deepFreeze(makeBid({ status: "Countered", counterExpiresAt })),
          event,
          actor("buyer"),
          { now: NOW, listing: closed },
        ),
      ).toMatchObject({ ok: false, error: { message: "This counter has expired." } });
  for (const counterExpiresAt of [null, counterEnd])
    expect(
      transition(
        bidMachine,
        deepFreeze(makeBid({ status: "Countered", counterExpiresAt })),
        "COUNTER_EXPIRE",
        actor("system"),
        { now: NOW, listing: closed },
      ),
    ).toMatchObject({ ok: false, error: { message: "The counter hasn't expired." } });
  for (const [status, event] of [
    ["Submitted", "ACCEPT"],
    ["Backup", "PROMOTE"],
  ] as const)
    for (const allocatedQty of [undefined, 999n, 3001n])
      expect(
        transition(bidMachine, deepFreeze(makeBid({ status })), event, actor("seller"), {
          now: NOW,
          listing: closed,
          allocatedQty,
        }),
      ).toMatchObject({
        ok: false,
        error: {
          message: "Allocated quantity must be between the bid's minimum fill and quantity.",
        },
      });
  for (const allocatedQty of [1000n, 3000n])
    expect(
      transition(bidMachine, deepFreeze(makeBid()), "ACCEPT", actor("seller"), {
        now: NOW,
        listing: closed,
        allocatedQty,
      }).ok,
    ).toBe(true);
  expect(windowOpen(live, NOW)).toBe(true);
  expect(windowOpen({ ...live, windowClosesAt: null }, NOW)).toBe(false);
  expect(windowOpen(live, live.windowClosesAt as Date)).toBe(false);
});
const input: BidInput = {
  priceMinor: 3500n,
  quantity: 3000n,
  minFill: 1000n,
  rationale: "Long-term.",
};
const context = () => ({
  id: "new",
  now: NOW,
  actor: actor("buyer"),
  listing: live,
  buyer: makeBuyer(),
  buyerPolicy: { ok: true, failures: [] },
  relatedParty: false,
  existingActiveBidId: null as string | null,
  idempotencyKey: "key",
});
it("creates a bid with fourteen days of post-window validity and null counter fields", () => {
  const c = context(),
    b = unwrap(createBid(input, c));
  expect(b).toEqual({
    ...input,
    id: "new",
    sandboxId: "sandbox",
    listingId: "listing",
    buyerId: "buyer",
    buyerOrgId: "buyer-org",
    submittedAt: NOW,
    amendedAt: null,
    expiresAt: addDays(live.windowClosesAt as Date, 14),
    counterPriceMinor: null,
    counterExpiresAt: null,
    counterOutcome: null,
    allocatedQty: null,
    rejectionReason: null,
    idempotencyKey: "key",
    status: "Submitted",
    version: 1,
  });
});
it("enforces the exact failure order with multiple simultaneous failures", () => {
  const c = context(),
    bad = { ...input, priceMinor: 0n },
    policy = {
      ok: false,
      failures: [{ code: "KYC_INCOMPLETE" as const, message: "Complete KYC." }],
    };
  expect(
    createBid(bad, {
      ...c,
      listing: closed,
      relatedParty: true,
      buyerPolicy: policy,
      existingActiveBidId: "existing",
    }),
  ).toMatchObject({ ok: false, error: { code: "BID_WINDOW_CLOSED" } });
  expect(
    createBid(bad, {
      ...c,
      relatedParty: true,
      buyerPolicy: policy,
      existingActiveBidId: "existing",
    }),
  ).toMatchObject({ ok: false, error: { code: "SELF_DEALING" } });
  expect(createBid(bad, { ...c, actor: actor("seller"), buyerPolicy: policy })).toMatchObject({
    ok: false,
    error: { code: "SELF_DEALING" },
  });
  expect(
    createBid(bad, { ...c, buyerPolicy: policy, existingActiveBidId: "existing" }),
  ).toMatchObject({ ok: false, error: { code: "POLICY_BLOCKED", failures: policy.failures } });
  expect(createBid(bad, { ...c, existingActiveBidId: "existing" })).toMatchObject({
    ok: false,
    error: { code: "DUPLICATE_BID" },
  });
  expect(createBid(bad, c)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
});
it("collects every field issue and accepts exact field boundaries", () => {
  const c = context();
  expect(
    createBid({ priceMinor: 0n, quantity: 999n, minFill: 0n, rationale: "x".repeat(501) }, c),
  ).toMatchObject({
    ok: false,
    error: {
      issues: [
        { field: "priceMinor" },
        { field: "quantity", message: "Minimum for this listing is 1,000 sh." },
        { field: "minFill", message: "Minimum for this listing is 1,000 sh." },
        { field: "rationale" },
      ],
    },
  });
  expect(createBid({ ...input, quantity: 5001n, minFill: 5002n }, c)).toMatchObject({
    ok: false,
    error: { issues: [{ field: "quantity" }, { field: "minFill" }] },
  });
  expect(
    createBid({ ...input, quantity: 1000n, minFill: 1000n, rationale: "x".repeat(500) }, c).ok,
  ).toBe(true);
});
