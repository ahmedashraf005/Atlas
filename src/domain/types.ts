import type { Currency } from "@/lib/format";
export type InvestorType = "family_office" | "hnwi" | "fund" | "angel_syndicate";
export type KycStatus = "pending" | "verified" | "rejected";
export type ShareClassKind = "preferred" | "ordinary";
export type PriceVisibility = "operator" | "participants" | "members";
export interface ShareClass {
  id: string;
  companyId: string;
  name: string;
  kind: ShareClassKind;
  seniority: number;
  shares: bigint;
  originalPriceMinor: bigint;
  prefMultipleBps: number;
}
export interface Company {
  id: string;
  sandboxId: string;
  orgId: string;
  name: string;
  currency: Currency;
  lastRoundPriceMinor: bigint | null;
  lastRoundDate: Date | null;
  lastRoundPostMoneyMinor: bigint | null;
}
export interface TransferPolicy {
  companyId: string;
  rofrDays: number;
  fundingDays: number;
  minLot: bigint;
  lockupMonths: number;
  blackoutWindows: { start: Date; end: Date; label: string }[];
  allowedBuyerTypes: InvestorType[];
  blockedOrgIds: string[];
  priceVisibility: PriceVisibility;
  yearlyCapBps: number;
}
export interface BuyerProfile {
  userId: string;
  orgId: string;
  investorType: InvestorType;
  kycStatus: KycStatus;
  professionalVerified: boolean;
}
export type HoldingStatus = "Unverified" | "PendingCompany" | "Verified" | "Rejected";
export interface Holding {
  id: string;
  sandboxId: string;
  ownerId: string;
  companyId: string;
  shareClassId: string;
  quantity: bigint;
  reservedQty: bigint;
  soldQty: bigint;
  acquiredAt: Date;
  status: HoldingStatus;
  rejectionReason: string | null;
  version: number;
}
export type ListingStatus =
  | "Draft"
  | "InReview"
  | "Rejected"
  | "Live"
  | "Withdrawn"
  | "Closed"
  | "Negotiating"
  | "Allocated"
  | "Expired"
  | "Completed";
export interface Listing {
  id: string;
  sandboxId: string;
  holdingId: string;
  sellerId: string;
  companyId: string;
  shareClassId: string;
  currency: Currency;
  quantity: bigint;
  minFill: bigint;
  reservePriceMinor: bigint;
  windowDays: 3 | 5 | 7;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
  countersSent: number;
  status: ListingStatus;
  rejectionReason: string | null;
  createdAt: Date;
  version: number;
}
export type BidStatus =
  | "Submitted"
  | "Countered"
  | "Backup"
  | "Accepted"
  | "Rejected"
  | "Expired"
  | "Withdrawn";
export type CounterOutcome = "pending" | "accepted" | "declined" | "lapsed";
export interface Bid {
  id: string;
  sandboxId: string;
  listingId: string;
  buyerId: string;
  buyerOrgId: string;
  priceMinor: bigint;
  quantity: bigint;
  minFill: bigint;
  rationale: string;
  submittedAt: Date;
  amendedAt: Date | null;
  expiresAt: Date;
  counterPriceMinor: bigint | null;
  counterExpiresAt: Date | null;
  counterOutcome: CounterOutcome | null;
  allocatedQty: bigint | null;
  rejectionReason: string | null;
  idempotencyKey: string;
  status: BidStatus;
  version: number;
}
export type TradeStatus =
  | "AwaitingDocs"
  | "RofrPending"
  | "RofrExercised"
  | "AwaitingFunds"
  | "Funded"
  | "TransferPending"
  | "Settled"
  | "Cancelled"
  | "Disputed";
export type CancelReason = "company_refused" | "buyer_default" | "dispute_resolved" | "operator";
export interface Trade {
  id: string;
  sandboxId: string;
  listingId: string;
  bidId: string;
  holdingId: string;
  sellerId: string;
  buyerId: string;
  companyId: string;
  shareClassId: string;
  currency: Currency;
  quantity: bigint;
  priceMinor: bigint;
  sellerSignedAt: Date | null;
  buyerSignedAt: Date | null;
  rofrDeadline: Date | null;
  fundingDeadline: Date | null;
  wireSentAt: Date | null;
  fundedAt: Date | null;
  registerUpdatedAt: Date | null;
  releaseApprovals: string[];
  backupBidId: string | null;
  escrowRef: string;
  disputeReason: string | null;
  disputedFrom: "Funded" | "TransferPending" | null;
  cancelReason: CancelReason | null;
  settledAt: Date | null;
  createdAt: Date;
  status: TradeStatus;
  version: number;
}
export interface TradeRecord {
  priceMinor: bigint;
  quantity: bigint;
  executedAt: Date;
  relatedParty: boolean;
}
