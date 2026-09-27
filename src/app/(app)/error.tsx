"use client";
import Link from "next/link";
import { SectionCard } from "@/components/atlas/section-card";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionCard title="Something went wrong">
      <p>The page failed to load. Try again, or go back to the start.</p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
        <Button variant="link" asChild>
          <Link href="/">Back to the start</Link>
        </Button>
      </div>
      {error.digest && <p className="type-mono text-ink-muted">{error.digest}</p>}
    </SectionCard>
  );
}
