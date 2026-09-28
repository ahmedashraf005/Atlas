import type { AuditEntry, Json } from "@/domain/audit";

export const ACTION_LABELS: Record<string, string> = {
  "holding.verify": "Holding verified",
  "holding.reject": "Holding rejected",
  "listing.approve": "Listing approved",
  "listing.reject": "Listing rejected",
  "listing.counter": "Bid countered",
  "listing.allocate": "Bids allocated",
  "listing.declineAll": "All bids declined",
  "bid.submit": "Bid placed",
  "bid.amend": "Bid amended",
  "bid.withdraw": "Bid withdrawn",
  "bid.acceptCounter": "Counter accepted",
  "bid.declineCounter": "Counter declined",
  "trade.sign": "Agreement signed",
  "trade.waive": "ROFR waived",
  "trade.exercise": "ROFR exercised",
  "trade.refuse": "Transfer refused",
  "trade.markWireSent": "Wire marked as sent",
  "trade.confirmFunds": "Funds confirmed",
  "trade.uploadRegister": "Register updated",
  "trade.approveRelease": "Release approved",
  "trade.raiseDispute": "Dispute raised",
  "trade.resolveContinue": "Trade resumed",
  "trade.resolveCancel": "Dispute cancelled and refunded",
  "trade.cancel": "Trade cancelled",
  "audit.verify": "Audit chain verified",
  "demo.tamperAudit": "Audit tamper demo",
  "demo.simulateCompetingBid": "Simulated bid placed",

  "holding.SUBMIT_FOR_VERIFICATION": "Holding submitted for verification",
  "holding.VERIFY": "Holding verified",
  "holding.REJECT": "Holding rejected",
  "holding.RESUBMIT": "Holding resubmitted",
  "holding.create": "Holding created",
  "holding.resubmit": "Holding resubmitted",
  "listing.SUBMIT": "Listing submitted for review",
  "listing.APPROVE": "Listing approved",
  "listing.REJECT": "Listing rejected",
  "listing.WITHDRAW": "Listing withdrawn",
  "listing.CLOSE_WINDOW": "Bid window closed",
  "listing.COUNTER_SENT": "Counter sent",
  "listing.ALLOCATE": "Bids allocated",
  "listing.DECLINE_ALL": "All bids declined",
  "listing.EXPIRE": "Listing expired",
  "listing.COMPLETE": "Listing completed",
  "listing.create": "Listing created",
  "listing.withdraw": "Listing withdrawn",
  "bid.AMEND": "Bid amended",
  "bid.WITHDRAW": "Bid withdrawn",
  "bid.COUNTER": "Bid countered",
  "bid.ACCEPT_COUNTER": "Counter accepted",
  "bid.DECLINE_COUNTER": "Counter declined",
  "bid.COUNTER_EXPIRE": "Counter lapsed",
  "bid.ACCEPT": "Bid accepted",
  "bid.KEEP_AS_BACKUP": "Backup bid selected",
  "bid.REJECT": "Bid rejected",
  "bid.PROMOTE": "Backup bid promoted",
  "bid.EXPIRE": "Bid expired",
  "bid.create": "Bid placed",
  "trade.SELLER_SIGN": "Seller signed agreement",
  "trade.BUYER_SIGN": "Buyer signed agreement",
  "trade.WAIVE": "ROFR waived",
  "trade.LAPSE": "ROFR lapsed",
  "trade.EXERCISE": "ROFR exercised",
  "trade.REFUSE": "Transfer refused",
  "trade.MARK_WIRE_SENT": "Wire marked as sent",
  "trade.CONFIRM_FUNDS": "Funds confirmed",
  "trade.BUYER_DEFAULT": "Buyer defaulted",
  "trade.UPLOAD_REGISTER": "Register updated",
  "trade.APPROVE_RELEASE": "Release approved",
  "trade.RAISE_DISPUTE": "Dispute raised",
  "trade.RESOLVE_CONTINUE": "Trade resumed",
  "trade.RESOLVE_CANCEL": "Dispute cancelled and refunded",
  "trade.CANCEL_BY_OPERATOR": "Trade cancelled",
  "trade.setBackup": "Trade backup assigned",
  "trade.sendMessage": "Trade message sent",
  "company.requestAccess": "Access requested",
  "company.decideAccess": "Access decided",
  "company.askQuestion": "Question asked",
  "company.answerQuestion": "Answer published",
  "policy.update": "Transfer policy updated",
  "sandbox.seed": "Demo data created",
  "sandbox.reset": "Demo reset",
  "sandbox.switchPersona": "Persona switched",
  "sandbox.advanceClock": "Clock advanced",
  "sandbox.toggleAutopilot": "Auto-pilot toggled",
  "sandbox.setRofrMode": "ROFR mode changed",
};
export function describeAction(action: string): string {
  if (Object.hasOwn(ACTION_LABELS, action)) return ACTION_LABELS[action] as string;
  const [entity = "", event = ""] = action.split(".");
  const words = event
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase();
  return `${entity.charAt(0).toUpperCase()}${entity.slice(1)} · ${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
export function describeActor(
  entry: Pick<AuditEntry, "actorId" | "actorRole" | "simulated">,
  users: readonly { id: string; displayName: string; handle: string }[],
): string {
  if (entry.actorRole === "system") return "Atlas (deadline)";
  const user = users.find((u) => u.id === entry.actorId);
  return `${user ? `${user.displayName} · ${user.handle}` : "Unknown actor"}${entry.simulated ? " (auto-pilot)" : ""}`;
}
const snapshot = (value: Json): Record<string, Json> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value : { value };
// Snapshots are already canonical audit JSON: bigint suffixes and ISO dates stay intact.
export function diffSnapshot(
  before: Json,
  after: Json,
): { field: string; from: string; to: string }[] {
  const a = snapshot(before),
    b = snapshot(after);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap((field) => {
    const from = JSON.stringify(a[field]),
      to = JSON.stringify(b[field]);
    return field === "version" || from === to ? [] : [{ field, from: from ?? "—", to: to ?? "—" }];
  });
}
