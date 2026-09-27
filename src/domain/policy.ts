import { availableQty } from "@/domain/holding";
import { applyBps, maxBigint, minBigint } from "@/domain/money";
import { addMonthsUtc, maxDate } from "@/domain/time";
import type { BuyerProfile, Holding, TransferPolicy } from "@/domain/types";
import { formatDate, formatShares } from "@/lib/format";
export type PolicyFailureCode =
  | "HOLDING_NOT_VERIFIED"
  | "LOCKUP_ACTIVE"
  | "BLACKOUT_ACTIVE"
  | "NO_AVAILABLE_SHARES"
  | "YEARLY_CAP_REACHED"
  | "BELOW_MIN_LOT"
  | "QUANTITY_ABOVE_MAX"
  | "QUANTITY_BELOW_MIN_LOT"
  | "MIN_FILL_BELOW_MIN_LOT"
  | "MIN_FILL_ABOVE_QUANTITY"
  | "BUYER_TYPE_NOT_ALLOWED"
  | "BUYER_BLOCKED"
  | "KYC_INCOMPLETE"
  | "NOT_PROFESSIONAL";
export interface PolicyFailure {
  code: PolicyFailureCode;
  message: string;
  until?: Date;
}
export interface EligibilityResult {
  ok: boolean;
  maxSellable: bigint;
  failures: PolicyFailure[];
  nextEligibleAt: Date | null;
}
export interface ListingPolicyResult extends EligibilityResult {}
export interface BuyerPolicyResult {
  ok: boolean;
  failures: PolicyFailure[];
}
interface SellerInput {
  policy: TransferPolicy;
  holding: Holding;
  soldInLast12Months: bigint;
  now: Date;
}
export function evaluateSellerEligibility({
  policy: p,
  holding: h,
  soldInLast12Months,
  now,
}: SellerInput): EligibilityResult {
  const failures: PolicyFailure[] = [];
  if (h.status !== "Verified")
    failures.push({
      code: "HOLDING_NOT_VERIFIED",
      message: "The company hasn't verified this holding yet.",
    });
  const end = addMonthsUtc(h.acquiredAt, p.lockupMonths);
  if (now < end)
    failures.push({
      code: "LOCKUP_ACTIVE",
      message: `Lock-up ends ${formatDate(end)}.`,
      until: end,
    });
  for (const w of p.blackoutWindows)
    if (w.start <= now && now < w.end)
      failures.push({
        code: "BLACKOUT_ACTIVE",
        message: `Sales are paused until ${formatDate(w.end)} (${w.label}).`,
        until: new Date(w.end.getTime()),
      });
  const available = availableQty(h);
  if (available === 0n)
    failures.push({
      code: "NO_AVAILABLE_SHARES",
      message: "All shares in this holding are already listed or sold.",
    });
  const capRemaining = maxBigint(0n, applyBps(h.quantity, p.yearlyCapBps) - soldInLast12Months);
  if (capRemaining <= 0n)
    failures.push({
      code: "YEARLY_CAP_REACHED",
      message: `You've reached this year's sale limit of ${p.yearlyCapBps / 100}% of your holding.`,
    });
  let maxSellable = maxBigint(0n, minBigint(available, capRemaining));
  if (
    failures.some((f) =>
      ["HOLDING_NOT_VERIFIED", "LOCKUP_ACTIVE", "BLACKOUT_ACTIVE"].includes(f.code),
    )
  )
    maxSellable = 0n;
  if (maxSellable > 0n && maxSellable < p.minLot)
    failures.push({
      code: "BELOW_MIN_LOT",
      message: `You can sell ${formatShares(maxSellable, "prose")}, below the company's minimum of ${formatShares(p.minLot, "prose")}.`,
    });
  const untils = failures.flatMap((f) => (f.until ? [f.until] : []));
  const nextEligibleAt = untils.length ? untils.reduce(maxDate) : null;
  return { ok: failures.length === 0, maxSellable, failures, nextEligibleAt };
}
export function evaluateListing(
  i: SellerInput & { quantity: bigint; minFill: bigint },
): ListingPolicyResult {
  const eligibility = evaluateSellerEligibility(i);
  if (!eligibility.ok) return eligibility;
  const failures: PolicyFailure[] = [];
  if (i.quantity > eligibility.maxSellable)
    failures.push({
      code: "QUANTITY_ABOVE_MAX",
      message: `You can list up to ${formatShares(eligibility.maxSellable, "prose")}.`,
    });
  if (i.quantity < i.policy.minLot)
    failures.push({
      code: "QUANTITY_BELOW_MIN_LOT",
      message: `List at least ${formatShares(i.policy.minLot, "prose")}.`,
    });
  if (i.minFill < i.policy.minLot)
    failures.push({
      code: "MIN_FILL_BELOW_MIN_LOT",
      message: `Minimum fill must be at least ${formatShares(i.policy.minLot, "prose")}.`,
    });
  if (i.minFill > i.quantity)
    failures.push({
      code: "MIN_FILL_ABOVE_QUANTITY",
      message: "Minimum fill can't exceed the listing quantity.",
    });
  return { ...eligibility, failures, ok: failures.length === 0 };
}
export function evaluateBuyer({
  policy: p,
  buyer: b,
}: {
  policy: TransferPolicy;
  buyer: BuyerProfile;
}): BuyerPolicyResult {
  const failures: PolicyFailure[] = [];
  if (b.kycStatus !== "verified")
    failures.push({ code: "KYC_INCOMPLETE", message: "Complete KYC verification before bidding." });
  if (!b.professionalVerified)
    failures.push({
      code: "NOT_PROFESSIONAL",
      message: "Professional investor verification is required.",
    });
  if (!p.allowedBuyerTypes.includes(b.investorType))
    failures.push({
      code: "BUYER_TYPE_NOT_ALLOWED",
      message: "This investor type isn't eligible under the company's transfer policy.",
    });
  if (p.blockedOrgIds.includes(b.orgId))
    failures.push({
      code: "BUYER_BLOCKED",
      message: "The company has restricted access to this listing.",
    });
  return { ok: failures.length === 0, failures };
}
