import { describe, expect, it } from "vitest";
import { type EntityFacts, isPersonaInvolved, type PersonaUser } from "@/lib/persona-involvement";

const seller: PersonaUser = { id: "seller", role: "seller", orgId: null };
const buyer: PersonaUser = { id: "buyer", role: "buyer", orgId: "investor" };
const otherBuyer: PersonaUser = { id: "other", role: "buyer", orgId: "other-org" };
const admin: PersonaUser = { id: "admin", role: "company_admin", orgId: "company" };
const otherAdmin: PersonaUser = {
  id: "other-admin",
  role: "company_admin",
  orgId: "other-company",
};
const operator: PersonaUser = { id: "operator", role: "operator", orgId: "atlas" };

describe("auto-pilot persona involvement", () => {
  const cases: { facts: EntityFacts; involved: PersonaUser[]; excluded: PersonaUser[] }[] = [
    {
      facts: { kind: "holding", ownerId: seller.id, companyOrgId: "company" },
      involved: [seller, admin],
      excluded: [buyer, otherBuyer, otherAdmin],
    },
    {
      facts: {
        kind: "listing",
        sellerId: seller.id,
        bidBuyerIds: [buyer.id],
        companyOrgId: "company",
      },
      involved: [seller, buyer, admin],
      excluded: [otherBuyer, otherAdmin],
    },
    {
      facts: { kind: "bid", buyerId: buyer.id, sellerId: seller.id },
      involved: [seller, buyer],
      excluded: [otherBuyer, admin, otherAdmin],
    },
    {
      facts: { kind: "trade", sellerId: seller.id, buyerId: buyer.id, companyOrgId: "company" },
      involved: [seller, buyer, admin],
      excluded: [otherBuyer, otherAdmin],
    },
    {
      facts: { kind: "company", requestingBuyerId: buyer.id, companyOrgId: "company" },
      involved: [buyer, admin],
      excluded: [seller, otherBuyer, otherAdmin],
    },
  ];
  for (const { facts, involved, excluded } of cases) {
    it(`${facts.kind}: includes only parties and the right company admin`, () => {
      for (const person of involved) expect(isPersonaInvolved(person, facts, "seller")).toBe(true);
      for (const person of excluded) expect(isPersonaInvolved(person, facts, "seller")).toBe(false);
    });
    it(`${facts.kind}: operator participates only in operator jobs`, () => {
      expect(isPersonaInvolved(operator, facts, "operator")).toBe(true);
      expect(isPersonaInvolved(operator, facts, "buyer")).toBe(false);
      expect(isPersonaInvolved(operator, facts, "company_admin")).toBe(false);
    });
  }
});
