"use client";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { simulateCompetingBid } from "@/components/shell/demo-actions";
import { Button } from "@/components/ui/button";
export function CompetingBid({ listingId }: { listingId: string }) {
  const [state, send, pending] = useActionState(simulateCompetingBid, { status: "idle" }),
    [, start] = useTransition();
  useEffect(() => {
    if (state.status === "success") toast.success(state.data.message);
  }, [state]);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => start(() => send({ listingId }))}
      >
        Simulate competing bid
      </Button>
      <p className="type-body-sm text-ink-muted">Adds a bid from a simulated investor.</p>
      {state.status === "error" && (
        <p role="alert" className="type-body-sm text-danger">
          {state.error.message}
        </p>
      )}
    </div>
  );
}
