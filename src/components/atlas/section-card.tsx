import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  aside,
  children,
  flush = false,
  id,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 bg-surface border border-line rounded-md",
        !flush && "p-5 flex flex-col gap-4",
      )}
    >
      <div
        className={cn("flex flex-wrap items-baseline justify-between gap-3", flush && "px-5 py-4")}
      >
        <h2 className="type-heading-2">{title}</h2>
        {aside && <div className="type-body-sm text-ink-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
