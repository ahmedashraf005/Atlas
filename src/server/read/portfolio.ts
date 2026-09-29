import "server-only";
import { formatDate, formatShares } from "@/lib/format";
import { type Database, getDb } from "@/server/db/client";
import * as portfolio from "@/server/repositories/portfolio";
import type { Viewer } from "@/server/viewer";
export async function getPortfolioModel(viewer: Viewer, database?: Database) {
  const rows = await portfolio.forOwner(
    database ?? (await getDb()),
    viewer.sandboxId,
    viewer.user.id,
  );
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.holdingId, [...(groups.get(r.holdingId) ?? []), r]);
  return [...groups.values()].map((group) => {
    const first = group[0];
    if (!first) throw Error("Empty portfolio group");
    const purchased = group.reduce((qty, row) => qty + row.purchasedQty, 0n),
      remaining = first.quantity - first.soldQty;
    return {
      id: first.holdingId,
      company: first.company,
      shareClass: first.shareClass,
      quantity: formatShares(purchased < remaining ? purchased : remaining, "table"),
      acquired: formatDate(first.acquiredAt),
      sources: group.map((r) => ({ ref: r.ref, href: `/trades/${r.tradeId}` })),
    };
  });
}
