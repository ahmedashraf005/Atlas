import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-4 rounded-md border border-line bg-surface p-8">
        <h1 className="type-heading-1">Page not found</h1>
        <p className="text-ink-muted">This page doesn't exist in the demo.</p>
        <Button variant="link" asChild>
          <Link href="/">Back to the start</Link>
        </Button>
      </div>
    </main>
  );
}
