import { describe, expect, it } from "vitest";
import type { Effect, EntityKind } from "@/domain/effects";
import type { Machine } from "@/domain/machine";
import { availableEvents, sources, transition } from "@/domain/machine";
import type { Result } from "@/domain/result";
import type { Actor, ActorRole } from "@/domain/roles";
import type {
  Bid,
  BuyerProfile,
  Company,
  Holding,
  Listing,
  ShareClass,
  Trade,
  TransferPolicy,
} from "@/domain/types";
export const NOW = new Date("2026-09-25T10:30:00Z");
export const ALL_ROLES: ActorRole[] = ["seller", "buyer", "company_admin", "operator", "system"];
export const actor = (role: ActorRole, overrides: Partial<Actor> = {}): Actor => ({
  userId: role,
  role,
  orgId: role === "company_admin" ? "company-org" : role === "buyer" ? "buyer-org" : null,
  sandboxId: "sandbox",
  simulated: false,
  ...overrides,
});
export const makeHolding = (o: Partial<Holding> = {}): Holding => ({
  id: "holding",
  sandboxId: "sandbox",
  ownerId: "seller",
  companyId: "company",
  shareClassId: "ordinary",
  quantity: 10000n,
  reservedQty: 0n,
  soldQty: 0n,
  acquiredAt: new Date("2025-01-31T10:30:00Z"),
  status: "Verified",
  rejectionReason: null,
  version: 1,
  ...o,
});
export const makeListing = (o: Partial<Listing> = {}): Listing => ({
  id: "listing",
  sandboxId: "sandbox",
  holdingId: "holding",
  sellerId: "seller",
  companyId: "company",
  shareClassId: "ordinary",
  currency: "AED",
  quantity: 5000n,
  minFill: 1000n,
  reservePriceMinor: 3500n,
  windowDays: 5,
  windowOpensAt: new Date("2026-09-20T10:30:00Z"),
  windowClosesAt: new Date(NOW.getTime()),
  countersSent: 0,
  status: "Closed",
  rejectionReason: null,
  createdAt: new Date("2026-09-19T10:30:00Z"),
  version: 1,
  ...o,
});
export const makeBid = (o: Partial<Bid> = {}): Bid => ({
  id: "bid",
  sandboxId: "sandbox",
  listingId: "listing",
  buyerId: "buyer",
  buyerOrgId: "buyer-org",
  priceMinor: 3500n,
  quantity: 3000n,
  minFill: 1000n,
  rationale: "Long-term holding.",
  submittedAt: new Date("2026-09-21T10:30:00Z"),
  amendedAt: null,
  expiresAt: new Date("2026-10-09T10:30:00Z"),
  counterPriceMinor: null,
  counterExpiresAt: null,
  counterOutcome: null,
  allocatedQty: null,
  rejectionReason: null,
  idempotencyKey: "key",
  status: "Submitted",
  version: 1,
  ...o,
});
export const makeTrade = (o: Partial<Trade> = {}): Trade => ({
  id: "trade",
  sandboxId: "sandbox",
  listingId: "listing",
  bidId: "bid",
  holdingId: "holding",
  sellerId: "seller",
  buyerId: "buyer",
  companyId: "company",
  shareClassId: "ordinary",
  currency: "AED",
  quantity: 1000n,
  priceMinor: 3500n,
  sellerSignedAt: null,
  buyerSignedAt: null,
  rofrDeadline: null,
  fundingDeadline: null,
  wireSentAt: null,
  fundedAt: null,
  registerUpdatedAt: null,
  releaseApprovals: [],
  backupBidId: null,
  escrowRef: "ESC-trade",
  disputeReason: null,
  disputedFrom: null,
  cancelReason: null,
  settledAt: null,
  createdAt: new Date(NOW.getTime()),
  status: "AwaitingDocs",
  version: 1,
  ...o,
});
export const makePolicy = (o: Partial<TransferPolicy> = {}): TransferPolicy => ({
  companyId: "company",
  rofrDays: 30,
  fundingDays: 5,
  minLot: 1000n,
  lockupMonths: 6,
  blackoutWindows: [],
  allowedBuyerTypes: ["family_office", "hnwi", "fund", "angel_syndicate"],
  blockedOrgIds: [],
  priceVisibility: "members",
  yearlyCapBps: 10000,
  ...o,
});
export const makeBuyer = (o: Partial<BuyerProfile> = {}): BuyerProfile => ({
  userId: "buyer",
  orgId: "buyer-org",
  investorType: "fund",
  kycStatus: "verified",
  professionalVerified: true,
  ...o,
});
export const makeCompany = (o: Partial<Company> = {}): Company => ({
  id: "company",
  sandboxId: "sandbox",
  orgId: "company-org",
  name: "Falaj Robotics",
  currency: "AED",
  lastRoundPriceMinor: 4200n,
  lastRoundDate: new Date("2026-03-01T00:00:00Z"),
  lastRoundPostMoneyMinor: 40_000_000_000n,
  ...o,
});
export const makeClass = (o: Partial<ShareClass> = {}): ShareClass => ({
  id: "ordinary",
  companyId: "company",
  name: "Ordinary",
  kind: "ordinary",
  seniority: 3,
  shares: 6_000_000n,
  originalPriceMinor: 0n,
  prefMultipleBps: 0,
  ...o,
});
export const CLASSES = [
  makeClass({
    id: "B",
    name: "Series B",
    kind: "preferred",
    seniority: 1,
    shares: 2_000_000n,
    originalPriceMinor: 4200n,
    prefMultipleBps: 10000,
  }),
  makeClass({
    id: "A",
    name: "Series A",
    kind: "preferred",
    seniority: 2,
    shares: 3_000_000n,
    originalPriceMinor: 1200n,
    prefMultipleBps: 10000,
  }),
  makeClass(),
];
export function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const child of Object.values(v)) deepFreeze(child);
  }
  return v;
}
export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}
export const N = (
  entity: EntityKind,
  entityId: string,
  recipient: "seller" | "buyer" | "company" | "operator",
  template: string,
): Effect => ({ type: "NOTIFY", entity, entityId, recipient, template });
export interface MachineCase<S, E, T, C> {
  from: S;
  event: E;
  to: S;
  roles: ActorRole[];
  ctx: C;
  entity?: Partial<T>;
  patch?: Partial<T>;
  effects?: Effect[];
}
export function machineContract<
  S extends string,
  E extends string,
  T extends { status: S; version: number; id: string },
  C extends { now: Date },
