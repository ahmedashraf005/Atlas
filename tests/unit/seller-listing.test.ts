import { describe, expect, it } from "vitest";
import {
  listingPreview,
  validateListing,
} from "@/app/(app)/holdings/[id]/list/_components/listing-preview";
import { can } from "@/domain/authz";
import { listingMachine } from "@/domain/listing";
import { holdingOrder, listingBadges, sandboxToday } from "@/server/read/holdings";

const band = { lowMinor: "295", midMinor: "310", highMinor: "330" };
describe("listing preview integer arithmetic", () => {
  it("keeps very large valid prices safe when the reference ratio exceeds the numeric range", () => {
    expect(listingPreview("2000", "999999999999999.99", "USD", band).comparison).toBe("—");
  });
  it.each([
    ["10000", "3.00", "10,000 sh × USD 3.00 = USD 30,000", "Within the fair-value band"],
    ["5000", "3.00", "5,000 sh × USD 3.00 = USD 15,000", "Within the fair-value band"],
    ["2000", "2.79", "2,000 sh × USD 2.79 = USD 5,580", "10% below the fair-value midpoint"],
    ["2000", "3.41", "2,000 sh × USD 3.41 = USD 6,820", "10% above the fair-value midpoint"],
  ])("formats %s at %s", (qty, price, total, comparison) => {
    expect(listingPreview(qty, price, "USD", band)).toEqual({ total, comparison });
  });
  it.each([
    ["abc", "3.00"],
    ["1000", "abc"],
    ["1000", "3.005"],
    ["0", "3.00"],
    ["1.5", "3.00"],
  ])("rejects %s and %s", (qty, price) => {
    expect(listingPreview(qty, price, "USD", band)).toEqual({ total: "—", comparison: "—" });
  });
  it("supports grouped input, huge integer totals and no reference", () => {
    expect(listingPreview("999,999,999,999,999", "999999999999999.99", "AED", null).total).toBe(
      "999,999,999,999,999 sh × AED 999,999,999,999,999.99 = AED 999,999,999,999,998,990,000,000,000,000",
    );
    expect(listingPreview("1", "1", "AED", null).comparison).toBe("—");
  });
  it("mirrors policy bounds before review", () => {
    const values = {
        quantity: "5000",
        minFill: "2000",
        reservePrice: "3.00",
        windowDays: "5" as const,
      },
      limits = { maxSellable: "10000", minLot: "2000" };
    expect(validateListing(values, limits)).toEqual({});
    expect(
      validateListing(
        { ...values, quantity: "10001", minFill: "1000", reservePrice: "abc" },
        limits,
      ),
    ).toHaveProperty("quantity");
    expect(validateListing({ ...values, minFill: "5001" }, limits).minFill).toBe(
      "Minimum fill can't exceed the listing quantity.",
    );
    expect(validateListing({ ...values, quantity: "1000" }, limits).quantity).toContain("at least");
  });
});
it("orders eligible, ineligible, pending, unverified then rejected with names within groups", () => {
  const cards = [
    { company: "Qamra", status: "Verified" as const, eligible: false },
    { company: "Wadi", status: "Verified" as const, eligible: true },
    { company: "Falaj", status: "Verified" as const, eligible: true },
    { company: "A", status: "PendingCompany" as const, eligible: false },
    { company: "B", status: "Rejected" as const, eligible: false },
    { company: "C", status: "Unverified" as const, eligible: false },
  ];
  expect(cards.sort(holdingOrder).map((c) => c.company)).toEqual([
    "Falaj",
    "Wadi",
    "Qamra",
    "A",
    "C",
    "B",
  ]);
});
it("maps every listing state to its badge", () => {
  expect(Object.keys(listingBadges).sort()).toEqual([...listingMachine.states].sort());
  expect(Object.values(listingBadges).map((b) => b.text)).toEqual([
    "Draft",
    "Awaiting Atlas review",
    "Live",
    "Window closed · your move",
    "Negotiating",
    "Bids accepted",
    "Completed",
    "Expired",
    "Withdrawn",
    "Rejected by Atlas",
  ]);
});
it.each([
  "members",
  "participants",
  "operator",
] as const)("uses shared %s visibility for a seller shareholder", (priceVisibility) => {
  const decision = can(
    { sandboxId: "s", userId: "seller", orgId: null, role: "seller", simulated: false },
    "company.viewTradePrices",
    {
      kind: "company",
      sandboxId: "s",
      companyOrgId: "c",
      accessGrant: "none",
      priceVisibility,
      isParticipant: true,
    },
  );
  expect(decision.allowed).toBe(priceVisibility !== "operator");
});
it("uses Dubai's sandbox date across UTC midnight", () => {
  expect(sandboxToday(new Date("2026-09-28T22:00:00Z"))).toBe("2026-09-29");
});
