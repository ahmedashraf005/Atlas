import "server-only";
import type { Tx } from "@/server/db/client";
import { incrementRef } from "@/server/repositories/sandboxes";
export async function next(tx: Tx, sandboxId: string, prefix: "L" | "T"): Promise<string> {
  return `${prefix}-${await incrementRef(tx, sandboxId)}`;
}
