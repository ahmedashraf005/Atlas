import Link from "next/link";
import { notFound } from "next/navigation";
import { Deadline } from "@/components/atlas/deadline";
import { EmptyState } from "@/components/atlas/empty-state";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { VerifiedMark } from "@/components/atlas/verified";
import { Button } from "@/components/ui/button";
import { getBidComposerModel } from "@/server/read/bids";
import { getViewer } from "@/server/viewer";
import { BidForm } from "./_components/bid-form";
export const metadata = { title: "Place a bid" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const m = await getBidComposerModel(await getViewer(), (await params).id);
  if (!m) notFound();
  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Discover", href: "/discover" },
          { label: m.company, href: m.companyHref },
          { label: `Bid on ${m.ref}` },
        ]}
        title={m.mode === "amend" ? "Amend your bid" : "Place a bid"}
        meta={
          <span className="type-body text-ink-muted">
            {m.company} · {m.ref}
          </span>
        }
      />
      {m.blocked.length ? (
        <EmptyState
          title={m.blocked[0] ?? "Bidding unavailable"}
          description={m.blocked.slice(1).join(" ")}
          action={
            <Button asChild variant="secondary">
              <Link href={m.companyHref}>Back to {m.company}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[2fr_1fr]">
          <SectionCard title="Your bid">
            <BidForm model={m} />
          </SectionCard>
          <aside className="flex min-w-0 flex-col gap-6">
            <SectionCard title="Listing">
              <p className="type-title flex items-center gap-2">
                {m.seller}
                <VerifiedMark label="Holding verified by company" />
              </p>
              <dl className="type-body-sm flex flex-col gap-3">
                {[
                  ["Share class", m.shareClass],
                  ["Quantity", m.quantity],
                  ["Minimum fill", m.minFill],
                  ["Reserve price", "Hidden"],
                  ["Right of first refusal", m.rofrDays],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
              {m.closesAt && (
                <div className="type-body-sm">
                  <Deadline at={m.closesAt} now={m.now} prefix="Closes" />
                </div>
              )}
            </SectionCard>
            <SectionCard title="Market context">
              <dl className="type-body-sm flex flex-col gap-3">
                {[
                  ["Last round", `${m.market.roundName} · ${m.market.round}`],
                  ["Fair value", m.market.fairValue],
                  ["Last Atlas trade", m.market.lastTrade],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          </aside>
        </div>
      )}
    </>
  );
}
