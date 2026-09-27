import "server-only";
import { type AuditDraft, appendEntry, verifyChain } from "@/domain/audit";
import type { Db } from "@/server/db/client";
import * as repository from "@/server/repositories/audit";
import * as sandboxes from "@/server/repositories/sandboxes";
import type { TxContext } from "@/server/transitions";
export async function appendAudit(
  ctx: TxContext,
  draft: Pick<AuditDraft, "action" | "entity" | "entityId" | "before" | "after">,
): Promise<void> {
  // Re-read because nested transitions may already have advanced this transaction's head.
  const sandbox = await sandboxes.find(ctx.tx, ctx.sandbox.id);
  if (!sandbox) throw new Error("Locked sandbox missing");
  const head = await repository.head(ctx.tx, sandbox.id, sandbox.auditHeadSeq);
  if ((sandbox.auditHeadSeq > 0 && !head) || (head && head.hash !== sandbox.auditHeadHash))
    throw new Error("Audit checkpoint mismatch");
  const entry = appendEntry(head, {
    ...draft,
    sandboxId: sandbox.id,
    actorId: ctx.actor.userId,
    actorRole: ctx.actor.role,
    simulated: ctx.actor.simulated,
    at: ctx.now,
  });
  await repository.insert(ctx.tx, sandbox.id, entry);
  await sandboxes.save(ctx.tx, sandbox.id, { auditHeadSeq: entry.seq, auditHeadHash: entry.hash });
  ctx.sandbox.auditHeadSeq = entry.seq;
  ctx.sandbox.auditHeadHash = entry.hash;
}
export const readChain = repository.list;
export async function verifySandboxChain(db: Db, sandboxId: string) {
  // Serialize with appenders so the head and entries describe the same snapshot.
  return db.transaction(async (tx) => {
    const sandbox = await sandboxes.lockSandbox(tx, sandboxId);
    return verifyChain(await readChain(tx, sandboxId), {
      count: sandbox.auditHeadSeq,
      headHash: sandbox.auditHeadHash,
    });
  });
}
