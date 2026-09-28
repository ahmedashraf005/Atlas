import "server-only";
import { z } from "zod";
import type { AuditEntry } from "@/domain/audit";
import { can } from "@/domain/authz";
import type { Trade } from "@/domain/types";
import { formatDate, formatDateTime, formatMoney, formatShares } from "@/lib/format";
import {
  cancelReasonText,
  mentionsPaymentChange,
  moreTradeActions,
  nextStep,
  type TradeFacts,
  type TradeTone,
  tradeBadge,
  tradeResource,
  waitingOn,
  yourMove,
} from "@/lib/trade-display";
import { type Database, getDb } from "@/server/db/client";
import * as audit from "@/server/repositories/audit";
import * as companies from "@/server/repositories/companies";
import * as documents from "@/server/repositories/documents";
import * as escrow from "@/server/repositories/escrow";
import * as holdings from "@/server/repositories/holdings";
import * as listings from "@/server/repositories/listings";
import * as messages from "@/server/repositories/messages";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import type { Viewer } from "@/server/viewer";

const documentTitles: Record<string, string> = {
  transfer_agreement: "Share transfer agreement",
  register_extract: "Register extract",
  completion_certificate: "Completion certificate",
};
const completed = (trade: Trade) =>
  ["Settled", "Cancelled", "RofrExercised"].includes(trade.status);
const nextDeadline = (trade: Trade) =>
  trade.status === "RofrPending"
    ? trade.rofrDeadline
    : trade.status === "AwaitingFunds"
      ? trade.fundingDeadline
      : null;
