import "server-only";
import { type Action, authorize, type Resource } from "@/domain/authz";
import { type BidCtx, type BidEvent, bidMachine } from "@/domain/bid";
import type { EntityKind } from "@/domain/effects";
import type { DomainError } from "@/domain/errors";
import { type HoldingCtx, type HoldingEvent, holdingMachine } from "@/domain/holding";
import { type ListingCtx, type ListingEvent, listingMachine } from "@/domain/listing";
import { transition } from "@/domain/machine";
import { evaluateListing } from "@/domain/policy";
import { err, ok, type Result } from "@/domain/result";
import type { Actor } from "@/domain/roles";
import { type TradeCtx, type TradeEvent, tradeMachine } from "@/domain/trade";
import type { Bid, Holding, Listing, Trade } from "@/domain/types";
import { scheduleAutomation } from "@/server/automation";
import type { Tx } from "@/server/db/client";
import type { SandboxRow } from "@/server/db/schema";
import { applyEffects, postTransition } from "@/server/effects";
import { type ActionError, NotFoundError } from "@/server/errors";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as holdings from "@/server/repositories/holdings";
import * as listings from "@/server/repositories/listings";
import * as trades from "@/server/repositories/trades";
export interface TxContext {
  tx: Tx;
  sandbox: SandboxRow;
  actor: Actor;
  now: Date;
  personaUserId: string;
  depth: number;
}
export interface Entities {
  holding: Holding;
  listing: Listing;
  bid: Bid;
  trade: Trade;
}
export type EntityOf<K extends EntityKind> = Entities[K];
export type EventOf<K extends EntityKind> = {
  holding: HoldingEvent;
  listing: ListingEvent;
  bid: BidEvent;
  trade: TradeEvent;
}[K];
export type ExtraCtxOf<K extends EntityKind> = {
  holding: Omit<HoldingCtx, "now">;
  listing: Omit<ListingCtx, "now" | "policyResult" | "allTradesTerminal">;
  bid: Omit<BidCtx, "now" | "listing">;
  trade: Omit<TradeCtx, "now" | "policy" | "actor">;
}[K];
export type TransitionChange = {
  [K in EntityKind]: { kind: K; prev: EntityOf<K>; next: EntityOf<K> };
}[EntityKind];
export const allTradesTerminal = (items: Trade[]) =>
  items.every((t) => tradeMachine.terminal.includes(t.status));
export async function runTransition<K extends EntityKind>(
  ctx: TxContext,
  kind: K,
  id: string,
  event: EventOf<K>,
  extra: ExtraCtxOf<K>,
): Promise<Result<EntityOf<K>, DomainError | ActionError>> {
  if (ctx.depth > 5) throw new Error("Transition nesting exceeded 5");
  const sid = ctx.sandbox.id;
  // The entity map preserves the public kind/event/entity relationship; dispatch narrows internally.
  const prev = await (kind === "holding"
    ? holdings
    : kind === "listing"
      ? listings
      : kind === "bid"
        ? bids
        : trades
  ).getForUpdate(ctx.tx, sid, id);
  if (!prev) return err({ code: "NOT_FOUND", message: "Not found." });
  const listing = kind === "bid" ? await listings.find(ctx.tx, sid, (prev as Bid).listingId) : null;
  if (kind === "bid" && !listing) throw new NotFoundError();
  const company = await companies.find(
    ctx.tx,
    sid,
    kind === "bid" ? (listing as Listing).companyId : (prev as Holding | Listing | Trade).companyId,
  );
  if (!company) throw new NotFoundError();
  let resource: Resource;
  if (kind === "holding")
    resource = {
      kind,
      sandboxId: sid,
      ownerId: (prev as Holding).ownerId,
      companyOrgId: company.orgId,
    };
  else if (kind === "listing")
    resource = {
      kind,
      sandboxId: sid,
      sellerId: (prev as Listing).sellerId,
      companyOrgId: company.orgId,
      status: (prev as Listing).status,
    };
  else if (kind === "bid")
    resource = {
      kind,
      sandboxId: sid,
      buyerId: (prev as Bid).buyerId,
      sellerId: (listing as Listing).sellerId,
      listingStatus: (listing as Listing).status,
    };
  else
    resource = {
      kind: "trade",
      sandboxId: sid,
      sellerId: (prev as Trade).sellerId,
      buyerId: (prev as Trade).buyerId,
      companyOrgId: company.orgId,
    };
  const allowed = authorize(ctx.actor, `${kind}.${event}` as Action, resource);
  if (!allowed.ok) return allowed;
  let result: Result<{
    next: Holding | Listing | Bid | Trade;
    effects: import("@/domain/effects").Effect[];
  }>;
  if (kind === "holding")
    result = transition(holdingMachine, prev as Holding, event as HoldingEvent, ctx.actor, {
      ...extra,
      now: ctx.now,
    });
  else if (kind === "listing") {
    const l = prev as Listing;
    const h = await holdings.find(ctx.tx, sid, l.holdingId);
    if (!h) throw new NotFoundError();
    const policy = await companies.policy(ctx.tx, sid, l.companyId);
    const committed = await holdings.committedQty(ctx.tx, sid, h.id, ctx.now);
    const policyResult = evaluateListing({
      policy,
      holding: h,
      soldInLast12Months: committed,
      now: ctx.now,
      quantity: l.quantity,
      minFill: l.minFill,
    });
    const terminal = allTradesTerminal(
      (await trades.list(ctx.tx, sid)).filter((t) => t.listingId === l.id),
    );
    result = transition(listingMachine, l, event as ListingEvent, ctx.actor, {
      ...extra,
      now: ctx.now,
      policyResult,
      allTradesTerminal: terminal,
    });
  } else if (kind === "bid")
    result = transition(bidMachine, prev as Bid, event as BidEvent, ctx.actor, {
      ...extra,
      now: ctx.now,
      listing: listing as Listing,
    });
  else
    result = transition(tradeMachine, prev as Trade, event as TradeEvent, ctx.actor, {
      ...extra,
      now: ctx.now,
      policy: await companies.policy(ctx.tx, sid, company.id),
    });
  if (!result.ok) return result;
  const next = result.value.next;
  if (kind === "holding") await holdings.save(ctx.tx, next as Holding, prev.version);
  else if (kind === "listing") await listings.save(ctx.tx, next as Listing, prev.version);
  else if (kind === "bid") await bids.save(ctx.tx, next as Bid, prev.version);
  else await trades.save(ctx.tx, next as Trade, prev.version);
  const change = { kind, prev, next } as TransitionChange;
  await applyEffects(ctx, result.value.effects, change);
  await postTransition(ctx, event, change);
  await scheduleAutomation(ctx, kind, next);
  return ok(next as EntityOf<K>);
}
