"use client";
import Link from "next/link";
import { Deadline } from "@/components/atlas/deadline";
import { EmptyState } from "@/components/atlas/empty-state";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TradesModel } from "@/server/read/trades";
export function TradesList({ model }: { model: TradesModel }) {
  return (
    <Tabs defaultValue="progress">
      <TabsList aria-label="Trade history">
        <TabsTrigger value="progress">In progress</TabsTrigger>
        <TabsTrigger value="completed">Completed</TabsTrigger>
      </TabsList>
      {(["progress", "completed"] as const).map((tab) => {
        const rows = model.rows.filter((r) => r.completed === (tab === "completed"));
        return (
          <TabsContent key={tab} value={tab}>
            <SectionCard
              title={tab === "progress" ? "Trades in progress" : "Completed trades"}
              flush
            >
              {!rows.length ? (
                <EmptyState
                  title={tab === "progress" ? "No trades in progress." : "No completed trades yet."}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full type-body-sm">
                    <thead className="bg-surface-sunken text-ink-muted type-label">
                      <tr>
                        {[
                          "Trade",
                          "Company",
                          "Counterparty",
                          "Quantity",
                          "Price",
                          "Total",
                          "Status",
                          "Next deadline",
                        ].map((h) => (
                          <th key={h} className="px-5 py-3 text-left whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t border-line">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <Link
                              href={r.href}
                              className="font-semibold text-atlas-green hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
                            >
                              {r.ref}
                            </Link>
                            <p className="text-ink-muted">{r.listing}</p>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {r.company}
                            <p className="text-ink-muted">{r.shareClass}</p>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">{r.counterparty}</td>
                          {[r.quantity, r.price, r.total].map((v, i) => (
                            <td
                              key={["qty", "price", "total"][i]}
                              className="px-5 py-4 text-right whitespace-nowrap"
                            >
                              {v}
                            </td>
                          ))}
                          <td className="px-5 py-4">
                            <div className="flex flex-col items-start gap-1 whitespace-nowrap">
                              <StatusBadge tone={r.badge.tone}>{r.badge.text}</StatusBadge>
                              {r.yourMove && <StatusBadge tone="warning">Your move</StatusBadge>}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {r.deadline ? <Deadline at={r.deadline} now={model.now} /> : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
