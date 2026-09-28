"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptSelected, counter, declineAll } from "@/app/_actions/listings";
import { ConfirmDialog } from "@/components/atlas/confirm-dialog";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { allocationPreview, bidMaths } from "@/lib/bid-maths";
import { formatMoney, formatShares } from "@/lib/format";
import type { ListingModel } from "@/server/read/listing";

function Counter({ row, model: m }: { row: ListingModel["ladder"][number]; model: ListingModel }) {
  const [price, setPrice] = useState(
      `${BigInt(row.counterDefault) / 100n}.${(BigInt(row.counterDefault) % 100n).toString().padStart(2, "0")}`,
    ),
    [open, setOpen] = useState(false),
    [state, send, pending] = useActionState(counter, { status: "idle" }),
    [, start] = useTransition(),
    math = bidMaths(price, row.quantityRaw, row.minFillRaw, m.currency, null);
  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
      toast.success("Counter sent. The buyer has 48 hours to respond.");
    }
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Counter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Counter {row.handle}'s bid</DialogTitle>
          <DialogDescription>
            Must be above their bid of {row.price}. They have 48 hours to respond.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(() => send({ listingId: m.id, bidId: row.id, price }));
          }}
        >
          <label htmlFor={`counter-${row.id}`} className="type-label">
            Price per share ({m.currency})
          </label>
          <Input
            id={`counter-${row.id}`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            required
          />
          {math && <p className="type-figure">{math.total}</p>}
          {state.status === "error" && (
            <p role="alert" className="type-body-sm text-danger">
              {state.error.message}
            </p>
          )}
          <Button type="submit" disabled={pending || !math}>
            Send counter
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function BidLadder({ model: m }: { model: ListingModel }) {
  const [selected, setSelected] = useState<string[]>([]),
    [backup, setBackup] = useState<string | null>(null),
    [state, accept, pending] = useActionState(acceptSelected, { status: "idle" }),
    [declined, decline, busy] = useActionState(declineAll, { status: "idle" }),
    [, start] = useTransition();
  const selectedRows = m.ladder.filter((b) => selected.includes(b.id) && b.selectable),
    preview = allocationPreview(m.quantityRaw, selectedRows, m.currency),
    unselected = m.ladder.filter((b) => b.selectable && !selected.includes(b.id));
  useEffect(() => {
    if (state.status === "success") {
      toast.success(
        `Accepted ${state.data.count} bids. Trades ${state.data.refs.join(", ")} created.`,
      );
      setSelected([]);
    }
  }, [state]);
  useEffect(() => {
    if (declined.status === "success")
      toast.success("All bids declined. Your shares are available again.");
  }, [declined]);
  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
    if (backup === id) setBackup(null);
  };
  return (
    <>
      <p className={`type-body-sm ${m.decisionWarning ? "text-warning" : "text-ink-muted"}`}>
        {m.decisionLabel}
      </p>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard title="Bids" aside={`${m.countersLeft} of 3 counters left`} flush>
          <TooltipProvider>
            <div className="overflow-x-auto">
              <table className="w-full type-body-sm">
                <thead className="bg-surface-sunken type-label text-ink-muted">
                  <tr>
                    {[
                      "Select",
                      "Rank",
                      "Buyer",
                      "Price",
                      "Quantity / Min fill",
                      "Total",
                      "Rationale",
                      "Status",
                      "Action",
                    ].map((h) => (
                      <th key={h} className="px-4 py-3 text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.ladder.map((b) => (
                    <tr key={b.id} className="border-t border-line">
                      <td className="px-4 py-4">
                        {b.selectable && (
                          <Checkbox
                            aria-label={`Select bid from ${b.handle}`}
                            checked={selected.includes(b.id)}
                            onCheckedChange={(v) => toggle(b.id, v === true)}
                          />
                        )}
                      </td>
                      <td className="px-4 py-4">{b.rank}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="font-semibold">{b.handle}</p>
                        <StatusBadge tone="neutral">{b.certainty}</StatusBadge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p>{b.price}</p>
                        <p className={`type-body-sm ${b.bandTone}`}>{b.bandLabel}</p>
                        {b.belowReserve && (
                          <p className="type-body-sm text-warning">Below your reserve</p>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {b.quantity} / {b.minFill}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">{b.total}</td>
                      <td className="px-4 py-4">
                        {b.rationale ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="block max-w-40 truncate focus-visible:outline-2 focus-visible:outline-focus-ring"
                              >
                                {b.rationale}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">{b.rationale}</TooltipContent>
                          </Tooltip>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {b.badges.map((badge) =>
                            badge.tooltip ? (
                              <Tooltip key={badge.text}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="focus-visible:outline-2 focus-visible:outline-focus-ring"
                                  >
                                    <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>{badge.tooltip}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <StatusBadge key={badge.text} tone={badge.tone}>
                                {badge.text}
                              </StatusBadge>
                            ),
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">{b.canCounter && <Counter row={b} model={m} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TooltipProvider>
          {m.ladder.length === 0 && (
            <p className="px-5 pb-5 type-body-sm text-ink-muted">No submitted bids to review.</p>
          )}
        </SectionCard>
        {m.editable && (
          <SectionCard title="Accept bids">
            <div aria-live="polite" className="flex flex-col gap-3 type-body-sm">
              {preview.result.allocations.map((a) => {
                const b = m.ladder.find((b) => b.id === a.bidId);
                return (
                  <p key={a.bidId}>
                    {b?.handle}: {formatShares(a.qty, "table")} at{" "}
                    {formatMoney(a.priceMinor, m.currency, "perShare")}
                  </p>
                );
              })}
              {preview.result.skipped.map((s) => {
                const b = m.ladder.find((b) => b.id === s.bidId);
                return (
                  <p key={s.bidId} className="text-warning">
                    {b?.handle}: Minimum fill {b?.minFill} can't be met with {preview.remaining}{" "}
                    left
                  </p>
                );
              })}
              <p className="font-semibold">
                Allocated {preview.allocated} of {m.quantity}
              </p>
              {preview.result.remainingQty > 0n && <p>Released back to you {preview.remaining}</p>}
              <p className="type-figure">Proceeds {preview.total}</p>
              <p>Average price {preview.average}</p>
            </div>
            <fieldset className="flex flex-col gap-3 type-body-sm">
              <legend className="type-label mb-2">Keep as backup</legend>
              <p className="text-ink-muted">
                If a buyer doesn't pay, the backup buyer is offered their shares.
              </p>
              {[{ id: "", handle: "None" }, ...unselected].map((b) => (
                <label key={b.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="backup"
                    value={b.id}
                    checked={(backup ?? "") === b.id}
                    onChange={() => setBackup(b.id || null)}
                    className="accent-atlas-green focus-visible:outline-2 focus-visible:outline-focus-ring"
                  />
                  {b.handle}
                </label>
              ))}
            </fieldset>
            <ConfirmDialog
              trigger={
                <Button disabled={pending || busy || preview.result.allocations.length === 0}>
                  Accept selected bids
                </Button>
              }
              title={`Accept ${preview.result.allocations.length} bids?`}
              description={`Trades are created for ${preview.allocated}, total ${preview.total}. ${m.company} then has ${m.rofrDays} days to decide on its right of first refusal. You can't undo this.`}
              confirmLabel="Accept bids"
              onConfirm={() =>
                start(() =>
                  accept({
                    listingId: m.id,
                    bidIds: selectedRows.map((b) => b.id),
                    backupBidId: backup,
                  }),
                )
              }
            />
            <ConfirmDialog
              trigger={
                <Button variant="danger" disabled={pending || busy}>
                  Decline all bids
                </Button>
              }
              tone="danger"
              title="Decline every bid?"
              description={`The listing ends and your ${m.quantityProse} become available again.`}
              confirmLabel="Decline all bids"
              onConfirm={() => start(() => decline({ listingId: m.id }))}
            />
            {[state, declined].map((s, i) =>
              s.status === "error" ? (
                <p
                  key={i === 0 ? "accept" : "decline"}
                  role="alert"
                  className="type-body-sm text-danger"
                >
                  {s.error.message}
                </p>
              ) : null,
            )}
          </SectionCard>
        )}
      </div>
    </>
  );
}
