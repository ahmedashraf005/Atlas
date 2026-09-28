import "server-only";
import { v7 } from "uuid";
import { authorize } from "@/domain/authz";
import { guardFailed, policyBlocked } from "@/domain/errors";
import { evaluateBuyer } from "@/domain/policy";
import { err, ok } from "@/domain/result";
import { appendAudit } from "@/server/audit";
import { NotFoundError } from "@/server/errors";
import * as companies from "@/server/repositories/companies";
import * as grants from "@/server/repositories/grants";
import * as notifications from "@/server/repositories/notifications";
import * as users from "@/server/repositories/users";
import type { TxContext } from "@/server/transitions";

export async function decideAccess(
  ctx: TxContext,
  companyId: string,
  buyerId: string,
  decision: "approve" | "deny" | "automatic",
) {
  const sid = ctx.sandbox.id,
    company = await companies.find(ctx.tx, sid, companyId);
  if (!company) throw new NotFoundError();
  const auth = authorize(ctx.actor, "company.decideAccess", {
    kind: "company",
    sandboxId: sid,
    companyOrgId: company.orgId,
    accessGrant: "pending",
  });
  if (!auth.ok) return auth;
  const found = await grants.find(ctx.tx, sid, companyId, buyerId);
  const grant = found ? await grants.getForUpdate(ctx.tx, sid, found.id) : null;
  if (!grant) throw new NotFoundError();
  if (grant.status !== "pending")
    return err(guardFailed("This access request has already been decided."));
  const buyer = await users.find(ctx.tx, sid, buyerId);
  if (!buyer?.orgId || !buyer.investorType) throw new NotFoundError();
  const eligible = evaluateBuyer({
    policy: await companies.policy(ctx.tx, sid, companyId),
    buyer: {
      userId: buyer.id,
      orgId: buyer.orgId,
      investorType: buyer.investorType,
      kycStatus: buyer.kycStatus,
      professionalVerified: buyer.professionalVerified,
    },
  });
  if (decision === "approve" && !eligible.ok) return err(policyBlocked(eligible.failures));
  const status =
    decision === "automatic"
      ? eligible.ok
        ? "approved"
        : "denied"
      : decision === "approve"
        ? "approved"
        : "denied";
  const next = await grants.decide(ctx.tx, sid, grant, status, ctx.actor.userId, ctx.now);
  await appendAudit(ctx, {
    action: "company.decideAccess",
    entity: "company",
    entityId: companyId,
    before: grant,
    after: next,
  });
  await notifications.insert(ctx.tx, sid, {
    id: v7(),
    recipientId: buyerId,
    template: status === "approved" ? "access_approved" : "access_denied",
    entity: "company",
    entityId: companyId,
    createdAt: ctx.now,
    readAt: null,
  });
  return ok({ companyId, status });
}
