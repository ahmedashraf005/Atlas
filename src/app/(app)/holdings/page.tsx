import Link from "next/link";
import { EmptyState } from "@/components/atlas/empty-state";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { Button } from "@/components/ui/button";
import { getHoldingsModel } from "@/server/read/holdings";
import { getViewer } from "@/server/viewer";
import { AddHoldingDialog } from "./_components/add-holding-dialog";
import { HoldingCard } from "./_components/holding-card";
import { WithdrawListing } from "./_components/withdraw-listing";
export const metadata = { title: "Holdings" };
export default async function HoldingsPage() {
  const model = await getHoldingsModel(await getViewer());
  const add = model.canAdd ? (
    <AddHoldingDialog companies={model.companies} today={model.today} primary={model.addPrimary} />
  ) : undefined;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Holdings"
        meta={
          <p className="type-body text-ink-muted">
            Shares you can sell on Atlas. The company verifies every holding before it can be
            listed.
          </p>
        }
        actions={model.cards.length ? add : undefined}
      />
      {model.cards.length ? (
        <div className="space-y-4">
          {model.cards.map((h) => (
            <HoldingCard key={h.id} holding={h} />
          ))}
        </div>
      ) : (
        <EmptyState title="You don't hold any shares on Atlas yet." action={add} />
      )}
      {!!model.listings.length && (
        <SectionCard id="your-listings" title="Your listings" flush>
          <div className="overflow-x-auto">
            <table className="w-full type-body-sm text-left">
              <thead className="bg-surface-sunken type-label text-ink-muted">
                <tr>
                  {[
                    "Listing",
                    "Company",
                    "Quantity",
                    "Min fill",
                    "Reserve",
                    "Window",
                    "Bids",
                    "Status",
                    "Action",
                  ].map((t) => (
                    <th
                      key={t}
                      className={`px-3 py-3 whitespace-nowrap ${["Quantity", "Min fill", "Reserve"].includes(t) ? "text-right" : ""}`}
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.listings.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="px-3 py-3">
                      <Link
                        href={`/listings/${l.id}`}
                        className="font-semibold text-atlas-green hover:underline"
                      >
                        {l.ref}
                      </Link>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {l.company}
                      <p className="text-ink-muted">{l.shareClass}</p>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">{l.quantity}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">{l.minFill}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">{l.reserve}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{l.window}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{l.bids}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {l.badges.map((b) => (
                          <StatusBadge key={b.text} tone={b.tone}>
                            {b.text}
                          </StatusBadge>
                        ))}
                      </div>
                      {l.rejectionReason && (
                        <p className="type-body-sm text-danger mt-1">{l.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {l.action?.kind === "review" ? (
                        <Button
                          size="sm"
                          variant={l.action.primary ? "primary" : "secondary"}
                          asChild
                        >
                          <Link href={`/listings/${l.id}`}>Review bids</Link>
                        </Button>
                      ) : l.action?.kind === "withdraw" ? (
                        <WithdrawListing
                          listingId={l.id}
                          listingRef={l.ref}
                          quantity={l.quantityProse}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
