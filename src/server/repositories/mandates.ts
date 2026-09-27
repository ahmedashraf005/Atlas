import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { mandates } from "@/server/db/schema";
import * as companies from "@/server/repositories/companies";
export async function list(db: Database, sandboxId: string) {
  return db.select().from(mandates).where(eq(mandates.sandboxId, sandboxId));
}
export async function demandCount(
  db: Database,
  sandboxId: string,
  companyId: string,
): Promise<number> {
  const company = await companies.find(db, sandboxId, companyId);
  if (!company) return 0;
  return new Set(
    (await list(db, sandboxId))
      .filter((m) => m.sectors.includes(company.sector) && m.stages.includes(company.stage))
      .map((m) => m.buyerId),
  ).size;
}
