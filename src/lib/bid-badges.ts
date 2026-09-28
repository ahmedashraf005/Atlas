import type { Bid, Listing } from "@/domain/types";
import { type Currency, formatMoney, formatRelative, formatShares } from "@/lib/format";

type Tone = "neutral" | "info" | "warning" | "success" | "danger";
export interface BidBadge {
  tone: Tone;
  text: string;
  tooltip?: string;
}
export function bidBadges(
  bid: Bid,
  listingStatus: Listing["status"],
  currency: Currency,
  now: Date,
): BidBadge[] {
  const price = (p: bigint) => formatMoney(p, currency, "perShare");
  switch (bid.status) {
    case "Submitted": {
      const waiting: BidBadge = {
        tone: "info",
        text: listingStatus === "Live" ? "In the window" : "Awaiting seller decision",
      };
      if (bid.counterOutcome === "accepted")
        return [{ tone: "info", text: `Counter accepted at ${price(bid.priceMinor)}` }];
      if (bid.counterOutcome === "declined" || bid.counterOutcome === "lapsed")
        return [{ tone: "neutral", text: `Counter ${bid.counterOutcome}` }, waiting];
      return [waiting];
    }
    case "Countered":
      return [
        {
          tone: "warning",
          text: `Countered at ${price(bid.counterPriceMinor ?? bid.priceMinor)} · ${formatRelative(bid.counterExpiresAt ?? now, now).replace(/^in /, "")} left`,
        },
      ];
    case "Backup":
      return [{ tone: "info", text: "Backup bid" }];
    case "Accepted":
      return [
        {
          tone: "success",
          text: `Accepted · ${formatShares(bid.allocatedQty ?? bid.quantity, "table")}`,
        },
      ];
    case "Rejected":
      return [{ tone: "neutral", text: "Not selected", tooltip: bid.rejectionReason ?? undefined }];
    case "Expired":
      return [{ tone: "neutral", text: "Expired" }];
    case "Withdrawn":
      return [{ tone: "neutral", text: "Withdrawn" }];
  }
}
