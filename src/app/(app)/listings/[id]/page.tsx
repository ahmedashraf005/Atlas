import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WithdrawListing } from "@/app/(app)/holdings/_components/withdraw-listing";
import { Deadline } from "@/components/atlas/deadline";
import { EmptyState } from "@/components/atlas/empty-state";
import { Figure } from "@/components/atlas/figure";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { getListingModel } from "@/server/read/listing";
import { getViewer } from "@/server/viewer";
import { BidLadder } from "./_components/bid-ladder";
import { CompetingBid } from "./_components/competing-bid";
export const metadata = { title: "Listing" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const m = await getListingModel(await getViewer(), (await params).id);
  if (!m) notFound();
  if (m.redirect !== null) redirect(m.redirect);
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Holdings", href: "/holdings" }, { label: m.ref }]}
        title={`Listing ${m.ref}`}
        meta={
          <>
            <span className="type-body text-ink-muted">
              {m.company} · {m.shareClass}
            </span>
            <StatusBadge tone={m.badge.tone}>{m.badge.text}</StatusBadge>
            <span className="type-body-sm">
              {m.closesAt ? (
                <Deadline at={m.closesAt} now={m.now} prefix="Closes" />
              ) : (
                m.closedLabel
              )}
            </span>
          </>
        }
        actions={
          m.canWithdraw ? (
            <WithdrawListing listingId={m.id} listingRef={m.ref} quantity={m.quantityProse} />
          ) : undefined
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Figure label="Quantity" value={m.quantity} />
        <Figure label="Minimum fill" value={m.minFill} />
        <Figure label="Reserve" value={m.reserve} />
        <Figure label="Bids" value={m.bidLabel} />
      </div>
      {["Draft", "InReview"].includes(m.status) && (
        <EmptyState title="Awaiting Atlas review. Usually a few seconds in this demo." />
      )}
      {m.status === "Live" && (
        <SectionCard title="Sealed bids">
          <p className="type-body">
            {m.bidCount} bids received. They stay sealed until the window closes on {m.closeLabel}.
          </p>
          {m.editable && <CompetingBid listingId={m.id} />}
        </SectionCard>
      )}
      {["Closed", "Negotiating"].includes(m.status) && <BidLadder model={m} />}
      {["Allocated", "Completed"].includes(m.status) && (
        <SectionCard title="Trades" flush>
          <div className="overflow-x-auto">
            <table className="w-full type-body-sm">
              <thead className="bg-surface-sunken type-label text-ink-muted">
                <tr>
                  {["Trade", "Buyer", "Quantity", "Price", "Total", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.trades.map((t) => (
                  <tr key={t.id} className="border-t border-line">
                    <td className="px-5 py-4">
                      <Link
                        href={`/trades/${t.id}`}
                        className="text-atlas-green font-semibold hover:underline"
                      >
                        {t.ref}
                      </Link>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {t.buyer}
                      <p className="text-ink-muted">{t.handle}</p>
                    </td>
                    {[t.quantity, t.price, t.total].map((value, i) => (
                      <td
                        key={["qty", "price", "total"][i]}
                        className="px-5 py-4 text-right whitespace-nowrap"
                      >
                        {value}
                      </td>
                    ))}
                    <td className="px-5 py-4">
                      <StatusBadge tone={t.statusTone}>{t.statusLabel}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {m.backup && <p className="px-5 py-4 type-body-sm text-ink-muted">{m.backup}</p>}
        </SectionCard>
      )}
      {["Expired", "Withdrawn", "Rejected"].includes(m.status) && (
        <EmptyState title={m.reason} description="Your shares are available again." />
      )}
    </>
  );
}
