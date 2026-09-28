"use client";
import { Circle, CircleCheck, CircleX } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { Deadline } from "@/components/atlas/deadline";
import { SectionCard } from "@/components/atlas/section-card";
import type { TimelineStep } from "@/server/read/trades";
export function Timeline({ steps, now }: { steps: TimelineStep[]; now: string }) {
  const reduced = useReducedMotion(),
    previous = useRef(new Map(steps.map((s) => [s.key, s.state])));
  useEffect(() => {
    previous.current = new Map(steps.map((s) => [s.key, s.state]));
  }, [steps]);
  return (
    <SectionCard title="Timeline">
      <ol className="flex flex-col gap-5">
        {steps.map((s) => {
          const newlyDone = s.state === "done" && previous.current.get(s.key) !== "done",
            Icon = s.state === "done" ? CircleCheck : s.state === "stopped" ? CircleX : Circle,
            color =
              s.state === "upcoming"
                ? "text-line-strong"
                : s.tone === "success"
                  ? "text-success"
                  : s.tone === "warning"
                    ? "text-warning"
                    : s.tone === "info"
                      ? "text-info"
                      : s.tone === "danger"
                        ? "text-danger"
                        : "text-ink-muted";
          return (
            <motion.li
              key={s.key}
              data-step={s.key}
              data-state={s.state}
              initial={false}
              animate={
                !reduced && newlyDone ? { opacity: [0, 1], y: [4, 0] } : { opacity: 1, y: 0 }
              }
              transition={{ duration: reduced ? 0 : 0.15 }}
              className="flex items-start gap-3"
            >
              <Icon
                size={20}
                strokeWidth={1.5}
                aria-hidden
                className={`${color} shrink-0 mt-0.5`}
              />
              <div className="min-w-0 flex flex-col gap-1">
                <h3
                  className={`type-title ${s.state === "upcoming" ? "text-ink-muted" : "text-ink"}`}
                >
                  {s.title}
                </h3>
                {s.details.map((detail) => (
                  <p key={detail} className="type-body-sm text-ink-muted break-words">
                    {detail}
                  </p>
                ))}
                {s.waiting && <p className="type-body-sm text-ink-muted">Waiting on {s.waiting}</p>}
                {s.deadline && (
                  <p className="type-body-sm">
                    <Deadline at={s.deadline} now={now} />
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
