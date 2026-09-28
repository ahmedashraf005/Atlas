import { describe, expect, it } from "vitest";
import { can } from "@/domain/authz";
import { transition } from "@/domain/machine";
import type { ActorRole } from "@/domain/roles";
import { type TradeEvent, tradeMachine } from "@/domain/trade";
import type { Trade, TradeStatus } from "@/domain/types";
import {
  cancelReasonText,
  mentionsPaymentChange,
  moreTradeActions,
  nextStep,
  type TradeActionKey,
  tradeBadge,
  tradeResource,
  waitingOn,
  yourMove,
} from "@/lib/trade-display";
import { actor, makePolicy, makeTrade, NOW } from "./domain/helpers/fixtures";

const future = new Date(NOW.getTime() + 86400000),
  facts = {
    companyName: "Falaj Robotics",
    companyOrgId: "company-org",
    seller: "Karim Nasser",
    buyer: "Omar Qasim",
    rofrDays: 30,
    completionHref: "/certificate",
  };
const stateTrade = (status: TradeStatus, extra: Partial<Trade> = {}) =>
  makeTrade({
    status,
    rofrDeadline: future,
    fundingDeadline: future,
    ...(status !== "AwaitingDocs" ? { sellerSignedAt: NOW, buyerSignedAt: NOW } : {}),
    ...(["Funded", "TransferPending", "Settled", "Disputed"].includes(status)
      ? { wireSentAt: NOW, fundedAt: NOW }
      : {}),
    ...(status === "Disputed"
      ? { disputedFrom: "Funded", disputeReason: "Register mismatch" }
      : {}),
    ...extra,
  });
const model = (
  status: TradeStatus,
  role: ActorRole,
  extra: Partial<Trade> = {},
  autopilot = true,
) => nextStep({ actor: actor(role), now: NOW, autopilot }, stateTrade(status, extra), facts);
const badgeCases = [
  ["AwaitingDocs", "info", "Awaiting signatures"],
  ["RofrPending", "info", "Company deciding"],
  ["AwaitingFunds", "info", "Awaiting funds"],
  ["Funded", "info", "Funds in escrow"],
  ["TransferPending", "info", "Awaiting release"],
  ["Settled", "success", "Settled"],
  ["Cancelled", "danger", "Cancelled"],
  ["RofrExercised", "neutral", "Bought by the company"],
  ["Disputed", "danger", "In dispute"],
] as const;
it.each(badgeCases)("badge %s", (status, tone, text) =>
  expect(tradeBadge(status)).toEqual({ tone, text }));