async function load(viewer: Viewer, id: string, db: Database) {
  if (!z.uuid().safeParse(id).success) return null;
  const row = await trades.findRow(db, viewer.sandboxId, id);
  if (!row) return null;
  const company = await companies.find(db, viewer.sandboxId, row.companyId);
  if (!company || !can(viewer.actor, "trade.view", tradeResource(row, company.orgId)).allowed)
    return null;
  const seller = await users.find(db, viewer.sandboxId, row.sellerId),
    buyer = await users.find(db, viewer.sandboxId, row.buyerId);
  const listing = await listings.findPublic(db, viewer.sandboxId, row.listingId),
    classes = await companies.classes(db, viewer.sandboxId, row.companyId),
    policy = await companies.policy(db, viewer.sandboxId, row.companyId);
  if (!seller || !buyer || !listing) return null;
  const shareClass = classes.find((c) => c.id === row.shareClassId);
  if (!shareClass) return null;
  return { row, company, seller, buyer, listing, shareClass, policy };
}
export async function getTradesModel(viewer: Viewer, database?: Database) {
  const db = database ?? (await getDb());
  const rows = [];
  for (const row of await trades.visibleRows(db, viewer.sandboxId, viewer.actor)) {
    const data = await load(viewer, row.id, db);
    if (!data) continue;
    const move = yourMove(viewer.actor, row, data.company.orgId),
      deadline = nextDeadline(row);
    rows.push({
      id: row.id,
      ref: row.ref,
      href: `/trades/${row.id}`,
      listing: `from ${data.listing.ref}`,
      company: data.company.name,
      shareClass: data.shareClass.name,
      counterparty:
        viewer.actor.role === "seller"
          ? data.buyer.displayName
          : viewer.actor.role === "buyer"
            ? data.seller.displayName
            : `${data.seller.displayName} → ${data.buyer.displayName}`,
      quantity: formatShares(row.quantity, "table"),
      price: formatMoney(row.priceMinor, row.currency, "perShare"),
      total: formatMoney(row.priceMinor * row.quantity, row.currency),
      badge: tradeBadge(row.status),
      yourMove: move,
      deadline: deadline?.toISOString() ?? null,
      completed: completed(row),
      createdAt: row.createdAt.toISOString(),
    });
  }
  rows.sort(
    (a, b) =>
      Number(b.yourMove) - Number(a.yourMove) ||
      (a.deadline ? new Date(a.deadline).getTime() : Infinity) -
        (b.deadline ? new Date(b.deadline).getTime() : Infinity) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.ref.localeCompare(b.ref),
  );
  return { now: viewer.now.toISOString(), rows };
}
export type TradesModel = Awaited<ReturnType<typeof getTradesModel>>;
export interface TimelineStep {
  key: string;
  title: string;
  state: "done" | "current" | "upcoming" | "stopped";
  tone: TradeTone;
  details: string[];
  waiting: string | null;
  deadline: string | null;
}
async function timeline(
  viewer: Viewer,
  trade: Trade,
  facts: TradeFacts,
  entries: AuditEntry[],
  db: Database,
  fundingDays: number,
): Promise<TimelineStep[]> {
  const allUsers = await users.list(db, viewer.sandboxId),
    display = (id: string) => {
      const u = allUsers.find((u) => u.id === id);
      return u ? `${u.displayName} · ${u.handle}` : "Atlas operations";
    };
  const actor = (entry: Pick<AuditEntry, "actorRole" | "actorId" | "simulated">) =>
    entry.actorRole === "system"
      ? "Atlas (deadline)"
      : `${display(entry.actorId)}${entry.simulated ? " (auto-pilot)" : ""}`;
  const entryFor = (event: string) => entries.find((e) => e.action === `trade.${event}`);
  const recorded = (event: string, at: Date | null, fallback: string, prefix = "") => {
    const e = entryFor(event);
    return e
      ? `${prefix}${actor(e)} · ${formatDateTime(e.at)}`
      : at
        ? `${prefix}${fallback} · ${formatDateTime(at)} · Demo snapshot`
        : null;
  };
  const steps: TimelineStep[] = [];
  const step = (key: string, title: string, done: boolean, details: (string | null)[]) =>
    steps.push({
      key,
      title,
      state: done ? "done" : "upcoming",
      tone: done ? "success" : "neutral",
      details: details.filter((d): d is string => d !== null),
      waiting: null,
      deadline: null,
    });
  const allocation = await audit.listingAllocationAt(
    db,
    viewer.sandboxId,
    trade.listingId,
    trade.createdAt,
  );
  step("accepted", "Bid accepted", true, [
    allocation
      ? `${actor(allocation)} · ${formatDateTime(allocation.at)}`
      : recorded("create", trade.createdAt, display(trade.sellerId)),
  ]);
  step("agreement", "Agreement signed", !!trade.sellerSignedAt && !!trade.buyerSignedAt, [
    recorded("SELLER_SIGN", trade.sellerSignedAt, display(trade.sellerId)),
    recorded("BUYER_SIGN", trade.buyerSignedAt, display(trade.buyerId)),
  ]);
  const rofr = entries.find((e) =>
    ["trade.WAIVE", "trade.LAPSE", "trade.EXERCISE"].includes(e.action),
  );
  const rofrDone = !!rofr || !!trade.fundingDeadline || trade.status === "RofrExercised";
  const snapshotAdmin = allUsers.find(
    (u) => u.role === "company_admin" && u.orgId === facts.companyOrgId,
  );
  const snapshotDecisionAt = trade.fundingDeadline
    ? new Date(trade.fundingDeadline.getTime() - fundingDays * 86400000)
    : null;
  const rofrDetail = rofr
    ? `${rofr.action === "trade.LAPSE" ? "Lapsed — deadline passed" : rofr.action === "trade.EXERCISE" ? "Exercised" : "Waived"} · ${actor(rofr)} · ${formatDateTime(rofr.at)}`
    : snapshotDecisionAt
      ? `Waived · ${snapshotAdmin ? display(snapshotAdmin.id) : facts.companyName} · ${formatDateTime(snapshotDecisionAt)} · Demo snapshot (date inferred)`
      : null;
  step("rofr", "Right of first refusal", rofrDone, [rofrDetail]);
  step("funds", "Funds in escrow", !!trade.fundedAt, [
    recorded(
      "CONFIRM_FUNDS",
      trade.fundedAt,
      display(allUsers.find((u) => u.role === "operator" && u.simulatedOnly)?.id ?? "system"),
    ),
  ]);
  step("register", "Register updated", !!trade.registerUpdatedAt, [
    recorded(
      "UPLOAD_REGISTER",
      trade.registerUpdatedAt,
      snapshotAdmin ? display(snapshotAdmin.id) : facts.companyName,
    ),
  ]);
  const approvals = entries.filter((e) => e.action === "trade.APPROVE_RELEASE");
  step(
    "released",
    "Released",
    trade.status === "Settled",
    trade.releaseApprovals.map((id) => {
      const e = approvals.find((e) => e.actorId === id);
      return e
        ? `${actor(e)} · ${formatDateTime(e.at)}`
        : `${display(id)}${trade.settledAt ? ` · ${formatDateTime(trade.settledAt)}` : ""} · Demo snapshot`;
    }),
  );
  if (["Cancelled", "RofrExercised", "Disputed"].includes(trade.status)) {
    const lastDone = steps.reduce((last, s, i) => (s.state === "done" ? i : last), 0),
      branch = entries.findLast(
        (e) =>
          e.after &&
          typeof e.after === "object" &&
          !Array.isArray(e.after) &&
          "status" in e.after &&
          e.after.status === trade.status,
      );
    const kept = steps.slice(0, lastDone + 1);
    kept.push({
      key: "branch",
      title: tradeBadge(trade.status).text,
      state: "stopped",
      tone: trade.status === "RofrExercised" ? "neutral" : "danger",
      details: [
        trade.status === "Cancelled"
          ? cancelReasonText(trade.cancelReason)
          : trade.status === "Disputed"
            ? (trade.disputeReason ?? "Awaiting Atlas review.")
            : (rofrDetail ?? "Exercised"),
        ...(branch ? [`${actor(branch)} · ${formatDateTime(branch.at)}`] : []),
      ],
      waiting: null,
      deadline: null,
    });
    return kept;
  }
  const current = steps.find((s) => s.state !== "done");
  if (current) {
    current.state = "current";
    current.tone = yourMove(viewer.actor, trade, facts.companyOrgId) ? "warning" : "info";
    current.waiting = waitingOn(trade)
      .parties.map(
        (p) =>
          ({
            company: facts.companyName,
            seller: facts.seller,
            buyer: facts.buyer,
            escrow: "the escrow agent",
            operators: "Atlas operations",
            operator: "Atlas operations",
          })[p],
      )
      .join(" and ");
    current.deadline = nextDeadline(trade)?.toISOString() ?? null;
  }
  return steps;
}
export async function getTradeRoomModel(viewer: Viewer, id: string, database?: Database) {
  const db = database ?? (await getDb());
  const data = await load(viewer, id, db);
  if (!data) return null;
  const { row, company, seller, buyer, listing, shareClass, policy } = data;
  const docs = (await documents.forTrade(db, viewer.sandboxId, id)).map((d) => ({
    id: d.id,
    title: documentTitles[d.kind] ?? d.title,
    kind: d.kind,
    href: `/trades/${id}/documents/${d.id}`,
  }));
  const facts = {
    companyName: company.name,
    companyOrgId: company.orgId,
    seller: seller.displayName,
    buyer: buyer.displayName,
    rofrDays: policy.rofrDays,
    completionHref: docs.find((d) => d.kind === "completion_certificate")?.href ?? null,
  };
  const entries = await audit.forTrade(db, viewer.sandboxId, id),
    events = await escrow.forTrade(db, viewer.sandboxId, id);
  const allUsers = await users.list(db, viewer.sandboxId),
    thread =
      viewer.actor.role === "company_admin"
        ? null
        : (await messages.forTrade(db, viewer.sandboxId, id)).map((m) => {
            const user = allUsers.find((u) => u.id === m.senderId);
            return {
              id: m.id,
              sender: user ? `${user.displayName} · ${user.handle}` : "Atlas operations",
              at: formatDateTime(m.createdAt),
              body: m.bodyRedacted,
              flagged: m.flagged,
              paymentWarning:
                m.found.includes("payment_change") || mentionsPaymentChange(m.bodyRedacted),
            };
          });
  const held = events.reduce(
    (sum, e) =>
      e.kind === "funded"
        ? sum + e.amountMinor
        : e.kind === "released" || e.kind === "refunded"
          ? sum - e.amountMinor
          : sum,
    0n,
  );
  return {
    id,
    ref: row.ref,
    now: viewer.now.toISOString(),
    company: company.name,
    shareClass: shareClass.name,
    badge: tradeBadge(row.status),
    yourMove: yourMove(viewer.actor, row, company.orgId),
    listing:
      viewer.actor.role === "seller" || viewer.actor.role === "operator"
        ? { ref: listing.ref, href: `/listings/${listing.id}` }
        : null,
    summary: {
      quantity: formatShares(row.quantity, "table"),
      price: formatMoney(row.priceMinor, row.currency, "perShare"),
      total: formatMoney(row.priceMinor * row.quantity, row.currency),
      escrowRef: row.escrowRef,
    },
    nextStep: nextStep(viewer, row, facts),
    more: moreTradeActions(viewer.actor, row, company.orgId),
    timeline: await timeline(viewer, row, facts, entries, db, policy.fundingDays),
    parties: {
      seller: `${seller.displayName} · ${seller.handle}`,
      buyer: `${buyer.displayName} · ${buyer.handle}`,
      company: `${company.name} · ROFR ${policy.rofrDays} days`,
    },
    checklist: [
      { label: "Seller signed", done: !!row.sellerSignedAt },
      { label: "Buyer signed", done: !!row.buyerSignedAt },
      { label: "ROFR decision", done: !!row.fundingDeadline || row.status === "RofrExercised" },
      { label: "Funds received", done: !!row.fundedAt },
      { label: "Register updated", done: !!row.registerUpdatedAt },
      {
        label: `Release approvals ${row.releaseApprovals.length} of 2`,
        done: row.releaseApprovals.length === 2,
      },
    ],
    escrow: {
      events: events.map((e) => ({
        id: e.id,
        label:
          e.kind === "wire_sent"
            ? "Wire sent"
            : `${({ funded: "Funds received", released: "Released to seller", refunded: "Refunded to buyer" } as const)[e.kind]} ${formatMoney(e.amountMinor, e.currency)}`,
        at: formatDateTime(e.at),
      })),
      held: held > 0n ? `Held in escrow: ${formatMoney(held, row.currency)}` : "Nothing held yet.",
    },
    documents: docs,
    messages: thread,
    operatorPayment: viewer.actor.role === "operator",
  };
}
export type TradeRoomModel = NonNullable<Awaited<ReturnType<typeof getTradeRoomModel>>>;
export async function getTradeDocumentModel(
  viewer: Viewer,
  tradeId: string,
  documentId: string,
  database?: Database,
) {
  const db = database ?? (await getDb());
  const data = await load(viewer, tradeId, db);
  if (!data || !z.uuid().safeParse(documentId).success) return null;
  const document = (await documents.forTrade(db, viewer.sandboxId, tradeId)).find(
    (d) => d.id === documentId,
  );
  if (!document) return null;
  const { row, seller, buyer, company, shareClass, policy } = data,
    classQuantity = formatShares(row.quantity, "prose").replace(
      / shares?$/,
      ` ${shareClass.name} ${row.quantity === 1n ? "share" : "shares"}`,
    ),
    price = formatMoney(row.priceMinor, row.currency, "perShare"),
    total = formatMoney(row.quantity * row.priceMinor, row.currency);
  const paragraphs: string[] = [],
    headers: string[] = [],
    rows: string[][] = [];
  if (document.kind === "transfer_agreement") {
    paragraphs.push(
      `Seller: ${seller.displayName} · ${seller.handle}. Buyer: ${buyer.displayName} · ${buyer.handle}.`,
      `${classQuantity} of ${company.name} at ${price} per share, total ${total}.`,
      `${company.name} has ${policy.rofrDays} days to decide on its right of first refusal. Escrow reference: ${row.escrowRef}.`,
      row.sellerSignedAt && row.buyerSignedAt
        ? `Signed by ${seller.displayName} on ${formatDateTime(row.sellerSignedAt)} and ${buyer.displayName} on ${formatDateTime(row.buyerSignedAt)}.`
        : "Not yet signed.",
    );
  } else if (document.kind === "register_extract") {
    paragraphs.push(
      `Register of members — ${company.name} — extract as of ${formatDate(document.createdAt)}.`,
    );
    const holding = await holdings.find(db, viewer.sandboxId, row.holdingId),
      buyerHoldings = (await holdings.forOwner(db, viewer.sandboxId, row.buyerId)).filter(
        (h) => h.shareClassId === row.shareClassId,
      ),
      history = await trades.registerHistory(
        db,
        viewer.sandboxId,
        row.holdingId,
        row.buyerId,
        row.shareClassId,
      );
    const earlier = (t: (typeof history)[number]) => {
      const at = t.settledAt ?? t.exercisedAt;
      return t.id !== row.id && at !== null && at <= document.createdAt;
    };
    const soldTrades = history.filter((t) => t.holdingId === row.holdingId),
      knownSold = soldTrades.reduce((sum, t) => sum + t.quantity, 0n),
      earlierSold = soldTrades.filter(earlier).reduce((sum, t) => sum + t.quantity, 0n);
    const sellerBefore = holding
      ? holding.quantity - (holding.soldQty - knownSold) - earlierSold
      : row.quantity;
    const receipts = history.filter((t) => t.buyerId === row.buyerId && t.status === "Settled"),
      knownReceived = receipts.reduce((sum, t) => sum + t.quantity, 0n),
      earlierReceived = receipts.filter(earlier).reduce((sum, t) => sum + t.quantity, 0n),
      buyerSales = history.filter((t) => t.sellerId === row.buyerId),
      knownBuyerSales = buyerSales.reduce((sum, t) => sum + t.quantity, 0n),
      earlierBuyerSales = buyerSales.filter(earlier).reduce((sum, t) => sum + t.quantity, 0n);
    const buyerBefore =
      buyerHoldings.reduce((sum, h) => sum + h.quantity - h.soldQty, 0n) -
      knownReceived +
      earlierReceived +
      knownBuyerSales -
      earlierBuyerSales;
    headers.push("Holder", "Class", "Shares before", "Shares after");
    rows.push(
      [
        `${seller.displayName} · ${seller.handle}`,
        shareClass.name,
        formatShares(sellerBefore, "table"),
        formatShares(sellerBefore - row.quantity, "table"),
      ],
      [
        `${buyer.displayName} · ${buyer.handle}`,
        shareClass.name,
        formatShares(buyerBefore, "table"),
        formatShares(buyerBefore + row.quantity, "table"),
      ],
    );
  } else if (document.kind === "completion_certificate") {
    paragraphs.push(
      `${classQuantity} of ${company.name} transferred from ${seller.displayName} to ${buyer.displayName} at ${price} per share (total ${total}) on ${row.settledAt ? formatDate(row.settledAt) : formatDate(document.createdAt)}. Escrow ${row.escrowRef} released.`,
    );
    const allUsers = await users.list(db, viewer.sandboxId);
    paragraphs.push(
      `Release approved by ${row.releaseApprovals
        .map((id) => {
          const u = allUsers.find((u) => u.id === id);
          return u ? `${u.displayName} · ${u.handle}` : "Atlas operations";
        })
        .join(" and ")}.`,
    );
  } else return null;
  return {
    title: documentTitles[document.kind] ?? document.title,
    tradeId,
    ref: row.ref,
    paragraphs,
    headers,
    rows,
    watermark: { handle: viewer.user.handle, time: formatDateTime(viewer.now) },
  };
}
