import { BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";

export function VerifiedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 type-label bg-brass-soft text-brass">
      <BadgeCheck size={14} strokeWidth={1.75} aria-hidden />
      {children}
    </span>
  );
}
export function VerifiedMark({ label = "Verified" }: { label?: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex">
      <BadgeCheck size={14} strokeWidth={1.75} className="text-brass" aria-hidden />
    </span>
  );
}
