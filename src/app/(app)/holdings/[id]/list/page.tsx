import { Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/atlas/empty-state";
import { Figure } from "@/components/atlas/figure";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { Button } from "@/components/ui/button";
import { getCreateListingModel } from "@/server/read/create-listing";
import { getViewer } from "@/server/viewer";
import { CreateListingForm } from "./_components/create-listing-form";
export default async function CreateListingPage({ params }: { params: Promise<{ id: string }> }) {
  const model = await getCreateListingModel(await getViewer(), (await params).id);
  if (!model) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title="List shares"
        breadcrumbs={[
          { label: "Holdings", href: "/holdings" },
          { label: `List ${model.company} shares` },
        ]}
      />
      {!model.eligible ? (
        <EmptyState
          title="You can't list these shares yet."
          description={model.failures.join(" ")}
          action={
            <Button variant="secondary" asChild>
              <Link href="/holdings">Back to holdings</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr] min-w-0">
          <CreateListingForm model={model} />
          <SectionCard title="Market context">
            <Figure
              label="Last round price"
              value={model.market.round}
              caption={model.market.roundCaption}
            />
            <Figure
              label={`${model.market.fairHeader} · ${model.shareClass}`}
              verifiedHeader={
                model.market.fairHeader === "Fair-value band"
                  ? `Fair-value band · ${model.shareClass}`
                  : undefined
              }
              value={model.market.fairValue}
              caption={model.market.fairCaption}
            />
            <Figure
              label="Last Atlas trade"
              value={model.market.last}
              caption={model.market.lastCaption}
            />
            <p className="flex items-start gap-2 type-body-sm">
              <Users className="size-4 shrink-0 text-ink-muted" strokeWidth={1.5} aria-hidden />
              {model.market.demand}
            </p>
            <p className="type-body-sm text-ink-muted">
              Reference prices help you set a reserve. They don&apos;t limit what buyers can bid.
            </p>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
