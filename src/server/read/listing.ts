import "server-only";
import { rankBids } from "@/domain/allocation";
import { decisionDeadline } from "@/domain/listing";
import { bidVsBand } from "@/domain/pricing";
import { bidBadges } from "@/lib/bid-badges";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatRelative,
  formatShares,
} from "@/lib/format";
import { type Db, getDb } from "@/server/db/client";
import { companyReference } from "@/server/read/company";
import { listingBadges } from "@/server/read/holdings";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as listings from "@/server/repositories/listings";
import { closeRecord } from "@/server/repositories/parties";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import type { Viewer } from "@/server/viewer";
export async function getListingModel(viewer: Viewer, id: string, dbArg?: Db) {
  const db = dbArg ?? (await getDb()),
    sid = viewer.sandboxId,
    publicListing = await listings.findPublic(db, sid, id);
  if (!publicListing) return null;
  const company = await companies.find(db, sid, publicListing.companyId);
  if (!company) return null;
  if (viewer.user.role === "buyer" || viewer.user.role === "company_admin")
    return {
      redirect:
        viewer.user.role === "buyer" && publicListing.status === "Live"
          ? `/listings/${id}/bid`
          : `/companies/${company.slug}`,
    } as const;
  if (viewer.user.role !== "operator" && publicListing.sellerId !== viewer.user.id) return null;
  const listing = await listings.findForViewer(db, viewer, id);
  if (!listing || !("reservePriceMinor" in listing)) return null;
  const ref = await companyReference(viewer, company, db),
    money = (p: bigint) => formatMoney(p, listing.currency, "perShare"),
    editable = viewer.user.role === "seller",
    deadline = decisionDeadline(listing);
  // No bid rows or buyer identities are selected while bids remain sealed.
  const review = ["Closed", "Negotiating"].includes(listing.status),
    complete = ["Allocated", "Completed"].includes(listing.status),
    count = await bids.countForListing(db, sid, id),
    allBids = review || complete ? await bids.forListing(db, sid, id) : [];
  const ladder = await Promise.all(
    rankBids(allBids.filter((b) => ["Submitted", "Countered", "Backup"].includes(b.status))).map(
      async (b, i) => {
        const user = await users.find(db, sid, b.buyerId),
          record = await closeRecord(db, sid, b.buyerId),
          position = bidVsBand(b.priceMinor, ref.band);
        return {
          id: b.id,
          rank: `${i + 1}`,
          handle: user?.handle ?? "Investor",
          certainty:
            record.total === 0 ? "New on Atlas" : `Closed ${record.settled} of ${record.total}`,
          price: money(b.priceMinor),
          priceMinor: b.priceMinor.toString(),
          quantity: formatShares(b.quantity, "table"),
          quantityRaw: b.quantity.toString(),
          minFill: formatShares(b.minFill, "table"),
          minFillRaw: b.minFill.toString(),
          total: formatMoney(b.priceMinor * b.quantity, listing.currency),
          rationale: b.rationale,
          submittedAt: b.submittedAt.toISOString(),
          bandLabel:
            position === "unknown"
              ? ""
              : position === "above"
                ? "Above band"
                : position === "below"
                  ? "Below band"
                  : "Within band",
          bandTone:
            position === "above"
              ? "text-info"
              : position === "below"
                ? "text-warning"
                : "text-ink-muted",
          belowReserve: b.priceMinor < listing.reservePriceMinor,
          badges: bidBadges(b, listing.status, listing.currency, viewer.now),
          selectable: editable && b.status === "Submitted",
          canCounter:
            editable &&
            b.status === "Submitted" &&
            b.counterOutcome === null &&
            listing.countersSent < 3 &&
            deadline !== null &&
            deadline > viewer.now,
          counterDefault: (listing.reservePriceMinor > b.priceMinor
            ? listing.reservePriceMinor
            : (b.priceMinor * 101n + 99n) / 100n
          ).toString(),
        };
      },
    ),
  );
  const tradeRows = complete ? await trades.forListing(db, sid, id) : [],
    tradeModels = await Promise.all(
      tradeRows.map(async (t) => {
        const buyer = await users.find(db, sid, t.buyerId);
        return {
          id: t.id,
          ref: t.ref,
          buyer: buyer?.displayName ?? "Investor",
          handle: buyer?.handle ?? "Investor",
          quantity: formatShares(t.quantity, "table"),
          price: money(t.priceMinor),
          total: formatMoney(t.quantity * t.priceMinor, listing.currency),
          statusLabel: t.status.replace(/([a-z])([A-Z])/g, "$1 $2").replace("Rofr", "ROFR"),
          statusTone:
            t.status === "Settled"
              ? ("success" as const)
              : t.status === "Cancelled" || t.status === "RofrExercised"
                ? ("neutral" as const)
                : t.status === "Disputed"
                  ? ("danger" as const)
                  : ("info" as const),
        };
      }),
    );
  const backup = allBids.find((b) => b.status === "Backup"),
    backupUser = backup ? await users.find(db, sid, backup.buyerId) : null;
  return {
    redirect: null,
    id,
    ref: listing.ref,
    company: company.name,
    shareClass: ref.classes.find((c) => c.id === listing.shareClassId)?.name ?? "Shares",
    companyHref: `/companies/${company.slug}`,
    status: listing.status,
    badge: listingBadges[listing.status],
    editable,
    canWithdraw: editable && ["Draft", "InReview", "Live"].includes(listing.status),
    quantity: formatShares(listing.quantity, "table"),
    quantityProse: formatShares(listing.quantity, "prose"),
    quantityRaw: listing.quantity.toString(),
    minFill:
      listing.minFill === listing.quantity ? "All or none" : formatShares(listing.minFill, "table"),
    reserve: money(listing.reservePriceMinor),
    currency: listing.currency,
    bidCount: `${count}`,
    bidLabel: `${count} ${listing.status === "Live" ? "sealed" : "to review"}`,
    closesAt: listing.status === "Live" ? (listing.windowClosesAt?.toISOString() ?? null) : null,
    closeLabel: listing.windowClosesAt ? formatDateTime(listing.windowClosesAt) : "—",
    closedLabel: listing.windowClosesAt ? `Closed ${formatDate(listing.windowClosesAt)}` : "—",
    now: viewer.now.toISOString(),
    decisionLabel: deadline
      ? `Decide by ${formatDateTime(deadline)} (${formatRelative(deadline, viewer.now)}). After that the listing expires and your shares are released.`
      : "",
    decisionWarning: deadline !== null && deadline.getTime() - viewer.now.getTime() < 172800000,
    countersLeft: `${3 - listing.countersSent}`,
    rofrDays: `${ref.policy.rofrDays}`,
    ladder,
    trades: tradeModels,
    backup: backup
      ? `Backup: ${backupUser?.handle ?? "Investor"} at ${money(backup.priceMinor)} for ${formatShares(backup.quantity, "table")}.`
      : null,
    reason:
      listing.rejectionReason ??
      (listing.status === "Expired"
        ? "The listing expired."
        : listing.status === "Withdrawn"
          ? "You withdrew this listing."
          : "The listing was not approved."),
  };
}
export type ListingModel = Exclude<
  NonNullable<Awaited<ReturnType<typeof getListingModel>>>,
  { readonly redirect: string }
>;
