import { expect, it } from "vitest";
import { allocate } from "@/domain/allocation";
import { transition } from "@/domain/machine";
import { addDays } from "@/domain/time";
import {
  createTradesFromAllocation,
  type TradeCtx,
  type TradeEvent,
  tradeMachine,
} from "@/domain/trade";
import type { Trade, TradeStatus } from "@/domain/types";
import {
  actor,
  deepFreeze,
  type MachineCase,
  machineContract,
  makeBid,
  makeListing,
  makePolicy,
  makeTrade,
  N,
  NOW,
  unwrap,
} from "./helpers/fixtures";

const policy = makePolicy(),
  ctx = { now: NOW, policy },
  future = addDays(NOW, 1),
  release = { type: "RELEASE_SHARES" as const, holdingId: "holding", qty: 1000n },
  backup = {
    type: "BACKUP_OR_RELEASE" as const,
    listingId: "listing",
    holdingId: "holding",
    qty: 1000n,
    backupBidId: "backup",
  };
const cancelled = [
    N("trade", "trade", "seller", "trade_cancelled"),
    N("trade", "trade", "buyer", "trade_cancelled"),
  ],
  funds = [N("trade", "trade", "buyer", "funds_due"), N("trade", "trade", "seller", "rofr_waived")];
const cases: MachineCase<TradeStatus, TradeEvent, Trade, TradeCtx>[] = [
  {
    from: "AwaitingDocs",
    event: "SELLER_SIGN",
    to: "AwaitingDocs",
    roles: ["seller"],
    ctx,
    patch: { sellerSignedAt: NOW },
    effects: [N("trade", "trade", "buyer", "counterparty_signed")],
  },
  {
    from: "AwaitingDocs",
    event: "SELLER_SIGN",
    to: "RofrPending",
    roles: ["seller"],
    ctx,
    entity: { buyerSignedAt: NOW },
    patch: { sellerSignedAt: NOW, rofrDeadline: addDays(NOW, 30) },
    effects: [N("trade", "trade", "company", "rofr_notice")],
  },
  {
    from: "AwaitingDocs",
    event: "BUYER_SIGN",
    to: "AwaitingDocs",
    roles: ["buyer"],
    ctx,
    patch: { buyerSignedAt: NOW },
    effects: [N("trade", "trade", "seller", "counterparty_signed")],
  },
  {
    from: "AwaitingDocs",
    event: "BUYER_SIGN",
    to: "RofrPending",
    roles: ["buyer"],
    ctx,
    entity: { sellerSignedAt: NOW },
    patch: { buyerSignedAt: NOW, rofrDeadline: addDays(NOW, 30) },
    effects: [N("trade", "trade", "company", "rofr_notice")],
  },
  {
    from: "RofrPending",
    event: "WAIVE",
    to: "AwaitingFunds",
    roles: ["company_admin"],
    ctx,
    entity: { rofrDeadline: future },
    patch: { fundingDeadline: addDays(NOW, 5) },
    effects: funds,
  },
  {
    from: "RofrPending",
    event: "LAPSE",
    to: "AwaitingFunds",
    roles: ["system"],
    ctx,
    entity: { rofrDeadline: NOW },
    patch: { fundingDeadline: addDays(NOW, 5) },
    effects: funds,
  },
  {
    from: "RofrPending",
    event: "EXERCISE",
    to: "RofrExercised",
    roles: ["company_admin"],
    ctx,
    entity: { rofrDeadline: future },
    effects: [
      { type: "MARK_SHARES_SOLD", holdingId: "holding", qty: 1000n },
      N("trade", "trade", "buyer", "rofr_exercised"),
      N("trade", "trade", "seller", "rofr_exercised"),
    ],
  },
  {
    from: "RofrPending",
    event: "REFUSE",
    to: "Cancelled",
    roles: ["company_admin"],
    ctx: { ...ctx, reason: "Policy refusal." },
    entity: { backupBidId: "backup" },
    patch: { cancelReason: "company_refused" },
    effects: [
      backup,
      N("trade", "trade", "buyer", "trade_cancelled"),
      N("trade", "trade", "seller", "trade_cancelled"),
    ],
  },
  {
    from: "AwaitingFunds",
    event: "MARK_WIRE_SENT",
    to: "AwaitingFunds",
    roles: ["buyer"],
    ctx,
    patch: { wireSentAt: NOW },
    effects: [N("trade", "trade", "operator", "wire_sent")],
  },
  {
    from: "AwaitingFunds",
    event: "CONFIRM_FUNDS",
    to: "Funded",
    roles: ["operator"],
    ctx,
    entity: { wireSentAt: NOW },
    patch: { fundedAt: NOW },
    effects: [
      N("trade", "trade", "company", "register_update_due"),
      N("trade", "trade", "seller", "funds_confirmed"),
    ],
  },
  {
    from: "AwaitingFunds",
    event: "BUYER_DEFAULT",
    to: "Cancelled",
    roles: ["system"],
    ctx,
    entity: { fundingDeadline: NOW, backupBidId: "backup" },
    patch: { cancelReason: "buyer_default" },
    effects: [
      backup,
      N("trade", "trade", "buyer", "trade_cancelled"),
      N("trade", "trade", "seller", "trade_cancelled"),
    ],
  },
  {
    from: "Funded",
    event: "UPLOAD_REGISTER",
    to: "TransferPending",
    roles: ["company_admin"],
    ctx,
    patch: { registerUpdatedAt: NOW },
    effects: [N("trade", "trade", "operator", "release_due")],
  },
  {
    from: "TransferPending",
    event: "APPROVE_RELEASE",
    to: "TransferPending",
    roles: ["operator"],
    ctx,
    patch: { releaseApprovals: ["operator"] },
  },
  {
    from: "TransferPending",
    event: "APPROVE_RELEASE",
    to: "Settled",
    roles: ["operator"],
    ctx,
    entity: { releaseApprovals: ["first"] },
    patch: { releaseApprovals: ["first", "operator"], settledAt: NOW },
    effects: [
      { type: "MARK_SHARES_SOLD", holdingId: "holding", qty: 1000n },
      {
        type: "TRANSFER_TO_BUYER",
        tradeId: "trade",
        buyerId: "buyer",
        companyId: "company",
        shareClassId: "ordinary",
        qty: 1000n,
      },
      { type: "ESCROW_RELEASE", tradeId: "trade" },
      N("trade", "trade", "seller", "settled"),
      N("trade", "trade", "buyer", "settled"),
    ],
  },
  ...(["Funded", "TransferPending"] as const).map((from) => ({
    from,
    event: "RAISE_DISPUTE" as const,
    to: "Disputed" as const,
    roles: ["seller" as const, "buyer" as const, "operator" as const],
    ctx: { ...ctx, reason: "Register mismatch." },
    patch: { disputeReason: "Register mismatch.", disputedFrom: from },
    effects: [N("trade", "trade", "operator", "dispute_raised")],
  })),
  ...(["Funded", "TransferPending"] as const).map((to) => ({
    from: "Disputed" as const,
    event: "RESOLVE_CONTINUE" as const,
    to,
    roles: ["operator" as const],
    ctx,
    entity: { disputedFrom: to, disputeReason: "Mismatch." },
    patch: { disputedFrom: null, disputeReason: null },
    effects: [
      N("trade", "trade", "seller", "dispute_resolved"),
      N("trade", "trade", "buyer", "dispute_resolved"),
    ],
  })),
  {
    from: "Disputed",
    event: "RESOLVE_CANCEL",
    to: "Cancelled",
    roles: ["operator"],
    ctx: { ...ctx, reason: "Resolution." },
    patch: { cancelReason: "dispute_resolved" },
    effects: [{ type: "ESCROW_REFUND", tradeId: "trade" }, release, ...cancelled],
  },
  ...(["AwaitingDocs", "RofrPending", "AwaitingFunds", "Funded", "TransferPending"] as const).map(
    (from) => ({
      from,
      event: "CANCEL_BY_OPERATOR" as const,
      to: "Cancelled" as const,
      roles: ["operator" as const],
      ctx: { ...ctx, reason: "Compliance cancellation." },
      entity: { fundedAt: from === "Funded" || from === "TransferPending" ? NOW : null },
      patch: { cancelReason: "operator" as const },
      effects: [
        ...(from === "Funded" || from === "TransferPending"
          ? [{ type: "ESCROW_REFUND" as const, tradeId: "trade" }]
          : []),
        release,
        ...cancelled,
      ],
    }),
  ),
];
machineContract(tradeMachine, makeTrade, cases, ctx);
it("rejects repeat signatures and routes whichever party signs second to ROFR", () => {
  for (const [event, role, entity] of [
    ["SELLER_SIGN", "seller", { sellerSignedAt: NOW }],
    ["BUYER_SIGN", "buyer", { buyerSignedAt: NOW }],
  ] as const)
    expect(
      transition(tradeMachine, deepFreeze(makeTrade(entity)), event, actor(role), ctx),
    ).toMatchObject({ ok: false, error: { message: "You've already signed." } });
  const first = unwrap(
    transition(tradeMachine, deepFreeze(makeTrade()), "BUYER_SIGN", actor("buyer"), ctx),
  ).next;
  expect(
    unwrap(transition(tradeMachine, deepFreeze(first), "SELLER_SIGN", actor("seller"), ctx)).next
      .status,
  ).toBe("RofrPending");
});
it("guards every ROFR and funding deadline boundary", () => {
  for (const event of ["WAIVE", "EXERCISE"] as const)
    for (const rofrDeadline of [null, NOW])
      expect(
        transition(
          tradeMachine,
          deepFreeze(makeTrade({ status: "RofrPending", rofrDeadline })),
          event,
          actor("company_admin"),
          ctx,
        ),
      ).toMatchObject({ ok: false, error: { message: "The ROFR window has ended." } });
  for (const rofrDeadline of [null, future])
    expect(
      transition(
        tradeMachine,
        deepFreeze(makeTrade({ status: "RofrPending", rofrDeadline })),
        "LAPSE",
        actor("system"),
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { message: "The ROFR window hasn't ended." } });
  for (const fundingDeadline of [null, future])
    expect(
      transition(
        tradeMachine,
        deepFreeze(makeTrade({ status: "AwaitingFunds", fundingDeadline })),
        "BUYER_DEFAULT",
        actor("system"),
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { message: "The funding deadline hasn't passed." } });
});
it("guards wires, reasons, disputes, and four eyes without trusting a context actor", () => {
  expect(
    transition(
      tradeMachine,
      deepFreeze(makeTrade({ status: "AwaitingFunds", wireSentAt: NOW })),
      "MARK_WIRE_SENT",
      actor("buyer"),
      ctx,
    ),
  ).toMatchObject({ ok: false, error: { message: "You've already marked the wire as sent." } });
  expect(
    transition(
      tradeMachine,
      deepFreeze(makeTrade({ status: "AwaitingFunds" })),
      "CONFIRM_FUNDS",
      actor("operator"),
      ctx,
    ),
  ).toMatchObject({ ok: false, error: { message: "The buyer hasn't sent the wire yet." } });
  for (const [status, event, role] of [
    ["RofrPending", "REFUSE", "company_admin"],
    ["Disputed", "RESOLVE_CANCEL", "operator"],
    ["Funded", "CANCEL_BY_OPERATOR", "operator"],
  ] as const)
    for (const reason of [undefined, "  "])
      expect(
        transition(tradeMachine, deepFreeze(makeTrade({ status })), event, actor(role), {
          ...ctx,
          reason,
        }),
      ).toMatchObject({ ok: false, error: { message: "Give a reason for this action." } });
  for (const [reason, message] of [
    ["", "Give a reason for the dispute."],
    ["x".repeat(1001), "Keep the dispute reason to 1,000 characters or fewer."],
  ])
    expect(
      transition(
        tradeMachine,
        deepFreeze(makeTrade({ status: "Funded" })),
        "RAISE_DISPUTE",
        actor("seller"),
        { ...ctx, reason },
      ),
    ).toMatchObject({ ok: false, error: { message } });
  expect(
    transition(
      tradeMachine,
      deepFreeze(makeTrade({ status: "Disputed" })),
      "RESOLVE_CONTINUE",
      actor("operator"),
      ctx,
    ),
  ).toMatchObject({ ok: false, error: { message: "This dispute did not start in Funded." } });
  for (const releaseApprovals of [["operator"], ["first", "second"]])
    expect(
      transition(
        tradeMachine,
        deepFreeze(makeTrade({ status: "TransferPending", releaseApprovals })),
        "APPROVE_RELEASE",
        actor("operator"),
        { ...ctx, actor: actor("operator", { userId: "forged" }) },
      ),
    ).toMatchObject({
      ok: false,
      error: { message: "A second operator must approve the release." },
    });
  const row = tradeMachine.rows.find(
    (r) => r.event === "APPROVE_RELEASE" && r.to === "TransferPending",
  );
  expect(() => row?.apply?.(makeTrade(), ctx)).toThrow("engine");
});
it("creates pay-as-bid trades and puts the backup on the lowest priced allocation only", () => {
  const bids = [
      makeBid({ id: "high", priceMinor: 4000n }),
      makeBid({ id: "low", priceMinor: 3500n }),
    ],
    allocation = allocate(5000n, bids),
    listing = makeListing();
  let id = 0;
  const trades = createTradesFromAllocation(
    deepFreeze(listing),
    deepFreeze(allocation),
    new Map(bids.map((b) => [b.id, b])),
    { now: NOW, newId: () => String(++id), escrowRef: (id) => `ESC-${id}`, backupBidId: "backup" },
  );
  expect(
    trades.map((t) => ({ price: t.priceMinor, qty: t.quantity, backup: t.backupBidId })),
  ).toEqual([
    { price: 4000n, qty: 3000n, backup: null },
    { price: 3500n, qty: 2000n, backup: "backup" },
  ]);
  for (const t of trades)
    expect(t).toMatchObject({
      status: "AwaitingDocs",
      version: 1,
      releaseApprovals: [],
      createdAt: NOW,
      sellerSignedAt: null,
      buyerSignedAt: null,
      rofrDeadline: null,
      fundingDeadline: null,
      cancelReason: null,
      disputedFrom: null,
      listingId: "listing",
      holdingId: "holding",
      companyId: "company",
      shareClassId: "ordinary",
      sellerId: "seller",
      buyerId: "buyer",
      currency: "AED",
      escrowRef: `ESC-${t.id}`,
    });
  expect(
    createTradesFromAllocation(listing, allocate(0n, []), new Map(), {
      now: NOW,
      newId: () => "x",
      escrowRef: () => "esc",
      backupBidId: null,
    }),
  ).toEqual([]);
});
it("rejects inconsistent allocation references, quantities and generated ids", () => {
  const l = makeListing(),
    b = makeBid(),
    a = allocate(3000n, [b]),
    c = { now: NOW, newId: () => "same", escrowRef: () => "esc", backupBidId: null };
  for (const map of [
    new Map(),
    new Map([[b.id, { ...b, listingId: "other" }]]),
    new Map([[b.id, { ...b, sandboxId: "other" }]]),
  ])
    expect(() => createTradesFromAllocation(l, a, map, c)).toThrow();
  for (const qty of [999n, 3001n])
    expect(() =>
      createTradesFromAllocation(
        l,
        { ...a, allocations: [{ bidId: b.id, qty, priceMinor: b.priceMinor }] },
        new Map([[b.id, b]]),
        c,
      ),
    ).toThrow();
  for (const bad of [
    { ...a, allocatedQty: 2999n },
    { ...a, allocatedQty: 6000n, allocations: [...a.allocations, ...a.allocations] },
  ])
    expect(() => createTradesFromAllocation(l, bad, new Map([[b.id, b]]), c)).toThrow();
  const second = makeBid({ id: "second", priceMinor: 3600n });
  expect(() =>
    createTradesFromAllocation(
      l,
      allocate(5000n, [b, second]),
      new Map([
        [b.id, b],
        [second.id, second],
      ]),
      c,
    ),
  ).toThrow("unique");
});
