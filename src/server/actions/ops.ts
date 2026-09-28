import "server-only";
import { z } from "zod";
import { ok } from "@/domain/result";
import type { ConsoleData } from "@/server/actions/company-console";
import { type ActionDef, defineAction } from "@/server/actions/pipeline";
import { runTransition } from "@/server/transitions";

const listingInput = z.strictObject({ listingId: z.uuid() });
const rejectInput = listingInput.extend({ reason: z.string().trim().min(1).max(1000) });
export const approveListingDef: ActionDef<typeof listingInput, ConsoleData> = {
  name: "listing.approve",
  input: listingInput,
  revalidate: ["/ops", "/holdings"],
  handler: async (ctx, input) => {
    const result = await runTransition(ctx, "listing", input.listingId, "APPROVE", {});
    return result.ok ? ok({ message: "Listing approved." }) : result;
  },
};
export const rejectListingDef: ActionDef<typeof rejectInput, ConsoleData> = {
  name: "listing.reject",
  input: rejectInput,
  revalidate: ["/ops", "/holdings"],
  handler: async (ctx, input) => {
    const result = await runTransition(ctx, "listing", input.listingId, "REJECT", {
      reason: input.reason,
    });
    return result.ok ? ok({ message: "Listing rejected." }) : result;
  },
};
export const approveListing = defineAction(approveListingDef);
export const rejectListing = defineAction(rejectListingDef);