>(
  m: Machine<S, E, T, C>,
  build: (o: Partial<T>) => T,
  cases: MachineCase<S, E, T, C>[],
  baseCtx: C,
): void {
  describe("exhaustive state/event matrix", () => {
    for (const state of m.states)
      for (const event of m.events)
        it(`${state} × ${event}`, () => {
          const entity = deepFreeze(build({ status: state } as Partial<T>));
          const r = transition(m, entity, event, actor("seller"), baseCtx);
          const exists = cases.some((c) => c.from === state && c.event === event);
          expect(!r.ok && r.error.code === "INVALID_TRANSITION").toBe(!exists);
        });
  });
  for (const [index, c] of cases.entries())
    describe(`row ${index}: ${c.from} ${c.event} → ${c.to}`, () => {
      for (const role of c.roles)
        it(`allows ${role}, exact apply/effects, immutable input`, () => {
          const entity = deepFreeze(build({ ...c.entity, status: c.from } as Partial<T>));
          const before = structuredClone(entity);
          const r = unwrap(transition(m, entity, c.event, actor(role), deepFreeze(c.ctx)));
          expect(r.next).toEqual({
            ...entity,
            ...c.patch,
            status: c.to,
            version: entity.version + 1,
          });
          expect(r.effects).toEqual([
            {
              type: "AUDIT",
              entity: m.name,
              entityId: entity.id,
              action: `${m.name}.${c.event}`,
              from: c.from,
              to: c.to,
            },
            ...(c.effects ?? []),
          ]);
          expect({ from: r.from, to: r.to }).toEqual({ from: c.from, to: c.to });
          expect(entity).toEqual(before);
          expect(r.next).not.toBe(entity);
          expect(availableEvents(m, entity, actor(role), c.ctx)).toContain(c.event);
        });
      for (const role of ALL_ROLES.filter((role) => !c.roles.includes(role)))
        it(`forbids ${role}`, () => {
          const r = transition(
            m,
            deepFreeze(build({ ...c.entity, status: c.from } as Partial<T>)),
            c.event,
            actor(role),
            c.ctx,
          );
          expect(r).toMatchObject({ ok: false, error: { code: "FORBIDDEN_ROLE" } });
        });
    });
  it("has only reachable states, no outgoing terminal rows, and uses every declared event", () => {
    const reachable = new Set<S>([m.initial]);
    for (const state of reachable)
      for (const row of m.rows) if (sources(row.from).includes(state)) reachable.add(row.to);
    expect([...reachable].sort()).toEqual([...m.states].sort());
    expect(m.rows.some((r) => sources(r.from).some((s) => m.terminal.includes(s)))).toBe(false);
    expect(new Set(m.rows.map((r) => r.event))).toEqual(new Set(m.events));
    expect(new Set(cases.flatMap((c) => [c.from, c.to]))).toEqual(new Set(m.states));
  });
}
