import { diffBps, parseMoneyInput, parseSharesInput } from "@/domain/money";
import { type Currency, formatMoney, formatShares } from "@/lib/format";
export interface ListingValues {
  quantity: string;
  minFill: string;
  reservePrice: string;
  windowDays: "3" | "5" | "7";
}
export function validateListing(
  values: ListingValues,
  limits: { maxSellable: string; minLot: string },
) {
  const issues: Record<string, string> = {};
  const qty = parseSharesInput(values.quantity),
    min = parseSharesInput(values.minFill),
    price = parseMoneyInput(values.reservePrice);
  if (!qty.ok) issues.quantity = qty.error.issues?.[0]?.message ?? qty.error.message;
  else if (qty.value > BigInt(limits.maxSellable))
    issues.quantity = `You can list up to ${formatShares(BigInt(limits.maxSellable), "prose")}.`;
  else if (qty.value < BigInt(limits.minLot))
    issues.quantity = `List at least ${formatShares(BigInt(limits.minLot), "prose")}.`;
  if (!min.ok) issues.minFill = min.error.issues?.[0]?.message ?? min.error.message;
  else if (min.value < BigInt(limits.minLot))
    issues.minFill = `Minimum fill must be at least ${formatShares(BigInt(limits.minLot), "prose")}.`;
  else if (qty.ok && min.value > qty.value)
    issues.minFill = "Minimum fill can't exceed the listing quantity.";
  if (!price.ok) issues.reservePrice = price.error.issues?.[0]?.message ?? price.error.message;
  return issues;
}
export function listingPreview(
  quantity: string,
  reservePrice: string,
  currency: Currency,
  band: { lowMinor: string; midMinor: string; highMinor: string } | null,
) {
  const qty = parseSharesInput(quantity),
    price = parseMoneyInput(reservePrice);
  if (!qty.ok || !price.ok) return { total: "—", comparison: "—" };
  let comparison = "—";
  if (band && BigInt(band.midMinor) > 0n) {
    if (price.value >= BigInt(band.lowMinor) && price.value <= BigInt(band.highMinor))
      comparison = "Within the fair-value band";
    else {
      try {
        const bps = diffBps(price.value, BigInt(band.midMinor));
        comparison = `${Math.abs(bps) / 100}% ${bps < 0 ? "below" : "above"} the fair-value midpoint`;
      } catch (error) {
        // A valid price may exceed the dimensionless ratio's safe range; its total remains exact.
        if (!(error instanceof RangeError)) throw error;
      }
    }
  }
  return {
    total: `${formatShares(qty.value, "table")} × ${formatMoney(price.value, currency, "perShare")} = ${formatMoney(qty.value * price.value, currency)}`,
    comparison,
  };
}
