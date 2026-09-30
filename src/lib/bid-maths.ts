import { type AllocationBid, allocate, rankBids } from "@/domain/allocation";
import {
  applyBps,
  diffBps,
  divRoundHalfAway,
  parseMoneyInput,
  parseSharesInput,
} from "@/domain/money";
import { bidVsBand } from "@/domain/pricing";
import { type Currency, formatMoney, formatShares } from "@/lib/format";
export interface BandInput {
  low: string;
  mid: string;
  high: string;
  estimate: boolean;
}
export type BidFormValues = { price: string; quantity: string; minFill: string; rationale: string };
export function validateBidForm(
  values: BidFormValues,
  listing: { minFillRaw: string; quantityRaw: string },
): Partial<Record<keyof BidFormValues, string>> {
  const issues: Partial<Record<keyof BidFormValues, string>> = {};
  const price = parseMoneyInput(values.price);
  const quantity = parseSharesInput(values.quantity);
  const minFill = parseSharesInput(values.minFill);
  const minimum = BigInt(listing.minFillRaw);
  const maximum = BigInt(listing.quantityRaw);
  if (!price.ok) issues.price = price.error.issues?.[0]?.message ?? "Enter a valid price.";
  if (!quantity.ok)
    issues.quantity = quantity.error.issues?.[0]?.message ?? "Enter a valid quantity.";
  else if (quantity.value < minimum)
    issues.quantity = `Minimum for this listing is ${formatShares(minimum, "table")}.`;
  else if (quantity.value > maximum)
    issues.quantity = `This listing offers ${formatShares(maximum, "table")}.`;
  if (!minFill.ok)
    issues.minFill = minFill.error.issues?.[0]?.message ?? "Enter a valid minimum fill.";
  else if (minFill.value < minimum)
    issues.minFill = `Minimum for this listing is ${formatShares(minimum, "table")}.`;
  else if (minFill.value > maximum)
    issues.minFill = `This listing offers ${formatShares(maximum, "table")}.`;
  else if (quantity.ok && minFill.value > quantity.value)
    issues.minFill = "Minimum fill can't exceed the bid quantity.";
  if (values.rationale.length > 500)
    issues.rationale = "Keep the rationale to 500 characters or fewer.";
  return issues;
}
export function competingPrice(base: bigint, count: number) {
  return applyBps(base, 10000 + ([150, -100, 300, 50][count % 4] ?? 150));
}
export function averagePrice(total: bigint, qty: bigint) {
  return qty === 0n ? 0n : divRoundHalfAway(total, qty);
}
export function bidMaths(
  price: string,
  quantity: string,
  minFill: string,
  currency: Currency,
  band: BandInput | null,
) {
  const p = parseMoneyInput(price),
    q = parseSharesInput(quantity),
    m = parseSharesInput(minFill);
  if (!p.ok || !q.ok || !m.ok) return null;
  let comparison = "";
  if (band) {
    const b = {
      method: "waterfall" as const,
      lowMinor: BigInt(band.low),
      midMinor: BigInt(band.mid),
      highMinor: BigInt(band.high),
    };
    const position = bidVsBand(p.value, b),
      bps = b.midMinor > 0n ? diffBps(p.value, b.midMinor) : 0;
    const label = band.estimate ? "estimate" : "fair-value band midpoint";
    comparison =
      position === "within"
        ? band.estimate
          ? "At the estimate"
          : "Within the fair-value band"
        : `${Math.abs(bps) / 100}% ${bps < 0 ? "below" : "above"} the ${label}`;
  }
  return {
    total: `Total: ${formatShares(q.value, "table")} × ${formatMoney(p.value, currency, "perShare")} = ${formatMoney(p.value * q.value, currency)}`,
    totalValue: formatMoney(p.value * q.value, currency),
    comparison,
    minimum: `If the seller splits the listing, you'll buy at least ${formatShares(m.value, "table")}.`,
    price: formatMoney(p.value, currency, "perShare"),
    quantity: formatShares(q.value, "table"),
    minFill: formatShares(m.value, "table"),
  };
}
export interface AllocationInput {
  id: string;
  priceMinor: string;
  quantityRaw: string;
  minFillRaw: string;
  submittedAt: string;
}
export function allocationPreview(quantity: string, bids: AllocationInput[], currency: Currency) {
  const candidates: AllocationBid[] = bids.map((b) => ({
    id: b.id,
    priceMinor: BigInt(b.priceMinor),
    quantity: BigInt(b.quantityRaw),
    minFill: BigInt(b.minFillRaw),
    submittedAt: new Date(b.submittedAt),
  }));
  const result = allocate(BigInt(quantity), candidates),
    allocated = result.allocations.reduce((s, a) => s + a.qty, 0n),
    total = result.allocations.reduce((s, a) => s + a.qty * a.priceMinor, 0n);
  let remaining = BigInt(quantity);
  const skippedRemaining: Record<string, string> = {};
  for (const bid of rankBids(candidates)) {
    const allocated = result.allocations.find((a) => a.bidId === bid.id);
    if (allocated) remaining -= allocated.qty;
    else skippedRemaining[bid.id] = formatShares(remaining, "table");
  }
  return {
    result,
    skippedRemaining,
    allocated: formatShares(allocated, "table"),
    remaining: formatShares(result.remainingQty, "table"),
    total: formatMoney(total, currency),
    average: formatMoney(averagePrice(total, allocated), currency, "perShare"),
  };
}
