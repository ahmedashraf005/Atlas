import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { v7 } from "uuid";
import type { Database, Tx } from "@/server/db/client";
import { messages, messageThreads } from "@/server/db/schema";

export async function forTrade(db: Database, sandboxId: string, tradeId: string) {
  return (
    await db
      .select({ message: messages })
      .from(messages)
      .innerJoin(
        messageThreads,
        and(eq(messageThreads.id, messages.threadId), eq(messageThreads.sandboxId, sandboxId)),
      )
      .where(and(eq(messages.sandboxId, sandboxId), eq(messageThreads.tradeId, tradeId)))
      .orderBy(asc(messages.createdAt), asc(messages.id))
  ).map((r) => r.message);
}
/** The action already holds the sandbox lock, serialising first-message creation. */
export async function ensureThread(
  tx: Tx,
  sandboxId: string,
  tradeId: string,
  now: Date,
): Promise<string> {
  const [existing] = await tx
    .select()
    .from(messageThreads)
    .where(and(eq(messageThreads.sandboxId, sandboxId), eq(messageThreads.tradeId, tradeId)));
  if (existing) return existing.id;
  const id = v7();
  await tx
    .insert(messageThreads)
    .values({ id, sandboxId, tradeId, listingId: null, createdAt: now });
  return id;
}
export async function insert(
  tx: Tx,
  sandboxId: string,
  row: Omit<typeof messages.$inferInsert, "sandboxId">,
) {
  await tx.insert(messages).values({ ...row, sandboxId });
}
