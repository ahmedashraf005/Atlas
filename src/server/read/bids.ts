import "server-only";
import { evaluateBuyer } from "@/domain/policy";
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
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as listings from "@/server/repositories/listings";
import { buyerProfile, isRelatedParty } from "@/server/repositories/parties";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import type { Viewer } from "@/server/viewer";
export async function getBidComposerModel(viewer: Viewer, id: string, dbArg?: Db) {
  const db = dbArg ?? (await getDb()),
    sid = viewer.sandboxId,
    listing = await listings.findPublic(db, sid, id);
  if (!listing) return null;
  const company = await companies.find(db, sid, listing.companyId);
  if (!company) return null;
  const ref = await companyReference(viewer, company, db),
    seller = await users.find(db, sid, listing.sellerId),
    user = await users.find(db, sid, viewer.user.id),
    profile = user ? buyerProfile(user) : null;
  let blocked: string[] = [];
  if (viewer.user.role !== "buyer") blocked = ["Only buyers can bid."];
  else if (ref.grant?.status !== "approved") blocked = [`Request access to ${company.name} first.`];
  else if (profile) {
    const result = evaluateBuyer({ policy: ref.policy, buyer: profile });
    if (!result.ok) blocked = result.failures.map((f) => f.message);
    else if (await isRelatedParty(db, sid, listing.sellerId, profile.orgId))
      blocked = ["You can't bid on a listing you're connected to."];
  }
  if (
    !blocked.length &&
    (listing.status !== "Live" || !listing.windowClosesAt || listing.windowClosesAt <= viewer.now)
  )
    blocked = [`Bidding on ${listing.ref} has closed.`];
  const existing = (await bids.forBuyer(db, sid, viewer.user.id)).find(
    (b) => b.listingId === id && ["Submitted", "Countered", "Backup"].includes(b.status),
  );
  if (!blocked.length && existing && existing.status !== "Submitted")
    blocked = ["Your bid is awaiting a decision."];
  const own = existing?.status === "Submitted" ? existing : null,
    money = (p: bigint) => formatMoney(p, company.currency, "perShare"),
    last = ref.trades.at(-1);
  return {
    id,
    ref: listing.ref,
    company: company.name,
    companyHref: `/companies/${company.slug}`,
    blocked,
    currency: company.currency,
    seller: seller?.handle ?? "Holder",
    shareClass: ref.classes.find((c) => c.id === listing.shareClassId)?.name ?? "Shares",
    quantity: formatShares(listing.quantity, "table"),
    quantityRaw: listing.quantity.toString(),
    minFill:
      listing.minFill === listing.quantity ? "All or none" : formatShares(listing.minFill, "table"),
    minFillRaw: listing.minFill.toString(),
    minimumQuantity: formatShares(listing.minFill, "table"),
    closesAt: listing.windowClosesAt?.toISOString() ?? null,
    closeLabel: listing.windowClosesAt ? formatDateTime(listing.windowClosesAt) : "—",
    now: viewer.now.toISOString(),
    rofrDays: `${ref.policy.rofrDays} days`,
    mode: own ? ("amend" as const) : ("submit" as const),
    bidId: own?.id ?? null,
    defaults: {
      price: own
        ? `${own.priceMinor / 100n}.${(own.priceMinor % 100n).toString().padStart(2, "0")}`
        : "",
      quantity: (own?.quantity ?? listing.quantity).toString(),
      minFill: (own?.minFill ?? listing.minFill).toString(),
      rationale: own?.rationale ?? "",
    },
    band:
      ref.band.method === "none"
        ? null
        : {
            low: ref.band.lowMinor.toString(),
            mid: ref.band.midMinor.toString(),
            high: ref.band.highMinor.toString(),
            estimate: ref.band.method === "waterfall",
          },
    market: {
      round: company.lastRoundPriceMinor === null ? "—" : money(company.lastRoundPriceMinor),
      roundName: company.lastRoundName,
      fairValue: ref.hidden
        ? ref.band.method === "waterfall"
          ? ref.bandValue
          : "Not disclosed"
        : ref.bandValue,
      lastTrade: ref.hidden ? "Not disclosed" : last ? money(last.priceMinor) : "—",
    },
  };
}
export type BidComposerModel = NonNullable<Awaited<ReturnType<typeof getBidComposerModel>>>;
export async function getMyBidsModel(viewer: Viewer, dbArg?: Db) {
  const db = dbArg ?? (await getDb()),
    sid = viewer.sandboxId,
    own = viewer.user.role === "buyer" ? await bids.forBuyer(db, sid, viewer.user.id) : [],
    allListings = await Promise.all(own.map((b) => listings.findPublic(db, sid, b.listingId))),
    ownTrades = await trades.forBuyer(db, sid, viewer.user.id);
  const rows = await Promise.all(
    own.map(async (b, index) => {
      const l = allListings[index];
      if (!l) throw new Error("Bid listing missing");
      const c = await companies.find(db, sid, l.companyId),
        seller = await users.find(db, sid, l.sellerId),
        trade = ownTrades.find((t) => t.bidId === b.id),
        money = (p: bigint) => formatMoney(p, l.currency, "perShare");
      return {
        id: b.id,
        submittedAt: b.submittedAt.toISOString(),
        ref: l.ref,
        listingHref: `/listings/${l.id}`,
        company: c?.name ?? "Company",
        price: money(b.priceMinor),
        quantity: formatShares(b.quantity, "table"),
        minFill: formatShares(b.minFill, "table"),
        total: formatMoney(b.priceMinor * b.quantity, l.currency),
        closesAt: l.status === "Live" ? (l.windowClosesAt?.toISOString() ?? null) : null,
        closedLabel: l.windowClosesAt ? `Closed ${formatDate(l.windowClosesAt)}` : "—",
        compactWindow: l.windowClosesAt
          ? `${l.status === "Live" ? "Closes" : "Closed"} ${formatDate(l.windowClosesAt)}`
          : "—",
        badges: bidBadges(b, l.status, l.currency, viewer.now),
        active: ["Submitted", "Countered", "Backup"].includes(b.status),
        action:
          b.status === "Submitted" && l.status === "Live"
            ? { label: "Amend", href: `/listings/${l.id}/bid` }
            : b.status === "Accepted" && trade
              ? { label: "Open trade", href: `/trades/${trade.id}` }
              : null,
        counter:
          b.status === "Countered"
            ? {
                title: `Counter on ${l.ref} · ${c?.name ?? "Company"}`,
                description: `${seller?.handle ?? "Holder"} countered your ${money(b.priceMinor)} bid at ${money(b.counterPriceMinor ?? b.priceMinor)} for ${formatShares(b.quantity, "table")} (total ${formatMoney((b.counterPriceMinor ?? b.priceMinor) * b.quantity, l.currency)}). Respond by ${formatDateTime(b.counterExpiresAt ?? viewer.now)} (${formatRelative(b.counterExpiresAt ?? viewer.now, viewer.now)}).`,
                price: money(b.counterPriceMinor ?? b.priceMinor),
                originalPrice: money(b.priceMinor),
              }
            : null,
      };
    }),
  );
  rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return { now: viewer.now.toISOString(), rows, counters: rows.filter((r) => r.counter !== null) };
}
export type MyBidsModel = Awaited<ReturnType<typeof getMyBidsModel>>;
