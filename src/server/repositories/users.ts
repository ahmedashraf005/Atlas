import "server-only";
import { and, eq } from "drizzle-orm";
import type { PersonaKey } from "@/config/personas";
import type { Actor } from "@/domain/roles";
import type { Database } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { NotFoundError } from "@/server/errors";
export type UserRow = typeof users.$inferSelect;
export function toActor(row: UserRow, simulated = false): Actor {
  return { sandboxId: row.sandboxId, userId: row.id, role: row.role, orgId: row.orgId, simulated };
}
export async function find(db: Database, sandboxId: string, id: string): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.sandboxId, sandboxId), eq(users.id, id)));
  return row ?? null;
}
export async function list(db: Database, sandboxId: string): Promise<UserRow[]> {
  return db.select().from(users).where(eq(users.sandboxId, sandboxId));
}
export async function forPersona(
  db: Database,
  sandboxId: string,
  persona: PersonaKey,
): Promise<UserRow> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.sandboxId, sandboxId), eq(users.personaKey, persona)));
  if (!row) throw new NotFoundError();
  return row;
}
