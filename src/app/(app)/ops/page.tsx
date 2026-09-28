import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/atlas/empty-state";
import { Figure } from "@/components/atlas/figure";
import { PageHeader } from "@/components/atlas/page-header";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getOpsConsoleModel } from "@/server/read/consoles";
import { getViewer } from "@/server/viewer";
import { Activity } from "../company/_components/activity";
import { DecisionControl } from "../company/_components/decision-control";
export const metadata = { title: "Operations" };
export default async function Page() {
  const model = await getOpsConsoleModel(await getViewer());
  if (!model) notFound();
  return (
    <>
      <PageHeader
        title="Operations"
        meta={
          <p className="type-body text-ink-muted">
            Review listings, move money safely and keep the record straight.
          </p>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {model.figures.map((f) => (
          <Figure key={f.label} {...f} />
        ))}
      </div>
      <SectionCard title="Listing review" flush>
        {!model.review.length ? (
          <div className="p-5 pt-0">
            <EmptyState title="Nothing to review." />
            {model.autopilot && (
              <p className="type-body-sm text-ink-muted">
                Auto-pilot approves listings within seconds. Turn it off in the toolbar to review
                them yourself.
              </p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Listing",
                  "Company",
                  "Seller",
                  "Quantity",
                  "Min fill",
                  "Reserve",
                  "Window",
                  "Submitted",
                  "Policy",
                  "Actions",
                ].map((s) => (
                  <TableHead key={s}>{s}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.review.map((l, i) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link className="text-atlas-green hover:underline" href={`/listings/${l.id}`}>
                      {l.ref}
                    </Link>
                  </TableCell>
                  <TableCell>{l.company}</TableCell>
                  <TableCell>{l.seller}</TableCell>
                  <TableCell className="text-right">{l.quantity}</TableCell>
                  <TableCell className="text-right">{l.minFill}</TableCell>
                  <TableCell className="text-right">{l.reserve}</TableCell>
                  <TableCell>{l.window}</TableCell>
                  <TableCell>{l.submitted}</TableCell>
                  <TableCell className="whitespace-normal min-w-48">
                    <StatusBadge tone={l.policyOk ? "success" : "danger"}>
                      {l.policyOk ? "Policy check passed" : l.failures.join(" ")}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 py-3">
                      <DecisionControl
                        action="approveListing"
                        values={{ listingId: l.id }}
                        label="Approve"
                        primary={i === 0}
                      />
                      <DecisionControl
                        action="rejectListing"
                        values={{ listingId: l.id }}
                        label="Reject listing"
                        reason
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <SectionCard title="Escrow and release" flush>
        {model.money.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {["Trade", "Company", "Amount", "State", "Action"].map((s) => (
                  <TableHead key={s}>{s}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.money.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.ref}</TableCell>
                  <TableCell>{t.company}</TableCell>
                  <TableCell className="text-right">{t.total}</TableCell>
                  <TableCell>
                    {t.state}
                    {t.approved && (
                      <p className="type-body-sm text-ink-muted">
                        You approved — waiting for a second operator
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/trades/${t.id}`}>Open trade</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No money movements waiting." />
        )}
      </SectionCard>
      <SectionCard title="Disputes" flush>
        {model.disputes.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trade</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.disputes.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.ref}</TableCell>
                  <TableCell>{t.company}</TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="block max-w-64 truncate text-left focus-visible:outline-2 focus-visible:outline-focus-ring"
                        >
                          {t.reason}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t.reason}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/trades/${t.id}`}>Open trade</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No open disputes." />
        )}
      </SectionCard>
      <SectionCard title="Flagged messages" flush>
        {model.flagged.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {["Time", "Trade", "Sender", "Category", "Message"].map((s) => (
                  <TableHead key={s}>{s}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.flagged.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.at}</TableCell>
                  <TableCell>
                    {m.href && (
                      <Link className="text-atlas-green hover:underline" href={m.href}>
                        {m.trade}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>{m.sender}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1 py-2">
                      {m.contact && (
                        <StatusBadge tone="warning">Contact details removed</StatusBadge>
                      )}
                      {m.payment && <StatusBadge tone="danger">Payment change</StatusBadge>}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal min-w-48 max-w-80 break-words">
                    {m.excerpt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No flagged messages." />
        )}
      </SectionCard>
      <SectionCard
        title="Recent activity"
        aside={
          <Link className="text-atlas-green hover:underline" href="/ops/audit">
            Open audit log
          </Link>
        }
        flush
      >
        <Activity items={model.activity} />
      </SectionCard>
    </>
  );
}
