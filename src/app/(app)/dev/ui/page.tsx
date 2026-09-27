import { Inbox } from "lucide-react";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/atlas/coming-soon";
import { DateText } from "@/components/atlas/date-text";
import { Deadline } from "@/components/atlas/deadline";
import { EmptyState } from "@/components/atlas/empty-state";
import { Figure } from "@/components/atlas/figure";
import { Money, Shares } from "@/components/atlas/money";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge, type Tone } from "@/components/atlas/status-badge";
import { VerifiedBadge, VerifiedMark } from "@/components/atlas/verified";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFlags } from "@/env";
import { fixedClock } from "@/lib/clock";
import { formatMoney, formatShares } from "@/lib/format";
import tokens from "../../../../../docs/design/tokens.json";
import { formattingExamples } from "./_components/formatting-examples";
import { ButtonExamples, FormExamples, OverlayExamples } from "./_components/interactive-examples";

export const metadata = { title: "UI showcase" };
export const dynamic = "force-dynamic";

const typeClasses: Record<string, string> = {
  display: "type-display",
  "heading-1": "type-heading-1",
  "heading-2": "type-heading-2",
  title: "type-title",
  body: "type-body",
  "body-sm": "type-body-sm",
  label: "type-label",
  "figure-lg": "type-figure-lg",
  figure: "type-figure",
  mono: "type-mono",
};
const statuses: [Tone, string][] = [
  ["neutral", "Draft"],
  ["info", "Live"],
  ["warning", "Countered"],
  ["success", "Settled"],
  ["danger", "Cancelled"],
];

