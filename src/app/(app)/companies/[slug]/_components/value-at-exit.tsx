"use client";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
export function ValueAtExit({
  steps,
}: {
  steps: { exitLabel: string; classes: { name: string; perShare: string; ratio: number }[] }[];
}) {
  const [index, setIndex] = useState(12),
    step = steps[index];
  if (!step) return null;
  return (
    <div className="flex flex-col gap-4">
      <p className="type-body-sm text-ink-muted">
        Why ordinary shares can trade below the round price: preferred shares are paid first.
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <label htmlFor="exit-slider" className="type-label text-ink-muted">
            Exit valuation
          </label>
          <span className="type-figure">{step.exitLabel}</span>
        </div>
        <Slider
          id="exit-slider"
          aria-label="Exit valuation"
          min={0}
          max={24}
          step={1}
          value={[index]}
          onValueChange={(v) => setIndex(v[0] ?? 12)}
        />
      </div>
      <div className="flex flex-col gap-3 border-t border-line pt-3">
        {step.classes.map((c) => (
          <div key={c.name} className="flex flex-col gap-1">
            <div className="flex justify-between gap-2 type-body-sm">
              <span>{c.name}</span>
              <span className="type-figure">{c.perShare}</span>
            </div>
            <div className="h-2 rounded-sm bg-surface-sunken">
              <div
                className="h-2 rounded-sm bg-atlas-green"
                style={{ width: `${c.ratio * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="type-body-sm text-ink-muted">
        Simplified model: non-participating preferences. Guidance only, not investment advice.
      </p>
    </div>
  );
}
