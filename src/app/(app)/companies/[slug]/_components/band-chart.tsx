"use client";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/atlas/empty-state";
export interface ChartModel {
  points: {
    t: number;
    price: number;
    priceLabel: string;
    qty: string;
    label: string;
    date: string;
    position: "inside" | "above" | "below";
  }[];
  ticks: { t: number; label: string }[];
  hidden: boolean;
  band: { low: number; high: number } | null;
  lastRound: number | null;
  lastRoundLabel: string;
  start: number;
  end: number;
  aside: string;
  ariaLabel: string;
}
export function BandChart({ model }: { model: ChartModel }) {
  if (model.hidden) return <EmptyState title="The company limits who can see trade prices." />;
  if (!model.points.length)
    return (
      <EmptyState title="No Atlas trades yet. The fair value shown is an estimate from the last round." />
    );
  const values = model.points
      .map((p) => p.price)
      .concat(model.band ? [model.band.low, model.band.high] : [], model.lastRound ?? []),
    min = Math.min(...values),
    max = Math.max(...values),
    pad = (max - min || max) * 0.08;
  return (
    <>
      <div role="img" aria-label={model.ariaLabel} className="h-64 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={model.points} margin={{ top: 16, right: 14, bottom: 4, left: 2 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              type="number"
              dataKey="t"
              domain={[model.start, model.end]}
              scale="time"
              ticks={model.ticks.map((t) => t.t)}
              tickFormatter={(v) => model.ticks.find((t) => t.t === v)?.label ?? ""}
              tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            />
            <YAxis
              type="number"
              domain={[min - pad, max + pad]}
              tickFormatter={(v) => Number(v).toFixed(2)}
              tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
              width={52}
            />
            {model.band && (
              <ReferenceArea
                y1={model.band.low}
                y2={model.band.high}
                fill="var(--chart-band)"
                fillOpacity={1}
                stroke="none"
              />
            )}
            {model.lastRound !== null && (
              <ReferenceLine
                y={model.lastRound}
                stroke="var(--ink)"
                strokeDasharray="6 4"
                label={{
                  value: model.lastRoundLabel,
                  position: "insideTopRight",
                  fill: "var(--ink-muted)",
                  fontSize: 12,
                }}
              />
            )}
            <Line dataKey="price" stroke="var(--line-strong)" strokeWidth={1} dot={false} />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="rounded-md border border-line bg-surface p-2 shadow-overlay type-body-sm">
                    {String(payload[0].payload.label)}
                  </div>
                ) : null
              }
            />
            <Scatter
              dataKey="price"
              isAnimationActive={false}
              shape={(props: unknown) => {
                const p = props as {
                  cx: number;
                  cy: number;
                  payload: ChartModel["points"][number];
                };
                return (
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={p.payload.position === "inside" ? 5 : 6}
                    fill={
                      p.payload.position === "inside"
                        ? "var(--ink)"
                        : p.payload.position === "above"
                          ? "var(--chart-above)"
                          : "var(--chart-below)"
                    }
                  />
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 type-label text-ink-muted">
        <span>
          <i className="mr-1 inline-block h-2 w-4 bg-chart-band" />
          Fair-value band (25th–75th percentile)
        </span>
        <span>
          <i className="mr-1 inline-block size-2.5 rounded-full bg-ink" />
          Trade inside band
        </span>
        <span>
          <i className="mr-1 inline-block size-2.5 rounded-full bg-chart-above" />
          Above band
        </span>
        <span>
          <i className="mr-1 inline-block size-2.5 rounded-full bg-chart-below" />
          Below band
        </span>
        <span>Related-party trades excluded. Open bids are sealed and never shown.</span>
      </div>
      <table className="sr-only">
        <caption>Atlas trade prices</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Price</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {model.points.map((p) => (
            <tr key={p.t}>
              <td>{p.date}</td>
              <td>{p.priceLabel}</td>
              <td>{p.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
