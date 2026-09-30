import "server-only";
import { v7 } from "uuid";
import type { EntityKind } from "@/domain/effects";
import type { Result } from "@/domain/result";
import { isPersonaInvolved, type PersonaUser } from "@/lib/persona-involvement";
import type { Database, Tx } from "@/server/db/client";
import type { SandboxRow } from "@/server/db/schema";
import type { ActionError } from "@/server/errors";
import * as bids from "@/server/repositories/bids";
import * as companies from "@/server/repositories/companies";
import * as holdings from "@/server/repositories/holdings";
import * as jobs from "@/server/repositories/jobs";
import * as listings from "@/server/repositories/listings";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import type { EntityOf, TxContext } from "@/server/transitions";
export interface PlannedJob {
  event: string;
  partyUserId: string;
  delaySeconds: number;
  escrowException?: boolean;
}
/** Resolve only sandbox-scoped facts; the pure rule decides participation. */
export async function personaInvolvedWithJob(
  db: Database,
  sandboxId: string,
  persona: PersonaUser,
  job: Pick<jobs.JobRow, "entity" | "entityId" | "event" | "partyUserId">,
): Promise<boolean> {
  const actingUser = await users.find(db, sandboxId, job.partyUserId);
  if (!actingUser) return false;
  if (job.entity === "company") {
    const company = await companies.find(db, sandboxId, job.entityId);
    return company
      ? isPersonaInvolved(
          persona,
          { kind: "company", requestingBuyerId: job.event, companyOrgId: company.orgId },
          actingUser.role,
        )
      : false;
  }
  if (job.entity === "holding") {
    const holding = await holdings.find(db, sandboxId, job.entityId);
    const company = holding ? await companies.find(db, sandboxId, holding.companyId) : null;
    return holding
      ? isPersonaInvolved(
          persona,
          { kind: "holding", ownerId: holding.ownerId, companyOrgId: company?.orgId ?? null },
          actingUser.role,
        )
      : false;
  }
  if (job.entity === "listing") {
    const listing = await listings.find(db, sandboxId, job.entityId);
    if (!listing) return false;
    const company = await companies.find(db, sandboxId, listing.companyId);
    return isPersonaInvolved(
      persona,
      {
        kind: "listing",
        sellerId: listing.sellerId,
        bidBuyerIds: (await bids.forListing(db, sandboxId, listing.id)).map((bid) => bid.buyerId),
        companyOrgId: company?.orgId ?? null,
      },
      actingUser.role,
    );
  }
  if (job.entity === "bid") {
    const bid = await bids.find(db, sandboxId, job.entityId);
    const listing = bid ? await listings.find(db, sandboxId, bid.listingId) : null;
    return bid && listing
      ? isPersonaInvolved(
          persona,
          { kind: "bid", buyerId: bid.buyerId, sellerId: listing.sellerId },
          actingUser.role,
        )
      : false;
  }
  const trade = await trades.find(db, sandboxId, job.entityId);
  const company = trade ? await companies.find(db, sandboxId, trade.companyId) : null;
  return trade
    ? isPersonaInvolved(
        persona,
        {
          kind: "trade",
          sellerId: trade.sellerId,
          buyerId: trade.buyerId,
          companyOrgId: company?.orgId ?? null,
        },
        actingUser.role,
      )
    : false;
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
  const persona = await users.find(ctx.tx, sid, ctx.personaUserId);
  if (!persona) throw new Error("Missing persona");
  // New seller rows reuse the job uniqueness key; DECIDE is a custom-job marker, not a domain event.
  if (ctx.sandbox.autopilot) {
    const listing =
      kind === "listing" && entity.status === "Closed" && "sellerId" in entity
        ? entity
        : kind === "bid" &&
            entity.status === "Submitted" &&
            "counterOutcome" in entity &&
            entity.counterOutcome !== null &&
            "listingId" in entity
          ? await listings.find(ctx.tx, sid, entity.listingId)
          : null;
    if (
      listing &&
      "sellerId" in listing &&
      ["Closed", "Negotiating"].includes(listing.status) &&
      listing.sellerId !== ctx.personaUserId &&
      (await personaInvolvedWithJob(ctx.tx, sid, persona, {
        entity: "listing",
        entityId: listing.id,
        event: "DECIDE",
        partyUserId: listing.sellerId,
      }))
    )
      await jobs.insert(ctx.tx, sid, {
        id: v7(),
        sandboxId: sid,
        dueAt: new Date(ctx.now.getTime() + (kind === "listing" ? 5000 : 3000)),
        kind: "seller_decide",
        entity: "listing",
        entityId: listing.id,
        event: "DECIDE",
        partyUserId: listing.sellerId,
        status: "pending",
        resultCode: null,
        createdAt: ctx.now,
        executedAt: null,
      });
  }
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
  for (const p of planned) {
    if (
      !(await personaInvolvedWithJob(ctx.tx, sid, persona, {
        entity: kind,
        entityId: entity.id,
        event: p.event,
        partyUserId: p.partyUserId,
      }))
    )
      continue;
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
}
/** Read-only planning preserves refresh's fast path when every job already exists. */
export async function missingTradeJobs(db: Database, sandbox: SandboxRow) {
  if (!sandbox.autopilot) return [];
  const allUsers = await users.list(db, sandbox.id);
  const persona = allUsers.find((u) => u.personaKey === sandbox.persona);
  if (!persona) throw new Error("Missing persona");
  const personaUserId = persona.id;
  const allCompanies = await companies.list(db, sandbox.id);
  const pending = await jobs.list(db, sandbox.id);
  const missing: { tradeId: string; job: PlannedJob }[] = [];
  for (const trade of await trades.nonTerminal(db, sandbox.id)) {
    const orgId = allCompanies.find((c) => c.id === trade.companyId)?.orgId;
    const planned = planAutomation(
      "trade",
      trade,
      {
        autopilot: sandbox.autopilot,
        rofrMode: sandbox.rofrMode,
        personaUserId,
      },
      {
        companyAdminId:
          allUsers.find((u) => u.role === "company_admin" && u.orgId === orgId)?.id ?? null,
        operatorId: allUsers.find((u) => u.personaKey === "operator")?.id ?? null,
        secondOperatorId:
          allUsers.find((u) => u.role === "operator" && u.simulatedOnly)?.id ?? null,
      },
    );
    for (const job of planned) {
      const actingRole = allUsers.find((u) => u.id === job.partyUserId)?.role;
      if (
        actingRole &&
        isPersonaInvolved(
          persona,
          {
            kind: "trade",
            sellerId: trade.sellerId,
            buyerId: trade.buyerId,
            companyOrgId: orgId ?? null,
          },
          actingRole,
        ) &&
        !pending.some(
          (j) =>
            j.entityId === trade.id && j.event === job.event && j.partyUserId === job.partyUserId,
        )
      )
        missing.push({ tradeId: trade.id, job });
    }
  }
  return missing;
}
export async function reconcileTradeJobs(tx: Tx, sandbox: SandboxRow, now: Date): Promise<boolean> {
  const missing = await missingTradeJobs(tx, sandbox);
  for (const { tradeId, job } of missing)
    await jobs.insert(tx, sandbox.id, {
      id: v7(),
      sandboxId: sandbox.id,
      kind: "transition",
      entity: "trade",
      entityId: tradeId,
      event: job.event,
      partyUserId: job.partyUserId,
      dueAt: new Date(now.getTime() + job.delaySeconds * 1000),
      createdAt: now,
      status: "pending",
      resultCode: null,
      executedAt: null,
    });
  return missing.length > 0;
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
