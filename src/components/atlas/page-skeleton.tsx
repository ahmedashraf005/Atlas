import { Skeleton } from "@/components/ui/skeleton";
export function PageSkeleton() {
  return (
    <output aria-label="Loading page" className="flex w-full flex-col gap-6">
      <Skeleton className="h-10 w-56 max-w-full" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {["one", "two", "three", "four"].map((k) => (
          <Skeleton key={k} className="h-28" />
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
        {["first", "second", "third", "fourth"].map((k) => (
          <Skeleton key={k} className="h-10" />
        ))}
      </div>
    </output>
  );
}
