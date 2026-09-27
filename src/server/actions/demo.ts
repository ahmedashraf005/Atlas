import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERSONAS, type PersonaKey, personaSchema } from "@/config/personas";
import { type Action, authorize } from "@/domain/authz";
import { ok } from "@/domain/result";
import { type ActionState, defineAction } from "@/server/actions/pipeline";
import { appendAudit } from "@/server/audit";
import { sandboxClock } from "@/server/clock";
import { refreshInTransaction } from "@/server/refresh";
import * as sandboxes from "@/server/repositories/sandboxes";
import { resetInTransaction } from "@/server/sandbox";
import { writeSession } from "@/server/session";
import type { TxContext } from "@/server/transitions";

const allow = (ctx: TxContext, action: Action) =>
  authorize(ctx.actor, action, { kind: "sandbox", sandboxId: ctx.sandbox.id });
const empty = z.object({});
const revalidate = ["/"];
async function auditChange(ctx: TxContext, action: string, before: unknown, after: unknown) {
  await appendAudit(ctx, { action, entity: "sandbox", entityId: ctx.sandbox.id, before, after });
}
const switchAction = defineAction({
  name: "sandbox.switchPersona",
  input: z.object({ persona: personaSchema }),
  revalidate,
  handler: async (ctx, input) => {
    const auth = allow(ctx, "sandbox.switchPersona");
    if (!auth.ok) return auth;
    const before = ctx.sandbox.persona;
    await sandboxes.save(ctx.tx, ctx.sandbox.id, { persona: input.persona });
    await auditChange(
      ctx,
      "sandbox.switchPersona",
      { persona: before },
      { persona: input.persona },
    );
    return ok({ sid: ctx.sandbox.id, per: input.persona });
  },
});
export async function switchPersona(
  prev: ActionState<{ sid: string; per: PersonaKey }>,
  input: { persona: PersonaKey } | FormData,
) {
  const state = await switchAction(prev, input);
  if (state.status === "success") {
    await writeSession(state.data);
    redirect(PERSONAS.find((p) => p.key === state.data.per)?.home ?? "/discover");
  }
  return state;
}
const advanceAction = defineAction({
  name: "sandbox.advanceClock",
  input: z.object({ hours: z.union([z.literal(24), z.literal(168), z.literal(720)]) }),
  revalidate,
  handler: async (ctx, input) => {
    const auth = allow(ctx, "sandbox.advanceClock");
    if (!auth.ok) return auth;
    const before = ctx.sandbox.clockOffsetMs,
      after = before + input.hours * 3_600_000;
    await sandboxes.save(ctx.tx, ctx.sandbox.id, { clockOffsetMs: after });
    ctx.sandbox.clockOffsetMs = after;
    await auditChange(
      ctx,
      "sandbox.advanceClock",
      { clockOffsetMs: before },
      { clockOffsetMs: after },
    );
    await refreshInTransaction(ctx.tx, ctx.sandbox);
    return ok({});
  },
});
export async function advanceClock(
  prev: ActionState<object>,
  input: { hours: 24 | 168 | 720 } | FormData,
) {
  return advanceAction(prev, input);
}
const toggleAction = defineAction({
  name: "sandbox.toggleAutopilot",
  input: empty,
  revalidate,
  handler: async (ctx) => {
    const auth = allow(ctx, "sandbox.toggleAutopilot");
    if (!auth.ok) return auth;
    const before = ctx.sandbox.autopilot,
      after = !before;
    await sandboxes.save(ctx.tx, ctx.sandbox.id, { autopilot: after });
    ctx.sandbox.autopilot = after;
    await auditChange(ctx, "sandbox.toggleAutopilot", { autopilot: before }, { autopilot: after });
    await refreshInTransaction(ctx.tx, ctx.sandbox);
    return ok({});
  },
});
export async function toggleAutopilot(
  prev: ActionState<object>,
  input: Record<string, never> | FormData,
) {
  return toggleAction(prev, input);
}
const rofrAction = defineAction({
  name: "sandbox.setRofrMode",
  input: z.object({ mode: z.enum(["waive", "exercise"]) }),
  revalidate,
  handler: async (ctx, input) => {
    const auth = allow(ctx, "sandbox.setRofrMode");
    if (!auth.ok) return auth;
    const before = ctx.sandbox.rofrMode;
    await sandboxes.save(ctx.tx, ctx.sandbox.id, { rofrMode: input.mode });
    await auditChange(ctx, "sandbox.setRofrMode", { rofrMode: before }, { rofrMode: input.mode });
    return ok({});
  },
});
export async function setRofrMode(
  prev: ActionState<object>,
  input: { mode: "waive" | "exercise" } | FormData,
) {
  return rofrAction(prev, input);
}
const resetAction = defineAction({
  name: "sandbox.reset",
  input: empty,
  revalidate,
  handler: async (ctx) => {
    const auth = allow(ctx, "sandbox.reset");
    if (!auth.ok) return auth;
    const per = ctx.sandbox.persona,
      sid = await resetInTransaction(ctx.tx, ctx.sandbox.id, per);
    const sandbox = await sandboxes.lockSandbox(ctx.tx, sid);
    await appendAudit(
      {
        ...ctx,
        sandbox,
        actor: { ...ctx.actor, sandboxId: sid },
        now: sandboxClock(sandbox).now(),
      },
      {
        action: "sandbox.reset",
        entity: "sandbox",
        entityId: sid,
        before: { sandboxId: ctx.sandbox.id },
        after: { sandboxId: sid, persona: per },
      },
    );
    return ok({ sid, per });
  },
});
export async function resetSandbox(
  prev: ActionState<{ sid: string; per: PersonaKey }>,
  input: Record<string, never> | FormData,
) {
  const state = await resetAction(prev, input);
  if (state.status === "success") {
    await writeSession(state.data);
    redirect(PERSONAS.find((p) => p.key === state.data.per)?.home ?? "/discover");
  }
  return state;
}
