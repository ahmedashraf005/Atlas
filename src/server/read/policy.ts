import "server-only";
import { formatDate, formatShares } from "@/lib/format";
import { INVESTOR_LABELS, VISIBILITY_LABELS } from "@/lib/policy-display";
import { type Db, getDb } from "@/server/db/client";
import { ownCompany } from "@/server/read/consoles";
import * as companies from "@/server/repositories/companies";
import * as consoles from "@/server/repositories/consoles";
import type { Viewer } from "@/server/viewer";
export async function getPolicyModel(viewer: Viewer, database?: Db) {
  const db = database ?? (await getDb()),
    company = await ownCompany(db, viewer);
  if (!company) return null;
  const p = await companies.policy(db, viewer.sandboxId, company.id),
    orgs = await consoles.investorOrgs(db, viewer.sandboxId);
  const groups = [
    {
      title: "Transfer periods",
      rules: [
        {
          label: "Right of first refusal",
          value: `${p.rofrDays} days`,
          explanation:
            "After both parties sign, you have this long to buy the shares yourself at the agreed price.",
        },
        {
          label: "Funding period",
          value: `${p.fundingDays} days`,
          explanation: "Buyers must pay into escrow within this period after your ROFR decision.",
        },
      ],
    },
    {
      title: "Shareholder limits",
      rules: [
        {
          label: "Minimum lot",
          value: formatShares(p.minLot, "prose"),
          explanation: "The smallest listing or fill allowed.",
        },
        {
          label: "Lock-up",
          value: `${p.lockupMonths} months`,
          explanation: "Shareholders can't sell until this long after acquiring their shares.",
        },
        {
          label: "Yearly limit",
          value: `${p.yearlyCapBps / 100}%`,
          explanation: "The share of a holding a shareholder can sell in any 12 months.",
        },
        {
          label: "Blackout windows",
          value:
            p.blackoutWindows
              .map((w) => `${formatDate(w.start)} – ${formatDate(w.end)} · ${w.label}`)
              .join("; ") || "None",
          explanation: "Sales are paused during these periods (e.g. a funding round).",
        },
      ],
    },
    {
      title: "Buyer access and visibility",
      rules: [
        {
          label: "Eligible buyers",
          value: p.allowedBuyerTypes.map((t) => INVESTOR_LABELS[t]).join(", "),
          explanation: "Only these professional investor types can request access and bid.",
        },
        {
          label: "Restricted organisations",
          value:
            orgs
              .filter((o) => p.blockedOrgIds.includes(o.id))
              .map((o) => o.name)
              .join(", ") || "None",
          explanation: "These organisations can't see your information or bid.",
        },
        {
          label: "Who sees trade prices",
          value: VISIBILITY_LABELS[p.priceVisibility],
          explanation: "Public round information remains available to everyone.",
        },
      ],
    },
  ];
  const dateInput = (d: Date) => new Date(d.getTime() + 4 * 3600000).toISOString().slice(0, 10);
  return {
    companyId: company.id,
    name: company.name,
    groups,
    orgs: orgs.map((o) => ({ id: o.id, name: o.name })),
    initial: {
      rofrDays: String(p.rofrDays),
      fundingDays: String(p.fundingDays),
      minLot: p.minLot.toString(),
      lockupMonths: String(p.lockupMonths),
      yearlyLimit: String(p.yearlyCapBps / 100),
      allowedBuyerTypes: p.allowedBuyerTypes,
      blockedOrgIds: p.blockedOrgIds,
      priceVisibility: p.priceVisibility,
      blackoutWindows: p.blackoutWindows.map((w) => ({
        start: dateInput(w.start),
        end: dateInput(w.end),
        label: w.label,
      })),
    },
  };
}
