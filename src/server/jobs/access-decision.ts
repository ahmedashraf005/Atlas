import "server-only";
import { decideAccess } from "@/server/access-decision";
import { registerJobHandler } from "@/server/automation";
import * as grants from "@/server/repositories/grants";

registerJobHandler("access_decision", async (ctx, job) => {
  const grant = job.event
    ? await grants.find(ctx.tx, ctx.sandbox.id, job.entityId, job.event)
    : null;
  if (!grant || grant.status !== "pending") return { status: "skipped", code: "ALREADY_DECIDED" };
  return decideAccess(ctx, grant.companyId, grant.buyerId, "automatic");
});