it.each([
  ["company_refused", "The company refused the transfer."],
  ["buyer_default", "The buyer didn't pay into escrow by the deadline."],
  ["dispute_resolved", "Cancelled after Atlas reviewed a dispute."],
  ["operator", "Cancelled by Atlas operations."],
  [null, "The trade was cancelled."],
] as const)("cancel text %s", (reason, text) => expect(cancelReasonText(reason)).toBe(text));
it.each([
  "IBAN",
  "please use this account number",
  "BANK DETAILS changed",
  "swift code",
  "new account",
  "wire to this account",
  "new\naccount",
])("payment warning %s", (text) => expect(mentionsPaymentChange(text)).toBe(true));
it.each([
  "wire transfer completed",
  "the wire arrived",
  "accounting report",
  "liban",
  "swiftly done",
  "new accounts summary",
])("ordinary message %s", (text) => expect(mentionsPaymentChange(text)).toBe(false));
it("waiting parties and approvals for every state", () => {
  expect(waitingOn(makeTrade())).toEqual({
    parties: ["seller", "buyer"],
    approvalsRemaining: null,
  });
  expect(waitingOn(makeTrade({ sellerSignedAt: NOW })).parties).toEqual(["buyer"]);
  expect(waitingOn(makeTrade({ buyerSignedAt: NOW })).parties).toEqual(["seller"]);
  expect(waitingOn(makeTrade({ sellerSignedAt: NOW, buyerSignedAt: NOW })).parties).toEqual([]);
  for (const [status, party] of [
    ["RofrPending", "company"],
    ["AwaitingFunds", "buyer"],
    ["Funded", "company"],
    ["Disputed", "operator"],
  ] as const)
    expect(waitingOn(stateTrade(status)).parties).toEqual([party]);
  expect(waitingOn(stateTrade("AwaitingFunds", { wireSentAt: NOW })).parties).toEqual(["escrow"]);
  for (const count of [0, 1, 2, 3])
    expect(
      waitingOn(
        stateTrade("TransferPending", {
          releaseApprovals: ["first", "second", "third"].slice(0, count),
        }),
      ),
    ).toEqual({ parties: ["operators"], approvalsRemaining: String(Math.max(0, 2 - count)) });
  for (const status of ["Settled", "Cancelled", "RofrExercised"] as const)
    expect(waitingOn(stateTrade(status)).parties).toEqual([]);
});
const eventFor: Record<TradeActionKey, TradeEvent> = {
  sign: "BUYER_SIGN",
  waive: "WAIVE",
  exercise: "EXERCISE",
  refuse: "REFUSE",
  markWireSent: "MARK_WIRE_SENT",
  confirmFunds: "CONFIRM_FUNDS",
  uploadRegister: "UPLOAD_REGISTER",
  approveRelease: "APPROVE_RELEASE",
  raiseDispute: "RAISE_DISPUTE",
  resolveContinue: "RESOLVE_CONTINUE",
  resolveCancel: "RESOLVE_CANCEL",
  cancel: "CANCEL_BY_OPERATOR",
};
const expected: Record<TradeStatus, Partial<Record<ActorRole, TradeActionKey[]>>> = {
  AwaitingDocs: { seller: ["sign"], buyer: ["sign"] },
  RofrPending: { company_admin: ["waive", "exercise", "refuse"] },
  AwaitingFunds: { buyer: ["markWireSent"] },
  Funded: { company_admin: ["uploadRegister"] },
  TransferPending: { operator: ["approveRelease"] },
  Disputed: { operator: ["resolveContinue", "resolveCancel"] },
  Settled: {},
  Cancelled: {},
  RofrExercised: {},
};
for (const status of tradeMachine.states)
  describe(status, () => {
    for (const role of ["seller", "buyer", "company_admin", "operator", "system"] as const)
      it(`next step and legal actions for ${role}`, () => {
        const trade = stateTrade(status),
          a = actor(role),
          step = model(status, role);
        expect(step.actions.map((a) => a.key)).toEqual(expected[status][role] ?? []);
        for (const action of [...step.actions, ...moreTradeActions(a, trade, facts.companyOrgId)]) {
          const event =
            action.key === "sign" && role === "seller" ? "SELLER_SIGN" : eventFor[action.key];
          expect(can(a, `trade.${event}`, tradeResource(trade, facts.companyOrgId)).allowed).toBe(
            true,
          );
          expect(
            transition(tradeMachine, trade, event, a, {
              now: NOW,
              policy: makePolicy(),
              reason: "Review complete",
            }).ok,
          ).toBe(true);
        }
        expect(JSON.stringify(step)).not.toContain("[object Object]");
      });
  });
