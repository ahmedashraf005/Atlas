import { can } from "@/domain/authz";
import type { Actor } from "@/domain/roles";
import type { CancelReason, Trade, TradeStatus } from "@/domain/types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatRelative,
  formatShares,
} from "@/lib/format";

export type TradeTone = "neutral" | "info" | "warning" | "success" | "danger";
export interface TradeBadge {
  tone: TradeTone;
  text: string;
}
const badges: Record<TradeStatus, TradeBadge> = {
  AwaitingDocs: { tone: "info", text: "Awaiting signatures" },
  RofrPending: { tone: "info", text: "Company deciding" },
  AwaitingFunds: { tone: "info", text: "Awaiting funds" },
  Funded: { tone: "info", text: "Funds in escrow" },
  TransferPending: { tone: "info", text: "Awaiting release" },
  Settled: { tone: "success", text: "Settled" },
  Cancelled: { tone: "danger", text: "Cancelled" },
  RofrExercised: { tone: "neutral", text: "Bought by the company" },
  Disputed: { tone: "danger", text: "In dispute" },
};
export function tradeBadge(status: TradeStatus): TradeBadge {
  return { ...badges[status] };
}
export type WaitingParty = "seller" | "buyer" | "company" | "escrow" | "operators" | "operator";
export function waitingOn(trade: Trade): {
  parties: WaitingParty[];
  approvalsRemaining: string | null;
} {
  switch (trade.status) {
    case "AwaitingDocs":
      return {
        parties: [
          ...(!trade.sellerSignedAt ? ["seller" as const] : []),
          ...(!trade.buyerSignedAt ? ["buyer" as const] : []),
        ],
        approvalsRemaining: null,
      };
    case "RofrPending":
      return { parties: ["company"], approvalsRemaining: null };
    case "AwaitingFunds":
      return { parties: [trade.wireSentAt ? "escrow" : "buyer"], approvalsRemaining: null };
    case "Funded":
      return { parties: ["company"], approvalsRemaining: null };
    case "TransferPending":
      return {
        parties: ["operators"],
        approvalsRemaining: String(Math.max(0, 2 - trade.releaseApprovals.length)),
      };
    case "Disputed":
      return { parties: ["operator"], approvalsRemaining: null };
    default:
      return { parties: [], approvalsRemaining: null };
  }
}
export function tradeResource(trade: Trade, companyOrgId: string) {
  return {
    kind: "trade" as const,
    sandboxId: trade.sandboxId,
    sellerId: trade.sellerId,
    buyerId: trade.buyerId,
    companyOrgId,
  };
}
export function yourMove(actor: Actor, trade: Trade, companyOrgId: string): boolean {
  if (!can(actor, "trade.view", tradeResource(trade, companyOrgId)).allowed) return false;
  return waitingOn(trade).parties.some((p) => {
    if (p === "seller") return actor.role === "seller" && actor.userId === trade.sellerId;
    if (p === "buyer") return actor.role === "buyer" && actor.userId === trade.buyerId;
    if (p === "company") return actor.role === "company_admin" && actor.orgId === companyOrgId;
    if (p === "operators")
      return (
        actor.role === "operator" &&
        !trade.releaseApprovals.includes(actor.userId) &&
        trade.releaseApprovals.length < 2
      );
    return actor.role === "operator";
  });
}
const cancelReasons: Record<CancelReason, string> = {
  company_refused: "The company refused the transfer.",
  buyer_default: "The buyer didn't pay into escrow by the deadline.",
  dispute_resolved: "Cancelled after Atlas reviewed a dispute.",
  operator: "Cancelled by Atlas operations.",
};
export function cancelReasonText(reason: CancelReason | null): string {
  return reason ? cancelReasons[reason] : "The trade was cancelled.";
}
export function mentionsPaymentChange(text: string): boolean {
  return /\b(?:iban|account\s+number|bank\s+details|swift|new\s+account|wire\s+to)\b/i.test(text);
}
export type TradeActionKey =
  | "sign"
  | "waive"
  | "exercise"
  | "refuse"
  | "markWireSent"
  | "confirmFunds"
  | "uploadRegister"
  | "approveRelease"
  | "raiseDispute"
  | "resolveContinue"
  | "resolveCancel"
  | "cancel";
