import Link from "next/link";
import { EmptyState } from "@/components/atlas/empty-state";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDiscoverModel } from "@/server/read/discover";
import { getViewer } from "@/server/viewer";
export const metadata = { title: "Discover" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer(),
    raw = await searchParams,
    model = await getDiscoverModel(viewer, raw);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Discover"
        meta={
          <p className="type-body text-ink-muted">
            Private companies whose shares you can buy on Atlas.
          </p>
        }
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <form
            method="get"
            className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-5"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="sector-filter" className="type-label text-ink-muted">
                Sector
              </label>
              <Select name="sector" defaultValue={model.filters.sector || "all"}>
                <SelectTrigger id="sector-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sectors</SelectItem>
                  {model.sectors.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="stage-filter" className="type-label text-ink-muted">
                Stage
              </label>
              <Select name="stage" defaultValue={model.filters.stage || "all"}>
                <SelectTrigger id="stage-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {model.stages.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 type-body-sm">
              <input
                type="checkbox"
                name="open"
                defaultChecked={model.filters.open}
                className="accent-atlas-green"
              />
              Open listings only
            </label>
            {model.mandates.length > 0 && (
              <label className="flex items-center gap-2 type-body-sm">
                <input
                  type="checkbox"
                  name="matchesMandates"
                  defaultChecked={model.filters.matches}
                  className="accent-atlas-green"
                />
                Matches my mandates
              </label>
            )}
            <Button type="submit" variant="secondary">
              Apply
            </Button>
            <Button variant="link" asChild>
              <Link href="/discover">Clear</Link>
            </Button>
          </form>
          <SectionCard title="Companies" aside={`${model.companies.length} companies`} flush>
            {model.companies.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "Company",
                      "Last round",
                      "Round price",
                      "Fair value (ordinary)",
                      "Open listings",
                      "Mandates",
                      "Action",
                    ].map((x) => (
                      <TableHead key={x}>{x}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.companies.map((c) => (
                    <TableRow key={c.slug}>
                      <TableCell>
                        <Link
                          href={`/companies/${c.slug}`}
                          className="type-title text-atlas-green hover:underline"
                        >
                          {c.name}
                        </Link>
                        <div className="type-body-sm text-ink-muted">
                          {c.sector} · {c.stage}
                        </div>
                      </TableCell>
                      <TableCell>{c.lastRound}</TableCell>
                      <TableCell className="text-right type-figure">{c.roundPrice}</TableCell>
                      <TableCell className="text-right">{c.fairValue}</TableCell>
                      <TableCell className="text-right">{c.openListings}</TableCell>
                      <TableCell>
                        {c.matches && <StatusBadge tone="success">Matches</StatusBadge>}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/companies/${c.slug}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No companies match these filters."
                action={
                  <Button asChild variant="link">
                    <Link href="/discover">Clear filters</Link>
                  </Button>
                }
              />
            )}
          </SectionCard>
        </div>
        {model.mandates.length > 0 && (
          <SectionCard title="Your mandates" aside="Used for alerts and matching">
            <div className="flex flex-col gap-4">
              {model.mandates.map((m) => (
                <div key={m.name} className="border-b border-line pb-4 last:border-0 last:pb-0">
                  <h3 className="type-title">{m.name}</h3>
                  <p className="type-body-sm text-ink-muted">{m.sectors}</p>
                  <p className="type-body-sm text-ink-muted">{m.stages}</p>
                  <p className="type-body-sm">{m.ticket}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
