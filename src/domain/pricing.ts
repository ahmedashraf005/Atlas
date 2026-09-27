import { BAND_LOOKBACK_DAYS, BAND_MIN_TRADES } from "@/domain/constants";
import { maxBigint, minBigint, sumBigint } from "@/domain/money";
import { addDays } from "@/domain/time";
import type { Company, ShareClass, TradeRecord } from "@/domain/types";
export type Band =
  | { method: "trades"; lowMinor: bigint; midMinor: bigint; highMinor: bigint; tradeCount: number }
  | { method: "waterfall"; lowMinor: bigint; midMinor: bigint; highMinor: bigint }
  | { method: "none" };
export function fairValueBand({
  trades,
  now,
  fallbackMinor,
}: {
  trades: TradeRecord[];
  now: Date;
  fallbackMinor: bigint | null;
}): Band {
  const start = addDays(now, -BAND_LOOKBACK_DAYS);
  const eligible = trades
    .map((t, index) => ({ ...t, index }))
    .filter((t) => !t.relatedParty && t.executedAt >= start && t.executedAt <= now)
    .sort((a, b) =>
      a.priceMinor !== b.priceMinor
        ? a.priceMinor < b.priceMinor
          ? -1
          : 1
        : a.executedAt.getTime() - b.executedAt.getTime() || a.index - b.index,
    );
  if (eligible.some((t) => t.quantity <= 0n || t.priceMinor < 0n))
    throw new RangeError("Trade prices cannot be negative and quantities must be positive.");
  if (eligible.length < BAND_MIN_TRADES)
    return fallbackMinor === null
      ? { method: "none" }
      : {
          method: "waterfall",
          lowMinor: fallbackMinor,
          midMinor: fallbackMinor,
          highMinor: fallbackMinor,
        };
  const weight = sumBigint(eligible.map((t) => t.quantity));
  const percentile = (n: bigint, d: bigint): bigint => {
    let cumulative = 0n;
    for (const t of eligible) {
      cumulative += t.quantity;
      if (d * cumulative >= n * weight) return t.priceMinor;
    }
    throw new Error("A positive weighted percentile must resolve.");
  };
  return {
    method: "trades",
    lowMinor: percentile(1n, 4n),
    midMinor: percentile(1n, 2n),
    highMinor: percentile(3n, 4n),
    tradeCount: eligible.length,
  };
}
export interface WaterfallResult {
  payoutMinor: Record<string, bigint>;
  perShareMinor: Record<string, bigint>;
}
export function waterfall({
  exitValueMinor,
  classes,
}: {
  exitValueMinor: bigint;
  classes: ShareClass[];
}): WaterfallResult {
  if (
    exitValueMinor < 0n ||
    classes.some(
      (c) =>
        c.shares <= 0n ||
        c.originalPriceMinor < 0n ||
        !Number.isSafeInteger(c.prefMultipleBps) ||
        c.prefMultipleBps < 0,
    )
  )
    throw new RangeError("Use non-negative values and positive share quantities.");
  if (new Set(classes.map((c) => c.id)).size !== classes.length)
    throw new Error("Share class ids must be unique.");
  if (!classes.length && exitValueMinor > 0n)
    throw new Error("Share classes are required for a positive exit.");
  const sorted = [...classes].sort((a, b) => a.seniority - b.seniority);
  const payouts: Record<string, bigint> = Object.fromEntries(sorted.map((c) => [c.id, 0n]));
  let remaining = exitValueMinor;
  for (const [index, c] of sorted.entries())
    if (c.kind === "preferred") {
      const juniorShares = sumBigint(sorted.slice(index).map((j) => j.shares));
      const asConverted = (remaining * c.shares) / juniorShares;
      const pref = minBigint(
        remaining,
        (c.originalPriceMinor * c.shares * BigInt(c.prefMultipleBps)) / 10_000n,
      );
      const payout = minBigint(maxBigint(pref, asConverted), remaining);
      payouts[c.id] = payout;
      remaining -= payout;
    }
  const ordinary = sorted.filter((c) => c.kind === "ordinary");
  const ordinaryShares = sumBigint(ordinary.map((c) => c.shares));
  const pool = remaining;
  for (const [index, c] of ordinary.entries()) {
    const payout = index === ordinary.length - 1 ? remaining : (pool * c.shares) / ordinaryShares;
    payouts[c.id] = payout;
    remaining -= payout;
  }
  // Invalid seniority ordering must not silently lose undistributed money.
  if (remaining !== 0n) throw new Error("The share classes do not distribute the exit value.");
  return {
    payoutMinor: payouts,
    perShareMinor: Object.fromEntries(sorted.map((c) => [c.id, (payouts[c.id] ?? 0n) / c.shares])),
  };
}
export function fallbackPriceForClass({
  company,
  classes,
  shareClassId,
}: {
  company: Company;
  classes: ShareClass[];
  shareClassId: string;
}): bigint | null {
  return company.lastRoundPostMoneyMinor === null
    ? null
    : (waterfall({ exitValueMinor: company.lastRoundPostMoneyMinor, classes }).perShareMinor[
        shareClassId
      ] ?? null);
}
export function bidVsBand(
  priceMinor: bigint,
  band: Band,
): "above" | "within" | "below" | "unknown" {
  return band.method === "none"
    ? "unknown"
    : priceMinor < band.lowMinor
      ? "below"
      : priceMinor > band.highMinor
        ? "above"
        : "within";
}
