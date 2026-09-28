import { describe, expect, it } from "vitest";
import { type Action, authorize, can, type Resource, SIMPLE_ACTIONS } from "@/domain/authz";
import { MACHINES } from "@/domain/machines";
import type { ActorRole } from "@/domain/roles";
import { ALL_ROLES, actor } from "./helpers/fixtures";

const eventRoles: Record<string, ActorRole[]> = {
  "holding.SUBMIT_FOR_VERIFICATION": ["seller"],
  "holding.RESUBMIT": ["seller"],
  "holding.VERIFY": ["company_admin"],
  "holding.REJECT": ["company_admin"],
  "listing.SUBMIT": ["seller"],
  "listing.WITHDRAW": ["seller"],
  "listing.COUNTER_SENT": ["seller"],
  "listing.ALLOCATE": ["seller"],
  "listing.DECLINE_ALL": ["seller"],
  "listing.APPROVE": ["operator"],
  "listing.REJECT": ["operator"],
  "listing.CLOSE_WINDOW": ["system"],
  "listing.EXPIRE": ["system"],
  "listing.COMPLETE": ["system"],
  "bid.AMEND": ["buyer"],
  "bid.WITHDRAW": ["buyer"],
  "bid.ACCEPT_COUNTER": ["buyer"],
  "bid.DECLINE_COUNTER": ["buyer"],
  "bid.COUNTER": ["seller"],
  "bid.KEEP_AS_BACKUP": ["seller"],
  "bid.ACCEPT": ["seller", "system"],
  "bid.REJECT": ["seller", "system"],
  "bid.PROMOTE": ["seller", "system"],
  "bid.EXPIRE": ["system"],
  "bid.COUNTER_EXPIRE": ["system"],
  "trade.SELLER_SIGN": ["seller"],
  "trade.BUYER_SIGN": ["buyer"],
  "trade.MARK_WIRE_SENT": ["buyer"],
  "trade.WAIVE": ["company_admin"],
  "trade.EXERCISE": ["company_admin"],
  "trade.REFUSE": ["company_admin"],
  "trade.UPLOAD_REGISTER": ["company_admin"],
  "trade.CONFIRM_FUNDS": ["operator"],
  "trade.APPROVE_RELEASE": ["operator"],
  "trade.RESOLVE_CONTINUE": ["operator"],
  "trade.RESOLVE_CANCEL": ["operator"],
  "trade.CANCEL_BY_OPERATOR": ["operator"],
  "trade.RAISE_DISPUTE": ["seller", "buyer", "operator"],
  "trade.LAPSE": ["system"],
  "trade.BUYER_DEFAULT": ["system"],
};
function resource(action: string): Resource {
  const sandboxId = "sandbox",
    companyOrgId = "company-org",
    sellerId = "seller",
    buyerId = "buyer";
  if (action === "holding.create" || action.startsWith("audit.") || action.startsWith("sandbox."))
    return { kind: "sandbox", sandboxId };
  if (action.startsWith("holding."))
    return { kind: "holding", sandboxId, ownerId: sellerId, companyOrgId };
  if (action === "bid.create" || action.startsWith("listing."))
    return { kind: "listing", sandboxId, sellerId, companyOrgId, status: "Closed" };
  if (action.startsWith("bid."))
    return { kind: "bid", sandboxId, buyerId, sellerId, listingStatus: "Closed" };
  if (action.startsWith("trade."))
    return { kind: "trade", sandboxId, buyerId, sellerId, companyOrgId };
  return {
    kind: "company",
    sandboxId,
    companyOrgId,
    accessGrant: "approved",
    priceVisibility: "members",
  };
}
const staticRoles: Record<(typeof SIMPLE_ACTIONS)[number], ActorRole[]> = {
  "holding.create": ["seller"],
  "holding.view": ["seller", "company_admin", "operator"],
  "listing.create": ["seller"],
  "listing.view": ["seller", "buyer", "company_admin", "operator"],
  "listing.viewReserve": ["seller", "operator"],
  "listing.viewBids": ["seller", "operator"],
  "bid.create": ["buyer"],
  "bid.view": ["seller", "buyer", "operator"],
  "trade.view": ["seller", "buyer", "company_admin", "operator"],
  "company.viewTradePrices": ["seller", "buyer", "company_admin", "operator"],
  "company.view": ["seller", "buyer", "company_admin", "operator"],
  "company.requestAccess": ["buyer"],
  "company.askQuestion": ["buyer"],
  "company.viewInfoPack": ["buyer", "company_admin", "operator"],
  "company.answerQuestion": ["company_admin"],
  "company.decideAccess": ["company_admin"],
  "policy.view": ["seller", "buyer", "company_admin", "operator"],
  "policy.update": ["company_admin"],
  "audit.view": ["operator"],
  "audit.verify": ["operator"],
  "sandbox.reset": ["seller", "buyer", "company_admin", "operator"],
  "sandbox.advanceClock": ["seller", "buyer", "company_admin", "operator"],
  "sandbox.toggleAutopilot": ["seller", "buyer", "company_admin", "operator"],
  "sandbox.switchPersona": ["seller", "buyer", "company_admin", "operator"],
  "sandbox.setRofrMode": ["seller", "buyer", "company_admin", "operator"],
};
describe("complete authorisation matrix", () => {
  const actions = [...SIMPLE_ACTIONS, ...Object.keys(eventRoles)] as Action[];
  for (const action of actions)
    for (const role of ALL_ROLES)
      for (const relation of ["owner", "non-owner", "other-company", "other-sandbox"] as const)
        it(`${action} ${role} ${relation}`, () => {
          const r = resource(action);
          const a = actor(
            role,
            relation === "non-owner"
              ? { userId: "stranger" }
              : relation === "other-company"
                ? { orgId: "other" }
                : relation === "other-sandbox"
                  ? { sandboxId: "other" }
                  : {},
          );
          let allowed = (
            eventRoles[action] ?? staticRoles[action as (typeof SIMPLE_ACTIONS)[number]]
          ).includes(role);
          const relationshipSeller = [
            "holding.SUBMIT_FOR_VERIFICATION",
            "holding.RESUBMIT",
            "listing.create",
            "listing.SUBMIT",
            "listing.WITHDRAW",
            "listing.COUNTER_SENT",
            "listing.ALLOCATE",
            "listing.DECLINE_ALL",
            "listing.viewReserve",
            "listing.viewBids",
            "holding.view",
            "bid.COUNTER",
            "bid.KEEP_AS_BACKUP",
            "bid.ACCEPT",
            "bid.REJECT",
            "bid.PROMOTE",
            "bid.view",
            "trade.SELLER_SIGN",
            "trade.RAISE_DISPUTE",
            "trade.view",
          ];
          const relationshipBuyer = [
            "bid.AMEND",
            "bid.WITHDRAW",
            "bid.ACCEPT_COUNTER",
            "bid.DECLINE_COUNTER",
            "bid.view",
            "trade.BUYER_SIGN",
            "trade.MARK_WIRE_SENT",
            "trade.RAISE_DISPUTE",
            "trade.view",
          ];
          const relationshipCompany = [
            "holding.VERIFY",
            "holding.REJECT",
            "holding.view",
            "trade.WAIVE",
            "trade.EXERCISE",
            "trade.REFUSE",
            "trade.UPLOAD_REGISTER",
            "trade.view",
            "company.viewInfoPack",
            "company.answerQuestion",
            "company.decideAccess",
            "policy.update",
          ];
          if (
            relation === "non-owner" &&
            ((role === "seller" && relationshipSeller.includes(action)) ||
              (role === "buyer" && relationshipBuyer.includes(action)))
          )
            allowed = false;
          if (
            relation === "other-company" &&
            role === "company_admin" &&
            relationshipCompany.includes(action)
          )
            allowed = false;
          if (relation === "other-sandbox") allowed = false;
          expect(can(a, action, r).allowed).toBe(allowed);
          expect(authorize(a, action, r)).toMatchObject(
            allowed ? { ok: true, value: true } : { ok: false, error: { code: "FORBIDDEN" } },
          );
        });
  it("machine roles cannot drift from permissions", () => {
    for (const [kind, m] of Object.entries(MACHINES))
      for (const row of m.rows)
        for (const role of ALL_ROLES) {
          const action = `${kind}.${row.event}` as Action;
          expect(can(actor(role), action, resource(action)).allowed).toBe(row.roles.includes(role));
        }
  });
  it("does not expose sealed bids, unapproved packs or wrong resource types", () => {
    for (const status of ["Draft", "InReview", "Live"] as const)
      expect(
        can(actor("seller"), "listing.viewBids", {
          kind: "listing",
          sandboxId: "sandbox",
          sellerId: "seller",
          companyOrgId: "company-org",
          status,
        }).allowed,
      ).toBe(false);
    expect(
      can(actor("seller"), "bid.view", {
        kind: "bid",
        sandboxId: "sandbox",
        buyerId: "buyer",
        sellerId: "seller",
        listingStatus: "Live",
      }).allowed,
    ).toBe(false);
    for (const accessGrant of ["none", "pending", "denied"] as const)
      expect(
        can(actor("buyer"), "company.viewInfoPack", {
          kind: "company",
          sandboxId: "sandbox",
          companyOrgId: "company-org",
          accessGrant,
        }).allowed,
      ).toBe(false);
    for (const action of actions)
      if (
        action !== "holding.create" &&
        !action.startsWith("sandbox.") &&
        !action.startsWith("audit.")
      )
        expect(
          can(actor("operator"), action, { kind: "sandbox", sandboxId: "sandbox" }).allowed,
        ).toBe(false);
    expect(can(actor("seller"), "holding.create", { kind: "sandbox", sandboxId: "other" })).toEqual(
      { allowed: false, reason: "Not found." },
    );
  });
});
