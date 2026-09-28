import "server-only";
import { v7 } from "uuid";
import { authorize } from "@/domain/authz";
import { evaluateBuyer } from "@/domain/policy";
import { fairValueBand, fallbackPriceForClass } from "@/domain/pricing";
import { err, ok } from "@/domain/result";
import { competingPrice } from "@/lib/bid-maths";
import { appendAudit } from "@/server/audit";
import { submitBid } from "@/server/bidding";
import type { ActionError } from "@/server/errors";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as grants from "@/server/repositories/grants";
import * as listings from "@/server/repositories/listings";
import { buyerProfile, isRelatedParty } from "@/server/repositories/parties";
import * as prints from "@/server/repositories/prints";
import * as users from "@/server/repositories/users";
import type { TxContext } from "@/server/transitions";
export async function simulateBid(ctx: TxContext, listingId?: string) {
  const sid = ctx.sandbox.id,
    all = await listings.listWithRefs(ctx.tx, sid),
    own = await bids.forBuyer(ctx.tx, sid, ctx.actor.userId);
  const live = all
    .filter((l) => l.status === "Live" && l.windowClosesAt && l.windowClosesAt > ctx.now)
    .sort(
      (a, b) =>
        (a.windowClosesAt?.getTime() ?? 0) - (b.windowClosesAt?.getTime() ?? 0) ||
        a.ref.localeCompare(b.ref),
    );
  const target = listingId
    ? live.find((l) => l.id === listingId)
    : ctx.actor.role === "seller"
      ? live.find((l) => l.sellerId === ctx.actor.userId)
      : ctx.actor.role === "buyer"
        ? (live.find((l) =>
            own.some(
              (b) =>
                b.listingId === l.id && ["Submitted", "Countered", "Backup"].includes(b.status),
            ),
          ) ?? live[0])
        : live[0];
  if (!target)
    return err({
      code: "VALIDATION",
      message: "There's no live listing to bid on right now.",
    } satisfies ActionError);
  const company = await companies.find(ctx.tx, sid, target.companyId);
  if (!company) throw new Error("Company missing");
  const policy = await companies.policy(ctx.tx, sid, company.id),
    existing = await bids.forListing(ctx.tx, sid, target.id),
    people = await users.list(ctx.tx, sid);
  const admin = people.find((u) => u.role === "company_admin" && u.orgId === company.orgId);
  for (const handle of ["Investor #B-204", "Investor #B-352", "Investor #B-409"]) {
    const user = people.find((u) => u.handle === handle && u.simulatedOnly),
      buyer = user ? buyerProfile(user) : null;
    if (
      !user ||
      !buyer ||
      existing.some(
        (b) => b.buyerId === user.id && ["Submitted", "Countered", "Backup"].includes(b.status),
      ) ||
      !evaluateBuyer({ policy, buyer }).ok ||
      (await isRelatedParty(ctx.tx, sid, target.sellerId, buyer.orgId))
    )
      continue;
    const grant = await grants.find(ctx.tx, sid, company.id, user.id);
    if (grant?.status === "denied") continue;
    if (grant?.status !== "approved") {
      if (!admin) continue;
      const adminCtx = { ...ctx, actor: users.toActor(admin, true) },
        auth = authorize(adminCtx.actor, "company.decideAccess", {
          kind: "company",
          sandboxId: sid,
          companyOrgId: company.orgId,
          accessGrant: grant?.status ?? "none",
        });
      if (!auth.ok) return auth;
      const after = grant
        ? await grants.decide(ctx.tx, sid, grant, "approved", admin.id, ctx.now)
        : {
            id: v7(),
            companyId: company.id,
            buyerId: user.id,
            status: "approved" as const,
            ndaVersion: "v1",
            requestedAt: ctx.now,
            decidedAt: ctx.now,
            decidedBy: admin.id,
          };
      if (!grant) await grants.insert(ctx.tx, sid, after);
      await appendAudit(adminCtx, {
        action: "company.decideAccess",
        entity: "company",
        entityId: company.id,
        before: grant,
        after,
      });
    }
    const classes = await companies.classes(ctx.tx, sid, company.id),
      companyPrints = (await prints.list(ctx.tx, sid)).filter(
        (p) => p.companyId === company.id && p.shareClassId === target.shareClassId,
      ),
      band = fairValueBand({
        trades: companyPrints,
        now: ctx.now,
        fallbackMinor: fallbackPriceForClass({
          company: companies.toCompany(company),
          classes,
          shareClassId: target.shareClassId,
        }),
      });
    const base = band.method === "none" ? target.reservePriceMinor : band.midMinor,
      half = (target.quantity / 2n / policy.minLot) * policy.minLot,
      minFill = half > target.minFill ? half : target.minFill;
    const r = await submitBid(
      { ...ctx, actor: users.toActor(user, true) },
      target.id,
      {
        priceMinor: competingPrice(base, existing.length),
        quantity: target.quantity,
        minFill,
        rationale: "",
      },
      v7(),
    );
    return r.ok
      ? ok({
          listingId: target.id,
          ref: target.ref,
          slug: company.slug,
          message: `A simulated investor placed a sealed bid on ${target.ref}.`,
        })
      : r;
  }
  return err({
    code: "VALIDATION",
    message: `Every simulated investor has already bid on ${target.ref}.`,
  } satisfies ActionError);
}
