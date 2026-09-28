import "server-only";
import { can } from "@/domain/authz";
import { availableQty } from "@/domain/holding";
import { applyBps } from "@/domain/money";
import { evaluateSellerEligibility } from "@/domain/policy";
import { fairValueBand, fallbackPriceForClass } from "@/domain/pricing";
import type { Holding, HoldingStatus, ListingStatus } from "@/domain/types";
import { formatDate, formatMoney, formatRelative, formatShares } from "@/lib/format";
import { type Db, getDb } from "@/server/db/client";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as discovery from "@/server/repositories/discovery";
import * as grants from "@/server/repositories/grants";
import * as holdings from "@/server/repositories/holdings";
import * as listings from "@/server/repositories/listings";
import * as mandates from "@/server/repositories/mandates";
import * as prints from "@/server/repositories/prints";
import type { Viewer } from "@/server/viewer";

type Tone = "neutral" | "info" | "warning" | "success" | "danger";
export const listingBadges: Record<ListingStatus, { tone: Tone; text: string }> = {
  Draft: { tone: "neutral", text: "Draft" },
  InReview: { tone: "info", text: "Awaiting Atlas review" },
  Live: { tone: "info", text: "Live" },
  Closed: { tone: "warning", text: "Window closed · your move" },
  Negotiating: { tone: "warning", text: "Negotiating" },
  Allocated: { tone: "success", text: "Bids accepted" },
  Completed: { tone: "success", text: "Completed" },
  Expired: { tone: "neutral", text: "Expired" },
  Withdrawn: { tone: "neutral", text: "Withdrawn" },
  Rejected: { tone: "danger", text: "Rejected by Atlas" },
};
export function holdingOrder(
  a: { status: HoldingStatus; eligible: boolean; company: string },
  b: { status: HoldingStatus; eligible: boolean; company: string },
) {
  const rank = (h: typeof a) =>
    h.status === "Verified" ? (h.eligible ? 0 : 1) : h.status === "Rejected" ? 3 : 2;
  return rank(a) - rank(b) || a.company.localeCompare(b.company);
}
export function sandboxToday(now: Date): string {
  return new Date(now.getTime() + 4 * 3600000).toISOString().slice(0, 10);
}
export async function holdingFacts(viewer: Viewer, holding: Holding, db: Db) {
  const sid = viewer.sandboxId;
  const company = await companies.find(db, sid, holding.companyId);
  if (!company) throw new Error("Holding company missing");
  const [classes, policy, committed, demand, participant, grant] = await Promise.all([
    companies.classes(db, sid, company.id),
    companies.policy(db, sid, company.id),
    holdings.committedQty(db, sid, holding.id, viewer.now),
    mandates.demandCount(db, sid, company.id),
    discovery.participates(db, sid, company.id, viewer.user.id),
    grants.find(db, sid, company.id, viewer.user.id),
  ]);
  const shareClass = classes.find((c) => c.id === holding.shareClassId);
  if (!shareClass) throw new Error("Holding class missing");
  const eligibility = evaluateSellerEligibility({
    policy,
    holding,
    soldInLast12Months: committed,
    now: viewer.now,
  });
  const visible = can(viewer.actor, "company.viewTradePrices", {
    kind: "company",
    sandboxId: sid,
    companyOrgId: company.orgId,
    accessGrant: grant?.status ?? "none",
    priceVisibility: policy.priceVisibility,
    isParticipant: participant || grant?.status === "approved",
  }).allowed;
  const fallback = fallbackPriceForClass({
    company: companies.toCompany(company),
    classes,
    shareClassId: shareClass.id,
  });
  const trades = visible
    ? (await prints.list(db, sid))
        .filter(
          (p) =>
            p.companyId === company.id &&
            p.shareClassId === shareClass.id &&
            !p.relatedParty &&
            p.executedAt <= viewer.now &&
            p.executedAt.getTime() >= viewer.now.getTime() - 180 * 86400000,
        )
        .sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime())
    : [];
  const band = fairValueBand({ trades, now: viewer.now, fallbackMinor: fallback });
  const money = (v: bigint) => formatMoney(v, company.currency, "perShare");
  const bandValue =
    band.method === "none"
      ? "—"
      : band.method === "trades"
        ? `${money(band.lowMinor)}–${money(band.highMinor).split(" ")[1]}`
        : money(band.midMinor);
  const last = trades.at(-1);
  return {
    company,
    shareClass,
    policy,
    committed,
    eligibility,
    band,
    visible,
    market: {
      reference:
        band.method === "trades"
          ? `Fair value ${bandValue} · Last trade ${last ? money(last.priceMinor) : "—"}`
          : band.method === "waterfall"
            ? `Estimate ${bandValue} from the last round`
            : "No price reference yet",
      round: company.lastRoundPriceMinor === null ? "—" : money(company.lastRoundPriceMinor),
      roundCaption: `${company.lastRoundName} preferred`,
      fairValue: bandValue,
      fairHeader: band.method === "trades" ? "Fair-value band" : "Estimated value",
      fairCaption:
        band.method === "trades"
          ? `From ${band.tradeCount} trades in the last 180 days`
          : band.method === "waterfall"
            ? "Estimate from the last round's valuation"
            : "No price reference yet",
      last: last ? money(last.priceMinor) : visible ? "—" : "Not disclosed",
      lastCaption: last
        ? `${formatShares(last.quantity, "prose")} · ${formatDate(last.executedAt)}`
        : visible
          ? "No trades yet"
          : "The company limits who can see trade prices.",
      demand:
        demand === 0
          ? "No buyers with matching mandates yet"
          : `${demand} ${demand === 1 ? "buyer has" : "buyers have"} mandates matching ${company.name}`,
    },
  };
}
export async function getHoldingsModel(viewer: Viewer, dbArg?: Db) {
  const db = dbArg ?? (await getDb()),
    sid = viewer.sandboxId;
  const [ownHoldings, ownListings, allCompanies] = await Promise.all([
    holdings.forOwner(db, sid, viewer.user.id),
    listings.forSeller(db, sid, viewer.user.id),
    companies.list(db, sid),
  ]);
  const cards = await Promise.all(
    ownHoldings.map(async (h) => {
      const f = await holdingFacts(viewer, h, db);
      return {
        id: h.id,
        company: f.company.name,
        slug: f.company.slug,
        shareClass: f.shareClass.name,
        status: h.status,
        eligible: f.eligibility.ok && viewer.user.role === "seller",
        rejectionReason: h.rejectionReason,
        quantities: [
          { label: "Total", value: formatShares(h.quantity, "table") },
          { label: "Listed or in trades", value: formatShares(h.reservedQty, "table") },
          { label: "Sold", value: formatShares(h.soldQty, "table") },
          { label: "Available", value: formatShares(availableQty(h), "table") },
        ],
        eligibility: {
          message: f.eligibility.ok
            ? `You can sell up to ${formatShares(f.eligibility.maxSellable, "prose")} now.`
            : "You can't list these shares yet.",
          failures: f.eligibility.failures.map((f) => f.message),
          nextEligible: f.eligibility.nextEligibleAt
            ? `Earliest date you can list: ${formatDate(f.eligibility.nextEligibleAt)}`
            : null,
          terms: [
            {
              label: "Yearly limit",
              value: `${formatShares(applyBps(h.quantity, f.policy.yearlyCapBps), "prose")} (${f.policy.yearlyCapBps / 100}%)`,
            },
            { label: "Already committed", value: formatShares(f.committed, "prose") },
            { label: "Minimum lot", value: formatShares(f.policy.minLot, "prose") },
            { label: "Right of first refusal", value: `${f.policy.rofrDays} days` },
          ],
        },
        market: h.status === "Verified" ? f.market : null,
      };
    }),
  );
  cards.sort(holdingOrder);
  const priority: Partial<Record<ListingStatus, number>> = {
    Closed: 0,
    Negotiating: 0,
    Live: 1,
    InReview: 2,
    Draft: 3,
  };
  const rank = (s: ListingStatus) => priority[s] ?? 4;
  ownListings.sort(
    (a, b) => rank(a.status) - rank(b.status) || b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const firstReviewId = ownListings.find(
    (l) => l.status === "Closed" || l.status === "Negotiating",
  )?.id;
  const rows = await Promise.all(
    ownListings.map(async (l) => {
      const c = allCompanies.find((c) => c.id === l.companyId);
      const classes = await companies.classes(db, sid, l.companyId);
      const review = l.status === "Closed" || l.status === "Negotiating",
        primary = review && l.id === firstReviewId;
      const count = ["Live", "Closed", "Negotiating"].includes(l.status)
        ? await bids.countForListing(db, sid, l.id)
        : 0;
      return {
        id: l.id,
        ref: l.ref,
        rejectionReason: l.rejectionReason,
        company: c?.name ?? "—",
        shareClass: classes.find((c) => c.id === l.shareClassId)?.name ?? "—",
        quantity: formatShares(l.quantity, "table"),
        quantityProse: formatShares(l.quantity, "prose"),
        minFill: l.minFill === l.quantity ? "All or none" : formatShares(l.minFill, "table"),
        reserve: formatMoney(l.reservePriceMinor, l.currency, "perShare"),
        window:
          l.status === "Live" && l.windowClosesAt
            ? `Closes ${formatDate(l.windowClosesAt)} · ${formatRelative(l.windowClosesAt, viewer.now)}`
            : l.windowClosesAt
              ? `Closed ${formatDate(l.windowClosesAt)}`
              : "Opens after review",
        bids: l.status === "Live" ? `${count} sealed` : review ? `${count} to review` : "—",
        badges: [
          listingBadges[l.status],
          ...(l.status === "Live" &&
          l.windowClosesAt &&
          l.windowClosesAt.getTime() - viewer.now.getTime() < 48 * 3600000
            ? [{ tone: "warning" as const, text: "Closing soon" }]
            : []),
        ],
        action: review
          ? { kind: "review" as const, primary }
          : ["Draft", "InReview", "Live"].includes(l.status)
            ? { kind: "withdraw" as const, primary: false }
            : null,
      };
    }),
  );
  return {
    cards,
    listings: rows,
    addPrimary: !firstReviewId,
    canAdd: viewer.user.role === "seller",
    today: sandboxToday(viewer.now),
    companies: await Promise.all(
      allCompanies.map(async (c) => ({
        id: c.id,
        name: c.name,
        classes: (await companies.classes(db, sid, c.id)).map((cl) => ({
          id: cl.id,
          name: cl.name,
        })),
      })),
    ),
  };
}
export type HoldingsModel = Awaited<ReturnType<typeof getHoldingsModel>>;
export type HoldingCardModel = HoldingsModel["cards"][number];
