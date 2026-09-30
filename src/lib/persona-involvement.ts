import type { Role } from "@/domain/roles";

export type PersonaUser = { id: string; role: Role; orgId: string | null };
export type EntityFacts =
  | { kind: "holding"; ownerId: string; companyOrgId: string | null }
  | {
      kind: "listing";
      sellerId: string;
      bidBuyerIds: readonly string[];
      companyOrgId: string | null;
    }
  | { kind: "bid"; buyerId: string; sellerId: string }
  | { kind: "trade"; sellerId: string; buyerId: string; companyOrgId: string | null }
  | { kind: "company"; requestingBuyerId: string | null; companyOrgId: string | null };

/** Participation is independent of the person chosen to act on the job. */
export function isPersonaInvolved(
  personaUser: PersonaUser,
  facts: EntityFacts,
  jobActingRole: Role,
): boolean {
  if (personaUser.role === "operator") return jobActingRole === "operator";
  const companyAdmin =
    personaUser.role === "company_admin" &&
    facts.kind !== "bid" &&
    facts.companyOrgId !== null &&
    personaUser.orgId === facts.companyOrgId;
  if (companyAdmin) return true;
  switch (facts.kind) {
    case "holding":
      return personaUser.id === facts.ownerId;
    case "listing":
      return personaUser.id === facts.sellerId || facts.bidBuyerIds.includes(personaUser.id);
    case "bid":
      return personaUser.id === facts.buyerId || personaUser.id === facts.sellerId;
    case "trade":
      return personaUser.id === facts.sellerId || personaUser.id === facts.buyerId;
    case "company":
      return personaUser.id === facts.requestingBuyerId;
  }
}
