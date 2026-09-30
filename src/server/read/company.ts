import "server-only";
import type { Tone } from "@/components/atlas/status-badge";
import { DEMO_DOCUMENTS } from "@/config/demo-documents";
import { can } from "@/domain/authz";
import { evaluateBuyer } from "@/domain/policy";
import { fairValueBand, fallbackPriceForClass, waterfall } from "@/domain/pricing";
import type { ShareClass } from "@/domain/types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatRelative,
  formatShares,
} from "@/lib/format";
import { plural } from "@/lib/plural";
import { INVESTOR_LABELS } from "@/lib/policy-display";
import { type Db, getDb } from "@/server/db/client";
import * as companies from "@/server/repositories/companies";
import * as discovery from "@/server/repositories/discovery";
import * as documents from "@/server/repositories/documents";
import * as grants from "@/server/repositories/grants";
import * as mandates from "@/server/repositories/mandates";
import { buyerProfile } from "@/server/repositories/parties";
import * as prints from "@/server/repositories/prints";
import * as qa from "@/server/repositories/qa";
import * as users from "@/server/repositories/users";
import type { Viewer } from "@/server/viewer";

const DAY = 86400000;
function monthlyTicks(now: Date) {
  const start = now.getTime() - 180 * DAY,
    first = new Date(start + 4 * 3600000);
  const ticks: { t: number; label: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const date = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1) - 4 * 3600000,
    );
    if (date.getTime() >= start && date <= now)
      ticks.push({ t: date.getTime(), label: formatDate(date).split(" ")[1] ?? "" });
  }
  return ticks;
}

