import "server-only";
import { v7 } from "uuid";
import type { EntityKind } from "@/domain/effects";
import type { Result } from "@/domain/result";
import type { ActionError } from "@/server/errors";
import * as companies from "@/server/repositories/companies";
import * as jobs from "@/server/repositories/jobs";
import * as users from "@/server/repositories/users";
import type { EntityOf, TxContext } from "@/server/transitions";
export interface PlannedJob {
  event: string;
  partyUserId: string;
  delaySeconds: number;
  escrowException?: boolean;
}
export function planAutomation(
  kind: EntityKind,
  entity: EntityOf<EntityKind>,
  settings: { autopilot: boolean; rofrMode: "waive" | "exercise"; personaUserId: string },
  parties: {
    companyAdminId: string | null;
    operatorId: string | null;
    secondOperatorId: string | null;
  },
): PlannedJob[] {
  if (!settings.autopilot) return [];
  const planned: PlannedJob[] = [];
  const add = (
    event: string,
    partyUserId: string | null,
    delaySeconds: number,
    escrowException = false,
  ) => {
    if (partyUserId && (partyUserId !== settings.personaUserId || escrowException))
      planned.push({
        event,
        partyUserId,
        delaySeconds,
        ...(escrowException ? { escrowException: true } : {}),
      });
  };
  if (kind === "holding" && entity.status === "PendingCompany")
    add("VERIFY", parties.companyAdminId, 3);
  if (kind === "listing" && entity.status === "InReview")
    add("APPROVE", parties.secondOperatorId, 3);
  if (kind === "bid" && entity.status === "Countered" && "buyerId" in entity)
    add("ACCEPT_COUNTER", entity.buyerId, 5);
  if (kind === "trade" && "sellerSignedAt" in entity) {
    switch (entity.status) {
      case "AwaitingDocs":
        if (!entity.sellerSignedAt) add("SELLER_SIGN", entity.sellerId, 4);
        if (!entity.buyerSignedAt) add("BUYER_SIGN", entity.buyerId, 4);
        break;
      case "RofrPending":
        add(settings.rofrMode === "waive" ? "WAIVE" : "EXERCISE", parties.companyAdminId, 5);
        break;
      case "AwaitingFunds":
        if (!entity.wireSentAt) add("MARK_WIRE_SENT", entity.buyerId, 5);
        else add("CONFIRM_FUNDS", parties.secondOperatorId, 3, true);
        break;
      case "Funded":
        add("UPLOAD_REGISTER", parties.companyAdminId, 4);
        break;
      case "TransferPending":
        if (entity.releaseApprovals.length === 0)
          add("APPROVE_RELEASE", parties.secondOperatorId, 3);
        else if (entity.releaseApprovals.length === 1)
          add(
            "APPROVE_RELEASE",
            entity.releaseApprovals[0] === parties.secondOperatorId
              ? parties.operatorId
              : parties.secondOperatorId,
            3,
          );
        break;
    }
  }
  return planned;
}
export async function scheduleAutomation(
  ctx: TxContext,
  kind: EntityKind,
  entity: EntityOf<EntityKind>,
): Promise<void> {
  const sid = ctx.sandbox.id;
  const companyId = "companyId" in entity ? entity.companyId : null;
  let orgId: string | null = null;
  if (companyId) orgId = (await companies.find(ctx.tx, sid, companyId))?.orgId ?? null;
  const all = await users.list(ctx.tx, sid);
  const parties = {
    companyAdminId: all.find((u) => u.role === "company_admin" && u.orgId === orgId)?.id ?? null,
    operatorId: all.find((u) => u.personaKey === "operator")?.id ?? null,
    secondOperatorId: all.find((u) => u.role === "operator" && u.simulatedOnly)?.id ?? null,
  };
  const planned = planAutomation(
    kind,
    entity,
    {
      autopilot: ctx.sandbox.autopilot,
      rofrMode: ctx.sandbox.rofrMode,
      personaUserId: ctx.personaUserId,
    },
    parties,
  );
  for (const p of planned)
    await jobs.insert(ctx.tx, sid, {
      id: v7(),
      sandboxId: sid,
      dueAt: new Date(ctx.now.getTime() + p.delaySeconds * 1000),
      kind: "transition",
      entity: kind,
      entityId: entity.id,
      event: p.event,
      partyUserId: p.partyUserId,
      status: "pending",
      resultCode: null,
      createdAt: ctx.now,
      executedAt: null,
    });
}
export interface SkippedJob {
  status: "skipped";
  code: string;
}
export class JobSkippedError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "JobSkippedError";
  }
}
export type JobHandler = (
  ctx: TxContext,
  job: jobs.JobRow,
) => Promise<Result<unknown, ActionError> | SkippedJob>;
const handlers = new Map<string, JobHandler>();
export function registerJobHandler(kind: string, handler: JobHandler): void {
  if (kind === "transition") throw new Error("Reserved job kind");
  handlers.set(kind, handler);
}
export function getJobHandler(kind: string): JobHandler | undefined {
  return handlers.get(kind);
}
export const registeredJobKinds = () => ["transition", ...handlers.keys()];
export function jobWillExecute(
  job: jobs.JobRow,
  settings: { autopilot: boolean; personaUserId: string },
): boolean {
  return (
    settings.autopilot &&
    (job.partyUserId !== settings.personaUserId ||
      (job.kind === "transition" && job.entity === "trade" && job.event === "CONFIRM_FUNDS"))
  );
}
