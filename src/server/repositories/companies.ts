import "server-only";
import { and, eq } from "drizzle-orm";
import type { Company, ShareClass, TransferPolicy } from "@/domain/types";
import type { Database } from "@/server/db/client";
import { companies, shareClasses, transferPolicies } from "@/server/db/schema";
import { NotFoundError } from "@/server/errors";
export function toCompany(row: typeof companies.$inferSelect): Company {
  return {
    id: row.id,
    sandboxId: row.sandboxId,
    orgId: row.orgId,
    name: row.name,
    currency: row.currency,
    lastRoundPriceMinor: row.lastRoundPriceMinor,
    lastRoundDate: row.lastRoundDate,
    lastRoundPostMoneyMinor: row.lastRoundPostMoneyMinor,
  };
}
export function toShareClass(row: typeof shareClasses.$inferSelect): ShareClass {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    kind: row.kind,
    seniority: row.seniority,
    shares: row.shares,
    originalPriceMinor: row.originalPriceMinor,
    prefMultipleBps: row.prefMultipleBps,
  };
}
export function toPolicy(row: typeof transferPolicies.$inferSelect): TransferPolicy {
  return {
    companyId: row.companyId,
    rofrDays: row.rofrDays,
    fundingDays: row.fundingDays,
    minLot: row.minLot,
    lockupMonths: row.lockupMonths,
    blackoutWindows: row.blackoutWindows.map((w) => ({
      ...w,
      start: new Date(w.start),
      end: new Date(w.end),
    })),
    allowedBuyerTypes: row.allowedBuyerTypes,
    blockedOrgIds: row.blockedOrgIds,
    priceVisibility: row.priceVisibility,
    yearlyCapBps: row.yearlyCapBps,
  };
}
export async function find(db: Database, sandboxId: string, id: string) {
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.sandboxId, sandboxId), eq(companies.id, id)));
  return row ?? null;
}
export async function list(db: Database, sandboxId: string) {
  return db.select().from(companies).where(eq(companies.sandboxId, sandboxId));
}
export async function classes(db: Database, sandboxId: string, companyId: string) {
  return (
    await db
      .select()
      .from(shareClasses)
      .where(and(eq(shareClasses.sandboxId, sandboxId), eq(shareClasses.companyId, companyId)))
  ).map(toShareClass);
}
export async function policy(
  db: Database,
  sandboxId: string,
  companyId: string,
): Promise<TransferPolicy> {
  const [row] = await db
    .select()
    .from(transferPolicies)
    .where(
      and(eq(transferPolicies.sandboxId, sandboxId), eq(transferPolicies.companyId, companyId)),
    );
  if (!row) throw new NotFoundError();
  return toPolicy(row);
}
