import "server-only";
import { v7 } from "uuid";
import { z } from "zod";
import { authorize } from "@/domain/authz";
import { forbidden } from "@/domain/errors";
import { redactMessage } from "@/domain/redact";
import { err, ok } from "@/domain/result";
import { mentionsPaymentChange, tradeResource } from "@/lib/trade-display";
import { type ActionDef, defineAction } from "@/server/actions/pipeline";
import { appendAudit } from "@/server/audit";
import { NotFoundError } from "@/server/errors";
import * as companies from "@/server/repositories/companies";
import * as messages from "@/server/repositories/messages";
import * as trades from "@/server/repositories/trades";
import { type EventOf, runTransition } from "@/server/transitions";

const tradeInput = z.strictObject({ tradeId: z.uuid() });
const reasonInput = z.strictObject({
  tradeId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
});
export interface TradeData {
  tradeId: string;
  message: string;
}
const revalidate = (data: TradeData) => ["/trades", `/trades/${data.tradeId}`, "/bids"];
function eventAction(
  name: string,
  event: EventOf<"trade">,
  message: string,
): ActionDef<typeof tradeInput, TradeData> {
  return {
    name: `trade.${name}`,
    input: tradeInput,
    revalidate,
    handler: async (ctx, input) => {
      const result = await runTransition(ctx, "trade", input.tradeId, event, {});
      return result.ok
        ? ok({
            tradeId: input.tradeId,
            message:
              event === "APPROVE_RELEASE"
                ? result.value.status === "Settled"
                  ? "Release approved (2 of 2). Trade settled."
                  : "Release approved (1 of 2)."
                : message,
          })
        : result;
    },
  };
}
function reasonAction(
  name: string,
  event: EventOf<"trade">,
  message: string,
): ActionDef<typeof reasonInput, TradeData> {
  return {
    name: `trade.${name}`,
    input: reasonInput,
    revalidate,
    handler: async (ctx, input) => {
      const result = await runTransition(ctx, "trade", input.tradeId, event, {
        reason: input.reason,
      });
      return result.ok ? ok({ tradeId: input.tradeId, message }) : result;
    },
  };
}
export const signDef: ActionDef<typeof tradeInput, TradeData> = {
  name: "trade.sign",
  input: tradeInput,
  revalidate,
  handler: async (ctx, input) => {
    const trade = await trades.find(ctx.tx, ctx.sandbox.id, input.tradeId);
    if (!trade) throw new NotFoundError();
    const event =
      ctx.actor.role === "seller" && ctx.actor.userId === trade.sellerId
        ? "SELLER_SIGN"
        : ctx.actor.role === "buyer" && ctx.actor.userId === trade.buyerId
          ? "BUYER_SIGN"
          : null;
    if (!event) return err(forbidden("Only the unsigned seller or buyer can sign this agreement."));
    const result = await runTransition(ctx, "trade", trade.id, event, {});
    return result.ok ? ok({ tradeId: trade.id, message: "Agreement signed." }) : result;
  },
};
export const waiveDef = eventAction("waive", "WAIVE", "Right of first refusal waived.");
export const exerciseDef = eventAction("exercise", "EXERCISE", "The company bought the shares.");
export const refuseDef = reasonAction("refuse", "REFUSE", "Transfer refused.");
export const markWireSentDef = eventAction(
  "markWireSent",
  "MARK_WIRE_SENT",
  "Wire marked as sent. The escrow agent confirms receipt next.",
);
export const confirmFundsDef = eventAction("confirmFunds", "CONFIRM_FUNDS", "Funds confirmed.");
export const uploadRegisterDef = eventAction(
  "uploadRegister",
  "UPLOAD_REGISTER",
  "Register extract uploaded.",
);
export const approveReleaseDef = eventAction(
  "approveRelease",
  "APPROVE_RELEASE",
  "Release approved.",
);
export const raiseDisputeDef = reasonAction(
  "raiseDispute",
  "RAISE_DISPUTE",
  "Dispute raised. Atlas operations reviews it next.",
);
export const resolveContinueDef = eventAction(
  "resolveContinue",
  "RESOLVE_CONTINUE",
  "Trade resumed.",
);
export const resolveCancelDef = reasonAction(
  "resolveCancel",
  "RESOLVE_CANCEL",
  "Trade cancelled and escrow refunded.",
);
export const cancelDef = reasonAction("cancel", "CANCEL_BY_OPERATOR", "Trade cancelled.");
const messageInput = z.strictObject({
  tradeId: z.uuid(),
  body: z.string().trim().min(1).max(1000),
});
export const sendMessageDef: ActionDef<typeof messageInput, TradeData> = {
  name: "trade.sendMessage",
  input: messageInput,
  rateLimit: { max: 10, windowSeconds: 60 },
  revalidate,
  handler: async (ctx, input) => {
    const sid = ctx.sandbox.id,
      trade = await trades.find(ctx.tx, sid, input.tradeId);
    if (!trade) throw new NotFoundError();
    const company = await companies.find(ctx.tx, sid, trade.companyId);
    if (!company) throw new NotFoundError();
    const auth = authorize(ctx.actor, "trade.view", tradeResource(trade, company.orgId));
    if (!auth.ok) return auth;
    if (ctx.actor.role === "company_admin")
      return err(forbidden("Only the seller, buyer and Atlas operations can use this thread."));
    const redacted = redactMessage(input.body),
      id = v7(),
      threadId = await messages.ensureThread(ctx.tx, sid, trade.id, ctx.now);
    const row = {
      id,
      threadId,
      senderId: ctx.actor.userId,
      bodyRedacted: redacted.text,
      flagged: redacted.flagged,
      found: [...redacted.found, ...(mentionsPaymentChange(input.body) ? ["payment_change"] : [])],
      createdAt: ctx.now,
    };
    await messages.insert(ctx.tx, sid, row);
    await appendAudit(ctx, {
      action: "trade.sendMessage",
      entity: "trade",
      entityId: trade.id,
      before: null,
      after: row,
    });
    return ok({
      tradeId: trade.id,
      message: redacted.flagged
        ? "Contact details were removed. Keep conversations on Atlas."
        : "Message sent.",
    });
  },
};
export const sign = defineAction(signDef);
export const waive = defineAction(waiveDef);
export const exercise = defineAction(exerciseDef);
export const refuse = defineAction(refuseDef);
export const markWireSent = defineAction(markWireSentDef);
export const confirmFunds = defineAction(confirmFundsDef);
export const uploadRegister = defineAction(uploadRegisterDef);
export const approveRelease = defineAction(approveReleaseDef);
export const raiseDispute = defineAction(raiseDisputeDef);
export const resolveContinue = defineAction(resolveContinueDef);
export const resolveCancel = defineAction(resolveCancelDef);
export const cancel = defineAction(cancelDef);
export const sendMessage = defineAction(sendMessageDef);
