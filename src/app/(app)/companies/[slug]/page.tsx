import { FileText, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/atlas/empty-state";
import { Figure } from "@/components/atlas/figure";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { VerifiedBadge, VerifiedMark } from "@/components/atlas/verified";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCompanyModel } from "@/server/read/company";
import { getViewer } from "@/server/viewer";
import { AskQuestion } from "./_components/ask-question";
import { BandChart } from "./_components/band-chart";
import { RequestAccessDialog } from "./_components/request-access-dialog";
import { ValueAtExit } from "./_components/value-at-exit";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const model = await getCompanyModel(await getViewer(), (await params).slug);
  return { title: { absolute: model ? `${model.name} · Atlas` : "Company · Atlas" } };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await getViewer(),
    { slug } = await params,
    model = await getCompanyModel(viewer, slug);
  if (!model) notFound();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Discover", href: "/discover" }, { label: model.name }]}
        title={model.name}
        meta={
          <>
            <span className="type-body text-ink-muted">{model.meta}</span>
            <VerifiedBadge>Company onboarded and verified</VerifiedBadge>
            {model.openListings && <StatusBadge tone="info">{model.openListings}</StatusBadge>}
            {model.matchingMandate && (
              <span className="rounded-sm bg-atlas-green-soft px-2 py-0.5 type-label text-ink">
                Matches your mandate “{model.matchingMandate}”
              </span>
            )}
          </>
        }
        actions={
          model.isBuyer ? (
            model.requestAccess ? (
              <RequestAccessDialog company={model.name} companyId={model.id} />
            ) : model.approvedAccess ? (
              <Button asChild variant="secondary">
                <Link href="#listings">View listings</Link>
              </Button>
            ) : null
          ) : null
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Last round price"
          value={model.stats.round.value}
          caption={model.stats.round.caption}
        />
        <Figure
          label="Fair-value band"
          verifiedHeader={model.stats.band.label}
          value={model.stats.band.value}
          caption={model.stats.band.caption}
        />
        <Figure
          label="Last Atlas trade"
          value={model.stats.last.value}
          caption={model.stats.last.caption}
        />
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
          <h2 className="type-label text-ink-muted">Transfer terms</h2>
          {model.stats.terms.map((t) => (
            <div key={t.label} className="flex justify-between gap-3 type-body-sm">
              <span className="text-ink-muted">{t.label}</span>
              <span className="text-right font-medium">{t.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard title="Price history" aside={model.chart.aside}>
          <BandChart model={model.chart} />
        </SectionCard>
        {model.exit && (
          <SectionCard title="Value at exit">
            <ValueAtExit steps={model.exit} />
          </SectionCard>
        )}
      </div>
      <SectionCard
        id="listings"
        title="Listings"
        aside={
          <span className="flex items-center gap-1">
            <Lock size={14} strokeWidth={1.5} />
            Sealed bids · reserve prices are never shown to buyers
          </span>
        }
        flush
      >
        {model.listings.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead className="hidden xl:table-cell">Share class</TableHead>
                <TableHead className="hidden xl:table-cell">Quantity</TableHead>
                <TableHead className="hidden xl:table-cell">Min fill</TableHead>
                <TableHead className="hidden xl:table-cell">Seller</TableHead>
                <TableHead className="hidden xl:table-cell">Bid window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.listings.map((l) => (
                <TableRow key={l.id} className={l.highlight ? "bg-atlas-green-soft" : undefined}>
                  <TableCell>
                    <span className="font-semibold whitespace-nowrap">{l.ref}</span>
                    <div className="type-body-sm text-ink-muted xl:hidden">{l.shareClass}</div>
                    <div className="type-body-sm text-ink-muted xl:hidden">
                      {l.quantity} · Min fill {l.minFill}
                    </div>
                    <div className="type-body-sm text-ink-muted xl:hidden">
                      {l.seller} · {l.window}
                    </div>
                    {l.ownBid && <div className="type-body-sm text-ink-muted">{l.ownBid}</div>}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">{l.shareClass}</TableCell>
                  <TableCell className="hidden text-right type-figure xl:table-cell">
                    {l.quantity}
                  </TableCell>
                  <TableCell className="hidden text-right xl:table-cell">{l.minFill}</TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {l.seller} <VerifiedMark label="Holding verified by company" />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">{l.window}</TableCell>
                  <TableCell>
                    <span className="flex gap-1">
                      {l.badges.map((b) => (
                        <StatusBadge key={b.text} tone={b.tone}>
                          {b.text}
                        </StatusBadge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {l.action ? (
                      <Button
                        variant={l.action.primary ? "primary" : "secondary"}
                        size="sm"
                        asChild
                      >
                        <Link href={l.action.href}>{l.action.label}</Link>
                      </Button>
                    ) : l.accessHint ? (
                      <span className="type-body-sm text-ink-muted">{l.accessHint}</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No open listings for this company right now." />
        )}
      </SectionCard>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title="Questions and answers"
          aside="Answers are visible to every approved buyer"
        >
          <div className="flex flex-col gap-4">
            {model.qa.map((q) => (
              <div
                key={q.id}
                className="flex flex-col gap-1 border-b border-line pb-4 last:border-0"
              >
                <p className="font-semibold">{q.question}</p>
                {q.answer ? (
                  <>
                    <p>{q.answer}</p>
                    <p className="type-body-sm text-ink-muted">{q.caption}</p>
                  </>
                ) : (
                  <StatusBadge tone="info" className="self-start">
                    Awaiting answer
                  </StatusBadge>
                )}
              </div>
            ))}
            {model.canAsk ? (
              <AskQuestion companyId={model.id} />
            ) : (
              <p className="type-body-sm text-ink-muted">
                Approved buyers can ask the company questions.
              </p>
            )}
          </div>
        </SectionCard>
        <SectionCard title="Info pack">
          {model.info.status === "none" ? (
            <>
              <p className="type-body-sm text-ink-muted">
                The company shares its financials and cap table with approved buyers under an NDA.
              </p>
              {model.isBuyer && (
                <RequestAccessDialog
                  company={model.name}
                  companyId={model.id}
                  variant="secondary"
                />
              )}
            </>
          ) : model.info.status === "pending" ? (
            <>
              <StatusBadge tone="info" className="self-start">
                Awaiting company approval
              </StatusBadge>
              <p className="type-body-sm text-ink-muted">Usually a few seconds in this demo.</p>
            </>
          ) : model.info.status === "denied" ? (
            <>
              <StatusBadge tone="danger" className="self-start">
                Access not granted
              </StatusBadge>
              <p className="type-body-sm text-ink-muted">{model.info.denial}</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <StatusBadge tone="success">Access approved</StatusBadge>
                <span className="type-body-sm text-ink-muted">{model.info.nda}</span>
              </div>
              {model.info.documents.length ? (
                model.info.documents.map((d) => (
                  <Link
                    key={d.id}
                    href={d.href}
                    className="flex items-center gap-2 rounded-md border border-line p-3 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    <FileText size={18} strokeWidth={1.5} />
                    <span className="min-w-0 flex-1 whitespace-normal break-normal">{d.title}</span>
                    <span className="type-body-sm text-ink-muted">{d.label}</span>
                  </Link>
                ))
              ) : (
                <p>The company hasn&apos;t shared documents yet.</p>
              )}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
