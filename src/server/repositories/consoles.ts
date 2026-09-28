import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import {
  auditLog,
  bids,
  holdings,
  listings,
  messages,
  messageThreads,
  organizations,
  qaEntries,
  transferPolicies,
} from "@/server/db/schema";
import { ConflictError } from "@/server/errors";

export async function investorOrgs(db: Database, sandboxId: string) {
  return db
    .select()
    .from(organizations)
    .where(and(eq(organizations.sandboxId, sandboxId), eq(organizations.kind, "investor")))
    .orderBy(asc(organizations.name));
}
export async function pendingHoldings(db: Database, sandboxId: string, companyId: string) {
  const rows = await db
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.sandboxId, sandboxId),
        eq(holdings.companyId, companyId),
        eq(holdings.status, "PendingCompany"),
      ),
    );
  return Promise.all(
    rows.map(async (row) => {
      const [submission] = await db
        .select({ at: auditLog.at })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.sandboxId, sandboxId),
            eq(auditLog.entityId, row.id),
            eq(auditLog.entity, "holding"),
            inArray(auditLog.action, ["holding.SUBMIT_FOR_VERIFICATION", "holding.RESUBMIT"]),
          ),
        )
        .orderBy(desc(auditLog.seq))
        .limit(1);
      return { ...row, submittedAt: submission?.at ?? row.acquiredAt };
    }),
  );
}
export async function reviewListings(db: Database, sandboxId: string) {
  return db
    .select()
    .from(listings)
    .where(and(eq(listings.sandboxId, sandboxId), eq(listings.status, "InReview")))
    .orderBy(asc(listings.createdAt));
}
export async function flaggedMessages(db: Database, sandboxId: string) {
  return db
    .select({ message: messages, tradeId: messageThreads.tradeId })
    .from(messages)
    .innerJoin(
      messageThreads,
      and(eq(messageThreads.id, messages.threadId), eq(messageThreads.sandboxId, sandboxId)),
    )
    .where(
      and(
        eq(messages.sandboxId, sandboxId),
        sql`(${messages.flagged} OR 'payment_change' = ANY(${messages.found}))`,
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id));
}
export async function questionForUpdate(tx: Tx, sandboxId: string, id: string) {
  const [row] = await tx
    .select()
    .from(qaEntries)
    .where(and(eq(qaEntries.sandboxId, sandboxId), eq(qaEntries.id, id)))
    .for("update");
  return row ?? null;
}
export async function answer(
  tx: Tx,
  sandboxId: string,
  prev: typeof qaEntries.$inferSelect,
  text: string,
  userId: string,
  now: Date,
) {
  const [row] = await tx
    .update(qaEntries)
    .set({ answer: text, answeredBy: userId, answeredAt: now, version: prev.version + 1 })
    .where(
      and(
        eq(qaEntries.sandboxId, sandboxId),
        eq(qaEntries.id, prev.id),
        eq(qaEntries.version, prev.version),
        isNull(qaEntries.answer),
      ),
    )
    .returning();
  if (!row) throw new ConflictError();
  return row;
}
export async function policyForUpdate(tx: Tx, sandboxId: string, companyId: string) {
  const [row] = await tx
    .select()
    .from(transferPolicies)
    .where(
      and(eq(transferPolicies.sandboxId, sandboxId), eq(transferPolicies.companyId, companyId)),
    )
    .for("update");
  return row ?? null;
}
export async function savePolicy(
  tx: Tx,
  sandboxId: string,
  prev: typeof transferPolicies.$inferSelect,
  next: Omit<typeof transferPolicies.$inferSelect, "sandboxId" | "version">,
) {
  const [row] = await tx
    .update(transferPolicies)
    .set({ ...next, version: prev.version + 1 })
    .where(
      and(
        eq(transferPolicies.sandboxId, sandboxId),
        eq(transferPolicies.companyId, prev.companyId),
        eq(transferPolicies.version, prev.version),
      ),
    )
    .returning();
  if (!row) throw new ConflictError();
  return row;
}
// Activity needs only metadata; company administrators never receive private listing snapshots.
export async function activity(
  db: Database,
  sandboxId: string,
  limit: number,
  entityIds?: string[],
) {
  if (entityIds && !entityIds.length) return [];
  return db
    .select({
      seq: auditLog.seq,
      at: auditLog.at,
      actorId: auditLog.actorId,
      actorRole: auditLog.actorRole,
      simulated: auditLog.simulated,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.sandboxId, sandboxId),
        entityIds ? inArray(auditLog.entityId, entityIds) : undefined,
      ),
    )
    .orderBy(desc(auditLog.seq))
    .limit(limit);
}
export async function companyEntityIds(db: Database, sandboxId: string, companyId: string) {
  const [hs, ls, bs, qs] = await Promise.all([
    db
      .select({ id: holdings.id })
      .from(holdings)
      .where(and(eq(holdings.sandboxId, sandboxId), eq(holdings.companyId, companyId))),
    db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.sandboxId, sandboxId), eq(listings.companyId, companyId))),
    db
      .select({ id: bids.id })
      .from(bids)
      .innerJoin(listings, and(eq(listings.id, bids.listingId), eq(listings.sandboxId, sandboxId)))
      .where(and(eq(bids.sandboxId, sandboxId), eq(listings.companyId, companyId))),
    db
      .select({ id: qaEntries.id })
      .from(qaEntries)
      .where(and(eq(qaEntries.sandboxId, sandboxId), eq(qaEntries.companyId, companyId))),
  ]);
  return [companyId, ...[...hs, ...ls, ...bs, ...qs].map((r) => r.id)];
}
