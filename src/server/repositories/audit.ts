import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { AuditEntry } from "@/domain/audit";
import type { Database, Tx } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
export async function list(db: Database, sandboxId: string): Promise<AuditEntry[]> {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.sandboxId, sandboxId))
    .orderBy(asc(auditLog.seq));
}
export async function forTrade(
  db: Database,
  sandboxId: string,
  tradeId: string,
): Promise<AuditEntry[]> {
  return db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.sandboxId, sandboxId),
        eq(auditLog.entity, "trade"),
        eq(auditLog.entityId, tradeId),
      ),
    )
    .orderBy(asc(auditLog.seq));
}
// Metadata only: the listing snapshots contain reserve prices and must stay out of buyer reads.
export async function listingAllocationAt(
  db: Database,
  sandboxId: string,
  listingId: string,
  at: Date,
) {
  const [entry] = await db
    .select({
      actorId: auditLog.actorId,
      actorRole: auditLog.actorRole,
      simulated: auditLog.simulated,
      at: auditLog.at,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.sandboxId, sandboxId),
        eq(auditLog.entityId, listingId),
        eq(auditLog.action, "listing.ALLOCATE"),
        eq(auditLog.at, at),
      ),
    )
    .limit(1);
  return entry ?? null;
}
export async function head(
  db: Database,
  sandboxId: string,
  seq: number,
): Promise<AuditEntry | null> {
  const [row] = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.sandboxId, sandboxId), eq(auditLog.seq, seq)));
  return row ?? null;
}
export async function insert(tx: Tx, sandboxId: string, entry: AuditEntry): Promise<void> {
  if (entry.sandboxId !== sandboxId) throw new Error("Audit sandbox mismatch");
  await tx.insert(auditLog).values({
    ...entry,
    before: entry.before === null ? sql`'null'::jsonb` : entry.before,
    after: entry.after === null ? sql`'null'::jsonb` : entry.after,
  });
}

export async function listingRequest(
  db: Database,
  sandboxId: string,
  actorId: string,
  clientRequestId: string,
  since: Date,
): Promise<string | null> {
  const [entry] = await db
    .select({ entityId: auditLog.entityId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.sandboxId, sandboxId),
        eq(auditLog.actorId, actorId),
        eq(auditLog.action, "listing.create"),
        gte(auditLog.at, since),
        sql`${auditLog.after}->>'clientRequestId' = ${clientRequestId}`,
      ),
    )
    .orderBy(desc(auditLog.seq))
    .limit(1);
  return entry?.entityId ?? null;
}