export default function UiPage() {
  if (process.env.NODE_ENV === "production" && !getFlags().devUi) notFound();
  const clock = fixedClock("2026-09-25T10:30:00Z");
  const now = clock.now();
  const at = (hours: number) => new Date(now.getTime() + hours * 3600000);
  return (
    <>
      <PageHeader
        title="UI showcase"
        breadcrumbs={[{ label: "Atlas", href: "/" }, { label: "UI showcase" }]}
        meta={
          <span className="type-body-sm text-ink-muted">
            Atlas design system · fictional examples
          </span>
        }
      />
      <SectionCard id="colours" title="Colours">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {tokens.color.tokens.map((token) => (
            <div key={token.name} className="flex items-start gap-3">
              <div
                className="size-12 shrink-0 border border-line rounded-sm"
                style={{ background: `var(--${token.name})` }}
              />
              <div>
                <p className="type-mono">{token.name}</p>
                <p className="type-body-sm text-ink-muted">{token.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard id="typography" title="Typography">
        <div className="flex flex-col gap-6">
          {tokens.type.groups
            .flatMap((group) => group.styles)
            .map((style) => (
              <div key={style.name} className="min-w-0">
                <p className="mb-2 type-mono text-ink-muted">type-{style.name}</p>
                <p className={typeClasses[style.name]}>{style.sample}</p>
              </div>
            ))}
        </div>
      </SectionCard>
      <SectionCard id="buttons" title="Buttons">
        <ButtonExamples />
      </SectionCard>
      <SectionCard id="badges" title="Status and verification">
        <div className="flex flex-wrap items-center gap-3">
          {statuses.map(([tone, label]) => (
            <StatusBadge key={tone} tone={tone}>
              {label}
            </StatusBadge>
          ))}
          <VerifiedBadge>Company onboarded and verified</VerifiedBadge>
          <VerifiedMark label="Holding verified by company" />
        </div>
      </SectionCard>
      <SectionCard id="formatting" title="Formatting" flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Call</TableHead>
              <TableHead>Output</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formattingExamples(now).map(([call, result]) => (
              <TableRow key={call}>
                <TableCell>
                  <code className="type-mono">{call}</code>
                </TableCell>
                <TableCell className="tabular-nums">{result}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-5 py-4 type-body-sm text-ink-muted">
          DateText: <DateText date={now} withTime />
        </div>
      </SectionCard>
      <SectionCard id="deadlines" title="Deadlines">
        <div className="flex flex-col gap-3">
          {[120, 20, 0.75, -2].map((hours) => (
            <Deadline
              key={hours}
              at={at(hours)}
              now={now}
              prefix={hours >= 20 ? "Closes" : undefined}
            />
          ))}
        </div>
      </SectionCard>
      <SectionCard id="figures" title="Figures">
        <div className="grid gap-4 md:grid-cols-2 min-[90rem]:grid-cols-[1fr_1.2fr_1fr_1fr]">
          <Figure
            label="Last round price"
            value={<Money minor={4200n} currency="AED" mode="perShare" />}
            caption="Series B preferred · Mar 2026"
          />
          <Figure
            label="Fair-value band"
            verifiedHeader="Fair-value band · ordinary shares"
            value={`${formatMoney(3310n, "AED", "perShare")}–${formatMoney(3740n, "AED", "perShare").slice(4)}`}
            caption="From 6 trades in the last 180 days"
          />
          <Figure
            label="Last Atlas trade"
            value={<Money minor={3580n} currency="AED" mode="perShare" />}
            caption={
              <>
                {formatShares(4000n, "prose").replace("shares", "ordinary shares")} ·{" "}
                <DateText date="2026-09-12T10:30:00Z" />
              </>
            }
          />
          <Figure
            label="Transfer terms"
            caption={
              <dl className="flex flex-col gap-2">
                {[
                  ["Right of first refusal", "30 days"],
                  ["Minimum lot", <Shares key="lot" qty={1000n} style="table" />],
                  ["Buyer joinder", "Required"],
                ].map(([label, value]) => (
                  <div className="flex justify-between gap-3" key={String(label)}>
                    <dt>{label}</dt>
                    <dd className="font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            }
          />
        </div>
      </SectionCard>
      <SectionCard id="table" title="Table">
        <SectionCard title="Listings" flush aside="Fictional examples">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Listing",
                  "Share class",
                  "Quantity",
                  "Min fill",
                  "Seller",
                  "Bid window",
                  "Status",
                  "Action",
                ].map((label) => (
                  <TableHead
                    key={label}
                    className={
                      ["Quantity", "Min fill", "Action"].includes(label) ? "text-right" : undefined
                    }
                  >
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-atlas-green-soft">
                <TableCell>
                  <div className="font-semibold">L-2019</div>
                  <div className="type-label text-ink-muted">
                    Your bid · <Money minor={3400n} currency="AED" mode="perShare" />
                  </div>
                </TableCell>
                <TableCell>Ordinary</TableCell>
                <TableCell className="text-right tabular-nums">
                  <Shares qty={3000n} style="table" />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Shares qty={1000n} style="table" />
                </TableCell>
                <TableCell>Holder #S-102</TableCell>
                <TableCell>
                  Closed <DateText date="2026-09-23T10:30:00Z" />
                </TableCell>
                <TableCell>
                  <StatusBadge tone="warning">
                    Countered at {formatMoney(3550n, "AED", "perShare")} · 41h left
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  {/* TODO(segment-5): respond to counter */}
                  <Button size="sm" disabled>
                    Respond
                  </Button>
                </TableCell>
              </TableRow>
              {(
                [
                  { id: "L-2031", qty: 12000n, min: 2000n, holder: "Holder #S-214", hours: 120 },
                  { id: "L-2027", qty: 5500n, min: null, holder: "Holder #S-198", hours: 20 },
                ] as const
              ).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.id}</TableCell>
                  <TableCell>Ordinary</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Shares qty={row.qty} style="table" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.min ? <Shares qty={row.min} style="table" /> : "All or none"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      {row.holder}
                      <VerifiedMark label="Holding verified by company" />
                    </span>
                  </TableCell>
                  <TableCell>
                    <Deadline at={at(row.hours)} now={now} prefix="Closes" />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <StatusBadge tone="info">Live</StatusBadge>
                      {row.hours < 48 && <StatusBadge tone="warning">Closing soon</StatusBadge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {/* TODO(segment-5): place a bid */}
                    <Button variant="secondary" size="sm" disabled>
                      Bid
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </SectionCard>
      <SectionCard id="forms" title="Form controls">
        <FormExamples />
      </SectionCard>
      <SectionCard id="overlays" title="Overlays">
        <OverlayExamples />
      </SectionCard>
      <SectionCard id="states" title="Empty and loading">
        <EmptyState
          icon={<Inbox strokeWidth={1.5} aria-hidden />}
          title="No examples to show"
          description="An empty state gives the next step in plain language."
        />
        <ComingSoon page="Example placeholder" segment={3} />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </SectionCard>
    </>
  );
}
