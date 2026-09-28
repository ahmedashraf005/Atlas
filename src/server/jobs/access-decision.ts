import "server-only";
import { v7 } from "uuid";
import { authorize } from "@/domain/authz";
import { evaluateBuyer } from "@/domain/policy";
import { ok } from "@/domain/result";
import { appendAudit } from "@/server/audit";
import { registerJobHandler } from "@/server/automation";
import * as companies from "@/server/repositories/companies";
import * as grants from "@/server/repositories/grants";
import * as notifications from "@/server/repositories/notifications";
import * as users from "@/server/repositories/users";

registerJobHandler("access_decision", async (ctx, job) => {
  const sid = ctx.sandbox.id;
  const found = job.event ? await grants.find(ctx.tx, sid, job.entityId, job.event) : null;
  const grant = found ? await grants.getForUpdate(ctx.tx, sid, found.id) : null;
  if (!grant || grant.status !== "pending") return { status: "skipped", code: "ALREADY_DECIDED" };
  const company = await companies.find(ctx.tx, sid, grant.companyId);
  const buyer = await users.find(ctx.tx, sid, grant.buyerId);
  if (!company || !buyer || !buyer.orgId || !buyer.investorType)
    return { status: "skipped", code: "NOT_FOUND" };
  const auth = authorize(ctx.actor, "company.decideAccess", {
    kind: "company",
    sandboxId: sid,
    companyOrgId: company.orgId,
    accessGrant: "pending",
  });
  if (!auth.ok) return auth;
  const eligible = evaluateBuyer({
    policy: await companies.policy(ctx.tx, sid, company.id),
    buyer: {
      userId: buyer.id,
      orgId: buyer.orgId,
      investorType: buyer.investorType,
      kycStatus: buyer.kycStatus,
      professionalVerified: buyer.professionalVerified,
    },
  });
  const next = await grants.decide(
    ctx.tx,
    sid,
    grant,
    eligible.ok ? "approved" : "denied",
    ctx.actor.userId,
    ctx.now,
  );
  await appendAudit(ctx, {
    action: "company.decideAccess",
    entity: "company",
    entityId: company.id,
    before: grant,
    after: next,
  });
  await notifications.insert(ctx.tx, sid, {
    id: v7(),
    recipientId: buyer.id,
    template: eligible.ok ? "access_approved" : "access_denied",
    entity: "company",
    entityId: company.id,
    createdAt: ctx.now,
    readAt: null,
  });
  return ok({});
});
