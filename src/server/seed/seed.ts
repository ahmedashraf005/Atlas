import "server-only";
import { v7 } from "uuid";
import type { Tx } from "@/server/db/client";
import * as s from "@/server/db/schema";
import * as data from "@/server/seed/data";
export async function seedSandbox(tx: Tx, sandboxId: string, now: Date): Promise<void> {
  const ids = new Map<string, string>();
  const id = (key: string) => {
    let value = ids.get(key);
    if (!value) {
      value = v7();
      ids.set(key, value);
    }
    return value;
  };
  const org = (key: string) => id(`org:${key}`),
    user = (key: string) => id(`user:${key}`),
    company = (key: string) => id(`company:${key}`),
    ordinary = (key: string) => id(`ordinary:${key}`);
  const hours = (n: number) => new Date(now.getTime() + n * 3_600_000),
    days = (n: number) => hours(n * 24);
  for (const [key, kind, name] of data.organizationSpecs)
    await tx.insert(s.organizations).values({
      id: org(key),
      sandboxId,
      kind,
      name,
      jurisdiction: kind === "company" ? "UAE" : null,
    });
  for (const u of data.userSpecs) {
    const orgName = data.organizationSpecs.find((o) => o[0] === u.org)?.[2] ?? "";
    const subtitle =
      u.role === "buyer"
        ? "Professional investor · KYC verified"
        : u.role === "seller"
          ? "Shareholder · KYC verified"
          : u.role === "operator"
            ? "Atlas operations"
            : orgName;
    await tx.insert(s.users).values({
      id: user(u.key),
      sandboxId,
      orgId: u.org ? org(u.org) : null,
      role: u.role,
      personaKey: u.persona,
      handle: u.handle,
      displayName: u.name,
      subtitle,
      investorType: u.investorType,
      kycStatus: "verified",
      professionalVerified: u.role === "buyer",
      simulatedOnly: u.persona === null,
    });
  }
  await tx
    .insert(s.beneficialOwners)
    .values({ sandboxId, userId: user("seller_2"), orgId: org("buyer_d") });
  for (const c of data.companySpecs) {
    await tx.insert(s.companies).values({
      id: company(c.key),
      sandboxId,
      orgId: org(c.key),
      slug: c.slug,
      name: c.name,
      sector: c.sector,
      stage: c.stage,
      incorporation: c.incorporation,
      currency: c.currency,
      description: c.description,
      lastRoundName: c.round,
      lastRoundPriceMinor: c.price,
      lastRoundDate: days(-c.roundDays),
      lastRoundPostMoneyMinor: c.postMoney,
    });
    for (const [index, [name, shares, price]] of c.classes.entries())
      await tx.insert(s.shareClasses).values({
        id: price === 0n ? ordinary(c.key) : id(`class:${c.key}:${index}`),
        sandboxId,
        companyId: company(c.key),
        name,
        kind: price === 0n ? "ordinary" : "preferred",
        seniority: index + 1,
        shares,
        originalPriceMinor: price,
        prefMultipleBps: price === 0n ? 0 : 10000,
      });
    await tx.insert(s.transferPolicies).values({
      sandboxId,
      companyId: company(c.key),
      rofrDays: c.rofrDays,
      fundingDays: 5,
      minLot: c.minLot,
      lockupMonths: c.lockupMonths,
      blackoutWindows:
        c.key === "qamra"
          ? [
              {
                start: days(-2).toISOString(),
                end: days(10).toISOString(),
                label: "Series B fundraising",
              },
            ]
          : [],
      allowedBuyerTypes:
        c.key === "wadi"
          ? ["family_office", "fund"]
          : ["family_office", "hnwi", "fund", "angel_syndicate"],
      blockedOrgIds: c.key === "falaj" ? [org("dune")] : [],
      priceVisibility: c.visibility,
      yearlyCapBps: c.cap,
    });
  }
  for (const [key, owner, c, quantity, reservedQty, soldQty, acquired, status] of data.holdingSpecs)
    await tx.insert(s.holdings).values({
      id: id(key),
      sandboxId,
      ownerId: user(owner),
      companyId: company(c),
      shareClassId: ordinary(c),
      quantity,
      reservedQty,
      soldQty,
      acquiredAt: days(-acquired),
      status,
      rejectionReason: null,
    });
  for (const [
    ref,
    seller,
    holding,
    quantity,
    minFill,
    reservePriceMinor,
    windowDays,
    opens,
    closes,
    status,
    countersSent,
  ] of data.listingSpecs)
    await tx.insert(s.listings).values({
      id: id(ref),
      sandboxId,
      ref,
      holdingId: id(holding),
      sellerId: user(seller),
      companyId: company("falaj"),
      shareClassId: ordinary("falaj"),
      currency: "AED",
      quantity,
      minFill,
      reservePriceMinor,
      windowDays,
      windowOpensAt: hours(opens),
      windowClosesAt: hours(closes),
      status,
      countersSent,
      rejectionReason: null,
      createdAt: hours(opens),
    });
  for (const [listing, buyer, priceMinor, quantity, minFill, submitted, status] of data.bidSpecs) {
    const closes = data.listingSpecs.find((l) => l[0] === listing)?.[8];
    if (closes === undefined) throw new Error("Seed listing missing");
    await tx.insert(s.bids).values({
      id: id(`bid:${listing}:${buyer}`),
      sandboxId,
      listingId: id(listing),
      buyerId: user(buyer),
      buyerOrgId: org(buyer),
      priceMinor,
      quantity,
      minFill,
      rationale: "",
      submittedAt: hours(submitted),
      amendedAt: null,
      expiresAt: hours(closes + 14 * 24),
      counterPriceMinor: status === "Countered" ? 3550n : null,
      counterExpiresAt: status === "Countered" ? hours(41) : null,
      counterOutcome: status === "Countered" ? "pending" : null,
      allocatedQty: status === "Accepted" ? quantity : null,
      rejectionReason: status === "Rejected" ? "Not selected by the seller" : null,
      idempotencyKey: `seed:${listing}:${buyer}`,
      status,
    });
  }
  for (const [ref, buyer, quantity, priceMinor, settled] of [
    ["T-1036", "buyer_a", 4000n, 3580n, true],
    ["T-1042", "buyer_b", 2500n, 3600n, false],
  ] as const)
    await tx.insert(s.trades).values({
      id: id(ref),
      sandboxId,
      ref,
      listingId: id("L-2008"),
      bidId: id(`bid:L-2008:${buyer}`),
      holdingId: id("h_s198_falaj"),
      sellerId: user("seller_2"),
      buyerId: user(buyer),
      companyId: company("falaj"),
      shareClassId: ordinary("falaj"),
      currency: "AED",
      quantity,
      priceMinor,
      sellerSignedAt: days(settled ? -19 : -4),
      buyerSignedAt: days(settled ? -19 : -4),
      rofrDeadline: days(settled ? 11 : 26),
      fundingDeadline: settled ? days(-13) : null,
      wireSentAt: settled ? days(-16) : null,
      fundedAt: settled ? days(-15) : null,
      registerUpdatedAt: settled ? days(-14) : null,
      releaseApprovals: settled ? [user("operator_second"), user("operator")] : [],
      backupBidId: null,
      escrowRef: `ESC-${ref}`,
      disputeReason: null,
      disputedFrom: null,
      cancelReason: null,
      settledAt: settled ? days(-13) : null,
      createdAt: days(-20),
      status: settled ? "Settled" : "RofrPending",
    });
  for (const [c, priceMinor, quantity, ago, relatedParty] of data.printSpecs)
    await tx.insert(s.tradePrints).values({
      id: v7(),
      sandboxId,
      companyId: company(c),
      shareClassId: ordinary(c),
      priceMinor,
      quantity,
      executedAt: days(-ago),
      relatedParty,
      tradeId: c === "falaj" && ago === 13 ? id("T-1036") : null,
    });
  for (const [kind, ago] of [
    ["wire_sent", 16],
    ["funded", 15],
    ["released", 13],
  ] as const)
    await tx.insert(s.escrowEvents).values({
      id: v7(),
      sandboxId,
      tradeId: id("T-1036"),
      kind,
      amountMinor: 14_320_000n,
      currency: "AED",
      at: days(-ago),
    });
  for (const [buyer, c] of [
    ["buyer_a", "falaj"],
    ["buyer_b", "falaj"],
    ["buyer_c", "falaj"],
    ["buyer_c", "wadi"],
    ["buyer_d", "falaj"],
    ["buyer_e", "falaj"],
    ["buyer_e", "qamra"],
  ]) {
    if (!buyer || !c) throw new Error("Seed access missing");
    await tx.insert(s.accessGrants).values({
      id: v7(),
      sandboxId,
      companyId: company(c),
      buyerId: user(buyer),
      status: "approved",
      ndaVersion: "v1",
      requestedAt: days(-3),
      decidedAt: days(-3),
      decidedBy: user(c === "falaj" ? "company_admin" : `${c}_admin`),
    });
  }
  for (const q of data.qaSpecs)
    await tx.insert(s.qaEntries).values({
      id: v7(),
      sandboxId,
      companyId: company("falaj"),
      question: q.question,
      askedBy: user("buyer_c"),
      askedAt: days(-q.askedDays),
      answer: q.answer,
      answeredBy: q.answer ? user("company_admin") : null,
      answeredAt: q.answeredDays === null ? null : days(-q.answeredDays),
    });
  for (const [buyer, name, sectors, stages] of data.mandateSpecs)
    await tx.insert(s.mandates).values({
      id: v7(),
      sandboxId,
      buyerId: user(buyer),
      name,
      sectors,
      stages,
      currency: "AED",
      minTicketMinor: 25_000_000n,
      maxTicketMinor: 200_000_000n,
      maxPriceMinor: null,
    });
  for (const [title, slug] of [
    ["FY2025 audited financials", "fy2025-audited-financials"],
    ["Cap table summary", "cap-table-summary"],
    ["Transfer clauses (articles)", "transfer-clauses"],
  ])
    await tx.insert(s.documents).values({
      id: v7(),
      sandboxId,
      companyId: company("falaj"),
      tradeId: null,
      kind: "info_pack",
      title: title ?? "",
      fileLabel: "PDF · watermarked",
      storageKey: `demo/falaj/${slug}.pdf`,
      createdAt: days(-3),
    });
  for (const [ref, kind, ago] of [
    ["T-1036", "transfer_agreement", 19],
    ["T-1036", "register_extract", 14],
    ["T-1036", "completion_certificate", 13],
    ["T-1042", "transfer_agreement", 4],
  ] as const)
    await tx.insert(s.documents).values({
      id: v7(),
      sandboxId,
      companyId: company("falaj"),
      tradeId: id(ref),
      kind,
      title: kind.replaceAll("_", " "),
      fileLabel: "PDF · watermarked",
      storageKey: `demo/trades/${ref}/${kind}.pdf`,
      createdAt: days(-ago),
    });
  await tx.insert(s.notifications).values([
    {
      id: v7(),
      sandboxId,
      recipientId: user("buyer_a"),
      template: "countered",
      entity: "bid",
      entityId: id("bid:L-2019:buyer_a"),
      createdAt: days(-2),
      readAt: null,
    },
    {
      id: v7(),
      sandboxId,
      recipientId: user("company_admin"),
      template: "rofr_notice",
      entity: "trade",
      entityId: id("T-1042"),
      createdAt: days(-4),
      readAt: null,
    },
  ]);
}
