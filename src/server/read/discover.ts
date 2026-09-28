import "server-only";
import { z } from "zod";
import { formatDate, formatMoney } from "@/lib/format";
import { type Db, getDb } from "@/server/db/client";
import { companyReference } from "@/server/read/company";
import * as companies from "@/server/repositories/companies";
import * as discovery from "@/server/repositories/discovery";
import * as mandates from "@/server/repositories/mandates";
import type { Viewer } from "@/server/viewer";

const schema = z.object({
  sector: z.string().optional(),
  stage: z.string().optional(),
  open: z.string().optional(),
  matches: z.string().optional(),
});
export async function getDiscoverModel(viewer: Viewer, raw: unknown = {}, dbArg?: Db) {
  const db = dbArg ?? (await getDb());
  const parsed = schema.safeParse(raw),
    q = parsed.success ? parsed.data : {};
  const [all, listingRows, allMandates] = await Promise.all([
    companies.list(db, viewer.sandboxId),
    discovery.publicListings(db, viewer.sandboxId),
    mandates.list(db, viewer.sandboxId),
  ]);
  const mine =
    viewer.user.role === "buyer" ? allMandates.filter((m) => m.buyerId === viewer.user.id) : [];
  const sectors = [...new Set(all.map((c) => c.sector))].sort(),
    stages = [...new Set(all.map((c) => c.stage))].sort();
  const filters = {
    sector: sectors.includes(q.sector ?? "") ? (q.sector ?? "") : "",
    stage: stages.includes(q.stage ?? "") ? (q.stage ?? "") : "",
    open: q.open === "on",
    matches: q.matches === "on",
  };
  const rows = await Promise.all(
    all.map(async (c) => {
      const ref = await companyReference(viewer, c, db);
      const matches = mine.some((m) => m.sectors.includes(c.sector) && m.stages.includes(c.stage));
      const open = listingRows.filter((l) => l.companyId === c.id && l.status === "Live").length;
      return {
        slug: c.slug,
        name: c.name,
        sector: c.sector,
        stage: c.stage,
        lastRound: `${c.lastRoundName} · ${c.lastRoundDate ? formatDate(c.lastRoundDate).split(" ").slice(1).join(" ") : "—"}`,
        roundPrice: c.lastRoundPriceMinor
          ? formatMoney(c.lastRoundPriceMinor, c.currency, "perShare")
          : "—",
        fairValue:
          ref.band.method === "waterfall" && !ref.hidden ? `${ref.bandValue} est.` : ref.bandValue,
        openListings: open ? String(open) : "—",
        openCount: open,
        matches,
      };
    }),
  );
  return {
    sectors,
    stages,
    filters,
    mandates: mine.map((m) => ({
      name: m.name,
      sectors: m.sectors.join(", "),
      stages: m.stages.join(", "),
      ticket: `${formatMoney(m.minTicketMinor, m.currency)} – ${formatMoney(m.maxTicketMinor, m.currency)}`,
    })),
    companies: rows
      .filter(
        (c) =>
          (!filters.sector || c.sector === filters.sector) &&
          (!filters.stage || c.stage === filters.stage) &&
          (!filters.open || c.openCount > 0) &&
          (!filters.matches || c.matches),
      )
      .sort((a, b) => b.openCount - a.openCount || a.name.localeCompare(b.name))
      .map(({ openCount: _count, ...row }) => row),
  };
}
