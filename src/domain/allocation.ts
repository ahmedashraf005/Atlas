import { minBigint, sumBigint } from "@/domain/money";
export interface AllocationBid {
  id: string;
  priceMinor: bigint;
  quantity: bigint;
  minFill: bigint;
  submittedAt: Date;
}
export interface Allocation {
  bidId: string;
  qty: bigint;
  priceMinor: bigint;
}
export interface AllocationResult {
  allocations: Allocation[];
  skipped: { bidId: string; reason: "MIN_FILL_NOT_MET" | "NOTHING_LEFT" }[];
  allocatedQty: bigint;
  remainingQty: bigint;
}
export function rankBids<T extends AllocationBid>(bids: readonly T[]): T[] {
  return [...bids].sort((a, b) =>
    a.priceMinor !== b.priceMinor
      ? a.priceMinor > b.priceMinor
        ? -1
        : 1
      : a.submittedAt.getTime() !== b.submittedAt.getTime()
        ? a.submittedAt.getTime() - b.submittedAt.getTime()
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0,
  );
}
export function allocate(listingQty: bigint, selected: readonly AllocationBid[]): AllocationResult {
  if (listingQty < 0n) throw new RangeError("Listing quantity cannot be negative.");
  const ids = new Set<string>();
  for (const bid of selected) {
    if (ids.has(bid.id)) throw new Error("Select each bid only once.");
    ids.add(bid.id);
    if (
      bid.quantity <= 0n ||
      bid.minFill <= 0n ||
      bid.minFill > bid.quantity ||
      bid.priceMinor <= 0n ||
      !Number.isFinite(bid.submittedAt.getTime())
    )
      throw new RangeError("Bid values must be valid and positive.");
  }
  const allocations: Allocation[] = [];
  const skipped: AllocationResult["skipped"] = [];
  let remaining = listingQty;
  for (const bid of rankBids(selected)) {
    if (remaining === 0n) {
      skipped.push({ bidId: bid.id, reason: "NOTHING_LEFT" });
      continue;
    }
    const give = minBigint(bid.quantity, remaining);
    if (give < bid.minFill) {
      skipped.push({ bidId: bid.id, reason: "MIN_FILL_NOT_MET" });
      continue;
    }
    allocations.push({ bidId: bid.id, qty: give, priceMinor: bid.priceMinor });
    remaining -= give;
  }
  return {
    allocations,
    skipped,
    allocatedQty: sumBigint(allocations.map((a) => a.qty)),
    remainingQty: remaining,
  };
}
