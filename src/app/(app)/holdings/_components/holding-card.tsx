import { Users } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/atlas/status-badge";
import { VerifiedBadge } from "@/components/atlas/verified";
import { Button } from "@/components/ui/button";
import type { HoldingCardModel } from "@/server/read/holdings";
import { EligibilityPanel } from "./eligibility-panel";

export function HoldingCard({ holding }: { holding: HoldingCardModel }) {
  return (
    <section
      aria-label={`${holding.company} holding`}
      data-holding-id={holding.id}
      className="min-w-0 rounded-md border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="type-title">
            <Link href={`/companies/${holding.slug}`} className="text-atlas-green hover:underline">
              {holding.company}
            </Link>
          </h2>
          <p className="type-body-sm text-ink-muted">{holding.shareClass} shares</p>
        </div>
        {holding.status === "Verified" ? (
          <VerifiedBadge>Verified by {holding.company}</VerifiedBadge>
        ) : (
          <StatusBadge
            tone={
              holding.status === "PendingCompany"
                ? "info"
                : holding.status === "Rejected"
                  ? "danger"
                  : "neutral"
            }
          >
            {holding.status === "PendingCompany"
              ? "Awaiting company verification"
              : holding.status === "Rejected"
                ? "Rejected"
                : "Not submitted"}
          </StatusBadge>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
        {holding.quantities.map((q) => (
          <div key={q.label} className="min-w-0">
            <dt className="type-label text-ink-muted">{q.label}</dt>
            <dd className="type-figure mt-1">{q.value}</dd>
          </div>
        ))}
      </dl>
      <EligibilityPanel holding={holding} />
      {holding.market && (
        <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 pb-5 type-body-sm">
          <p>{holding.market.reference}</p>
          <p className="flex items-center gap-2">
            <Users className="size-4 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
            {holding.market.demand}
          </p>
        </div>
      )}
      {holding.eligible && (
        <div className="px-5 pb-5">
          <Button variant="secondary" asChild>
            <Link href={`/holdings/${holding.id}/list`}>List shares</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
