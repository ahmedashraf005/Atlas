import { describe, expect, it } from "vitest";
import { can } from "@/domain/authz";
import type { Actor } from "@/domain/roles";
import type { PriceVisibility } from "@/domain/types";

const sid = "sandbox",
  org = "org";
const roles = ["seller", "buyer", "company_admin", "operator", "system"] as const;
const modes = ["members", "participants", "operator"] as const;
describe("company trade-price visibility", () => {
  for (const mode of modes)
    for (const role of roles)
      for (const participant of [false, true])
        it(`${mode}, ${role}, participant ${participant}`, () => {
          const actor: Actor = {
            sandboxId: sid,
            userId: "u",
            role,
            orgId: role === "company_admin" ? org : null,
            simulated: false,
          };
          const resource = {
            kind: "company" as const,
            sandboxId: sid,
            companyOrgId: org,
            accessGrant: "none" as const,
            priceVisibility: mode as PriceVisibility,
            isParticipant: participant,
          };
          const expected =
            role !== "system" &&
            (mode === "members" ||
              role === "operator" ||
              role === "company_admin" ||
              (mode === "participants" && participant));
          expect(can(actor, "company.viewTradePrices", resource).allowed).toBe(expected);
        });
  it("company admin of another company is not privileged", () => {
    expect(
      can(
        { sandboxId: sid, userId: "u", role: "company_admin", orgId: "other", simulated: false },
        "company.viewTradePrices",
        {
          kind: "company",
          sandboxId: sid,
          companyOrgId: org,
          accessGrant: "none",
          priceVisibility: "operator",
          isParticipant: true,
        },
      ).allowed,
    ).toBe(false);
  });
});
