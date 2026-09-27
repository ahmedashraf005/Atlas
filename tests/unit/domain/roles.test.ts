import { expect, it } from "vitest";
import { ROLE_LABELS, ROLES, SYSTEM_ACTOR } from "@/domain/roles";

it("preserves UI roles and creates a sandbox-scoped system actor", () => {
  expect(ROLES).toEqual(["seller", "buyer", "company_admin", "operator"]);
  expect(ROLE_LABELS.company_admin).toBe("company admin");
  expect(SYSTEM_ACTOR("s")).toEqual({
    userId: "system",
    role: "system",
    orgId: null,
    sandboxId: "s",
    simulated: false,
  });
});
