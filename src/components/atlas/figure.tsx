import { BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Figure({
  label,
  value,
  caption,
  verifiedHeader,
}: {
  label: string;
  value?: ReactNode;
  caption?: ReactNode;
  verifiedHeader?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-line rounded-md flex flex-col min-w-0",
        verifiedHeader ? "overflow-hidden" : "p-4 gap-1",
      )}
    >
      {verifiedHeader ? (
        <div className="bg-brass-soft text-brass type-label px-4 py-1.5 flex items-center gap-1">
          <BadgeCheck size={14} strokeWidth={1.75} aria-hidden />
          {verifiedHeader}
        </div>
      ) : (
        <div className="type-label text-ink-muted">{label}</div>
      )}
      <div className={cn("flex flex-col gap-1", verifiedHeader && "p-4 pt-2.5")}>
        {value !== undefined && <div className="type-figure-lg">{value}</div>}
        {caption && <div className="type-body-sm text-ink-muted">{caption}</div>}
      </div>
    </div>
  );
}
