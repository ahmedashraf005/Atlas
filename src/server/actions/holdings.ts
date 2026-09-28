import "server-only";
import { v7 } from "uuid";
import { z } from "zod";
import { authorize } from "@/domain/authz";
import { validation } from "@/domain/errors";
import { createHolding as buildHolding } from "@/domain/holding";
import { createListing as buildListing } from "@/domain/listing";
import { parseMoneyInput, parseSharesInput } from "@/domain/money";
import { evaluateListing } from "@/domain/policy";
import { err, ok } from "@/domain/result";
import { formatShares } from "@/lib/format";
import { type ActionDef, defineAction } from "@/server/actions/pipeline";
import { appendAudit } from "@/server/audit";
import { NotFoundError } from "@/server/errors";
import * as audit from "@/server/repositories/audit";
import * as companies from "@/server/repositories/companies";
import * as holdings from "@/server/repositories/holdings";
import * as listings from "@/server/repositories/listings";
import * as refs from "@/server/repositories/refs";
import { runTransition } from "@/server/transitions";

const createHoldingInput = z.object({
  companyId: z.uuid(),
  shareClassId: z.uuid(),
  quantity: z.string(),
  acquiredOn: z.iso.date(),
  evidence: z.enum(["share_certificate", "cap_table_extract"]),
});
export interface HoldingData {
  holdingId: string;
}
export const createHoldingDef: ActionDef<typeof createHoldingInput, HoldingData> = {
  name: "holding.create",
  input: createHoldingInput,
  revalidate: ["/holdings"],
  handler: async (ctx, input) => {
    const sid = ctx.sandbox.id;
    const auth = authorize(ctx.actor, "holding.create", { kind: "sandbox", sandboxId: sid });
    if (!auth.ok) return auth;
    const company = await companies.find(ctx.tx, sid, input.companyId);
    if (!company) throw new NotFoundError();
    const shareClass = (await companies.classes(ctx.tx, sid, company.id)).find(
      (c) => c.id === input.shareClassId,
    );
    const quantity = parseSharesInput(input.quantity);
    const acquiredAt = new Date(`${input.acquiredOn}T00:00:00+04:00`);
    const issues: { field: string; message: string }[] = [];
    if (!shareClass)
      issues.push({
        field: "shareClassId",
        message: "Choose a share class belonging to this company.",
      });
    if (!quantity.ok)
      issues.push(...(quantity.error.issues ?? []).map((i) => ({ ...i, field: "quantity" })));
    else if (shareClass && quantity.value > shareClass.shares)
      issues.push({
        field: "quantity",
        message: `That's more than the ${formatShares(shareClass.shares, "prose").replace(/ shares?$/, "")} ${shareClass.name} shares the company has issued.`,
      });
    if (acquiredAt > ctx.now)
      issues.push({ field: "acquiredOn", message: "The acquisition date can't be in the future." });
    if (issues.length) return err(validation(issues));
    if (!quantity.ok || !shareClass) throw new Error("Validated holding facts missing");
    const built = buildHolding(
      {
        ownerId: ctx.actor.userId,
        companyId: company.id,
        shareClassId: shareClass.id,
        quantity: quantity.value,
        acquiredAt,
      },
      { id: v7(), sandboxId: sid, now: ctx.now },
    );
    if (!built.ok) return built;
    await holdings.insert(ctx.tx, sid, built.value);
    const submitted = await runTransition(
      ctx,
      "holding",
      built.value.id,
      "SUBMIT_FOR_VERIFICATION",
      {},
    );
    return submitted.ok ? ok({ holdingId: submitted.value.id }) : submitted;
  },
};
const resubmitInput = z.object({ holdingId: z.uuid() });
export const resubmitHoldingDef: ActionDef<typeof resubmitInput, HoldingData> = {
  name: "holding.resubmit",
  input: resubmitInput,
  revalidate: ["/holdings"],
  handler: async (ctx, input) => {
    const result = await runTransition(ctx, "holding", input.holdingId, "RESUBMIT", {});
    return result.ok ? ok({ holdingId: result.value.id }) : result;
  },
};
const listingInput = z.object({
  holdingId: z.uuid(),
  quantity: z.string(),
  minFill: z.string(),
  reservePrice: z.string(),
  windowDays: z.preprocess(
    (v) => (typeof v === "string" ? +v : v),
    z.union([z.literal(3), z.literal(5), z.literal(7)]),
  ),
  confirmedOwnership: z.preprocess((v) => (v === "true" ? true : v), z.literal(true)),
  clientRequestId: z.uuid(),
});
export interface ListingData {
  ref: string;
  listingId: string;
}
export const createListingDef: ActionDef<typeof listingInput, ListingData> = {
  name: "listing.create",
  input: listingInput,
  revalidate: ["/holdings"],
  handler: async (ctx, input) => {
    const sid = ctx.sandbox.id;
    // Role authorization precedes the owner lookup; another seller's holding remains undisclosed.
    const auth = authorize(ctx.actor, "listing.create", {
      kind: "holding",
      sandboxId: sid,
      ownerId: ctx.actor.userId,
      companyOrgId: "",
    });
    if (!auth.ok) return auth;
    const holding = await holdings.getForUpdate(ctx.tx, sid, input.holdingId);
    if (!holding || holding.ownerId !== ctx.actor.userId) throw new NotFoundError();
    const previousId = await audit.listingRequest(
      ctx.tx,
      sid,
      ctx.actor.userId,
      input.clientRequestId,
      new Date(ctx.now.getTime() - 600000),
    );
    if (previousId) {
      const previous = await listings.findForViewer(
        ctx.tx,
        { sandboxId: sid, actor: ctx.actor },
        previousId,
      );
      if (previous && previous.sellerId === ctx.actor.userId)
        return ok({ ref: previous.ref, listingId: previous.id });
    }
    const quantity = parseSharesInput(input.quantity),
      minFill = parseSharesInput(input.minFill),
      price = parseMoneyInput(input.reservePrice);
    const issues = [
      ["quantity", quantity],
      ["minFill", minFill],
      ["reservePrice", price],
    ] as const;
    const errors = issues.flatMap(([field, result]) =>
      result.ok ? [] : (result.error.issues ?? []).map((i) => ({ ...i, field })),
    );
    if (errors.length) return err(validation(errors));
    if (!quantity.ok || !minFill.ok || !price.ok)
      throw new Error("Validated listing values missing");
    const company = await companies.find(ctx.tx, sid, holding.companyId);
    if (!company) throw new NotFoundError();
    const policy = await companies.policy(ctx.tx, sid, company.id);
    const policyResult = evaluateListing({
      policy,
      holding,
      soldInLast12Months: await holdings.committedQty(ctx.tx, sid, holding.id, ctx.now),
      now: ctx.now,
      quantity: quantity.value,
      minFill: minFill.value,
    });
    if (!policyResult.ok)
      return err({
        code: "POLICY_BLOCKED",
        message: "This listing doesn't meet the company's transfer policy.",
        failures: policyResult.failures,
      });
    const built = buildListing(
      {
        holding,
        quantity: quantity.value,
        minFill: minFill.value,
        reservePriceMinor: price.value,
        windowDays: input.windowDays,
        currency: company.currency,
      },
      { id: v7(), now: ctx.now, actor: ctx.actor },
    );
    if (!built.ok) return built;
    const ref = await refs.next(ctx.tx, sid, "L");
    await listings.insert(ctx.tx, sid, built.value, ref);
    await appendAudit(ctx, {
      action: "listing.create",
      entity: "listing",
      entityId: built.value.id,
      before: null,
      after: { ...built.value, ref, clientRequestId: input.clientRequestId },
    });
    // runTransition computes policy facts itself, so the caller cannot inject an actor or policy result.
    const submitted = await runTransition(ctx, "listing", built.value.id, "SUBMIT", {});
    return submitted.ok ? ok({ ref, listingId: submitted.value.id }) : submitted;
  },
};
const withdrawInput = z.object({ listingId: z.uuid() });
export const withdrawListingDef: ActionDef<typeof withdrawInput, { listingId: string }> = {
  name: "listing.withdraw",
  input: withdrawInput,
  revalidate: ["/holdings"],
  handler: async (ctx, input) => {
    const result = await runTransition(ctx, "listing", input.listingId, "WITHDRAW", {});
    return result.ok ? ok({ listingId: result.value.id }) : result;
  },
};
export const createHolding = defineAction(createHoldingDef);
export const resubmitHolding = defineAction(resubmitHoldingDef);
export const createListing = defineAction(createListingDef);
export const withdrawListing = defineAction(withdrawListingDef);
