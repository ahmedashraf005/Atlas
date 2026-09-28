import "server-only";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Json } from "@/domain/audit";
import { GENESIS_HASH } from "@/domain/constants";
import { MACHINES } from "@/domain/machines";
import { ROLES } from "@/domain/roles";

export const personaEnum = pgEnum("persona", [
  "buyer_a",
  "buyer_b",
  "seller",
  "company_admin",
  "operator",
]);
export const roleEnum = pgEnum("role", ROLES);
export const orgKindEnum = pgEnum("org_kind", ["company", "investor", "operator"]);
export const currencyEnum = pgEnum("currency", ["AED", "USD"]);
export const incorporationEnum = pgEnum("incorporation", ["ADGM", "DIFC"]);
export const rofrModeEnum = pgEnum("rofr_mode", ["waive", "exercise"]);
export const holdingStatusEnum = pgEnum(
  "holding_status",
  MACHINES.holding.states as [
    (typeof MACHINES.holding.states)[number],
    ...(typeof MACHINES.holding.states)[number][],
  ],
);
export const listingStatusEnum = pgEnum(
  "listing_status",
  MACHINES.listing.states as [
    (typeof MACHINES.listing.states)[number],
    ...(typeof MACHINES.listing.states)[number][],
  ],
);
export const bidStatusEnum = pgEnum(
  "bid_status",
  MACHINES.bid.states as [
    (typeof MACHINES.bid.states)[number],
    ...(typeof MACHINES.bid.states)[number][],
  ],
);
export const tradeStatusEnum = pgEnum(
  "trade_status",
  MACHINES.trade.states as [
    (typeof MACHINES.trade.states)[number],
    ...(typeof MACHINES.trade.states)[number][],
  ],
);
export const accessStatusEnum = pgEnum("access_status", ["pending", "approved", "denied"]);
export const documentKindEnum = pgEnum("document_kind", [
  "info_pack",
  "transfer_agreement",
  "register_extract",
  "completion_certificate",
]);
export const escrowKindEnum = pgEnum("escrow_kind", [
  "wire_sent",
  "funded",
  "released",
  "refunded",
]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "done", "skipped"]);
const time = () => timestamp({ withTimezone: true, mode: "date" });
const amount = () => bigint({ mode: "bigint" });
const id = () => uuid().primaryKey();
const version = () => integer().notNull().default(1);
export const sandboxes = pgTable("sandboxes", {
  id: id(),
  createdAt: time().notNull(),
  lastSeenAt: time().notNull(),
  clockOffsetMs: bigint({ mode: "number" }).notNull().default(0),
  persona: personaEnum().notNull().default("buyer_a"),
  autopilot: boolean().notNull().default(true),
  rofrMode: rofrModeEnum().notNull().default("waive"),
  auditHeadSeq: integer().notNull().default(0),
  auditHeadHash: text().notNull().default(GENESIS_HASH),
  nextRef: integer().notNull().default(3000),
});
const sid = () =>
  uuid()
    .notNull()
    .references(() => sandboxes.id, { onDelete: "cascade" });
