import type { PolicyFailure } from "@/domain/policy";
export type DomainErrorCode =
  | "INVALID_TRANSITION"
  | "FORBIDDEN_ROLE"
  | "GUARD_FAILED"
  | "VALIDATION"
  | "INSUFFICIENT_SHARES"
  | "POLICY_BLOCKED"
  | "SELF_DEALING"
  | "DUPLICATE_BID"
  | "BID_WINDOW_CLOSED"
  | "FORBIDDEN";
export interface DomainError {
  code: DomainErrorCode;
  message: string;
  issues?: { field: string; message: string }[];
  failures?: PolicyFailure[];
}
export const invalidTransition = (state: string, event: string): DomainError => ({
  code: "INVALID_TRANSITION",
  message: `The ${state} state does not allow ${event}.`,
});
export const forbiddenRole = (): DomainError => ({
  code: "FORBIDDEN_ROLE",
  message: "Your role can't perform this action.",
});
export const guardFailed = (message: string): DomainError => ({ code: "GUARD_FAILED", message });
export const validation = (issues: NonNullable<DomainError["issues"]>): DomainError => ({
  code: "VALIDATION",
  message: "Check the highlighted fields.",
  issues,
});
export const insufficientShares = (): DomainError => ({
  code: "INSUFFICIENT_SHARES",
  message: "There aren't enough shares available for this operation.",
});
export const policyBlocked = (failures: PolicyFailure[]): DomainError => ({
  code: "POLICY_BLOCKED",
  message: "This bid doesn't meet the company's transfer policy.",
  failures,
});
export const selfDealing = (): DomainError => ({
  code: "SELF_DEALING",
  message: "You can't bid on a listing you're connected to.",
});
export const duplicateBid = (): DomainError => ({
  code: "DUPLICATE_BID",
  message: "You already have a bid on this listing. Amend it instead.",
});
export const bidWindowClosed = (): DomainError => ({
  code: "BID_WINDOW_CLOSED",
  message: "Bidding on this listing has closed.",
});
export const forbidden = (message: string): DomainError => ({ code: "FORBIDDEN", message });
