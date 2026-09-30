import "server-only";
import { v7 } from "uuid";
import { z } from "zod";
import { authorize } from "@/domain/authz";
import { forbidden } from "@/domain/errors";
import { redactMessage } from "@/domain/redact";
import { err, ok } from "@/domain/result";
import { isPersonaInvolved } from "@/lib/persona-involvement";
import { type ActionDef, defineAction } from "@/server/actions/pipeline";
import { appendAudit } from "@/server/audit";
import { NotFoundError } from "@/server/errors";
import * as companies from "@/server/repositories/companies";
import * as grants from "@/server/repositories/grants";
import * as jobs from "@/server/repositories/jobs";
import * as notifications from "@/server/repositories/notifications";
import * as qa from "@/server/repositories/qa";
import * as users from "@/server/repositories/users";
import type { TxContext } from "@/server/transitions";

async function notifyAdmins(ctx: TxContext, orgId: string, companyId: string, template: string) {
  for (const user of await users.list(ctx.tx, ctx.sandbox.id))
    if (user.role === "company_admin" && user.orgId === orgId)
      await notifications.insert(ctx.tx, ctx.sandbox.id, {
        id: v7(),
        recipientId: user.id,
        template,
        entity: "company",
        entityId: companyId,
        createdAt: ctx.now,
        readAt: null,
      });
}
const accessInput = z.object({
  companyId: z.uuid(),
  ndaVersion: z.literal("v1"),
  accepted: z.preprocess((v) => (v === "true" ? true : v), z.literal(true)),
});
export interface AccessData {
  id: string;
  status: "pending" | "approved" | "denied";
  slug: string;
}
export const requestAccessDef: ActionDef<typeof accessInput, AccessData> = {
  name: "company.requestAccess",
  input: accessInput,
  revalidate: (d) => [`/companies/${d.slug}`, "/discover"],
  handler: async (ctx, input) => {
    const sid = ctx.sandbox.id,
      company = await companies.find(ctx.tx, sid, input.companyId);
    if (!company) throw new NotFoundError();
    const existing = await grants.find(ctx.tx, sid, company.id, ctx.actor.userId);
    const auth = authorize(ctx.actor, "company.requestAccess", {
      kind: "company",
      sandboxId: sid,
      companyOrgId: company.orgId,
      accessGrant: existing?.status ?? "none",
    });
    if (!auth.ok) return auth;
    if (existing) return ok({ id: existing.id, status: existing.status, slug: company.slug });
    const row = {
      id: v7(),
      companyId: company.id,
      buyerId: ctx.actor.userId,
      status: "pending" as const,
      ndaVersion: input.ndaVersion,
      requestedAt: ctx.now,
      decidedAt: null,
      decidedBy: null,
      version: 1,
    };
    await grants.insert(ctx.tx, sid, row);
    await appendAudit(ctx, {
      action: "company.requestAccess",
      entity: "company",
      entityId: company.id,
      before: null,
      after: row,
    });
    await notifyAdmins(ctx, company.orgId, company.id, "access_requested");
    if (ctx.sandbox.autopilot) {
      const admin = (await users.list(ctx.tx, sid)).find(
        (u) =>
          u.role === "company_admin" && u.orgId === company.orgId && u.id !== ctx.personaUserId,
      );
      const persona = await users.find(ctx.tx, sid, ctx.personaUserId);
      if (
        admin &&
        persona &&
        isPersonaInvolved(
          persona,
          { kind: "company", requestingBuyerId: ctx.actor.userId, companyOrgId: company.orgId },
          admin.role,
        )
      )
        await jobs.insert(ctx.tx, sid, {
          id: v7(),
          sandboxId: sid,
          kind: "access_decision",
          entity: "company",
          entityId: company.id,
          event: ctx.actor.userId,
          partyUserId: admin.id,
          dueAt: new Date(ctx.now.getTime() + 3000),
          createdAt: ctx.now,
          status: "pending",
        });
    }
    return ok({ id: row.id, status: row.status, slug: company.slug });
  },
};
const questionInput = z.object({
  companyId: z.uuid(),
  question: z.string().trim().min(1).max(500),
});
export interface QuestionData {
  id: string;
  slug: string;
  message: string;
}
export const askQuestionDef: ActionDef<typeof questionInput, QuestionData> = {
  name: "company.askQuestion",
  input: questionInput,
  rateLimit: { max: 5, windowSeconds: 60 },
  revalidate: (d) => [`/companies/${d.slug}`],
  handler: async (ctx, input) => {
    const sid = ctx.sandbox.id,
      company = await companies.find(ctx.tx, sid, input.companyId);
    if (!company) throw new NotFoundError();
    const grant = await grants.find(ctx.tx, sid, company.id, ctx.actor.userId);
    const auth = authorize(ctx.actor, "company.askQuestion", {
      kind: "company",
      sandboxId: sid,
      companyOrgId: company.orgId,
      accessGrant: grant?.status ?? "none",
    });
    if (!auth.ok) return auth;
    if (grant?.status !== "approved")
      return err(forbidden("Approved buyers can ask the company questions."));
    const redacted = redactMessage(input.question),
      row = {
        id: v7(),
        companyId: company.id,
        question: redacted.text,
        askedBy: ctx.actor.userId,
        askedAt: ctx.now,
      };
    await qa.insert(ctx.tx, sid, row);
    await appendAudit(ctx, {
      action: "company.askQuestion",
      entity: "company",
      entityId: company.id,
      before: null,
      after: row,
    });
    await notifyAdmins(ctx, company.orgId, company.id, "question_asked");
    return ok({
      id: row.id,
      slug: company.slug,
      message: redacted.flagged
        ? "Contact details were removed. Keep conversations on Atlas."
        : "Question sent to the company.",
    });
  },
};
export const requestAccess = defineAction(requestAccessDef);
export const askQuestion = defineAction(askQuestionDef);
