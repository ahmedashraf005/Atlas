import { expect, it } from "vitest";
import { evaluateBuyer, evaluateListing, evaluateSellerEligibility } from "@/domain/policy";
import { addDays, addMonthsUtc } from "@/domain/time";
import { makeBuyer, makeHolding, makePolicy, NOW } from "./helpers/fixtures";

const eligibility = (
  holding = makeHolding(),
  policy = makePolicy(),
  soldInLast12Months = 0n,
  now = NOW,
) => evaluateSellerEligibility({ holding, policy, soldInLast12Months, now });
it("allows an eligible holding and limits availability/cap", () => {
  expect(eligibility()).toEqual({
    ok: true,
    maxSellable: 10000n,
    failures: [],
    nextEligibleAt: null,
  });
  expect(
    eligibility(
      makeHolding({ reservedQty: 3000n, soldQty: 1000n }),
      makePolicy({ yearlyCapBps: 5000 }),
      2000n,
    ).maxSellable,
  ).toBe(3000n);
});
it("returns each seller failure and exact messages", () => {
  expect(eligibility(makeHolding({ status: "Unverified" })).failures).toEqual([
    { code: "HOLDING_NOT_VERIFIED", message: "The company hasn't verified this holding yet." },
  ]);
  const recent = makeHolding({ acquiredAt: NOW });
  const end = addMonthsUtc(NOW, 6);
  expect(eligibility(recent).failures).toEqual([
    { code: "LOCKUP_ACTIVE", message: "Lock-up ends 25 Mar 2027.", until: end },
  ]);
  expect(eligibility(recent).nextEligibleAt).toEqual(end);
  const window = { start: NOW, end: addDays(NOW, 2), label: "Quarter-end" };
  expect(eligibility(makeHolding(), makePolicy({ blackoutWindows: [window] })).failures).toEqual([
    {
      code: "BLACKOUT_ACTIVE",
      message: "Sales are paused until 27 Sep 2026 (Quarter-end).",
      until: window.end,
    },
  ]);
  expect(eligibility(makeHolding({ reservedQty: 10000n })).failures).toEqual([
    {
      code: "NO_AVAILABLE_SHARES",
      message: "All shares in this holding are already listed or sold.",
    },
  ]);
  expect(eligibility(makeHolding(), makePolicy({ yearlyCapBps: 2500 }), 2500n).failures).toEqual([
    {
      code: "YEARLY_CAP_REACHED",
      message: "You've reached this year's sale limit of 25% of your holding.",
    },
  ]);
  expect(eligibility(makeHolding({ reservedQty: 9500n })).failures).toEqual([
    {
      code: "BELOW_MIN_LOT",
      message: "You can sell 500 shares, below the company's minimum of 1,000 shares.",
    },
  ]);
});
it("collects overlapping failures with latest until and suppresses listing checks until eligible", () => {
  const p = makePolicy({
    blackoutWindows: [
      { start: NOW, end: addDays(NOW, 2), label: "A" },
      { start: addDays(NOW, -1), end: addDays(NOW, 3), label: "B" },
    ],
  });
  const h = makeHolding({ status: "PendingCompany", acquiredAt: NOW, reservedQty: 10000n });
  const r = eligibility(h, p, 10000n);
  expect(r.failures.map((f) => f.code)).toEqual([
    "HOLDING_NOT_VERIFIED",
    "LOCKUP_ACTIVE",
    "BLACKOUT_ACTIVE",
    "BLACKOUT_ACTIVE",
    "NO_AVAILABLE_SHARES",
    "YEARLY_CAP_REACHED",
  ]);
  expect(r.maxSellable).toBe(0n);
  expect(r.nextEligibleAt).toEqual(addMonthsUtc(NOW, 6));
  expect(
    evaluateListing({
      holding: h,
      policy: p,
      soldInLast12Months: 10000n,
      quantity: -1n,
      minFill: -1n,
      now: NOW,
    }),
  ).toEqual(r);
});
it("uses inclusive starts, exclusive ends, and a rolling-cap amount floored at zero", () => {
  const p = makePolicy({ blackoutWindows: [{ start: NOW, end: addDays(NOW, 2), label: "A" }] });
  expect(eligibility(makeHolding(), p, 0n, addDays(NOW, -1)).ok).toBe(true);
  expect(eligibility(makeHolding(), p, 0n, addDays(NOW, 2)).ok).toBe(true);
  const h = makeHolding();
  expect(eligibility(h, makePolicy(), 0n, addMonthsUtc(h.acquiredAt, 6)).ok).toBe(true);
  expect(eligibility(h, makePolicy(), 20000n).maxSellable).toBe(0n);
});
it("validates listing quantity and minimum fill after eligibility", () => {
  const input = { holding: makeHolding(), policy: makePolicy(), soldInLast12Months: 0n, now: NOW };
  expect(evaluateListing({ ...input, quantity: 11000n, minFill: 12000n }).failures).toEqual([
    { code: "QUANTITY_ABOVE_MAX", message: "You can list up to 10,000 shares." },
    { code: "MIN_FILL_ABOVE_QUANTITY", message: "Minimum fill can't exceed the listing quantity." },
  ]);
  expect(evaluateListing({ ...input, quantity: 500n, minFill: 100n }).failures).toEqual([
    { code: "QUANTITY_BELOW_MIN_LOT", message: "List at least 1,000 shares." },
    { code: "MIN_FILL_BELOW_MIN_LOT", message: "Minimum fill must be at least 1,000 shares." },
  ]);
  expect(evaluateListing({ ...input, quantity: 1000n, minFill: 1000n }).ok).toBe(true);
});
it("checks every buyer failure individually and together without exposing blocked membership", () => {
  const p = makePolicy();
  expect(evaluateBuyer({ policy: p, buyer: makeBuyer() })).toEqual({ ok: true, failures: [] });
  const cases = [
    { buyer: makeBuyer({ kycStatus: "pending" }), policy: p, code: "KYC_INCOMPLETE" },
    { buyer: makeBuyer({ professionalVerified: false }), policy: p, code: "NOT_PROFESSIONAL" },
    {
      buyer: makeBuyer(),
      policy: makePolicy({ allowedBuyerTypes: [] }),
      code: "BUYER_TYPE_NOT_ALLOWED",
    },
    {
      buyer: makeBuyer(),
      policy: makePolicy({ blockedOrgIds: ["buyer-org"] }),
      code: "BUYER_BLOCKED",
    },
  ];
  for (const c of cases) expect(evaluateBuyer(c).failures.map((f) => f.code)).toEqual([c.code]);
  const r = evaluateBuyer({
    policy: makePolicy({ allowedBuyerTypes: [], blockedOrgIds: ["buyer-org"] }),
    buyer: makeBuyer({ kycStatus: "rejected", professionalVerified: false }),
  });
  expect(r.failures.map((f) => f.code)).toEqual([
    "KYC_INCOMPLETE",
    "NOT_PROFESSIONAL",
    "BUYER_TYPE_NOT_ALLOWED",
    "BUYER_BLOCKED",
  ]);
  expect(r.failures.at(-1)?.message).toBe("The company has restricted access to this listing.");
  expect(r.failures.at(-1)?.message).not.toMatch(/blocked/i);
});
