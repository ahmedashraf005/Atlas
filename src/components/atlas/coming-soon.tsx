import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/atlas/empty-state";

export function ComingSoon({ page, segment }: { page: string; segment: number }) {
  return (
    <div className="rounded-md border border-line bg-surface">
      <EmptyState
        icon={<Hammer strokeWidth={1.5} aria-hidden />}
        title={page}
        description={`This page is built in segment ${segment}.`}
      />
    </div>
  );
}
