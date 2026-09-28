import "server-only";
import { v7 } from "uuid";
import { z } from "zod";
import { authorize } from "@/domain/authz";
import { guardFailed } from "@/domain/errors";
import { redactMessage } from "@/domain/redact";
import { err, ok } from "@/domain/result";
import { decideAccess } from "@/server/access-decision";
import { type ActionDef, defineAction } from "@/server/actions/pipeline";
import { appendAudit } from "@/server/audit";
import { NotFoundError } from "@/server/errors";
import * as companies from "@/server/repositories/companies";
import * as consoles from "@/server/repositories/consoles";
import * as notifications from "@/server/repositories/notifications";
import { runTransition } from "@/server/transitions";
export interface ConsoleData {
  message: string;
}
const holdingInput = z.strictObject({ holdingId: z.uuid() });
const rejectInput = holdingInput.extend({ reason: z.string().trim().min(1).max(1000) });
export const verifyHoldingDef: ActionDef<typeof holdingInput, ConsoleData> = {
  name: "holding.verify",
  input: holdingInput,
  revalidate: ["/company", "/holdings"],
  handler: async (ctx, input) => {
    const result = await runTransition(ctx, "holding", input.holdingId, "VERIFY", {});
    return result.ok ? ok({ message: "Holding verified." }) : result;
  },
};
export const rejectHoldingDef: ActionDef<typeof rejectInput, ConsoleData> = {
  name: "holding.reject",
  input: rejectInput,
  revalidate: ["/company", "/holdings"],
  handler: async (ctx, input) => {
    const result = await runTransition(ctx, "holding", input.holdingId, "REJECT", {
      reason: input.reason,
    });
    return result.ok ? ok({ message: "Holding rejected." }) : result;
  },
};
const accessInput = z.strictObject({
  companyId: z.uuid(),
  buyerId: z.uuid(),
  decision: z.enum(["approve", "deny"]),
});
export const decideAccessDef: ActionDef<typeof accessInput, ConsoleData & { slug: string }> = {
  name: "company.decideAccess",
  input: accessInput,
  revalidate: (data) => ["/company", "/discover", `/companies/${data.slug}`],
  handler: async (ctx, input) => {
    const result = await decideAccess(ctx, input.companyId, input.buyerId, input.decision);
    if (!result.ok) return result;
    const company = await companies.find(ctx.tx, ctx.sandbox.id, input.companyId);
    if (!company) throw new NotFoundError();
    return ok({
      slug: company.slug,
      message: result.value.status === "approved" ? "Access approved." : "Access denied.",
    });
  },
};
const answerInput = z.strictObject({
  questionId: z.uuid(),
  answer: z.string().trim().min(1).max(1000),
});
export const answerQuestionDef: ActionDef<typeof answerInput, ConsoleData & { slug: string }> = {
  name: "company.answerQuestion",
  input: answerInput,
  revalidate: (data) => ["/company", `/companies/${data.slug}`],
  handler: async (ctx, input) => {
    const sid = ctx.sandbox.id,
      prev = await consoles.questionForUpdate(ctx.tx, sid, input.questionId);
    if (!prev) throw new NotFoundError();
    const company = await companies.find(ctx.tx, sid, prev.companyId);
    if (!company) throw new NotFoundError();
    const auth = authorize(ctx.actor, "company.answerQuestion", {
      kind: "company",
      sandboxId: sid,
      companyOrgId: company.orgId,
      accessGrant: "none",
    });
    if (!auth.ok) return auth;
    if (prev.answer !== null) return err(guardFailed("This question already has an answer."));
    const redacted = redactMessage(input.answer);
    const next = await consoles.answer(ctx.tx, sid, prev, redacted.text, ctx.actor.userId, ctx.now);
    await appendAudit(ctx, {
      action: "company.answerQuestion",
      entity: "company",
      entityId: company.id,
      before: prev,
      after: next,
    });
    await notifications.insert(ctx.tx, sid, {
      id: v7(),
      recipientId: prev.askedBy,
      template: "question_answered",
      entity: "company",
      entityId: company.id,
      createdAt: ctx.now,
      readAt: null,
    });
    return ok({
      slug: company.slug,
      message: redacted.flagged
        ? "Contact details were removed. Answer published."
        : "Answer published.",
    });
  },
};
export const verifyHolding = defineAction(verifyHoldingDef);
export const rejectHolding = defineAction(rejectHoldingDef);
export const decideAccessAction = defineAction(decideAccessDef);
export const answerQuestion = defineAction(answerQuestionDef);
