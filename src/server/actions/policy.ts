import "server-only";
import { z } from "zod";
import { authorize } from "@/domain/authz";
import { validation } from "@/domain/errors";
import { err, ok } from "@/domain/result";
import { type ActionDef, defineAction } from "@/server/actions/pipeline";
import { appendAudit } from "@/server/audit";
import { NotFoundError } from "@/server/errors";
import * as companies from "@/server/repositories/companies";
import * as consoles from "@/server/repositories/consoles";

const integer = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
export const policyInput = z.strictObject({
  companyId: z.uuid(),
  policy: z.strictObject({
    rofrDays: integer(7, 60),
    fundingDays: integer(1, 10),
    minLot: z
      .string()
      .refine((v) => /^\d{1,6}$/.test(v) && BigInt(v) >= 1n && BigInt(v) <= 100000n, {
        message: "Minimum lot must be between 1 and 100,000 shares.",
      }),
    lockupMonths: integer(0, 36),
    yearlyLimit: integer(1, 100),
    allowedBuyerTypes: z
      .array(z.enum(["family_office", "hnwi", "fund", "angel_syndicate"]))
      .min(1)
      .max(4),
    blockedOrgIds: z.array(z.uuid()).max(100),
    priceVisibility: z.enum(["operator", "participants", "members"]),
    blackoutWindows: z
      .array(
        z
          .strictObject({
            start: z.iso.date(),
            end: z.iso.date(),
            label: z.string().trim().min(1).max(60),
          })
          .refine((v) => v.end > v.start, { path: ["end"], message: "End must be after start." }),
      )
      .max(50),
  }),
});
export const updatePolicyDef: ActionDef<typeof policyInput, { message: string; slug: string }> = {
  name: "policy.update",
  input: policyInput,
  revalidate: (data) => [
    "/company/policy",
    "/company",
    "/holdings",
    "/discover",
    `/companies/${data.slug}`,
  ],
  handler: async (ctx, input) => {
    const sid = ctx.sandbox.id,
      company = await companies.find(ctx.tx, sid, input.companyId);
    if (!company) throw new NotFoundError();
    const auth = authorize(ctx.actor, "policy.update", {
      kind: "company",
      sandboxId: sid,
      companyOrgId: company.orgId,
      accessGrant: "none",
    });
    if (!auth.ok) return auth;
    const prev = await consoles.policyForUpdate(ctx.tx, sid, company.id);
    if (!prev) throw new NotFoundError();
    const investorOrgs = await consoles.investorOrgs(ctx.tx, sid);
    if (input.policy.blockedOrgIds.some((id) => !investorOrgs.some((org) => org.id === id)))
      return err(
        validation([
          {
            field: "policy.blockedOrgIds",
            message: "Choose an investor organisation in this sandbox.",
          },
        ]),
      );
    const p = input.policy;
    const next = await consoles.savePolicy(ctx.tx, sid, prev, {
      companyId: company.id,
      rofrDays: p.rofrDays,
      fundingDays: p.fundingDays,
      minLot: BigInt(p.minLot),
      lockupMonths: p.lockupMonths,
      yearlyCapBps: p.yearlyLimit * 100,
      allowedBuyerTypes: [...new Set(p.allowedBuyerTypes)],
      blockedOrgIds: [...new Set(p.blockedOrgIds)],
      priceVisibility: p.priceVisibility,
      blackoutWindows: p.blackoutWindows.map((w) => ({
        ...w,
        start: new Date(`${w.start}T00:00:00+04:00`).toISOString(),
        end: new Date(`${w.end}T00:00:00+04:00`).toISOString(),
      })),
    });
    await appendAudit(ctx, {
      action: "policy.update",
      entity: "company",
      entityId: company.id,
      before: prev,
      after: next,
    });
    return ok({ message: "Transfer policy updated.", slug: company.slug });
  },
};
export const updatePolicy = defineAction(updatePolicyDef);