export interface TradeActionView {
  key: TradeActionKey;
  label: string;
  title: string;
  description: string;
  confirm: string;
  tone: "primary" | "danger";
  variant: "primary" | "secondary" | "link";
  stepUp: boolean;
  reason: boolean;
}
export interface TradeFacts {
  companyName: string;
  companyOrgId: string;
  seller: string;
  buyer: string;
  rofrDays: number;
  completionHref: string | null;
}
export interface NextStepView {
  text: string;
  helper: string | null;
  actions: TradeActionView[];
  deadline: string | null;
  payment: boolean;
  success: boolean;
  certificateHref: string | null;
}
export function nextStep(
  viewer: { actor: Actor; now: Date; autopilot: boolean },
  trade: Trade,
  facts: TradeFacts,
): NextStepView {
  const { actor, now } = viewer,
    resource = tradeResource(trade, facts.companyOrgId);
  const qty = formatShares(trade.quantity, "prose"),
    price = formatMoney(trade.priceMinor, trade.currency, "perShare"),
    total = formatMoney(trade.priceMinor * trade.quantity, trade.currency);
  const result: NextStepView = {
    text: "",
    helper: null,
    actions: [],
    deadline: null,
    payment: false,
    success: false,
    certificateHref: null,
  };
  const action = (
    key: TradeActionKey,
    label: string,
    title: string,
    description: string,
    options: Partial<TradeActionView> = {},
  ) =>
    result.actions.push({
      key,
      label,
      title,
      description,
      confirm: label,
      tone: "primary",
      variant: "primary",
      stepUp: false,
      reason: false,
      ...options,
    });
  if (trade.status === "Settled") {
    result.text = `Settled on ${trade.settledAt ? formatDate(trade.settledAt) : "the recorded date"}. ${qty} transferred to ${facts.buyer}; ${total} released to ${facts.seller}.`;
    result.success = true;
    result.certificateHref = facts.completionHref;
    return result;
  }
  if (trade.status === "RofrExercised") {
    result.text = `${facts.companyName} bought the shares at ${price} under its right of first refusal.`;
    return result;
  }
  if (trade.status === "Cancelled") {
    result.text = cancelReasonText(trade.cancelReason);
    result.helper = "Shares were returned to the seller.";
    return result;
  }
  if (trade.status === "AwaitingDocs") {
    const seller =
      actor.userId === trade.sellerId &&
      !trade.sellerSignedAt &&
      can(actor, "trade.SELLER_SIGN", resource).allowed;
    const buyer =
      actor.userId === trade.buyerId &&
      !trade.buyerSignedAt &&
      can(actor, "trade.BUYER_SIGN", resource).allowed;
    if (seller || buyer) {
      result.text = `Sign the share transfer agreement${buyer ? " and the joinder to the shareholders' agreement" : ""}.`;
      action(
        "sign",
        "Sign agreement",
        "Sign the agreement?",
        `${facts.seller} → ${facts.buyer}: ${qty} at ${price}, total ${total}. After both parties sign, ${facts.companyName} has ${facts.rofrDays} days to decide on its right of first refusal.`,
      );
    }
  } else if (trade.status === "RofrPending") {
    result.deadline = trade.rofrDeadline?.toISOString() ?? null;
    if (can(actor, "trade.REFUSE", resource).allowed) {
      result.text = `Decide on your right of first refusal${trade.rofrDeadline ? ` by ${formatDateTime(trade.rofrDeadline)} (${formatRelative(trade.rofrDeadline, now)})` : ""}.`;
      if (trade.rofrDeadline && now < trade.rofrDeadline) {
        action(
          "waive",
          "Waive",
          "Waive the right of first refusal?",
          `The sale to ${facts.buyer} proceeds.`,
        );
        action(
          "exercise",
          `Buy at ${price}`,
          "Exercise the right of first refusal?",
          `The company buys ${qty} at ${price}, total ${total}, instead of ${facts.buyer}.`,
          { tone: "danger", variant: "secondary", confirm: "Buy the shares" },
        );
      }
      action(
        "refuse",
        "Refuse transfer",
        "Refuse the transfer?",
        "Give a reason for refusing this transfer. The shares return to the seller.",
        { tone: "danger", variant: "link", reason: true },
      );
    }
  } else if (trade.status === "AwaitingFunds") {
    result.deadline = trade.fundingDeadline?.toISOString() ?? null;
    if (!trade.wireSentAt && can(actor, "trade.MARK_WIRE_SENT", resource).allowed) {
      result.text = `Pay ${total} into escrow${trade.fundingDeadline ? ` by ${formatDateTime(trade.fundingDeadline)}` : ""}.`;
      result.payment = true;
      action(
        "markWireSent",
        "I've sent the wire",
        "Confirm you sent the wire?",
        `Confirm you sent ${total} using the locked instructions and reference ${trade.escrowRef}.`,
        { stepUp: true },
      );
    } else if (trade.wireSentAt && can(actor, "trade.CONFIRM_FUNDS", resource).allowed) {
      result.text = "Confirm the funds arrived.";
      action(
        "confirmFunds",
        "Confirm funds received",
        "Confirm funds received?",
        `Confirm ${total} arrived in escrow for ${trade.escrowRef}.`,
        { stepUp: true },
      );
    }
  } else if (trade.status === "Funded" && can(actor, "trade.UPLOAD_REGISTER", resource).allowed) {
    result.text = "Update your share register.";
    result.helper = "In this demo, the extract is generated for you.";
    action(
      "uploadRegister",
      "Upload register extract",
      "Upload the register extract?",
      `Record the transfer of ${qty} to ${facts.buyer}. In this demo, the extract is generated for you.`,
    );
  } else if (
    trade.status === "TransferPending" &&
    can(actor, "trade.APPROVE_RELEASE", resource).allowed
  ) {
    if (trade.releaseApprovals.includes(actor.userId)) {
      result.text = "Waiting for a second operator to approve.";
      return result;
    }
    if (trade.releaseApprovals.length < 2) {
      result.text = "Two different operators must approve before money moves.";
      action(
        "approveRelease",
        `Approve release (${trade.releaseApprovals.length + 1} of 2)`,
        "Approve the escrow release?",
        `Approve releasing ${total} to ${facts.seller}. Two different operators must approve before money moves.`,
        { stepUp: true },
      );
    }
  } else if (trade.status === "Disputed" && can(actor, "trade.RESOLVE_CANCEL", resource).allowed) {
    result.text = `Review the dispute: “${trade.disputeReason ?? "No reason recorded"}”.`;
    if (trade.disputedFrom)
      action(
        "resolveContinue",
        "Resume trade",
        "Resume the trade?",
        "The trade returns to the step where it was paused.",
      );
    action(
      "resolveCancel",
      "Cancel and refund",
      "Cancel and refund?",
      "Give a reason. Escrow is refunded to the buyer and the shares return to the seller.",
      { tone: "danger", variant: "link", reason: true },
    );
  }
  if (!result.text) {
    const party = waitingOn(trade)
      .parties.map(
        (p) =>
          ({
            seller: facts.seller,
            buyer: facts.buyer,
            company: facts.companyName,
            escrow: "the escrow agent",
            operators: "Atlas operations",
            operator: "Atlas operations",
          })[p],
      )
      .join(" and ");
    const what: Partial<Record<TradeStatus, string>> = {
      AwaitingDocs: "to sign the agreement",
      RofrPending: "to decide on the right of first refusal",
      AwaitingFunds: trade.wireSentAt ? "to confirm the funds" : "to send the wire",
      Funded: "to update the share register",
      TransferPending: "to approve release",
      Disputed: "to review the dispute",
    };
    result.text = `Waiting on ${party} ${what[trade.status]}.`;
    result.helper = viewer.autopilot
      ? "Usually a few seconds in this demo."
      : `Auto-pilot is off. Switch persona to act as ${party}.`;
  }
  return result;
}
export function moreTradeActions(
  actor: Actor,
  trade: Trade,
  companyOrgId: string,
): TradeActionView[] {
  const resource = tradeResource(trade, companyOrgId),
    actions: TradeActionView[] = [];
  if (
    ["Funded", "TransferPending"].includes(trade.status) &&
    can(actor, "trade.RAISE_DISPUTE", resource).allowed
  )
    actions.push({
      key: "raiseDispute",
      label: "Raise a dispute",
      title: "Raise a dispute?",
      description: "Describe the issue. The trade pauses while Atlas operations reviews it.",
      confirm: "Raise dispute",
      tone: "danger",
      variant: "link",
      reason: true,
      stepUp: false,
    });
  const event = trade.status === "Disputed" ? "trade.RESOLVE_CANCEL" : "trade.CANCEL_BY_OPERATOR";
  if (
    !["Settled", "Cancelled", "RofrExercised"].includes(trade.status) &&
    can(actor, event, resource).allowed
  )
    actions.push({
      key: trade.status === "Disputed" ? "resolveCancel" : "cancel",
      label: "Cancel trade",
      title: "Cancel this trade?",
      description:
        "Give a reason. The shares return to the seller and any held escrow is refunded.",
      confirm: "Cancel trade",
      tone: "danger",
      variant: "link",
      reason: true,
      stepUp: false,
    });
  return actions;
}
