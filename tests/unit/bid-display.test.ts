import { expect, it } from "vitest";
import { bidBadges } from "@/lib/bid-badges";
import { allocationPreview, averagePrice, bidMaths, competingPrice } from "@/lib/bid-maths";
import { makeBid, NOW } from "./domain/helpers/fixtures";

it.each([
  ["Submitted", "Live", null, "In the window"],
  ["Submitted", "Closed", null, "Awaiting seller decision"],
  ["Submitted", "Negotiating", "accepted", "Counter accepted at AED 35.00"],
  ["Submitted", "Closed", "declined", "Counter declined"],
  ["Submitted", "Closed", "lapsed", "Counter lapsed"],
  ["Countered", "Negotiating", "pending", "Countered at AED 35.50 · 41h left"],
  ["Backup", "Allocated", null, "Backup bid"],
  ["Accepted", "Allocated", null, "Accepted · 2,000 sh"],
  ["Rejected", "Allocated", null, "Not selected"],
  ["Expired", "Expired", null, "Expired"],
  ["Withdrawn", "Live", null, "Withdrawn"],
] as const)("maps %s / %s / %s", (status, listingStatus, counterOutcome, text) => {
  const result = bidBadges(
    makeBid({
      status,
      counterOutcome,
      counterPriceMinor: 3550n,
      counterExpiresAt: new Date(NOW.getTime() + 41 * 3600000),
      allocatedQty: 2000n,
      rejectionReason: "Not selected by the seller",
    }),
    listingStatus,
    "AED",
    NOW,
  );
  expect(result[0]?.text).toBe(text);
  if (counterOutcome === "declined" || counterOutcome === "lapsed")
    expect(result[1]?.text).toBe("Awaiting seller decision");
  if (status === "Rejected") expect(result[0]?.tooltip).toBe("Not selected by the seller");
});
it("uses safe fallbacks for missing optional bid history", () => {
  expect(bidBadges(makeBid({ status: "Countered" }), "Negotiating", "AED", NOW)[0]?.text).toBe(
    "Countered at AED 35.00 · now left",
  );
  expect(bidBadges(makeBid({ status: "Accepted" }), "Allocated", "AED", NOW)[0]?.text).toBe(
    "Accepted · 3,000 sh",
  );
  expect(
    bidBadges(makeBid({ status: "Rejected" }), "Allocated", "AED", NOW)[0]?.tooltip,
  ).toBeUndefined();
});
const band = { low: "3420", mid: "3580", high: "3610", estimate: false };
it("calculates big integer bid totals and band/estimate comparisons", () => {
  expect(bidMaths("35.50", "5,000", "2000", "AED", band)).toMatchObject({
    totalValue: "AED 177,500",
    comparison: "Within the fair-value band",
    minimum: "If the seller splits the listing, you'll buy at least 2,000 sh.",
  });
  expect(bidMaths("39.38", "1", "1", "AED", band)?.comparison).toBe(
    "10% above the fair-value band midpoint",
  );
  expect(bidMaths("32.22", "1", "1", "AED", band)?.comparison).toBe(
    "10% below the fair-value band midpoint",
  );
  expect(
    bidMaths("42", "1", "1", "AED", { low: "4200", mid: "4200", high: "4200", estimate: true })
      ?.comparison,
  ).toBe("At the estimate");
  expect(
    bidMaths("21", "1", "1", "AED", { low: "4200", mid: "4200", high: "4200", estimate: true })
      ?.comparison,
  ).toBe("50% below the estimate");
  expect(bidMaths("1", "1", "1", "USD", null)?.comparison).toBe("");
  expect(
    bidMaths("1", "1", "1", "USD", { low: "0", mid: "0", high: "0", estimate: false })?.comparison,
  ).toBe("0% above the fair-value band midpoint");
  for (const input of [
    ["bad", "1", "1"],
    ["1", "0", "1"],
    ["1", "1", "bad"],
  ])
    expect(bidMaths(input[0] ?? "", input[1] ?? "", input[2] ?? "", "AED", null)).toBeNull();
});
it("rounds average prices half away and handles empty allocation", () => {
  expect(averagePrice(105n, 2n)).toBe(53n);
  expect(averagePrice(-105n, 2n)).toBe(-53n);
  expect(averagePrice(104n, 2n)).toBe(52n);
  expect(averagePrice(1n, 0n)).toBe(0n);
  expect(allocationPreview("12000", [], "AED")).toMatchObject({
    allocated: "0 sh",
    remaining: "12,000 sh",
    total: "AED 0",
    average: "AED 0.00",
  });
  const p = allocationPreview(
    "12000",
    [
      {
        id: "c",
        priceMinor: "3520",
        quantityRaw: "6000",
        minFillRaw: "2000",
        submittedAt: NOW.toISOString(),
      },
      {
        id: "d",
        priceMinor: "3500",
        quantityRaw: "12000",
        minFillRaw: "6000",
        submittedAt: NOW.toISOString(),
      },
    ],
    "AED",
  );
  expect(p).toMatchObject({
    allocated: "12,000 sh",
    remaining: "0 sh",
    total: "AED 421,200",
    average: "AED 35.10",
  });
});
it.each([0, 1, 2, 3, 4, 5, 6, 7])("cycles deterministic competing price %s", (n) =>
  expect(competingPrice(3580n, n)).toBe([3634n, 3544n, 3687n, 3598n][n % 4]));
it("explains a skipped minimum fill using shares remaining at that bid's rank", () => {
  const preview = allocationPreview(
    "10000",
    [
      {
        id: "a",
        priceMinor: "3600",
        quantityRaw: "4000",
        minFillRaw: "1000",
        submittedAt: NOW.toISOString(),
      },
      {
        id: "b",
        priceMinor: "3500",
        quantityRaw: "8000",
        minFillRaw: "7000",
        submittedAt: NOW.toISOString(),
      },
      {
        id: "c",
        priceMinor: "3400",
        quantityRaw: "1000",
        minFillRaw: "1000",
        submittedAt: NOW.toISOString(),
      },
    ],
    "AED",
  );
  expect(preview.skippedRemaining.b).toBe("6,000 sh");
  expect(preview.remaining).toBe("5,000 sh");
  expect(preview.result.skipped).toEqual([{ bidId: "b", reason: "MIN_FILL_NOT_MET" }]);
});
