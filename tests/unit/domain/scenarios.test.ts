import { expect, it } from "vitest";
import { allocate } from "@/domain/allocation";
import { bidMachine, createBid } from "@/domain/bid";
import { holdingMachine, markSharesSold, releaseShares, reserveShares } from "@/domain/holding";
import { createListing, listingMachine } from "@/domain/listing";
import { transition } from "@/domain/machine";
import { evaluateBuyer, evaluateListing } from "@/domain/policy";
import type { ActorRole } from "@/domain/roles";
import { addDays, addHours } from "@/domain/time";
import { createTradesFromAllocation, type TradeEvent, tradeMachine } from "@/domain/trade";
import {
  actor,
  deepFreeze,
  makeBuyer,
  makeHolding,
  makeListing,
  makePolicy,
  makeTrade,
  NOW,
  unwrap,
} from "./helpers/fixtures";

it("settles the full verified holding → counter → pay-as-bid trade with quantity effects", () => {
  const policy = makePolicy();
  let now = NOW;
  let holding = makeHolding({ status: "Unverified" });
  holding = unwrap(
    transition(holdingMachine, deepFreeze(holding), "SUBMIT_FOR_VERIFICATION", actor("seller"), {
      now,
    }),
  ).next;
  holding = unwrap(
    transition(holdingMachine, deepFreeze(holding), "VERIFY", actor("company_admin"), { now }),
  ).next;
  let listing = unwrap(
    createListing(
      {
        holding,
        quantity: 3000n,
        minFill: 1000n,
        reservePriceMinor: 3500n,
        windowDays: 5,
        currency: "AED",
      },
      { id: "listing", now, actor: actor("seller") },
    ),
  );
  const submitted = unwrap(
    transition(listingMachine, deepFreeze(listing), "SUBMIT", actor("seller"), {
      now,
      policyResult: evaluateListing({
        policy,
        holding,
        soldInLast12Months: 0n,
        quantity: 3000n,
        minFill: 1000n,
        now,
      }),
    }),
  );
  listing = submitted.next;
  for (const effect of submitted.effects)
    if (effect.type === "RESERVE_SHARES") holding = unwrap(reserveShares(holding, effect.qty));
  listing = unwrap(
    transition(listingMachine, deepFreeze(listing), "APPROVE", actor("operator"), { now }),
  ).next;
  now = addDays(now, 1);
  let bid = unwrap(
    createBid(
      { priceMinor: 3400n, quantity: 3000n, minFill: 1000n, rationale: "Long-term." },
      {
        id: "bid",
        now,
        actor: actor("buyer"),
        listing,
        buyer: makeBuyer(),
        buyerPolicy: evaluateBuyer({ policy, buyer: makeBuyer() }),
        relatedParty: false,
        existingActiveBidId: null,
        idempotencyKey: "key",
      },
    ),
  );
  bid = unwrap(
    transition(bidMachine, deepFreeze(bid), "AMEND", actor("buyer"), {
      now,
      listing,
      amendment: { priceMinor: 3500n, quantity: 3000n, minFill: 1000n, rationale: "Updated." },
    }),
  ).next;
  now = addDays(NOW, 5);
  listing = unwrap(
    transition(listingMachine, deepFreeze(listing), "CLOSE_WINDOW", actor("system"), { now }),
  ).next;
  bid = unwrap(
    transition(bidMachine, deepFreeze(bid), "COUNTER", actor("seller"), {
      now,
      listing,
      counterPriceMinor: 3550n,
    }),
  ).next;
  listing = unwrap(
    transition(listingMachine, deepFreeze(listing), "COUNTER_SENT", actor("seller"), { now }),
  ).next;
  now = addHours(now, 1);
  bid = unwrap(
    transition(bidMachine, deepFreeze(bid), "ACCEPT_COUNTER", actor("buyer"), { now, listing }),
  ).next;
  const allocation = allocate(listing.quantity, [bid]);
  listing = unwrap(
    transition(listingMachine, deepFreeze(listing), "ALLOCATE", actor("seller"), {
      now,
      allocation,
    }),
  ).next;
  bid = unwrap(
    transition(bidMachine, deepFreeze(bid), "ACCEPT", actor("seller"), {
      now,
      listing,
      allocatedQty: 3000n,
    }),
  ).next;
  const created = createTradesFromAllocation(listing, allocation, new Map([[bid.id, bid]]), {
    now,
    newId: () => "trade",
    escrowRef: (id) => `ESC-${id}`,
    backupBidId: null,
  });
  let trade = created[0];
  if (!trade) throw new Error("Missing trade");
  const step = (event: TradeEvent, role: ActorRole, userId?: string) => {
    if (!trade) throw new Error("Missing trade");
    const r = unwrap(
      transition(tradeMachine, deepFreeze(trade), event, actor(role, userId ? { userId } : {}), {
        now,
        policy,
      }),
    );
    trade = r.next;
    for (const effect of r.effects)
      if (effect.type === "MARK_SHARES_SOLD") holding = unwrap(markSharesSold(holding, effect.qty));
    return r;
  };
  step("SELLER_SIGN", "seller");
  step("BUYER_SIGN", "buyer");
  step("WAIVE", "company_admin");
  step("MARK_WIRE_SENT", "buyer");
  step("CONFIRM_FUNDS", "operator");
  step("UPLOAD_REGISTER", "company_admin");
  step("APPROVE_RELEASE", "operator", "one");
  expect(
    transition(
      tradeMachine,
      deepFreeze(trade),
      "APPROVE_RELEASE",
      actor("operator", { userId: "one" }),
      { now, policy },
    ),
  ).toMatchObject({
    ok: false,
    error: { code: "GUARD_FAILED", message: "A second operator must approve the release." },
  });
  const settled = step("APPROVE_RELEASE", "operator", "two");
  expect(settled.next).toMatchObject({
    status: "Settled",
    priceMinor: 3550n,
    releaseApprovals: ["one", "two"],
  });
  expect(holding).toMatchObject({ soldQty: 3000n, reservedQty: 0n });
  expect(
    unwrap(
      transition(listingMachine, deepFreeze(listing), "COMPLETE", actor("system"), {
        now,
        allTradesTerminal: true,
      }),
    ).next.status,
  ).toBe("Completed");
});
it("exercises ROFR, carries a default backup and releases a withdrawn listing", () => {
  const policy = makePolicy();
  const t = makeTrade({ status: "RofrPending", rofrDeadline: addDays(NOW, 30) });
  const r = unwrap(
    transition(tradeMachine, deepFreeze(t), "EXERCISE", actor("company_admin"), {
      now: NOW,
      policy,
    }),
  );
  expect(r.next.status).toBe("RofrExercised");
  expect(r.effects).toContainEqual({ type: "MARK_SHARES_SOLD", holdingId: "holding", qty: 1000n });
  const d = unwrap(
    transition(
      tradeMachine,
      deepFreeze(
        makeTrade({ status: "AwaitingFunds", fundingDeadline: NOW, backupBidId: "backup" }),
      ),
      "BUYER_DEFAULT",
      actor("system"),
      { now: NOW, policy },
    ),
  );
  expect(d.effects).toContainEqual({
    type: "BACKUP_OR_RELEASE",
    listingId: "listing",
    holdingId: "holding",
    qty: 1000n,
    backupBidId: "backup",
  });
  const w = unwrap(
    transition(
      listingMachine,
      deepFreeze(makeListing({ status: "Live" })),
      "WITHDRAW",
      actor("seller"),
      { now: NOW },
    ),
  );
  expect(w.effects).toContainEqual({
    type: "REJECT_ACTIVE_BIDS",
    listingId: "listing",
    reason: "Listing withdrawn by the seller",
  });
  let h = unwrap(reserveShares(makeHolding(), 5000n));
  for (const e of w.effects) if (e.type === "RELEASE_SHARES") h = unwrap(releaseShares(h, e.qty));
  expect(h.reservedQty).toBe(0n);
});
