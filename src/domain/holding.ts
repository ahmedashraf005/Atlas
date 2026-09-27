import { notify } from "@/domain/effects";
import { insufficientShares, validation } from "@/domain/errors";
import { defineMachine } from "@/domain/machine";
import { err, ok, type Result } from "@/domain/result";
import type { Holding, HoldingStatus } from "@/domain/types";
export interface HoldingCtx {
  now: Date;
  reason?: string;
}
const events = ["SUBMIT_FOR_VERIFICATION", "VERIFY", "REJECT", "RESUBMIT"] as const;
export type HoldingEvent = (typeof events)[number];
export const holdingMachine = defineMachine<HoldingStatus, HoldingEvent, Holding, HoldingCtx>({
  name: "holding",
  initial: "Unverified",
  states: ["Unverified", "PendingCompany", "Verified", "Rejected"],
  terminal: [],
  events,
  rows: [
    {
      from: "Unverified",
      event: "SUBMIT_FOR_VERIFICATION",
      to: "PendingCompany",
      roles: ["seller"],
      effects: (h) => [notify("holding", h.id, "company", "holding_verification_requested")],
    },
    {
      from: "PendingCompany",
      event: "VERIFY",
      to: "Verified",
      roles: ["company_admin"],
      apply: () => ({ rejectionReason: null }),
      effects: (h) => [notify("holding", h.id, "seller", "holding_verified")],
    },
    {
      from: "PendingCompany",
      event: "REJECT",
      to: "Rejected",
      roles: ["company_admin"],
      guard: (_, c) => (c.reason?.trim() ? true : "Give a reason for rejecting this holding."),
      apply: (_, c) => ({ rejectionReason: c.reason?.trim() ?? null }),
      effects: (h) => [notify("holding", h.id, "seller", "holding_rejected")],
    },
    {
      from: "Rejected",
      event: "RESUBMIT",
      to: "PendingCompany",
      roles: ["seller"],
      effects: (h) => [notify("holding", h.id, "company", "holding_verification_requested")],
    },
  ],
});
export const availableQty = (h: Holding): bigint => h.quantity - h.reservedQty - h.soldQty;
function change(
  h: Holding,
  qty: bigint,
  operation: "reserve" | "release" | "sell",
): Result<Holding> {
  if (qty <= 0n)
    return err(
      validation([{ field: "quantity", message: "Share quantity must be greater than zero." }]),
    );
  if (qty > (operation === "reserve" ? availableQty(h) : h.reservedQty))
    return err(insufficientShares());
  return ok({
    ...h,
    reservedQty: h.reservedQty + (operation === "reserve" ? qty : -qty),
    soldQty: h.soldQty + (operation === "sell" ? qty : 0n),
    version: h.version + 1,
  });
}
export const reserveShares = (h: Holding, qty: bigint): Result<Holding> =>
  change(h, qty, "reserve");
export const releaseShares = (h: Holding, qty: bigint): Result<Holding> =>
  change(h, qty, "release");
export const markSharesSold = (h: Holding, qty: bigint): Result<Holding> => change(h, qty, "sell");
export function createHolding(
  input: {
    ownerId: string;
    companyId: string;
    shareClassId: string;
    quantity: bigint;
    acquiredAt: Date;
  },
  ctx: { id: string; sandboxId: string; now: Date },
): Result<Holding> {
  const issues = [];
  if (input.quantity <= 0n)
    issues.push({ field: "quantity", message: "Share quantity must be greater than zero." });
  if (!Number.isFinite(input.acquiredAt.getTime()) || input.acquiredAt > ctx.now)
    issues.push({
      field: "acquiredAt",
      message: "The acquisition date must be on or before today.",
    });
  if (issues.length) return err(validation(issues));
  return ok({
    ...input,
    acquiredAt: new Date(input.acquiredAt.getTime()),
    id: ctx.id,
    sandboxId: ctx.sandboxId,
    reservedQty: 0n,
    soldQty: 0n,
    status: "Unverified",
    rejectionReason: null,
    version: 1,
  });
}
