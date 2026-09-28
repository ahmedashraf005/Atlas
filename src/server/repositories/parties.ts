import "server-only";
import { and, eq } from "drizzle-orm";
import type { BuyerProfile } from "@/domain/types";
import type { Database } from "@/server/db/client";
import { beneficialOwners, trades } from "@/server/db/schema";
import type { UserRow } from "@/server/repositories/users";
export async function isRelatedParty(
  db: Database,
  sandboxId: string,
  sellerId: string,
  buyerOrgId: string,
): Promise<boolean> {
  const rows = await db
    .select({ userId: beneficialOwners.userId })
    .from(beneficialOwners)
    .where(
      and(
        eq(beneficialOwners.sandboxId, sandboxId),
        eq(beneficialOwners.userId, sellerId),
        eq(beneficialOwners.orgId, buyerOrgId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
export async function closeRecord(db: Database, sandboxId: string, buyerId: string) {
  const rows = await db
    .select({ status: trades.status, cancelReason: trades.cancelReason })
    .from(trades)
    .where(and(eq(trades.sandboxId, sandboxId), eq(trades.buyerId, buyerId)));
  const counted = rows.filter(
    (t) =>
      t.status !== "RofrExercised" &&
      !(t.status === "Cancelled" && t.cancelReason === "company_refused"),
  );
  return { settled: counted.filter((t) => t.status === "Settled").length, total: counted.length };
}
export function buyerProfile(user: UserRow): BuyerProfile | null {
  return user.role === "buyer" && user.orgId && user.investorType
    ? {
        userId: user.id,
        orgId: user.orgId,
        investorType: user.investorType,
        kycStatus: user.kycStatus,
        professionalVerified: user.professionalVerified,
      }
    : null;
}
