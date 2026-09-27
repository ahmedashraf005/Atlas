import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <output aria-label="Loading page" className="flex flex-col gap-6">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-4 md:grid-cols-3">
        {["first", "second", "third"].map((key) => (
          <Skeleton key={key} className="h-40" />
        ))}
      </div>
    </output>
  );
}
