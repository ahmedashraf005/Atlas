import "server-only";
import { z } from "zod";
import { verifyChain } from "@/domain/audit";
import { authorize } from "@/domain/authz";
import { ok } from "@/domain/result";
import { defineAction } from "@/server/actions/pipeline";
import { tamperAudit } from "@/server/demo/tamper";
import * as audit from "@/server/repositories/audit";

const input = z.strictObject({});
export const verifyDef = {
  name: "audit.verify",
  input,
  revalidate: ["/ops/audit"],
  handler: async (ctx: import("@/server/transitions").TxContext) => {
    const auth = authorize(ctx.actor, "audit.verify", {
      kind: "sandbox",
      sandboxId: ctx.sandbox.id,
    });
    if (!auth.ok) return auth;
    const result = verifyChain(await audit.list(ctx.tx, ctx.sandbox.id), {
      count: ctx.sandbox.auditHeadSeq,
      headHash: ctx.sandbox.auditHeadHash,
    });
    return ok({
      message: result.ok
        ? `Chain verified · ${result.count} entries`
        : `Chain broken at entry #${result.brokenAtSeq}`,
      verified: result.ok,
    });
  },
};
export const tamperDef = {
  name: "demo.tamperAudit",
  input,
  revalidate: ["/ops/audit"],
  handler: async (ctx: import("@/server/transitions").TxContext) => {
    // The demo tool has exactly the same operator-only scope as audit verification.
    const auth = authorize(ctx.actor, "audit.verify", {
      kind: "sandbox",
      sandboxId: ctx.sandbox.id,
    });
    if (!auth.ok) return auth;
    const seq = await tamperAudit(ctx.tx, ctx.sandbox.id, ctx.sandbox.auditHeadSeq);
    return ok({ message: `Entry #${seq} changed. Verify the chain to see the failure.` });
  },
};
export const verify = defineAction(verifyDef);
export const tamper = defineAction(tamperDef);
