import fc from "fast-check";
import { expect, it } from "vitest";
import {
  availableQty,
  createHolding,
  type HoldingCtx,
  type HoldingEvent,
  holdingMachine,
  markSharesSold,
  releaseShares,
  reserveShares,
} from "@/domain/holding";
import { transition } from "@/domain/machine";
import type { Holding, HoldingStatus } from "@/domain/types";
import {
  actor,
  deepFreeze,
  type MachineCase,
  machineContract,
  makeHolding,
  N,
  NOW,
  unwrap,
} from "./helpers/fixtures";

const cases: MachineCase<HoldingStatus, HoldingEvent, Holding, HoldingCtx>[] = [
  {
    from: "Unverified",
    event: "SUBMIT_FOR_VERIFICATION",
    to: "PendingCompany",
    roles: ["seller"],
    ctx: { now: NOW },
    effects: [N("holding", "holding", "company", "holding_verification_requested")],
  },
  {
    from: "PendingCompany",
    event: "VERIFY",
    to: "Verified",
    roles: ["company_admin"],
    ctx: { now: NOW },
    entity: { rejectionReason: "old" },
    patch: { rejectionReason: null },
    effects: [N("holding", "holding", "seller", "holding_verified")],
  },
  {
    from: "PendingCompany",
    event: "REJECT",
    to: "Rejected",
    roles: ["company_admin"],
    ctx: { now: NOW, reason: "Incorrect evidence." },
    patch: { rejectionReason: "Incorrect evidence." },
    effects: [N("holding", "holding", "seller", "holding_rejected")],
  },
  {
    from: "Rejected",
    event: "RESUBMIT",
    to: "PendingCompany",
    roles: ["seller"],
    ctx: { now: NOW },
    effects: [N("holding", "holding", "company", "holding_verification_requested")],
  },
];
machineContract(holdingMachine, makeHolding, cases, { now: NOW });
it.each([undefined, "", "  "])("requires a rejection reason %s", (reason) =>
  expect(
    transition(
      holdingMachine,
      deepFreeze(makeHolding({ status: "PendingCompany" })),
      "REJECT",
      actor("company_admin"),
      { now: NOW, reason },
    ),
  ).toMatchObject({
    ok: false,
    error: { code: "GUARD_FAILED", message: "Give a reason for rejecting this holding." },
  }));
it("reserves/releases/sells boundary amounts without changing the input", () => {
  const h = deepFreeze(makeHolding());
  const reserved = unwrap(reserveShares(h, 10000n));
  expect(reserved).toEqual({ ...h, reservedQty: 10000n, version: 2 });
  expect(availableQty(reserved)).toBe(0n);
  expect(reserveShares(reserved, 1n)).toMatchObject({
    ok: false,
    error: { code: "INSUFFICIENT_SHARES" },
  });
  expect(unwrap(releaseShares(reserved, 10000n))).toEqual({ ...h, version: 3 });
  expect(unwrap(markSharesSold(reserved, 10000n))).toEqual({ ...h, soldQty: 10000n, version: 3 });
  for (const operation of [reserveShares, releaseShares, markSharesSold]) {
    expect(operation(h, 0n)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(operation(h, -1n)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  }
  expect(releaseShares(h, 1n)).toMatchObject({ ok: false, error: { code: "INSUFFICIENT_SHARES" } });
  expect(markSharesSold(h, 1n)).toMatchObject({
    ok: false,
    error: { code: "INSUFFICIENT_SHARES" },
  });
});
it("creates unverified holdings and collects quantity/date errors", () => {
  const input = {
      ownerId: "seller",
      companyId: "company",
      shareClassId: "ordinary",
      quantity: 1n,
      acquiredAt: NOW,
    },
    ctx = { id: "new", sandboxId: "sandbox", now: NOW };
  expect(unwrap(createHolding(input, ctx))).toEqual({
    ...input,
    id: "new",
    sandboxId: "sandbox",
    reservedQty: 0n,
    soldQty: 0n,
    status: "Unverified",
    rejectionReason: null,
    version: 1,
  });
  const r = createHolding({ ...input, quantity: 0n, acquiredAt: new Date(NOW.getTime() + 1) }, ctx);
  expect(r).toMatchObject({
    ok: false,
    error: { code: "VALIDATION", issues: [{ field: "quantity" }, { field: "acquiredAt" }] },
  });
  expect(createHolding({ ...input, acquiredAt: new Date("bad") }, ctx)).toMatchObject({
    ok: false,
    error: { code: "VALIDATION" },
  });
});
it("any reserve/release/sell sequence preserves share conservation and failed inputs", () =>
  fc.assert(
    fc.property(
      fc.array(
        fc.tuple(
          fc.constantFrom("reserve", "release", "sell"),
          fc.bigInt({ min: -10n, max: 20000n }),
        ),
        { maxLength: 60 },
      ),
      (operations) => {
        let h = makeHolding();
        for (const [op, qty] of operations) {
          const frozen = deepFreeze(h),
            before = structuredClone(frozen);
          const result = { reserve: reserveShares, release: releaseShares, sell: markSharesSold }[
            op
          ](frozen, qty);
          if (result.ok) h = result.value;
          else expect(frozen).toEqual(before);
          expect(h.reservedQty).toBeGreaterThanOrEqual(0n);
          expect(h.soldQty).toBeGreaterThanOrEqual(0n);
          expect(h.reservedQty + h.soldQty).toBeLessThanOrEqual(h.quantity);
        }
      },
    ),
    { numRuns: 200 },
  ));