it("wire receipt and four-eyes only offer legal operator steps", () => {
  expect(model("AwaitingFunds", "operator").actions).toEqual([]);
  expect(model("AwaitingFunds", "operator", { wireSentAt: NOW }).actions.map((a) => a.key)).toEqual(
    ["confirmFunds"],
  );
  expect(model("AwaitingFunds", "buyer", { wireSentAt: NOW }).actions).toEqual([]);
  expect(model("TransferPending", "operator", { releaseApprovals: ["operator"] }).text).toBe(
    "Waiting for a second operator to approve.",
  );
  expect(model("TransferPending", "operator", { releaseApprovals: ["operator"] }).actions).toEqual(
    [],
  );
  expect(
    model("TransferPending", "operator", { releaseApprovals: ["first"] }).actions[0]?.label,
  ).toBe("Approve release (2 of 2)");
  expect(
    model("TransferPending", "operator", { releaseApprovals: ["first", "second"] }).actions,
  ).toEqual([]);
});
it("your move for every waiting party and never another organisation or sandbox", () => {
  for (const status of tradeMachine.states)
    for (const role of ["seller", "buyer", "company_admin", "operator", "system"] as const) {
      const trade = stateTrade(status);
      expect(yourMove(actor(role), trade, facts.companyOrgId)).toBe(
        (expected[status][role]?.length ?? 0) > 0,
      );
    }
  expect(
    yourMove(
      actor("operator"),
      stateTrade("AwaitingFunds", { wireSentAt: NOW }),
      facts.companyOrgId,
    ),
  ).toBe(true);
  expect(
    yourMove(actor("buyer"), stateTrade("AwaitingFunds", { wireSentAt: NOW }), facts.companyOrgId),
  ).toBe(false);
  expect(
    yourMove(
      actor("operator"),
      stateTrade("TransferPending", { releaseApprovals: ["operator"] }),
      facts.companyOrgId,
    ),
  ).toBe(false);
  expect(
    yourMove(actor("operator", { sandboxId: "other" }), stateTrade("Disputed"), facts.companyOrgId),
  ).toBe(false);
  expect(
    yourMove(
      actor("company_admin", { orgId: "other" }),
      stateTrade("RofrPending"),
      facts.companyOrgId,
    ),
  ).toBe(false);
});
it("waiting copy, payment lock, signatures, deadline guards and terminal copy", () => {
  expect(model("RofrPending", "buyer").helper).toBe("Usually a few seconds in this demo.");
  expect(model("RofrPending", "buyer", {}, false).helper).toContain(
    "Auto-pilot is off. Switch persona to act as Falaj Robotics.",
  );
  expect(model("AwaitingDocs", "buyer").text).toContain("joinder");
  expect(model("AwaitingDocs", "seller").text).not.toContain("joinder");
  expect(model("AwaitingDocs", "buyer", { buyerSignedAt: NOW }).actions).toEqual([]);
  expect(model("AwaitingDocs", "seller", { sellerSignedAt: NOW }).actions).toEqual([]);
  expect(model("AwaitingFunds", "buyer").payment).toBe(true);
  expect(
    model("RofrPending", "company_admin", { rofrDeadline: NOW }).actions.map((a) => a.key),
  ).toEqual(["refuse"]);
  expect(
    model("RofrPending", "company_admin", { rofrDeadline: null }).actions.map((a) => a.key),
  ).toEqual(["refuse"]);
  expect(
    model("Disputed", "operator", { disputedFrom: null, disputeReason: null }).actions.map(
      (a) => a.key,
    ),
  ).toEqual(["resolveCancel"]);
  expect(model("Settled", "buyer", { settledAt: NOW }).text).toContain(
    "AED 35,000 released to Karim Nasser",
  );
  expect(model("Settled", "buyer", { settledAt: null }).text).toContain("recorded date");
  expect(model("Settled", "buyer").certificateHref).toBe("/certificate");
  expect(model("RofrExercised", "buyer").text).toBe(
    "Falaj Robotics bought the shares at AED 35.00 under its right of first refusal.",
  );
  expect(model("Cancelled", "buyer").helper).toBe("Shares were returned to the seller.");
});
it("an unrelated user is never given an action", () => {
  for (const status of tradeMachine.states) {
    const step = nextStep(
      { actor: actor("buyer", { userId: "other" }), now: NOW, autopilot: true },
      stateTrade(status),
      facts,
    );
    expect(step.actions).toEqual([]);
  }
});
