import "server-only";
import { v7 } from "uuid";
import type { Allocation } from "@/domain/allocation";
import type { Effect, EntityKind } from "@/domain/effects";
import { markSharesSold, releaseShares, reserveShares } from "@/domain/holding";
import { minBigint } from "@/domain/money";
import { SYSTEM_ACTOR } from "@/domain/roles";
import { createTradesFromAllocation } from "@/domain/trade";
import type { Trade } from "@/domain/types";
import { appendAudit } from "@/server/audit";
import { scheduleAutomation } from "@/server/automation";
import { NotFoundError, RollbackError } from "@/server/errors";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as documents from "@/server/repositories/documents";
import * as escrow from "@/server/repositories/escrow";
import * as holdings from "@/server/repositories/holdings";
import * as listings from "@/server/repositories/listings";
import * as notifications from "@/server/repositories/notifications";
import * as prints from "@/server/repositories/prints";
import * as refs from "@/server/repositories/refs";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import { runTransition, type TransitionChange, type TxContext } from "@/server/transitions";

const nested = (ctx: TxContext): TxContext => ({
  ...ctx,
  actor: SYSTEM_ACTOR(ctx.sandbox.id),
  depth: ctx.depth + 1,
});
async function requireTransition<K extends EntityKind>(
  ctx: TxContext,
  kind: K,
  id: string,
  event: import("@/server/transitions").EventOf<K>,
  extra: import("@/server/transitions").ExtraCtxOf<K>,
) {
  const result = await runTransition(ctx, kind, id, event, extra);
  if (!result.ok) throw new RollbackError(result.error);
  return result.value;
}
async function quantity(
  ctx: TxContext,
  holdingId: string,
  qty: bigint,
  operation: "reserve" | "release" | "sell",
) {
  const prev = await holdings.getForUpdate(ctx.tx, ctx.sandbox.id, holdingId);
  if (!prev) throw new NotFoundError();
  const r = (
    operation === "reserve"
      ? reserveShares
      : operation === "release"
        ? releaseShares
        : markSharesSold
  )(prev, qty);
  if (!r.ok) throw new RollbackError(r.error);
  await holdings.save(ctx.tx, r.value, prev.version);
}
async function createTrades(
  ctx: TxContext,
  listingId: string,
  allocations: Allocation[],
  backupBidId: string | null = null,
) {
  const sid = ctx.sandbox.id,
    l = await listings.find(ctx.tx, sid, listingId);
  if (!l) throw new NotFoundError();
  const allBids = (await bids.list(ctx.tx, sid)).filter((b) => b.listingId === listingId);
  const total = allocations.reduce((n, a) => n + a.qty, 0n);
  const created = createTradesFromAllocation(
    l,
    { allocations, allocatedQty: total, remainingQty: l.quantity - total, skipped: [] },
    new Map(allBids.map((b) => [b.id, b])),
    { now: ctx.now, newId: v7, escrowRef: (id) => `ESC-${id}`, backupBidId },
  );
  for (const t of created) {
    const ref = await refs.next(ctx.tx, sid, "T");
    t.escrowRef = `ESC-${ref}`;
    await trades.insert(ctx.tx, sid, t, ref);
    await scheduleAutomation(ctx, "trade", t);
  }
}
async function tradeDocument(
  ctx: TxContext,
  trade: Trade,
  kind: "transfer_agreement" | "register_extract" | "completion_certificate",
) {
  await documents.insert(ctx.tx, ctx.sandbox.id, {
    id: v7(),
    companyId: trade.companyId,
    tradeId: trade.id,
    kind,
    title: kind.replaceAll("_", " "),
    fileLabel: "PDF · watermarked",
    storageKey: `demo/trades/${trade.id}/${kind}.pdf`,
    createdAt: ctx.now,
  });
}
async function escrowEvent(
  ctx: TxContext,
  trade: Trade,
  kind: "wire_sent" | "funded" | "released" | "refunded",
) {
  await escrow.insert(ctx.tx, ctx.sandbox.id, {
    id: v7(),
    tradeId: trade.id,
    kind,
    amountMinor: trade.priceMinor * trade.quantity,
    currency: trade.currency,
    at: ctx.now,
  });
}
export async function applyEffects(
  ctx: TxContext,
  effects: readonly Effect[],
  change: TransitionChange,
): Promise<void> {
  const sid = ctx.sandbox.id;
  for (const effect of effects) {
    switch (effect.type) {
      case "AUDIT":
        await appendAudit(ctx, {
          action: effect.action,
          entity: effect.entity,
          entityId: effect.entityId,
          before: change.prev,
          after: change.next,
        });
        break;
      case "NOTIFY": {
        const entity = change.next;
        const listing =
          change.kind === "bid" ? await listings.find(ctx.tx, sid, change.next.listingId) : null;
        const companyId =
          change.kind === "bid"
            ? listing?.companyId
            : (change.next as Exclude<typeof entity, import("@/domain/types").Bid>).companyId;
        const company = companyId ? await companies.find(ctx.tx, sid, companyId) : null;
        const sellerId =
          change.kind === "holding"
            ? change.next.ownerId
            : change.kind === "bid"
              ? listing?.sellerId
              : change.next.sellerId;
        const buyerId =
          change.kind === "bid" || change.kind === "trade" ? change.next.buyerId : null;
        const recipients = (await users.list(ctx.tx, sid)).filter((u) =>
          effect.recipient === "seller"
            ? u.id === sellerId
            : effect.recipient === "buyer"
              ? u.id === buyerId
              : effect.recipient === "company"
                ? u.role === "company_admin" && u.orgId === company?.orgId
                : u.role === "operator",
        );
        for (const user of recipients)
          await notifications.insert(ctx.tx, sid, {
            id: v7(),
            recipientId: user.id,
            template: effect.template,
            entity: effect.entity,
            entityId: effect.entityId,
            createdAt: ctx.now,
            readAt: null,
          });
        break;
      }
      case "RESERVE_SHARES":
        await quantity(ctx, effect.holdingId, effect.qty, "reserve");
        break;
      case "RELEASE_SHARES":
        await quantity(ctx, effect.holdingId, effect.qty, "release");
        break;
      case "MARK_SHARES_SOLD":
        await quantity(ctx, effect.holdingId, effect.qty, "sell");
        break;
      case "REJECT_ACTIVE_BIDS":
        for (const b of (await bids.list(ctx.tx, sid)).filter(
          (b) =>
            b.listingId === effect.listingId &&
            ["Submitted", "Countered", "Backup"].includes(b.status),
        ))
          await requireTransition(nested(ctx), "bid", b.id, "REJECT", { reason: effect.reason });
        break;
      case "CREATE_TRADES":
        await createTrades(ctx, effect.listingId, effect.allocations);
        break;
      case "BACKUP_OR_RELEASE": {
        const bid = effect.backupBidId
          ? await bids.getForUpdate(ctx.tx, sid, effect.backupBidId)
          : null;
        if (bid?.status === "Backup" && effect.qty >= bid.minFill) {
          const allocatedQty = minBigint(bid.quantity, effect.qty);
          await requireTransition(nested(ctx), "bid", bid.id, "PROMOTE", { allocatedQty });
          await createTrades(ctx, effect.listingId, [
            { bidId: bid.id, qty: allocatedQty, priceMinor: bid.priceMinor },
          ]);
          if (effect.qty > allocatedQty)
            await quantity(ctx, effect.holdingId, effect.qty - allocatedQty, "release");
        } else await quantity(ctx, effect.holdingId, effect.qty, "release");
        break;
      }
      case "TRANSFER_TO_BUYER": {
        const trade = await trades.find(ctx.tx, sid, effect.tradeId);
        if (!trade) throw new NotFoundError();
        const holding = await holdings.buyerHolding(
          ctx.tx,
          sid,
          effect.buyerId,
          effect.shareClassId,
        );
        if (holding)
          await holdings.save(
            ctx.tx,
            { ...holding, quantity: holding.quantity + effect.qty, version: holding.version + 1 },
            holding.version,
          );
        else
          await holdings.insert(ctx.tx, sid, {
            id: v7(),
            sandboxId: sid,
            ownerId: effect.buyerId,
            companyId: effect.companyId,
            shareClassId: effect.shareClassId,
            quantity: effect.qty,
            reservedQty: 0n,
            soldQty: 0n,
            acquiredAt: ctx.now,
            status: "Verified",
            rejectionReason: null,
            version: 1,
          });
        await prints.insert(ctx.tx, sid, {
          id: v7(),
          companyId: effect.companyId,
          shareClassId: effect.shareClassId,
          priceMinor: trade.priceMinor,
          quantity: effect.qty,
          executedAt: ctx.now,
          relatedParty: false,
          tradeId: trade.id,
        });
        await tradeDocument(ctx, trade, "completion_certificate");
        break;
      }
      case "ESCROW_RELEASE":
      case "ESCROW_REFUND": {
        const trade = await trades.find(ctx.tx, sid, effect.tradeId);
        if (!trade) throw new NotFoundError();
        await escrowEvent(ctx, trade, effect.type === "ESCROW_RELEASE" ? "released" : "refunded");
        break;
      }
    }
  }
}
export async function postTransition(
  ctx: TxContext,
  event: string,
  change: TransitionChange,
): Promise<void> {
  if (change.kind !== "trade") return;
  if (event === "MARK_WIRE_SENT") await escrowEvent(ctx, change.next, "wire_sent");
  if (event === "CONFIRM_FUNDS") await escrowEvent(ctx, change.next, "funded");
  if (event === "UPLOAD_REGISTER") await tradeDocument(ctx, change.next, "register_extract");
  if ((event === "SELLER_SIGN" || event === "BUYER_SIGN") && change.next.status === "RofrPending")
    await tradeDocument(ctx, change.next, "transfer_agreement");
}