export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    sandboxId: sid(),
    kind: orgKindEnum().notNull(),
    name: text().notNull(),
    jurisdiction: text(),
    version: version(),
  },
  (t) => [index("organizations_sandbox_idx").on(t.sandboxId)],
);
export const users = pgTable(
  "users",
  {
    id: id(),
    sandboxId: sid(),
    orgId: uuid().references(() => organizations.id),
    role: roleEnum().notNull(),
    personaKey: personaEnum(),
    handle: text().notNull(),
    displayName: text().notNull(),
    subtitle: text().notNull(),
    investorType: text().$type<import("@/domain/types").InvestorType>(),
    kycStatus: text().$type<import("@/domain/types").KycStatus>().notNull(),
    professionalVerified: boolean().notNull(),
    simulatedOnly: boolean().notNull(),
    version: version(),
  },
  (t) => [
    index("users_sandbox_idx").on(t.sandboxId),
    unique("users_persona_unique").on(t.sandboxId, t.personaKey),
  ],
);
export const beneficialOwners = pgTable(
  "beneficial_owners",
  {
    sandboxId: sid(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.orgId] }),
    index("beneficial_owners_sandbox_idx").on(t.sandboxId),
  ],
);
export const companies = pgTable(
  "companies",
  {
    id: id(),
    sandboxId: sid(),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id),
    slug: text().notNull(),
    name: text().notNull(),
    sector: text().notNull(),
    stage: text().notNull(),
    incorporation: incorporationEnum().notNull(),
    currency: currencyEnum().notNull(),
    description: text().notNull(),
    lastRoundName: text().notNull(),
    lastRoundPriceMinor: amount(),
    lastRoundDate: time(),
    lastRoundPostMoneyMinor: amount(),
    version: version(),
  },
  (t) => [
    index("companies_sandbox_idx").on(t.sandboxId),
    unique("companies_slug_unique").on(t.sandboxId, t.slug),
  ],
);
export const shareClasses = pgTable(
  "share_classes",
  {
    id: id(),
    sandboxId: sid(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    name: text().notNull(),
    kind: text().$type<import("@/domain/types").ShareClassKind>().notNull(),
    seniority: integer().notNull(),
    shares: amount().notNull(),
    originalPriceMinor: amount().notNull(),
    prefMultipleBps: integer().notNull(),
    version: version(),
  },
  (t) => [
    index("share_classes_sandbox_idx").on(t.sandboxId),
    unique("share_classes_seniority_unique").on(t.companyId, t.seniority),
  ],
);
export const transferPolicies = pgTable(
  "transfer_policies",
  {
    sandboxId: sid(),
    companyId: uuid()
      .primaryKey()
      .references(() => companies.id),
    rofrDays: integer().notNull(),
    fundingDays: integer().notNull(),
    minLot: amount().notNull(),
    lockupMonths: integer().notNull(),
    blackoutWindows: jsonb().$type<{ start: string; end: string; label: string }[]>().notNull(),
    allowedBuyerTypes: text().array().$type<import("@/domain/types").InvestorType[]>().notNull(),
    blockedOrgIds: uuid().array().notNull(),
    priceVisibility: text().$type<import("@/domain/types").PriceVisibility>().notNull(),
    yearlyCapBps: integer().notNull(),
    version: version(),
  },
  (t) => [index("transfer_policies_sandbox_idx").on(t.sandboxId)],
);
export const holdings = pgTable(
  "holdings",
  {
    id: id(),
    sandboxId: sid(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    shareClassId: uuid()
      .notNull()
      .references(() => shareClasses.id),
    quantity: amount().notNull(),
    reservedQty: amount().notNull(),
    soldQty: amount().notNull(),
    acquiredAt: time().notNull(),
    status: holdingStatusEnum().notNull(),
    rejectionReason: text(),
    version: version(),
  },
  (t) => [
    index("holdings_sandbox_idx").on(t.sandboxId),
    check(
      "holdings_quantity_check",
      sql`${t.quantity} > 0 AND ${t.reservedQty} >= 0 AND ${t.soldQty} >= 0 AND ${t.reservedQty} + ${t.soldQty} <= ${t.quantity}`,
    ),
  ],
);
export const listings = pgTable(
  "listings",
  {
    id: id(),
    sandboxId: sid(),
    holdingId: uuid()
      .notNull()
      .references(() => holdings.id),
    sellerId: uuid()
      .notNull()
      .references(() => users.id),
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    shareClassId: uuid()
      .notNull()
      .references(() => shareClasses.id),
    currency: currencyEnum().notNull(),
    ref: text().notNull(),
    quantity: amount().notNull(),
    minFill: amount().notNull(),
    reservePriceMinor: amount().notNull(),
    windowDays: integer().$type<3 | 5 | 7>().notNull(),
    windowOpensAt: time(),
    windowClosesAt: time(),
    countersSent: integer().notNull(),
    status: listingStatusEnum().notNull(),
    rejectionReason: text(),
    createdAt: time().notNull(),
    version: version(),
  },
  (t) => [
    index("listings_sandbox_idx").on(t.sandboxId),
    unique("listings_ref_unique").on(t.sandboxId, t.ref),
    check(
      "listings_values_check",
      sql`${t.quantity}>0 AND ${t.minFill}>0 AND ${t.minFill}<=${t.quantity} AND ${t.reservePriceMinor}>0 AND ${t.countersSent} BETWEEN 0 AND 3 AND ${t.windowDays} IN (3,5,7)`,
    ),
  ],
);
export const bids = pgTable(
  "bids",
  {
    id: id(),
    sandboxId: sid(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id),
    buyerId: uuid()
      .notNull()
      .references(() => users.id),
    buyerOrgId: uuid()
      .notNull()
      .references(() => organizations.id),
    priceMinor: amount().notNull(),
    quantity: amount().notNull(),
    minFill: amount().notNull(),
    rationale: text().notNull(),
    submittedAt: time().notNull(),
    amendedAt: time(),
    expiresAt: time().notNull(),
    counterPriceMinor: amount(),
    counterExpiresAt: time(),
    counterOutcome: text().$type<import("@/domain/types").CounterOutcome>(),
    allocatedQty: amount(),
    rejectionReason: text(),
    idempotencyKey: text().notNull(),
    status: bidStatusEnum().notNull(),
    version: version(),
  },
  (t) => [
    index("bids_sandbox_idx").on(t.sandboxId),
    unique("bids_idempotency_unique").on(t.buyerId, t.idempotencyKey),
    uniqueIndex("bids_active_unique")
      .on(t.listingId, t.buyerId)
      .where(sql`${t.status} IN ('Submitted','Countered','Backup')`),
    check(
      "bids_values_check",
      sql`${t.priceMinor}>0 AND ${t.quantity}>0 AND ${t.minFill}>0 AND ${t.minFill}<=${t.quantity}`,
    ),
  ],
);
export const trades = pgTable(
  "trades",
  {
    id: id(),
    sandboxId: sid(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id),
    bidId: uuid()
      .notNull()
      .references(() => bids.id),
    holdingId: uuid()
      .notNull()
      .references(() => holdings.id),
    sellerId: uuid()
      .notNull()
      .references(() => users.id),
    buyerId: uuid()
      .notNull()
      .references(() => users.id),
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    shareClassId: uuid()
      .notNull()
      .references(() => shareClasses.id),
    currency: currencyEnum().notNull(),
    ref: text().notNull(),
    quantity: amount().notNull(),
    priceMinor: amount().notNull(),
    sellerSignedAt: time(),
    buyerSignedAt: time(),
    rofrDeadline: time(),
    fundingDeadline: time(),
    wireSentAt: time(),
    fundedAt: time(),
    registerUpdatedAt: time(),
    releaseApprovals: uuid().array().notNull(),
    backupBidId: uuid().references(() => bids.id),
    escrowRef: text().notNull(),
    disputeReason: text(),
    disputedFrom: text().$type<"Funded" | "TransferPending">(),
    cancelReason: text().$type<import("@/domain/types").CancelReason>(),
    settledAt: time(),
    createdAt: time().notNull(),
    status: tradeStatusEnum().notNull(),
    version: version(),
  },
  (t) => [
    index("trades_sandbox_idx").on(t.sandboxId),
    unique("trades_ref_unique").on(t.sandboxId, t.ref),
    check("trades_values_check", sql`${t.quantity}>0 AND ${t.priceMinor}>0`),
  ],
);
export const tradePrints = pgTable(
  "trade_prints",
  {
    id: id(),
    sandboxId: sid(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    shareClassId: uuid()
      .notNull()
      .references(() => shareClasses.id),
    priceMinor: amount().notNull(),
    quantity: amount().notNull(),
    executedAt: time().notNull(),
    relatedParty: boolean().notNull(),
    tradeId: uuid().references(() => trades.id),
  },
  (t) => [index("trade_prints_sandbox_idx").on(t.sandboxId)],
);
export const accessGrants = pgTable(
  "access_grants",
  {
    id: id(),
    sandboxId: sid(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    buyerId: uuid()
      .notNull()
      .references(() => users.id),
    status: accessStatusEnum().notNull(),
    ndaVersion: text().notNull(),
    requestedAt: time().notNull(),
    decidedAt: time(),
    decidedBy: uuid().references(() => users.id),
    version: version(),
  },
  (t) => [
    index("access_grants_sandbox_idx").on(t.sandboxId),
    unique("access_grants_buyer_unique").on(t.companyId, t.buyerId),
  ],
);
export const qaEntries = pgTable(
  "qa_entries",
  {
    id: id(),
    sandboxId: sid(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id),
    question: text().notNull(),
    askedBy: uuid()
      .notNull()
      .references(() => users.id),
    askedAt: time().notNull(),
    answer: text(),
    answeredBy: uuid().references(() => users.id),
    answeredAt: time(),
    version: version(),
  },
  (t) => [index("qa_entries_sandbox_idx").on(t.sandboxId)],
);
export const mandates = pgTable(
  "mandates",
  {
    id: id(),
    sandboxId: sid(),
    buyerId: uuid()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    sectors: text().array().notNull(),
    stages: text().array().notNull(),
    currency: currencyEnum().notNull(),
    minTicketMinor: amount().notNull(),
    maxTicketMinor: amount().notNull(),
    maxPriceMinor: amount(),
    version: version(),
  },
  (t) => [index("mandates_sandbox_idx").on(t.sandboxId)],
);
export const documents = pgTable(
  "documents",
  {
    id: id(),
    sandboxId: sid(),
    companyId: uuid().references(() => companies.id),
    tradeId: uuid().references(() => trades.id),
    kind: documentKindEnum().notNull(),
    title: text().notNull(),
    fileLabel: text().notNull(),
    storageKey: text().notNull(),
    createdAt: time().notNull(),
  },
  (t) => [index("documents_sandbox_idx").on(t.sandboxId)],
);
export const messageThreads = pgTable(
  "message_threads",
  {
    id: id(),
    sandboxId: sid(),
    tradeId: uuid().references(() => trades.id),
    listingId: uuid().references(() => listings.id),
    createdAt: time().notNull(),
  },
  (t) => [index("message_threads_sandbox_idx").on(t.sandboxId)],
);
export const messages = pgTable(
  "messages",
  {
    id: id(),
    sandboxId: sid(),
    threadId: uuid()
      .notNull()
      .references(() => messageThreads.id),
    senderId: uuid()
      .notNull()
      .references(() => users.id),
    bodyRedacted: text().notNull(),
    flagged: boolean().notNull(),
    found: text().array().notNull(),
    createdAt: time().notNull(),
  },
  (t) => [index("messages_sandbox_idx").on(t.sandboxId)],
);
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    sandboxId: sid(),
    recipientId: uuid()
      .notNull()
      .references(() => users.id),
    template: text().notNull(),
    entity: text().notNull(),
    entityId: uuid().notNull(),
    createdAt: time().notNull(),
    readAt: time(),
  },
  (t) => [
    index("notifications_sandbox_idx").on(t.sandboxId),
    index("notifications_unread_idx").on(t.recipientId, t.readAt),
  ],
);
export const escrowEvents = pgTable(
  "escrow_events",
  {
    id: id(),
    sandboxId: sid(),
    tradeId: uuid()
      .notNull()
      .references(() => trades.id),
    kind: escrowKindEnum().notNull(),
    amountMinor: amount().notNull(),
    currency: currencyEnum().notNull(),
    at: time().notNull(),
  },
  (t) => [index("escrow_events_sandbox_idx").on(t.sandboxId)],
);
export const automationJobs = pgTable(
  "automation_jobs",
  {
    id: id(),
    sandboxId: sid(),
    dueAt: time().notNull(),
    kind: text().notNull(),
    entity: text().$type<import("@/domain/effects").EntityKind | "company">().notNull(),
    entityId: uuid().notNull(),
    event: text(),
    partyUserId: uuid()
      .notNull()
      .references(() => users.id),
    status: jobStatusEnum().notNull(),
    resultCode: text(),
    createdAt: time().notNull(),
    executedAt: time(),
  },
  (t) => [
    index("automation_jobs_sandbox_idx").on(t.sandboxId),
    index("automation_jobs_due_idx").on(t.sandboxId, t.status, t.dueAt),
    uniqueIndex("automation_jobs_pending_unique")
      .on(t.entityId, t.event, t.partyUserId)
      .where(sql`${t.status}='pending'`),
  ],
);
export const auditLog = pgTable(
  "audit_log",
  {
    sandboxId: sid(),
    seq: integer().notNull(),
    actorId: text().notNull(),
    actorRole: text().$type<import("@/domain/roles").ActorRole>().notNull(),
    simulated: boolean().notNull(),
    action: text().notNull(),
    entity: text().$type<import("@/domain/audit").AuditEntry["entity"]>().notNull(),
    entityId: uuid().notNull(),
    before: jsonb().$type<Json>().notNull(),
    after: jsonb().$type<Json>().notNull(),
    at: time().notNull(),
    prevHash: text().notNull(),
    hash: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sandboxId, t.seq] }),
    index("audit_log_sandbox_idx").on(t.sandboxId),
  ],
);
export const rateLimits = pgTable(
  "rate_limits",
  {
    sandboxId: sid(),
    key: text().notNull(),
    windowStart: time().notNull(),
    count: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sandboxId, t.key, t.windowStart] }),
    index("rate_limits_sandbox_idx").on(t.sandboxId),
  ],
);
export type SandboxRow = typeof sandboxes.$inferSelect;
