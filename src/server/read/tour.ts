import "server-only";
import { getDb } from "@/server/db/client";
import * as trades from "@/server/repositories/trades";
import * as users from "@/server/repositories/users";
import type { Viewer } from "@/server/viewer";

export async function hasTradeInProgress(viewer: Viewer): Promise<boolean> {
  const db = await getDb();
  const buyer = await users.forPersona(db, viewer.sandboxId, "buyer_a");
  const rows = await trades.forBuyer(db, viewer.sandboxId, buyer.id);
  return rows.some((t) => !["Settled", "Cancelled", "RofrExercised"].includes(t.status));
}
