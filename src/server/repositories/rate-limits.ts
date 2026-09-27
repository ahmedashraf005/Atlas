import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db/client";
import { rateLimits } from "@/server/db/schema";
export async function consume(
  tx: Tx,
  sandboxId: string,
  key: string,
  windowStart: Date,
): Promise<number> {
  const [row] = await tx
    .insert(rateLimits)
    .values({ sandboxId, key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.sandboxId, rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count}+1` },
    })
    .returning();
  if (!row) throw new Error("Rate limit row missing");
  return row.count;
}
