import { Circle, CircleCheck, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Figure } from "@/components/atlas/figure";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { Button } from "@/components/ui/button";
import { getTradeRoomModel } from "@/server/read/trades";
import { getViewer } from "@/server/viewer";
import { TradeMore } from "./_components/actions";
import { Messages } from "./_components/messages";
import { NextStep, PaymentInstructions } from "./_components/next-step";
import { Timeline } from "./_components/timeline";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    model = await getTradeRoomModel(await getViewer(), id);
  if (!model) notFound();
  return (
    <div className="flex flex-col gap-6 min-w-0">
      <PageHeader
        breadcrumbs={[{ label: "Trades", href: "/trades" }, { label: model.ref }]}
        title={`Trade ${model.ref}`}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <span className="type-body text-ink-muted">
              {model.company} · {model.shareClass} shares
            </span>
            <StatusBadge tone={model.badge.tone}>{model.badge.text}</StatusBadge>
            {model.yourMove && <StatusBadge tone="warning">Your move</StatusBadge>}
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-3">
            {model.listing && (
              <Button variant="link" asChild>
                <Link href={model.listing.href}>Listing {model.listing.ref}</Link>
              </Button>
            )}
            <TradeMore tradeId={model.id} items={model.more} />
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Figure label="Quantity" value={model.summary.quantity} />
        <Figure label="Price per share" value={model.summary.price} />
        <Figure label="Total" value={model.summary.total} />
        <Figure
          label="Escrow reference"
          value={<span className="type-mono break-all">{model.summary.escrowRef}</span>}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 flex flex-col gap-6">
          <NextStep model={model} />
          <Timeline steps={model.timeline} now={model.now} />
          <Messages model={model} />
        </div>
        <div className="min-w-0 flex flex-col gap-6">
          <SectionCard title="Parties">
            <dl className="flex flex-col gap-4 type-body-sm">
              {Object.entries(model.parties).map(([key, value]) => (
                <div key={key}>
                  <dt className="type-label text-ink-muted capitalize">{key}</dt>
                  <dd className="mt-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
          <SectionCard title="Checklist">
            <ul className="flex flex-col gap-3">
              {model.checklist.map((item) => {
                const Icon = item.done ? CircleCheck : Circle;
                return (
                  <li key={item.label} className="flex gap-2 items-center type-body-sm">
                    <Icon
                      size={16}
                      strokeWidth={1.5}
                      aria-hidden
                      className={item.done ? "text-success shrink-0" : "text-line-strong shrink-0"}
                    />
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </SectionCard>
          <SectionCard title="Escrow">
            {model.operatorPayment && <PaymentInstructions summary={model.summary} />}
            <ul className="flex flex-col gap-3">
              {model.escrow.events.map((event) => (
                <li key={event.id}>
                  <p className="type-body-sm">{event.label}</p>
                  <p className="type-body-sm text-ink-muted">{event.at}</p>
                </li>
              ))}
            </ul>
            <p className="type-body-sm text-ink-muted">{model.escrow.held}</p>
          </SectionCard>
          <SectionCard title="Documents">
            {!model.documents.length && (
              <p className="type-body-sm text-ink-muted">
                Documents appear as the trade progresses.
              </p>
            )}
            {model.documents.map((d) => (
              <Link
                key={d.id}
                href={d.href}
                className="flex items-start gap-2 type-body-sm text-atlas-green hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
              >
                <FileText
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 text-ink-muted"
                  aria-hidden
                />
                {d.title}
              </Link>
            ))}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
