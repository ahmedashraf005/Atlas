"use client";
import Link from "next/link";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { acceptCounter, declineCounter } from "@/app/_actions/bids";
import { ConfirmDialog } from "@/components/atlas/confirm-dialog";
import { Deadline } from "@/components/atlas/deadline";
import { EmptyState } from "@/components/atlas/empty-state";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MyBidsModel } from "@/server/read/bids";

function CounterCard({ row, primary }: { row: MyBidsModel["rows"][number]; primary: boolean }) {
  const [state, accept, pending] = useActionState(acceptCounter, { status: "idle" }),
    [declined, decline, busy] = useActionState(declineCounter, { status: "idle" }),
    [, start] = useTransition();
  useEffect(() => {
    for (const s of [state, declined])
      if (s.status === "success")
        toast.success(
          s === state
            ? "Counter accepted. The seller decides next."
            : "Counter declined. Your original bid stands.",
        );
  }, [state, declined]);
  if (!row.counter) return null;
  return (
    <SectionCard
      title={row.counter.title}
      aside={<StatusBadge tone="warning">Your move</StatusBadge>}
    >
      <p className="type-body">{row.counter.description}</p>
      <div className="flex flex-wrap gap-3">
        <ConfirmDialog
          trigger={
            <Button variant={primary ? "primary" : "secondary"} disabled={pending || busy}>
              Accept {row.counter.price}
            </Button>
          }
          title="Accept the counter?"
          description={`Your bid becomes ${row.counter.price} per share and stays binding. The seller then decides whether to accept it.`}
          confirmLabel="Accept counter"
          onConfirm={() => start(() => accept({ bidId: row.id }))}
        />
        <ConfirmDialog
          trigger={
            <Button variant="secondary" disabled={pending || busy}>
              Decline
            </Button>
          }
          title="Decline the counter?"
          description={`Your original bid of ${row.counter.originalPrice} stands.`}
          confirmLabel="Decline counter"
          onConfirm={() => start(() => decline({ bidId: row.id }))}
        />
      </div>
      {[state, declined].map((s, i) =>
        s.status === "error" ? (
          <p key={i === 0 ? "accept" : "decline"} role="alert" className="type-body-sm text-danger">
            {s.error.message}
          </p>
        ) : null,
      )}
    </SectionCard>
  );
}
export function MyBids({ model: m }: { model: MyBidsModel }) {
  return (
    <>
      <div className="flex flex-col gap-6">
        {m.counters.map((r, i) => (
          <CounterCard key={r.id} row={r} primary={i === 0} />
        ))}
      </div>
      <Tabs defaultValue="active">
        <TabsList aria-label="Bid history">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
        {(["active", "past"] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <SectionCard title={tab === "active" ? "Active bids" : "Past bids"} flush>
              {!m.rows.some((r) => r.active === (tab === "active")) ? (
                <EmptyState title={tab === "active" ? "No active bids." : "No past bids yet."} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full type-body-sm">
                    <thead className="bg-surface-sunken text-ink-muted type-label">
                      <tr>
                        {[
                          "Listing",
                          "Price",
                          "Quantity",
                          "Min fill",
                          "Total",
                          "Window",
                          "Status",
                          "Action",
                        ].map((h) => (
                          <th key={h} className="px-5 py-3 text-left whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {m.rows
                        .filter((r) => r.active === (tab === "active"))
                        .map((r) => (
                          <tr key={r.id} className="border-t border-line">
                            <td className="px-5 py-4">
                              <Link
                                href={r.listingHref}
                                className="font-semibold text-atlas-green hover:underline"
                              >
                                {r.ref}
                              </Link>
                              <p className="text-ink-muted whitespace-nowrap">{r.company}</p>
                            </td>
                            {[r.price, r.quantity, r.minFill, r.total].map((value, i) => (
                              <td
                                key={["price", "quantity", "min", "total"][i]}
                                className="px-5 py-4 whitespace-nowrap text-right"
                              >
                                {value}
                              </td>
                            ))}
                            <td className="px-5 py-4 whitespace-nowrap">
                              {r.closesAt ? (
                                <Deadline at={r.closesAt} now={m.now} />
                              ) : (
                                r.closedLabel
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <TooltipProvider>
                                <div className="flex flex-col gap-1 whitespace-nowrap">
                                  {r.badges.map((b) =>
                                    b.tooltip ? (
                                      <Tooltip key={b.text}>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className="focus-visible:outline-2 focus-visible:outline-focus-ring"
                                          >
                                            <StatusBadge tone={b.tone}>{b.text}</StatusBadge>
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>{b.tooltip}</TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <StatusBadge key={b.text} tone={b.tone}>
                                        {b.text}
                                      </StatusBadge>
                                    ),
                                  )}
                                </div>
                              </TooltipProvider>
                            </td>
                            <td className="px-5 py-4">
                              {r.action && (
                                <Button asChild variant="secondary" size="sm">
                                  <Link href={r.action.href}>{r.action.label}</Link>
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
