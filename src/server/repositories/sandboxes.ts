import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import type { PersonaKey } from "@/config/personas";
import type { Database, Tx } from "@/server/db/client";
import { type SandboxRow, sandboxes } from "@/server/db/schema";
import { NotFoundError } from "@/server/errors";
export async function find(db: Database, sandboxId: string): Promise<SandboxRow | null> {
  const [row] = await db.select().from(sandboxes).where(eq(sandboxes.id, sandboxId));
  return row ?? null;
}
export async function lockSandbox(tx: Tx, sandboxId: string): Promise<SandboxRow> {
  const [row] = await tx.select().from(sandboxes).where(eq(sandboxes.id, sandboxId)).for("update");
  if (!row) throw new NotFoundError();
  return row;
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  persona: PersonaKey,
  now: Date,
): Promise<boolean> {
  return (
    (
      await tx
        .insert(sandboxes)
        .values({ id: sandboxId, persona, createdAt: now, lastSeenAt: now })
        .onConflictDoNothing()
        .returning()
    ).length > 0
  );
}
export async function save(
  tx: Tx,
  sandboxId: string,
  changes: Partial<Omit<SandboxRow, "id" | "createdAt">>,
): Promise<void> {
  await tx.update(sandboxes).set(changes).where(eq(sandboxes.id, sandboxId));
}
export async function remove(tx: Tx, sandboxId: string): Promise<void> {
  await tx.delete(sandboxes).where(eq(sandboxes.id, sandboxId));
}
export async function purge(tx: Tx, before: Date): Promise<void> {
  const rows = await tx
    .select({ id: sandboxes.id })
    .from(sandboxes)
    .where(lt(sandboxes.lastSeenAt, before))
    .limit(25);
  for (const row of rows) await remove(tx, row.id);
}
export async function touch(db: Database, sandboxId: string, now: Date): Promise<void> {
  await db
    .update(sandboxes)
    .set({ lastSeenAt: now })
    .where(
      and(eq(sandboxes.id, sandboxId), lt(sandboxes.lastSeenAt, new Date(now.getTime() - 60_000))),
    );
}
export async function incrementRef(tx: Tx, sandboxId: string): Promise<number> {
  const [row] = await tx
    .update(sandboxes)
    .set({ nextRef: sql`${sandboxes.nextRef}+1` })
    .where(eq(sandboxes.id, sandboxId))
    .returning();
  if (!row) throw new NotFoundError();
  return row.nextRef;
}
