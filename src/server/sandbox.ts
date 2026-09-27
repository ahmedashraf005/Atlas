import "server-only";
import { v7 } from "uuid";
import type { PersonaKey } from "@/config/personas";
import { SYSTEM_ACTOR } from "@/domain/roles";
import { systemClock } from "@/lib/clock";
import { appendAudit } from "@/server/audit";
import type { Db, Tx } from "@/server/db/client";
import * as repository from "@/server/repositories/sandboxes";
import { seedSandbox } from "@/server/seed/seed";
export const lockSandbox = repository.lockSandbox;
export async function ensureInTransaction(
  tx: Tx,
  sandboxId: string,
  persona: PersonaKey,
): Promise<void> {
  const realNow = systemClock.now();
  if (!(await repository.insert(tx, sandboxId, persona, realNow))) return;
  await repository.purge(tx, new Date(realNow.getTime() - 7 * 86_400_000));
  const sandbox = await lockSandbox(tx, sandboxId);
  await seedSandbox(tx, sandboxId, realNow);
  await appendAudit(
    {
      tx,
      sandbox,
      actor: SYSTEM_ACTOR(sandboxId),
      now: realNow,
      personaUserId: "system",
      depth: 0,
    },
    {
      action: "sandbox.seed",
      entity: "sandbox",
      entityId: sandboxId,
      before: null,
      after: { seedVersion: 1 },
    },
  );
}
export async function ensureSandbox(db: Db, sandboxId: string, persona: PersonaKey): Promise<void> {
  // Avoid a write transaction after the first request.
  if (await repository.find(db, sandboxId)) return;
  await db.transaction((tx) => ensureInTransaction(tx, sandboxId, persona));
}
export async function touchSandbox(db: Db, sandboxId: string): Promise<void> {
  const existing = await repository.find(db, sandboxId);
  if (!existing || systemClock.now().getTime() - existing.lastSeenAt.getTime() < 60_000) return;
  await db.transaction(async (tx) => {
    const sandbox = await lockSandbox(tx, sandboxId);
    const now = systemClock.now();
    if (now.getTime() - sandbox.lastSeenAt.getTime() >= 60_000)
      await repository.touch(tx, sandboxId, now);
  });
}
export async function resetInTransaction(
  tx: Tx,
  oldId: string,
  persona: PersonaKey,
): Promise<string> {
  await repository.remove(tx, oldId);
  const id = v7();
  await ensureInTransaction(tx, id, persona);
  return id;
}
export async function resetSandbox(db: Db, oldId: string, persona: PersonaKey): Promise<string> {
  return db.transaction(async (tx) => {
    await lockSandbox(tx, oldId);
    return resetInTransaction(tx, oldId, persona);
  });
}