export function exitSteps(postMoney: bigint, classes: ShareClass[], currency: "AED" | "USD") {
  // Scale factors are dimensionless; money multiplication/division stays integer.
  const values = Array.from({ length: 25 }, (_, i) =>
    i === 12
      ? postMoney
      : i === 0
        ? postMoney / 4n
        : i === 24
          ? postMoney * 4n
          : (postMoney * BigInt(Math.round(2 ** ((i - 12) / 6) * 1_000_000_000))) / 1_000_000_000n,
  );
  const results = values.map((exitValueMinor) => waterfall({ exitValueMinor, classes }));
  const max = results
    .flatMap((r) => Object.values(r.perShareMinor))
    .reduce((a, b) => (a > b ? a : b), 0n);
  return results.map((r, i) => ({
    exitLabel: formatMoneyCompact(values[i] ?? postMoney, currency),
    classes: [...classes]
      .sort((a, b) => a.seniority - b.seniority)
      .map((c) => ({
        name: c.name,
        perShare: formatMoney(r.perShareMinor[c.id] ?? 0n, currency, "perShare"),
        ratio:
          max === 0n ? 0 : Number(((r.perShareMinor[c.id] ?? 0n) * 1_000_000n) / max) / 1_000_000,
      })),
  }));
}
export async function companyReference(
  viewer: Viewer,
  company: NonNullable<Awaited<ReturnType<typeof companies.find>>>,
  db: Db,
) {
  const sid = viewer.sandboxId;
  const [classes, policy, grant, participant, allPrints] = await Promise.all([
    companies.classes(db, sid, company.id),
    companies.policy(db, sid, company.id),
    grants.find(db, sid, company.id, viewer.user.id),
    discovery.participates(db, sid, company.id, viewer.user.id),
    prints.list(db, sid),
  ]);
  const ordinary = classes.find((c) => c.kind === "ordinary");
  const visible = can(viewer.actor, "company.viewTradePrices", {
    kind: "company",
    sandboxId: sid,
    companyOrgId: company.orgId,
    accessGrant: grant?.status ?? "none",
    priceVisibility: policy.priceVisibility,
    isParticipant: grant?.status === "approved" || participant,
  }).allowed;
  const trades = allPrints
    .filter(
      (p) =>
        p.companyId === company.id &&
        p.shareClassId === ordinary?.id &&
        !p.relatedParty &&
        p.executedAt.getTime() >= viewer.now.getTime() - 180 * DAY &&
        p.executedAt <= viewer.now,
    )
    .sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
  const fallback = ordinary
    ? fallbackPriceForClass({
        company: companies.toCompany(company),
        classes,
        shareClassId: ordinary.id,
      })
    : null;
  const band = fairValueBand({
    trades: visible ? trades : [],
    now: viewer.now,
    fallbackMinor: fallback,
  });
  const hidden = !visible && trades.length > 0;
  const money = (v: bigint) => formatMoney(v, company.currency, "perShare");
  const bandValue = hidden
    ? "Not disclosed"
    : band.method === "none"
      ? "—"
      : band.method === "trades"
        ? `${money(band.lowMinor)}–${money(band.highMinor).split(" ")[1]}`
        : `Round-implied ${money(band.midMinor)}`;
  return {
    classes,
    policy,
    grant,
    visible,
    trades: visible ? trades : [],
    band,
    hidden,
    bandValue,
    money,
  };
}
export async function getCompanyModel(viewer: Viewer, slug: string, dbArg?: Db) {
  const db = dbArg ?? (await getDb());
  const company = (await companies.list(db, viewer.sandboxId)).find((c) => c.slug === slug);
  if (!company) return null;
  const ref = await companyReference(viewer, company, db);
  const [allListings, ownBids, allUsers, allMandates, entries, docs] = await Promise.all([
    discovery.publicListings(db, viewer.sandboxId),
    discovery.ownBids(db, viewer.sandboxId, viewer.user.id),
    users.list(db, viewer.sandboxId),
    mandates.list(db, viewer.sandboxId),
    qa.list(db, viewer.sandboxId),
    documents.list(db, viewer.sandboxId),
  ]);
  const mine = ownBids.filter((b) => ["Submitted", "Countered", "Backup"].includes(b.status));
  const buyer = viewer.user.role === "buyer",
    approved = ref.grant?.status === "approved";
  const viewerRow = allUsers.find((u) => u.id === viewer.user.id);
  const profile = viewerRow ? buyerProfile(viewerRow) : null;
  const buyerPolicy = profile ? evaluateBuyer({ policy: ref.policy, buyer: profile }) : null;
  const matching =
    buyer && buyerPolicy?.ok
      ? allMandates.find(
          (m) =>
            m.buyerId === viewer.user.id &&
            m.sectors.includes(company.sector) &&
            m.stages.includes(company.stage),
        )
      : undefined;
  const listingRows = allListings
    .filter(
      (l) =>
        l.companyId === company.id &&
        (["Live", "Closed", "Negotiating"].includes(l.status) ||
          mine.some((b) => b.listingId === l.id)),
    )
    .sort(
      (a, b) =>
        Number(mine.some((x) => x.listingId === b.id)) -
        Number(mine.some((x) => x.listingId === a.id)) +
        (mine.some((x) => x.listingId === a.id) === mine.some((x) => x.listingId === b.id)
          ? (a.windowClosesAt?.getTime() ?? Number.POSITIVE_INFINITY) -
              (b.windowClosesAt?.getTime() ?? Number.POSITIVE_INFINITY) ||
            a.ref.localeCompare(b.ref)
          : 0),
    )
    .map((l) => {
      const bid = buyer ? mine.find((b) => b.listingId === l.id) : undefined;
      const badges: { tone: Tone; text: string }[] = [];
      let action: { label: string; href: string; primary: boolean } | null = null;
      if (bid?.status === "Countered" && bid.counterPriceMinor !== null && bid.counterExpiresAt) {
        badges.push({
          tone: "warning",
          text: `Countered at ${ref.money(bid.counterPriceMinor)} · ${formatRelative(bid.counterExpiresAt, viewer.now).replace(/^in /, "")} left`,
        });
        action = { label: "Respond", href: "/bids", primary: true };
      } else if (bid?.status === "Submitted") {
        badges.push({
          tone: "info",
          text: l.status === "Live" ? "Your bid is in" : "Awaiting seller decision",
        });
        if (l.status === "Live")
          action = { label: "Amend", href: `/listings/${l.id}/bid`, primary: false };
      } else if (l.status === "Live") {
        badges.push({ tone: "info", text: "Live" });
        if (l.windowClosesAt && l.windowClosesAt.getTime() - viewer.now.getTime() < 2 * DAY)
          badges.push({ tone: "warning", text: "Closing soon" });
        if (buyer && approved)
          action = { label: "Bid", href: `/listings/${l.id}/bid`, primary: false };
      } else badges.push({ tone: "neutral", text: "Window closed" });
      return {
        id: l.id,
        ref: l.ref,
        highlight: !!bid,
        ownBid: bid ? `Your bid · ${ref.money(bid.priceMinor)}` : null,
        shareClass: ref.classes.find((c) => c.id === l.shareClassId)?.name ?? "—",
        quantity: formatShares(l.quantity, "table"),
        minFill: l.quantity === l.minFill ? "All or none" : formatShares(l.minFill, "table"),
        seller: allUsers.find((u) => u.id === l.sellerId)?.handle ?? "—",
        window: l.windowClosesAt
          ? `${l.status === "Live" ? "Closes" : "Closed"} ${formatDate(l.windowClosesAt)}${l.status === "Live" ? ` · ${formatRelative(l.windowClosesAt, viewer.now)}` : ""}`
          : "—",
        badges,
        action,
        accessHint:
          buyer && !approved && l.status === "Live" && !bid ? "Request access to bid" : null,
      };
    });
  const last = ref.trades.at(-1),
    open = allListings.filter((l) => l.companyId === company.id && l.status === "Live").length;
  const chartPoints = ref.trades.map((p) => ({
    t: p.executedAt.getTime(),
    price: Number(p.priceMinor) / 100,
    qty: formatShares(p.quantity, "table"),
    priceLabel: ref.money(p.priceMinor),
    label: `${ref.money(p.priceMinor)} · ${formatShares(p.quantity, "table")} · ${formatDate(p.executedAt)}`,
    date: formatDate(p.executedAt),
    position:
      ref.band.method === "none"
        ? ("inside" as const)
        : p.priceMinor < ref.band.lowMinor
          ? ("below" as const)
          : p.priceMinor > ref.band.highMinor
            ? ("above" as const)
            : ("inside" as const),
  }));
  const canInfo = can(viewer.actor, "company.viewInfoPack", {
    kind: "company",
    sandboxId: viewer.sandboxId,
    companyOrgId: company.orgId,
    accessGrant: ref.grant?.status ?? "none",
  }).allowed;
  const bandCaption = ref.hidden
    ? "The company limits who can see trade prices."
    : ref.band.method === "trades"
      ? `From ${plural(ref.band.tradeCount, "trade")} in the last 180 days`
      : ref.band.method === "waterfall"
        ? "Value per share if the company sold at its last round's valuation. Ordinary shares usually trade at a discount to this."
        : "No price reference yet";
  return {
    id: company.id,
    slug,
    name: company.name,
    meta: `${company.sector} · ${company.stage} · Incorporated in ${company.incorporation}`,
    openListings: open ? plural(open, "open listing") : null,
    matchingMandate: matching?.name ?? null,
    isBuyer: buyer,
    canAsk: buyer && approved,
    requestAccess: buyer && !ref.grant,
    approvedAccess: approved,
    stats: {
      round: {
        value: company.lastRoundPriceMinor === null ? "—" : ref.money(company.lastRoundPriceMinor),
        caption: `${company.lastRoundName} preferred · ${company.lastRoundDate ? formatDate(company.lastRoundDate).split(" ").slice(1).join(" ") : "—"}`,
      },
      band: {
        label:
          ref.band.method === "waterfall" && !ref.hidden
            ? "Round-implied estimate · ordinary shares"
            : "Fair-value band · ordinary shares",
        value: ref.bandValue,
        caption: bandCaption,
      },
      last: {
        value: ref.hidden ? "Not disclosed" : last ? ref.money(last.priceMinor) : "—",
        caption: ref.hidden
          ? "The company limits who can see trade prices."
          : last
            ? `${formatShares(last.quantity, "prose").replace(" shares", " ordinary shares")} · ${formatDate(last.executedAt)}`
            : "No Atlas trades yet.",
      },
      terms: [
        { label: "Right of first refusal", value: `${ref.policy.rofrDays} days` },
        { label: "Minimum lot", value: formatShares(ref.policy.minLot, "table") },
        { label: "Buyer joinder", value: "Required" },
        {
          label: "Eligible buyers",
          value: ref.policy.allowedBuyerTypes.map((t) => INVESTOR_LABELS[t]).join(", "),
        },
      ],
    },
    chart: {
      points: chartPoints,
      ticks: monthlyTicks(viewer.now),
      hidden: ref.hidden,
      band:
        ref.hidden || ref.band.method === "none"
          ? null
          : { low: Number(ref.band.lowMinor) / 100, high: Number(ref.band.highMinor) / 100 },
      lastRound:
        company.lastRoundPriceMinor === null ? null : Number(company.lastRoundPriceMinor) / 100,
      lastRoundLabel: `Last round (preferred) ${company.lastRoundPriceMinor === null ? "—" : ref.money(company.lastRoundPriceMinor)}`,
      start: viewer.now.getTime() - 180 * DAY,
      end: viewer.now.getTime(),
      aside: `Ordinary shares · ${company.currency} per share · last 180 days`,
      ariaLabel: `${plural(chartPoints.length, "Atlas trade")} between ${chartPoints[0]?.date ?? "—"} and ${chartPoints.at(-1)?.date ?? "—"} against a fair-value band of ${ref.bandValue}`,
    },
    exit:
      company.lastRoundPostMoneyMinor === null
        ? null
        : exitSteps(company.lastRoundPostMoneyMinor, ref.classes, company.currency),
    listings: listingRows,
    qa: entries
      .filter(
        (e) =>
          e.companyId === company.id &&
          ((e.answer !== null && canInfo) || e.askedBy === viewer.user.id),
      )
      .sort((a, b) => (b.answeredAt ?? b.askedAt).getTime() - (a.answeredAt ?? a.askedAt).getTime())
      .map((e) => ({
        id: e.id,
        question: e.question,
        answer: e.answer,
        caption: e.answeredAt ? `Answered by ${company.name} · ${formatDate(e.answeredAt)}` : null,
      })),
    info: {
      status: canInfo ? ("approved" as const) : (ref.grant?.status ?? "none"),
      denial:
        ref.grant?.status === "denied" &&
        !buyerPolicy?.failures.some((f) => f.code === "BUYER_BLOCKED") &&
        buyerPolicy?.failures.some((f) => f.code === "BUYER_TYPE_NOT_ALLOWED")
          ? `${company.name} accepts only ${ref.policy.allowedBuyerTypes.map((t) => INVESTOR_LABELS[t]).join(", ")}.`
          : "The company has restricted access to its information.",
      nda: ref.grant ? `NDA accepted ${formatDate(ref.grant.requestedAt)}` : null,
      documents: canInfo
        ? docs
            .filter((d) => d.companyId === company.id && d.kind === "info_pack")
            .map((d) => ({
              id: d.id,
              title: d.title,
              label: "View only · watermarked",
              href: `/companies/${slug}/documents/${d.id}`,
            }))
        : [],
    },
  };
}
export type CompanyModel = NonNullable<Awaited<ReturnType<typeof getCompanyModel>>>;
export async function getDocumentModel(
  viewer: Viewer,
  slug: string,
  documentId: string,
  dbArg?: Db,
) {
  const db = dbArg ?? (await getDb());
  const company = (await companies.list(db, viewer.sandboxId)).find((c) => c.slug === slug);
  if (!company) return null;
  const grant = await grants.find(db, viewer.sandboxId, company.id, viewer.user.id);
  if (
    !can(viewer.actor, "company.viewInfoPack", {
      kind: "company",
      sandboxId: viewer.sandboxId,
      companyOrgId: company.orgId,
      accessGrant: grant?.status ?? "none",
    }).allowed
  )
    return null;
  const document = (await documents.list(db, viewer.sandboxId)).find(
    (d) => d.id === documentId && d.companyId === company.id && d.kind === "info_pack",
  );
  const content = document ? DEMO_DOCUMENTS[document.storageKey] : undefined;
  if (!document || !content) return null;
  const classes = await companies.classes(db, viewer.sandboxId, company.id),
    policy = await companies.policy(db, viewer.sandboxId, company.id);
  const total = classes.reduce((n, c) => n + c.shares, 0n);
  const rows =
    content.kind === "financials"
      ? content.rows
      : content.kind === "cap_table"
        ? classes
            .sort((a, b) => a.seniority - b.seniority)
            .map((c) => [
              c.name,
              formatShares(c.shares, "table"),
              `${(c.shares * 10000n) / total / 100n}.${(((c.shares * 10000n) / total) % 100n).toString().padStart(2, "0")}%`,
              formatMoney(c.originalPriceMinor, company.currency, "perShare"),
              c.kind === "preferred" ? `${c.prefMultipleBps / 10000}x non-participating` : "None",
            ])
        : [];
  const paragraphs =
    content.kind === "clauses"
      ? [
          `Right of first refusal: ${policy.rofrDays} days. Board approval and buyer joinder are required.`,
          `Lock-up: ${policy.lockupMonths} months. Minimum lot: ${formatShares(policy.minLot, "prose")}. Annual sale cap: ${policy.yearlyCapBps / 100}% of the holding.`,
        ]
      : [content.intro];
  const stamp = `${viewer.user.handle} · ${formatDateTime(viewer.now)}`;
  return {
    company: company.name,
    slug,
    title: document.title,
    heading: content.kind === "clauses" ? "Summary of transfer restrictions" : document.title,
    paragraphs,
    headers:
      content.kind === "financials"
        ? ["Metric", "FY2025", "FY2024"]
        : content.kind === "cap_table"
          ? ["Class", "Shares", "Fully diluted", "Original price", "Preference"]
          : [],
    rows,
    watermark: `Confidential · ${stamp}`,
    footer: `Watermarked for ${viewer.user.handle} on ${formatDateTime(viewer.now)}. Sharing this document breaches the NDA.`,
    note: "Figures are fictional and for demonstration only.",
  };
}
