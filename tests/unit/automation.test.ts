import { expect, it } from "vitest";
import { PERSONAS } from "@/config/personas";
import type { EntityKind } from "@/domain/effects";
import { jobWillExecute, planAutomation } from "@/server/automation";
import type { JobRow } from "@/server/repositories/jobs";
import type { EntityOf } from "@/server/transitions";

const parties = {
  companyAdminId: "company_admin",
  operatorId: "operator",
  secondOperatorId: "operator_second",
};
const cases: [EntityKind, Partial<EntityOf<EntityKind>>, string, string, number][] = [
  ["holding", { status: "PendingCompany" }, "VERIFY", "company_admin", 3],
  ["listing", { status: "InReview" }, "APPROVE", "operator_second", 3],
  ["bid", { status: "Countered", buyerId: "buyer_a" }, "ACCEPT_COUNTER", "buyer_a", 5],
  [
    "trade",
    {
      status: "AwaitingDocs",
      sellerSignedAt: null,
      buyerSignedAt: new Date(0),
      sellerId: "seller",
      buyerId: "buyer_a",
    },
    "SELLER_SIGN",
    "seller",
    4,
  ],
  [
    "trade",
    {
      status: "AwaitingDocs",
      sellerSignedAt: new Date(0),
      buyerSignedAt: null,
      sellerId: "seller",
      buyerId: "buyer_a",
    },
    "BUYER_SIGN",
    "buyer_a",
    4,
  ],
  ["trade", { status: "RofrPending", sellerSignedAt: new Date(0) }, "WAIVE", "company_admin", 5],
  [
    "trade",
    { status: "AwaitingFunds", sellerSignedAt: new Date(0), wireSentAt: null, buyerId: "buyer_b" },
    "MARK_WIRE_SENT",
    "buyer_b",
    5,
  ],
  [
    "trade",
    { status: "AwaitingFunds", sellerSignedAt: new Date(0), wireSentAt: new Date(0) },
    "CONFIRM_FUNDS",
    "operator_second",
    3,
  ],
  [
    "trade",
    { status: "Funded", sellerSignedAt: new Date(0) },
    "UPLOAD_REGISTER",
    "company_admin",
    4,
  ],
  [
    "trade",
    { status: "TransferPending", sellerSignedAt: new Date(0), releaseApprovals: [] },
    "APPROVE_RELEASE",
    "operator_second",
    3,
  ],
  [
    "trade",
    {
      status: "TransferPending",
      sellerSignedAt: new Date(0),
      releaseApprovals: ["operator_second"],
    },
    "APPROVE_RELEASE",
    "operator",
    3,
  ],
  [
    "trade",
    { status: "TransferPending", sellerSignedAt: new Date(0), releaseApprovals: ["operator"] },
    "APPROVE_RELEASE",
    "operator_second",
    3,
  ],
];
for (const [kind, entity, event, party, delay] of cases)
  for (const persona of [...PERSONAS.map((p) => p.key), "operator_second"])
    it(`${kind} ${entity.status} ${event} as ${persona}`, () => {
      const plans = planAutomation(
        kind,
        entity as EntityOf<EntityKind>,
        { autopilot: true, rofrMode: "waive", personaUserId: persona },
        parties,
      );
      const expected =
        party === persona && event !== "CONFIRM_FUNDS"
          ? []
          : [
              {
                event,
                partyUserId: party,
                delaySeconds: delay,
                ...(event === "CONFIRM_FUNDS" ? { escrowException: true } : {}),
              },
            ];
      expect(plans).toEqual(expected);
      expect(
        planAutomation(
          kind,
          entity as EntityOf<EntityKind>,
          { autopilot: false, rofrMode: "waive", personaUserId: persona },
          parties,
        ),
      ).toEqual([]);
    });
it("exercise mode and both unsigned parties", () => {
  expect(
    planAutomation(
      "trade",
      { status: "RofrPending", sellerSignedAt: null } as EntityOf<"trade">,
      { autopilot: true, rofrMode: "exercise", personaUserId: "buyer_a" },
      parties,
    )[0]?.event,
  ).toBe("EXERCISE");
  expect(
    planAutomation(
      "trade",
      {
        status: "AwaitingDocs",
        sellerSignedAt: null,
        buyerSignedAt: null,
        sellerId: "seller",
        buyerId: "buyer_a",
      } as EntityOf<"trade">,
      { autopilot: true, rofrMode: "waive", personaUserId: "operator" },
      parties,
    ).map((p) => p.event),
  ).toEqual(["SELLER_SIGN", "BUYER_SIGN"]);
});
it("job execution respects the persona and escrow exception", () => {
  const job = {
    partyUserId: "operator_second",
    entity: "trade",
    kind: "transition",
    event: "CONFIRM_FUNDS",
  } as JobRow;
  expect(jobWillExecute(job, { autopilot: true, personaUserId: "operator_second" })).toBe(true);
  expect(
    jobWillExecute(
      { ...job, event: "APPROVE_RELEASE" },
      { autopilot: true, personaUserId: "operator_second" },
    ),
  ).toBe(false);
  expect(jobWillExecute(job, { autopilot: false, personaUserId: "buyer_a" })).toBe(false);
});
