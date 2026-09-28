import "server-only";
import { v7 } from "uuid";
import { authorize } from "@/domain/authz";
import { type BidInput, createBid } from "@/domain/bid";
import { forbidden, validation } from "@/domain/errors";
import { parseMoneyInput, parseSharesInput } from "@/domain/money";
import { evaluateBuyer } from "@/domain/policy";
import { err, ok, type Result } from "@/domain/result";
import type { Bid } from "@/domain/types";
import { appendAudit } from "@/server/audit";
import { type ActionError, NotFoundError } from "@/server/errors";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as grants from "@/server/repositories/grants";
import * as listings from "@/server/repositories/listings";
import * as notifications from "@/server/repositories/notifications";
import { buyerProfile, isRelatedParty } from "@/server/repositories/parties";
import * as users from "@/server/repositories/users";
import type { TxContext } from "@/server/transitions";
export function parseBidFields(input: {
  price: string;
  quantity: string;
  minFill: string;
  rationale: string;
}): Result<BidInput> {
  const price = parseMoneyInput(input.price),
    quantity = parseSharesInput(input.quantity),
    minFill = parseSharesInput(input.minFill);
  const values = [
    ["price", price],
    ["quantity", quantity],
    ["minFill", minFill],
  ] as const;
  const issues = values.flatMap(([field, r]) =>
    r.ok ? [] : (r.error.issues ?? []).map((i) => ({ ...i, field })),
  );
  if (issues.length) return err(validation(issues));
  if (!price.ok || !quantity.ok || !minFill.ok) throw new Error("Validated bid fields missing");
  return ok({
    priceMinor: price.value,
    quantity: quantity.value,
    minFill: minFill.value,
    rationale: input.rationale,
  });
}
export async function submitBid(
  ctx: TxContext,
  listingId: string,
  input: BidInput,
  idempotencyKey: string,
): Promise<Result<Bid, ActionError>> {
  const sid = ctx.sandbox.id,
    listing = await listings.getForUpdate(ctx.tx, sid, listingId);
  if (!listing) throw new NotFoundError();
  const auth = authorize(ctx.actor, "bid.create", {
    kind: "listing",
    sandboxId: sid,
    sellerId: listing.sellerId,
    companyOrgId: "",
    status: listing.status,
  });
  if (!auth.ok) return auth;
  const previous = await bids.byKey(ctx.tx, sid, ctx.actor.userId, idempotencyKey);
  if (previous)
    return previous.listingId === listing.id
      ? ok(previous)
      : err(
          validation([
            {
              field: "idempotencyKey",
              message: "This request was already used for a different listing.",
            },
          ]),
        );
  const company = await companies.find(ctx.tx, sid, listing.companyId),
    user = await users.find(ctx.tx, sid, ctx.actor.userId);
  if (!company || !user) throw new NotFoundError();
  const grant = await grants.find(ctx.tx, sid, company.id, user.id);
  if (grant?.status !== "approved")
    return err(forbidden(`Request access to ${company.name} first.`));
  const buyer = buyerProfile(user);
  if (!buyer) return err(forbidden("Only buyers can bid."));
  const policy = await companies.policy(ctx.tx, sid, company.id);
  const own = (await bids.forBuyer(ctx.tx, sid, user.id)).find(
    (b) => b.listingId === listing.id && ["Submitted", "Countered", "Backup"].includes(b.status),
  );
  const built = createBid(input, {
    id: v7(),
    now: ctx.now,
    actor: ctx.actor,
    listing,
    buyer,
    buyerPolicy: evaluateBuyer({ policy, buyer }),
    relatedParty: await isRelatedParty(ctx.tx, sid, listing.sellerId, buyer.orgId),
    existingActiveBidId: own?.id ?? null,
    idempotencyKey,
  });
  if (!built.ok) return built;
  const saved = await bids.insertOnce(ctx.tx, sid, built.value);
  if (saved.inserted) {
    await appendAudit(ctx, {
      action: "bid.create",
      entity: "bid",
      entityId: saved.bid.id,
      before: null,
      after: saved.bid,
    });
    await notifications.insert(ctx.tx, sid, {
      id: v7(),
      recipientId: listing.sellerId,
      template: "bid_received",
      entity: "bid",
      entityId: saved.bid.id,
      createdAt: ctx.now,
      readAt: null,
    });
  }
  return ok(saved.bid);
}
