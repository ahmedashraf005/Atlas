import "server-only";
import { and, eq, lte } from "drizzle-orm";
import type { Database, Tx } from "@/server/db/client";
import { automationJobs } from "@/server/db/schema";
export type JobRow = typeof automationJobs.$inferSelect;
export async function list(db: Database, sandboxId: string): Promise<JobRow[]> {
  return db
    .select()
    .from(automationJobs)
    .where(and(eq(automationJobs.sandboxId, sandboxId), eq(automationJobs.status, "pending")));
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  job: typeof automationJobs.$inferInsert,
): Promise<void> {
  await tx
    .insert(automationJobs)
    .values({ ...job, sandboxId })
    .onConflictDoNothing();
}
export async function finish(
  tx: Tx,
  sandboxId: string,
  id: string,
  status: "done" | "skipped",
  resultCode: string | null,
  now: Date,
): Promise<void> {
  await tx
    .update(automationJobs)
    .set({ status, resultCode, executedAt: now })
    .where(and(eq(automationJobs.sandboxId, sandboxId), eq(automationJobs.id, id)));
}

export async function due(db: Database, sandboxId: string, now: Date): Promise<JobRow[]> {
  return db
    .select()
    .from(automationJobs)
    .where(
      and(
        eq(automationJobs.sandboxId, sandboxId),
        eq(automationJobs.status, "pending"),
        lte(automationJobs.dueAt, now),
      ),
    );
}
