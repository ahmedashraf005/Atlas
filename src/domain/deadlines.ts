import { bidMachine } from "@/domain/bid";
import type { Effect } from "@/domain/effects";
import { decisionDeadline, listingMachine } from "@/domain/listing";
import { transition } from "@/domain/machine";
import { SYSTEM_ACTOR } from "@/domain/roles";
import { tradeMachine } from "@/domain/trade";
import type { Bid, Listing, Trade, TransferPolicy } from "@/domain/types";
export type SystemEvent =
  | { kind: "listing"; event: "CLOSE_WINDOW" | "EXPIRE" | "COMPLETE"; effectiveAt: Date }
  | { kind: "bid"; event: "COUNTER_EXPIRE" | "EXPIRE"; effectiveAt: Date }
  | { kind: "trade"; event: "LAPSE" | "BUYER_DEFAULT"; effectiveAt: Date };
export interface AppliedDeadline {
  event: string;
  effectiveAt: Date;
  effects: Effect[];
}
export function dueListingEvent(
  l: Listing,
  now: Date,
  facts: { allTradesTerminal: boolean },
): Extract<SystemEvent, { kind: "listing" }> | null {
  if (l.status === "Live" && l.windowClosesAt && now >= l.windowClosesAt)
    return {
      kind: "listing",
      event: "CLOSE_WINDOW",
      effectiveAt: new Date(l.windowClosesAt.getTime()),
    };
  const d = decisionDeadline(l);
  if ((l.status === "Closed" || l.status === "Negotiating") && d && now >= d)
    return { kind: "listing", event: "EXPIRE", effectiveAt: d };
  if (l.status === "Allocated" && facts.allTradesTerminal)
    return { kind: "listing", event: "COMPLETE", effectiveAt: new Date(now.getTime()) };
  return null;
}
export function dueBidEvent(b: Bid, now: Date): Extract<SystemEvent, { kind: "bid" }> | null {
  if (b.status === "Countered" && b.counterExpiresAt && now >= b.counterExpiresAt)
    return {
      kind: "bid",
      event: "COUNTER_EXPIRE",
      effectiveAt: new Date(b.counterExpiresAt.getTime()),
    };
  if ((b.status === "Submitted" || b.status === "Backup") && now >= b.expiresAt)
    return { kind: "bid", event: "EXPIRE", effectiveAt: new Date(b.expiresAt.getTime()) };
  return null;
}
export function dueTradeEvent(t: Trade, now: Date): Extract<SystemEvent, { kind: "trade" }> | null {
  if (t.status === "RofrPending" && t.rofrDeadline && now >= t.rofrDeadline)
    return { kind: "trade", event: "LAPSE", effectiveAt: new Date(t.rofrDeadline.getTime()) };
  if (t.status === "AwaitingFunds" && t.fundingDeadline && now >= t.fundingDeadline)
    return {
      kind: "trade",
      event: "BUYER_DEFAULT",
      effectiveAt: new Date(t.fundingDeadline.getTime()),
    };
  return null;
}
export function settleDeadlines<T, E extends SystemEvent>(
  initial: T,
  due: (entity: T) => E | null,
  apply: (entity: T, event: E) => { next: T; effects: Effect[] },
): { entity: T; applied: AppliedDeadline[] } {
  let entity = initial;
  const applied: AppliedDeadline[] = [];
  for (let count = 0; count <= 10; count++) {
    const event = due(entity);
    if (!event) return { entity, applied };
    if (count === 10) throw new Error("Deadline processing exceeded 10 iterations.");
    const result = apply(entity, event);
    entity = result.next;
    applied.push({ event: event.event, effectiveAt: event.effectiveAt, effects: result.effects });
  }
  throw new Error("Deadline processing did not finish.");
}
export function settleTradeDeadlines(
  t: Trade,
  now: Date,
  policy: TransferPolicy,
): { trade: Trade; applied: AppliedDeadline[] } {
  const result = settleDeadlines(
    t,
    (entity) => dueTradeEvent(entity, now),
    (entity, event) => {
      const r = transition(tradeMachine, entity, event.event, SYSTEM_ACTOR(entity.sandboxId), {
        now: event.effectiveAt,
        policy,
      });
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    },
  );
  return { trade: result.entity, applied: result.applied };
}
export function settleListingDeadlines(
  l: Listing,
  now: Date,
  facts: { allTradesTerminal: boolean },
): { listing: Listing; applied: AppliedDeadline[] } {
  const result = settleDeadlines(
    l,
    (entity) => dueListingEvent(entity, now, facts),
    (entity, event) => {
      const r = transition(listingMachine, entity, event.event, SYSTEM_ACTOR(entity.sandboxId), {
        now: event.effectiveAt,
        ...facts,
      });
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    },
  );
  return { listing: result.entity, applied: result.applied };
}
export function settleBidDeadlines(
  b: Bid,
  now: Date,
  listing: Listing,
): { bid: Bid; applied: AppliedDeadline[] } {
  const result = settleDeadlines(
    b,
    (entity) => dueBidEvent(entity, now),
    (entity, event) => {
      const r = transition(bidMachine, entity, event.event, SYSTEM_ACTOR(entity.sandboxId), {
        now: event.effectiveAt,
        listing,
      });
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    },
  );
  return { bid: result.entity, applied: result.applied };
}
