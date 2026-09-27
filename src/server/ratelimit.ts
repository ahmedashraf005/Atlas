import "server-only";
import { systemClock } from "@/lib/clock";
import type { Db } from "@/server/db/client";
import { consume } from "@/server/repositories/rate-limits";
import { lockSandbox } from "@/server/repositories/sandboxes";
export async function rateLimit(
  db: Db,
  sandboxId: string,
  key: string,
  limit: { max: number; windowSeconds: number },
): Promise<boolean> {
  const windowMs = limit.windowSeconds * 1000,
    windowStart = new Date(Math.floor(systemClock.now().getTime() / windowMs) * windowMs);
  return db.transaction(async (tx) => {
    await lockSandbox(tx, sandboxId);
    return (await consume(tx, sandboxId, key, windowStart)) <= limit.max;
  });
}
