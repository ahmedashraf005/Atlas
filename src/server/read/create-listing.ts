import "server-only";
import { z } from "zod";
import { formatShares } from "@/lib/format";
import { type Db, getDb } from "@/server/db/client";
import { holdingFacts } from "@/server/read/holdings";
import * as holdings from "@/server/repositories/holdings";
import type { Viewer } from "@/server/viewer";

export async function getCreateListingModel(viewer: Viewer, holdingId: string, dbArg?: Db) {
  if (!z.uuid().safeParse(holdingId).success) return null;
  const db = dbArg ?? (await getDb());
  const h = await holdings.find(db, viewer.sandboxId, holdingId);
  if (!h || h.ownerId !== viewer.user.id) return null;
  const f = await holdingFacts(viewer, h, db);
  return {
    holdingId: h.id,
    company: f.company.name,
    shareClass: f.shareClass.name,
    currency: f.company.currency,
    eligible: f.eligibility.ok && viewer.user.role === "seller",
    failures: f.eligibility.failures.map((f) => f.message),
    maxSellable: f.eligibility.maxSellable.toString(),
    minLot: f.policy.minLot.toString(),
    maxLabel: formatShares(f.eligibility.maxSellable, "table"),
    minLabel: formatShares(f.policy.minLot, "table"),
    rofrDays: `${f.policy.rofrDays}`,
    market: f.market,
    band:
      f.band.method === "none"
        ? null
        : {
            lowMinor: f.band.lowMinor.toString(),
            midMinor: f.band.midMinor.toString(),
            highMinor: f.band.highMinor.toString(),
          },
  };
}
export type CreateListingModel = NonNullable<Awaited<ReturnType<typeof getCreateListingModel>>>;
