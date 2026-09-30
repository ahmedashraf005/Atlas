import "server-only";
import { can } from "@/domain/authz";
import { tradeMachine } from "@/domain/machines";
import { evaluateBuyer, evaluateListing } from "@/domain/policy";
import { describeAction, describeActor } from "@/lib/audit-display";
import { formatDate, formatDateTime, formatMoney, formatShares } from "@/lib/format";
import { plural } from "@/lib/plural";
import { INVESTOR_LABELS } from "@/lib/policy-display";
import { mentionsPaymentChange, tradeBadge } from "@/lib/trade-display";
import { type Db, getDb } from "@/server/db/client";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as consoles from "@/server/repositories/consoles";
import * as discovery from "@/server/repositories/discovery";
import * as grants from "@/server/repositories/grants";
import * as holdings from "@/server/repositories/holdings";
import * as prints from "@/server/repositories/prints";
import * as qa from "@/server/repositories/qa";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import type { Viewer } from "@/server/viewer";
export interface ActivityView {
  seq: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  href: string | null;
}
export async function entityLinks(db: Db, viewer: Viewer) {
  const [cs, ls, ts] = await Promise.all([
    companies.list(db, viewer.sandboxId),
    discovery.publicListings(db, viewer.sandboxId),
    trades.visibleRows(db, viewer.sandboxId, viewer.actor),
  ]);
  const map = new Map<string, { label: string; href: string }>();
  for (const c of cs) map.set(c.id, { label: c.name, href: `/companies/${c.slug}` });
  for (const l of ls)
    map.set(l.id, {
      label: l.ref,
      href:
        viewer.actor.role === "operator"
          ? `/listings/${l.id}`
          : `/companies/${cs.find((c) => c.id === l.companyId)?.slug}`,
    });
  for (const t of ts) map.set(t.id, { label: t.ref, href: `/trades/${t.id}` });
  const [hs, bs, qs, gs] = await Promise.all([
    holdings.list(db, viewer.sandboxId),
    bids.list(db, viewer.sandboxId),
    qa.list(db, viewer.sandboxId),
    grants.list(db, viewer.sandboxId),
  ]);
  for (const h of hs) {
    const company = cs.find((c) => c.id === h.companyId);
    map.set(h.id, {
      label: `${company?.name ?? "Company"} holding`,
      href:
        viewer.actor.role === "seller"
          ? `/holdings/${h.id}`
          : `/companies/${company?.slug ?? "falaj-robotics"}`,
    });
  }
  for (const b of bs) {
    const listing = ls.find((l) => l.id === b.listingId);
    if (listing) map.set(b.id, { label: `Bid on ${listing.ref}`, href: `/listings/${listing.id}` });
  }
  for (const q of qs) {
    const company = cs.find((c) => c.id === q.companyId);
    if (company)
      map.set(q.id, { label: `${company.name} question`, href: `/companies/${company.slug}` });
  }
  for (const g of gs) {
    const company = cs.find((c) => c.id === g.companyId);
    if (company)
      map.set(g.id, { label: `${company.name} access`, href: `/companies/${company.slug}` });
  }
  return map;
}
export async function activityModel(
  db: Db,
  viewer: Viewer,
  limit: number,
  ids?: string[],
): Promise<ActivityView[]> {
  const [entries, people, links] = await Promise.all([
    consoles.activity(db, viewer.sandboxId, limit, ids),
    users.list(db, viewer.sandboxId),
    entityLinks(db, viewer),
  ]);
  return entries.map((e) => ({
    seq: String(e.seq),
    at: formatDateTime(e.at),
    actor: describeActor(e, people),
    action: describeAction(e.action),
    entity: links.get(e.entityId)?.label ?? e.entityId,
    href: e.action === "policy.update" ? "/company/policy" : (links.get(e.entityId)?.href ?? null),
  }));
}
export interface DecisionItem {
  id: string;
  kind: "rofr" | "register" | "holding" | "access" | "question";
  title: string;
  detail: string;
  deadline: string | null;
  href: string | null;
  confirmation: string;
  companyId: string;
  buyerId: string;
  policyOk: boolean;
  failures: string[];
}
export async function ownCompany(db: Db, viewer: Viewer) {
  if (viewer.actor.role !== "company_admin" || viewer.actor.sandboxId !== viewer.sandboxId)
    return null;
  const company = (await companies.list(db, viewer.sandboxId)).find(
    (c) => c.orgId === viewer.actor.orgId,
  );
  if (
    !company ||
    !can(viewer.actor, "policy.update", {
      kind: "company",
      sandboxId: viewer.sandboxId,
      companyOrgId: company.orgId,
      accessGrant: "none",
    }).allowed
  )
    return null;
  return company;
}
export async function getCompanyConsoleModel(viewer: Viewer, database?: Db) {
  const db = database ?? (await getDb());
  const company = await ownCompany(db, viewer);
  if (!company) return null;
  const sid = viewer.sandboxId;
  const [people, ts, hs, gs, qs, ls, classes, policy, ids] = await Promise.all([
    users.list(db, sid),
    trades.visibleRows(db, sid, viewer.actor),
    consoles.pendingHoldings(db, sid, company.id),
    grants.list(db, sid),
    qa.list(db, sid),
    discovery.publicListings(db, sid),
    companies.classes(db, sid, company.id),
    companies.policy(db, sid, company.id),
    consoles.companyEntityIds(db, sid, company.id),
  ]);
  const person = (id: string) => people.find((p) => p.id === id);
  const decisions: { item: DecisionItem; created: number; deadline: number }[] = [];
  function add(
    kind: DecisionItem["kind"],
    id: string,
    title: string,
    detail: string,
    created: Date,
    extra: Partial<DecisionItem> = {},
  ) {
    const item: DecisionItem = {
      id,
      kind,
      title,
      detail,
      deadline: null,
      href: null,
      confirmation: "",
      companyId: company?.id ?? "",
      buyerId: "",
      policyOk: true,
      failures: [],
      ...extra,
    };
    decisions.push({
      item,
      created: created.getTime(),
      deadline: item.deadline ? new Date(item.deadline).getTime() : Infinity,
    });
  }
  for (const t of ts) {
    if (t.status === "RofrPending")
      add(
        "rofr",
        t.id,
        `Right of first refusal · ${t.ref}`,
        `${formatShares(t.quantity, "table")} at ${formatMoney(t.priceMinor, t.currency, "perShare")} to ${person(t.buyerId)?.displayName}`,
        t.createdAt,
        { deadline: t.rofrDeadline?.toISOString(), href: `/trades/${t.id}` },
      );
    if (t.status === "Funded")
      add(
        "register",
        t.id,
        `Update the register · ${t.ref}`,
        `${formatShares(t.quantity, "table")} from ${person(t.sellerId)?.displayName} to ${person(t.buyerId)?.displayName}`,
        t.fundedAt ?? t.createdAt,
        { href: `/trades/${t.id}` },
      );
  }
  for (const h of hs) {
    const owner = person(h.ownerId),
      name = classes.find((c) => c.id === h.shareClassId)?.name ?? "";
    add(
      "holding",
      h.id,
      "Verify a holding",
      `${owner?.displayName} · ${owner?.handle} claims ${formatShares(h.quantity, "table")} ${name} shares, acquired ${formatDate(h.acquiredAt)}`,
      h.submittedAt,
      {
        confirmation: `Confirm ${owner?.displayName} holds ${formatShares(h.quantity, "table")} ${name} shares on your register?`,
      },
    );
  }
  for (const grant of gs.filter((g) => g.companyId === company.id && g.status === "pending")) {
    const buyer = person(grant.buyerId);
    if (!buyer?.orgId || !buyer.investorType) continue;
    const eligible = evaluateBuyer({
      policy,
      buyer: {
        userId: buyer.id,
        orgId: buyer.orgId,
        investorType: buyer.investorType,
        kycStatus: buyer.kycStatus,
        professionalVerified: buyer.professionalVerified,
      },
    });
    add(
      "access",
      grant.id,
      "Access request",
      `${buyer.displayName} · ${buyer.handle} · ${INVESTOR_LABELS[buyer.investorType]}`,
      grant.requestedAt,
      {
        buyerId: buyer.id,
        policyOk: eligible.ok,
        failures: eligible.failures.map((f) => f.message),
      },
    );
  }
  for (const q of qs.filter((q) => q.companyId === company.id && q.answer === null))
    add("question", q.id, `Question from ${person(q.askedBy)?.handle}`, q.question, q.askedAt);
  decisions.sort(
    (a, b) =>
      a.deadline - b.deadline || a.created - b.created || a.item.id.localeCompare(b.item.id),
  );
  const since = viewer.now.getTime() - 180 * 86400000;
  const ordinary = classes.find((c) => c.kind === "ordinary");
  const recentPrints = (await prints.list(db, sid)).filter(
    (p) =>
      p.companyId === company.id &&
      p.shareClassId === ordinary?.id &&
      !p.relatedParty &&
      p.executedAt.getTime() >= since &&
      p.executedAt <= viewer.now,
  );
  const traded = recentPrints.reduce((sum, p) => sum + p.quantity * p.priceMinor, 0n);
  return {
    name: company.name,
    slug: company.slug,
    now: viewer.now.toISOString(),
    autopilot: viewer.autopilot,
    figures: [
      { label: "Decisions waiting", value: String(decisions.length) },
      {
        label: "Live listings",
        value: String(ls.filter((l) => l.companyId === company.id && l.status === "Live").length),
      },
      {
        label: "Trades in progress",
        value: String(ts.filter((t) => !tradeMachine.terminal.includes(t.status)).length),
      },
      {
        label: "Traded on Atlas (180 days)",
        value: formatMoney(traded, company.currency),
        caption: plural(recentPrints.length, "trade"),
      },
    ],
    decisions: decisions.map((d) => d.item),
    activity: await activityModel(db, viewer, 10, [
      ...ids,
      ...ts.map((t) => t.id),
      ...gs.filter((g) => g.companyId === company.id).map((g) => g.id),
    ]),
  };
}
export async function getOpsConsoleModel(viewer: Viewer, database?: Db) {
  const db = database ?? (await getDb());
  if (!can(viewer.actor, "audit.view", { kind: "sandbox", sandboxId: viewer.sandboxId }).allowed)
    return null;
  const sid = viewer.sandboxId,
    [cs, ts, ls, people, flagged] = await Promise.all([
      companies.list(db, sid),
      trades.visibleRows(db, sid, viewer.actor),
      consoles.reviewListings(db, sid),
      users.list(db, sid),
      consoles.flaggedMessages(db, sid),
    ]);
  const review = await Promise.all(
    ls.map(async (l) => {
      const holding = await holdings.find(db, sid, l.holdingId);
      if (!holding) throw Error("Listing holding missing");
      const policy = await companies.policy(db, sid, l.companyId),
        committed = await holdings.committedQty(db, sid, holding.id, viewer.now);
      // SUBMIT already reserved this listing's shares. Remove only that reservation for re-evaluation.
      const eligible = evaluateListing({
        policy,
        holding: { ...holding, reservedQty: holding.reservedQty - l.quantity },
        soldInLast12Months: committed - l.quantity,
        now: viewer.now,
        quantity: l.quantity,
        minFill: l.minFill,
      });
      return {
        id: l.id,
        ref: l.ref,
        company: cs.find((c) => c.id === l.companyId)?.name ?? "",
        seller: people.find((p) => p.id === l.sellerId)?.handle ?? "",
        quantity: formatShares(l.quantity, "table"),
        minFill: formatShares(l.minFill, "table"),
        reserve: formatMoney(l.reservePriceMinor, l.currency, "perShare"),
        window: `${l.windowDays} days`,
        submitted: formatDateTime(l.createdAt),
        policyOk: eligible.ok,
        failures: eligible.failures.map((f) => f.message),
      };
    }),
  );
  const money = ts
    .filter((t) => t.status === "TransferPending" || (t.status === "AwaitingFunds" && t.wireSentAt))
    .map((t) => ({
      id: t.id,
      ref: t.ref,
      company: cs.find((c) => c.id === t.companyId)?.name ?? "",
      total: formatMoney(t.quantity * t.priceMinor, t.currency),
      state:
        t.status === "AwaitingFunds"
          ? "Confirm funds"
          : `Approvals ${t.releaseApprovals.length} of 2`,
      approved: t.releaseApprovals.includes(viewer.user.id),
    }));
  const held = ts.filter((t) => t.fundedAt && !["Settled", "Cancelled"].includes(t.status));
  const balances = (["AED", "USD"] as const)
    .map((currency) => ({
      currency,
      amount: held
        .filter((t) => t.currency === currency)
        .reduce((sum, t) => sum + t.quantity * t.priceMinor, 0n),
    }))
    .filter((b) => b.amount > 0n);
  return {
    autopilot: viewer.autopilot,
    review,
    money,
    figures: [
      { label: "Listings to review", value: String(review.length) },
      { label: "Releases waiting", value: String(money.length) },
      { label: "Open disputes", value: String(ts.filter((t) => t.status === "Disputed").length) },
      {
        label: "Held in escrow",
        value: balances.length
          ? balances.map((b) => formatMoney(b.amount, b.currency)).join(" · ")
          : "AED 0",
      },
    ],
    disputes: ts
      .filter((t) => t.status === "Disputed")
      .map((t) => ({
        id: t.id,
        ref: t.ref,
        company: cs.find((c) => c.id === t.companyId)?.name ?? "",
        reason: t.disputeReason ?? "",
        badge: tradeBadge(t.status),
      })),
    flagged: flagged.map(({ message: m, tradeId }) => ({
      id: m.id,
      at: formatDateTime(m.createdAt),
      trade: ts.find((t) => t.id === tradeId)?.ref ?? "",
      href: tradeId ? `/trades/${tradeId}` : null,
      sender: people.find((p) => p.id === m.senderId)?.handle ?? "",
      contact: m.flagged,
      payment: m.found.includes("payment_change") || mentionsPaymentChange(m.bodyRedacted),
      excerpt: m.bodyRedacted.slice(0, 100),
    })),
    activity: await activityModel(db, viewer, 15),
  };
}
