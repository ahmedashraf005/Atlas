import fc from "fast-check";
import { expect, it } from "vitest";
import { type AllocationBid, allocate, rankBids } from "@/domain/allocation";
import { deepFreeze, NOW } from "./helpers/fixtures";

const b = (
  id: string,
  priceMinor = 100n,
  quantity = 10n,
  minFill = 1n,
  submittedAt = NOW,
): AllocationBid => ({ id, priceMinor, quantity, minFill, submittedAt });
it("ranks by price, then time, then id without mutation", () => {
  const bids = deepFreeze([
    b("z", 100n),
    b("b", 200n),
    b("a", 200n),
    b("early", 200n, 10n, 1n, new Date(NOW.getTime() - 1)),
  ]);
  expect(rankBids(bids).map((x) => x.id)).toEqual(["early", "a", "b", "z"]);
  expect(rankBids([b("same"), b("same")]).map((x) => x.id)).toEqual(["same", "same"]);
});
it("allocates exact and partial fills, skips minimums, then nothing left", () => {
  expect(allocate(10n, [b("a")])).toEqual({
    allocations: [{ bidId: "a", qty: 10n, priceMinor: 100n }],
    skipped: [],
    allocatedQty: 10n,
    remainingQty: 0n,
  });
  expect(allocate(15n, [b("a", 200n), b("b", 150n, 10n, 6n), b("c"), b("d")])).toEqual({
    allocations: [
      { bidId: "a", qty: 10n, priceMinor: 200n },
      { bidId: "c", qty: 5n, priceMinor: 100n },
    ],
    skipped: [
      { bidId: "b", reason: "MIN_FILL_NOT_MET" },
      { bidId: "d", reason: "NOTHING_LEFT" },
    ],
    allocatedQty: 15n,
    remainingQty: 0n,
  });
  expect(allocate(0n, [])).toEqual({
    allocations: [],
    skipped: [],
    allocatedQty: 0n,
    remainingQty: 0n,
  });
});
it("rejects invalid or duplicate bids", () => {
  expect(() => allocate(-1n, [])).toThrow();
  expect(() => allocate(1n, [b("a"), b("a")])).toThrow();
  for (const bad of [
    b("a", 0n),
    b("a", 1n, 0n),
    b("a", 1n, 1n, 0n),
    b("a", 1n, 1n, 2n),
    b("a", 1n, 1n, 1n, new Date("bad")),
  ])
    expect(() => allocate(1n, [bad])).toThrow();
});
it("preserves quantity, valid fills, skip reasons and permutation invariance", () =>
  fc.assert(
    fc.property(
      fc.bigInt({ min: 0n, max: 10000n }),
      fc.array(
        fc.record({
          price: fc.bigInt({ min: 1n, max: 10000n }),
          qty: fc.bigInt({ min: 1n, max: 1000n }),
          fraction: fc.nat({ max: 100 }),
          time: fc.nat({ max: 100 }),
        }),
        { maxLength: 20 },
      ),
      (qty, values) => {
        const bids = values.map((v, i) =>
          b(
            String(i),
            v.price,
            v.qty,
            1n + (BigInt(v.fraction) % v.qty),
            new Date(NOW.getTime() + v.time),
          ),
        );
        const result = allocate(qty, deepFreeze(bids));
        expect(result.allocatedQty).toBeLessThanOrEqual(qty);
        expect(result.remainingQty + result.allocatedQty).toBe(qty);
        expect(allocate(qty, [...bids].reverse())).toEqual(result);
        let remaining = qty;
        for (const bid of rankBids(bids)) {
          const fill = result.allocations.find((a) => a.bidId === bid.id);
          if (fill) {
            expect(fill.qty).toBeGreaterThanOrEqual(bid.minFill);
            expect(fill.qty).toBeLessThanOrEqual(bid.quantity);
            remaining -= fill.qty;
          } else if (result.skipped.find((s) => s.bidId === bid.id)?.reason === "MIN_FILL_NOT_MET")
            expect(remaining).toBeLessThan(bid.minFill);
        }
      },
    ),
    { numRuns: 200 },
  ));
