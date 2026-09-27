import { forbidden } from "@/domain/errors";
import { MACHINES } from "@/domain/machines";
import { err, ok, type Result } from "@/domain/result";
import type { Actor } from "@/domain/roles";
import type { ListingStatus } from "@/domain/types";
export type Resource =
  | { kind: "holding"; sandboxId: string; ownerId: string; companyOrgId: string }
  | {
      kind: "listing";
      sandboxId: string;
      sellerId: string;
      companyOrgId: string;
      status: ListingStatus;
    }
  | {
      kind: "bid";
      sandboxId: string;
      buyerId: string;
      sellerId: string;
      listingStatus: ListingStatus;
    }
  | { kind: "trade"; sandboxId: string; sellerId: string; buyerId: string; companyOrgId: string }
  | {
      kind: "company";
      sandboxId: string;
      companyOrgId: string;
      accessGrant: "none" | "pending" | "approved" | "denied";
    }
  | { kind: "sandbox"; sandboxId: string };
export type Decision = { allowed: true } | { allowed: false; reason: string };
export const SIMPLE_ACTIONS = [
  "holding.create",
  "holding.view",
  "listing.create",
  "listing.view",
  "listing.viewReserve",
  "listing.viewBids",
  "bid.create",
  "bid.view",
  "trade.view",
  "company.view",
  "company.requestAccess",
  "company.askQuestion",
  "company.viewInfoPack",
  "company.answerQuestion",
  "company.decideAccess",
  "policy.view",
  "policy.update",
  "audit.view",
  "audit.verify",
  "sandbox.reset",
  "sandbox.advanceClock",
  "sandbox.toggleAutopilot",
  "sandbox.switchPersona",
  "sandbox.setRofrMode",
] as const;
type MachineAction = {
  [K in keyof typeof MACHINES]: `${K}.${(typeof MACHINES)[K]["events"][number]}`;
}[keyof typeof MACHINES];
export type Action = (typeof SIMPLE_ACTIONS)[number] | MachineAction;
const denied = (kind: Resource["kind"]): Decision => ({
  allowed: false,
  reason: `You don't have access to this ${kind}.`,
});
const permit = (allowed: boolean, r: Resource): Decision =>
  allowed ? { allowed: true } : denied(r.kind);
export function can(actor: Actor, action: Action, r: Resource): Decision {
  if (r.sandboxId !== actor.sandboxId) return { allowed: false, reason: "Not found." };
  const company =
    "companyOrgId" in r &&
    actor.role === "company_admin" &&
    actor.orgId !== null &&
    actor.orgId === r.companyOrgId;
  const seller =
    actor.role === "seller" &&
    (("ownerId" in r && actor.userId === r.ownerId) ||
      ("sellerId" in r && actor.userId === r.sellerId));
  const buyer = actor.role === "buyer" && "buyerId" in r && actor.userId === r.buyerId;
  const operator = actor.role === "operator";
  const [prefix, event] = action.split(".");
  if (
    prefix &&
    prefix in MACHINES &&
    event &&
    !SIMPLE_ACTIONS.includes(action as (typeof SIMPLE_ACTIONS)[number])
  ) {
    const machine = MACHINES[prefix as keyof typeof MACHINES];
    if (
      r.kind !== prefix ||
      !machine.rows.some((row) => row.event === event && row.roles.includes(actor.role))
    )
      return denied(r.kind);
    if (actor.role === "system") return { allowed: true };
    return permit(operator || seller || buyer || company, r);
  }
  if (actor.role === "system") return denied(r.kind);
  switch (action) {
    case "holding.create":
      return permit(r.kind === "sandbox" && actor.role === "seller", r);
    case "holding.view":
      return permit(r.kind === "holding" && (r.ownerId === actor.userId || company || operator), r);
    case "listing.create":
      return permit((r.kind === "holding" || r.kind === "listing") && seller, r);
    case "listing.view":
      return permit(r.kind === "listing", r);
    case "listing.viewReserve":
      return permit(r.kind === "listing" && (seller || operator), r);
    case "listing.viewBids":
      return permit(
        r.kind === "listing" &&
          (operator || (seller && !["Draft", "InReview", "Live"].includes(r.status))),
        r,
      );
    case "bid.create":
      return permit(r.kind === "listing" && actor.role === "buyer", r);
    case "bid.view":
      return permit(
        r.kind === "bid" && (buyer || operator || (seller && r.listingStatus !== "Live")),
        r,
      );
    case "trade.view":
      return permit(r.kind === "trade" && (seller || buyer || company || operator), r);
    case "company.view":
      return permit(r.kind === "company", r);
    case "company.requestAccess":
    case "company.askQuestion":
      return permit(r.kind === "company" && actor.role === "buyer", r);
    case "company.viewInfoPack":
      return permit(
        r.kind === "company" &&
          (company || operator || (actor.role === "buyer" && r.accessGrant === "approved")),
        r,
      );
    case "company.answerQuestion":
    case "company.decideAccess":
    case "policy.update":
      return permit(r.kind === "company" && company, r);
    case "policy.view":
      return permit(r.kind === "company", r);
    case "audit.view":
    case "audit.verify":
      return permit(r.kind === "sandbox" && operator, r);
    case "sandbox.reset":
    case "sandbox.advanceClock":
    case "sandbox.toggleAutopilot":
    case "sandbox.switchPersona":
    case "sandbox.setRofrMode":
      return permit(r.kind === "sandbox", r);
    default:
      return denied(r.kind);
  }
}
export function authorize(actor: Actor, action: Action, resource: Resource): Result<true> {
  const decision = can(actor, action, resource);
  return decision.allowed ? ok(true) : err(forbidden(decision.reason));
}
