import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/atlas/empty-state";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type AuditParams, getAuditModel } from "@/server/read/audit";
import { getViewer } from "@/server/viewer";
import { TamperControl, VerifyControl } from "./_components/audit-controls";
export const metadata = { title: "Audit log" };
export default async function Page({ searchParams }: { searchParams: Promise<AuditParams> }) {
  const model = await getAuditModel(await getViewer(), await searchParams);
  if (!model) notFound();
  return (
    <>
      <PageHeader
        title="Audit log"
        meta={
          <p className="type-body text-ink-muted max-w-3xl">
            Every change in this sandbox, in order. Each entry's hash covers the entry and the
            previous hash, so editing or deleting any entry breaks the chain.
          </p>
        }
        actions={<TamperControl />}
      />
      <SectionCard title="Chain integrity">
        <output
          aria-live="polite"
          className={`type-title ${model.verified ? "text-success" : "text-danger"}`}
        >
          {model.status}
        </output>
        <VerifyControl />
        <p className="type-body-sm text-ink-muted">hash(n) = SHA-256( hash(n − 1) + entry(n) )</p>
      </SectionCard>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="entity">Entity kind</Label>
          <select
            id="entity"
            name="entity"
            defaultValue={model.filters.entity}
            className="h-10 rounded-sm border border-line-strong bg-surface px-3 type-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <option value="">All entities</option>
            {["holding", "listing", "bid", "trade", "company", "sandbox"].map((v) => (
              <option key={v} value={v}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="action">Action search</Label>
          <Input id="action" name="action" defaultValue={model.filters.action} maxLength={100} />
        </div>
        <Button variant="secondary">Apply</Button>
        <Button variant="link" asChild>
          <Link href="/ops/audit">Clear</Link>
        </Button>
      </form>
      <SectionCard
        title="Entries"
        aside={`${model.count} entries · Page ${model.page} of ${model.pages}`}
        flush
      >
        {model.entries.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {["Entry", "Time", "Actor", "Action", "Entity", "Hash and changes"].map((s) => (
                  <TableHead key={s}>{s}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.entries.map((e) => (
                <TableRow key={e.seq}>
                  <TableCell>#{e.seq}</TableCell>
                  <TableCell>{e.at}</TableCell>
                  <TableCell className="whitespace-normal min-w-48">{e.actor}</TableCell>
                  <TableCell>{e.action}</TableCell>
                  <TableCell>
                    {e.href ? (
                      <Link className="text-atlas-green hover:underline" href={e.href}>
                        {e.entity}
                      </Link>
                    ) : (
                      <span className="type-mono">{e.entity}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal min-w-64 max-w-96 py-3">
                    <details>
                      <summary className="cursor-pointer type-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                        {e.shortHash}…
                      </summary>
                      <div className="mt-3 flex flex-col gap-2 type-mono type-body-sm break-all">
                        {e.diff.length ? (
                          e.diff.map((d) => (
                            <p key={d.field}>
                              {d.field}: {d.from} → {d.to}
                            </p>
                          ))
                        ) : (
                          <p>No snapshot changes.</p>
                        )}
                        <p>Hash: {e.hash}</p>
                        <p>Previous hash: {e.prevHash}</p>
                      </div>
                    </details>
                    {e.changed && <StatusBadge tone="danger">Changed after writing</StatusBadge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No entries match." />
        )}
      </SectionCard>
      <nav aria-label="Audit pages" className="flex gap-3">
        {model.previous && (
          <Button variant="secondary" asChild>
            <Link href={model.previous}>Previous</Link>
          </Button>
        )}
        {model.next && (
          <Button variant="secondary" asChild>
            <Link href={model.next}>Next</Link>
          </Button>
        )}
      </nav>
    </>
  );
}
