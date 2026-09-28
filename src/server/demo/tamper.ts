import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/db/client";
// Deliberately bypasses appendAudit, solely to demonstrate hash verification failure.
export async function tamperAudit(tx: Tx, sandboxId: string, count: number): Promise<number> {
  const seq = Math.max(1, Math.ceil(count / 2));
  await tx.execute(
    sql`UPDATE audit_log SET "after" = "after" || '{"tampered": true}'::jsonb WHERE sandbox_id = ${sandboxId} AND seq = ${seq}`,
  );
  return seq;
}
