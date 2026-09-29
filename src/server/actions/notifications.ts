import "server-only";
import { z } from "zod";
import { authorize } from "@/domain/authz";
import { ok } from "@/domain/result";
import { defineAction } from "@/server/actions/pipeline";
import { appendAudit } from "@/server/audit";
import { NotFoundError } from "@/server/errors";
import * as notifications from "@/server/repositories/notifications";
import type { TxContext } from "@/server/transitions";

const allow = (ctx: TxContext) =>
  authorize(ctx.actor, "sandbox.switchPersona", { kind: "sandbox", sandboxId: ctx.sandbox.id });
export const markReadDef = {
  name: "notifications.markRead",
  input: z.strictObject({ id: z.uuid() }),
  revalidate: ["/"],
  handler: async (ctx: TxContext, input: { id: string }) => {
    const auth = allow(ctx);
    if (!auth.ok) return auth;
    const row = await notifications.getForUpdate(
      ctx.tx,
      ctx.sandbox.id,
      ctx.actor.userId,
      input.id,
    );
    if (!row) throw new NotFoundError();
    if (!row.readAt) {
      await notifications.markRead(ctx.tx, ctx.sandbox.id, ctx.actor.userId, row.id, ctx.now);
      await appendAudit(ctx, {
        action: "notifications.markRead",
        entity: "sandbox",
        entityId: ctx.sandbox.id,
        before: { notificationId: row.id, readAt: null },
        after: { readAt: ctx.now },
      });
    }
    return ok({});
  },
};
export const markAllReadDef = {
  name: "notifications.markAllRead",
  input: z.strictObject({}),
  revalidate: ["/"],
  handler: async (ctx: TxContext) => {
    const auth = allow(ctx);
    if (!auth.ok) return auth;
    const rows = await notifications.markAllRead(ctx.tx, ctx.sandbox.id, ctx.actor.userId, ctx.now);
    if (rows.length)
      await appendAudit(ctx, {
        action: "notifications.markAllRead",
        entity: "sandbox",
        entityId: ctx.sandbox.id,
        before: { unreadIds: rows.map((r) => r.id) },
        after: { readAt: ctx.now },
      });
    return ok({});
  },
};
export const markRead = defineAction(markReadDef);
export const markAllRead = defineAction(markAllReadDef);
