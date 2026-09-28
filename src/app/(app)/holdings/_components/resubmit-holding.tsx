"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { resubmitHolding } from "@/app/_actions/holdings";
import { Button } from "@/components/ui/button";
export function ResubmitHolding({ holdingId }: { holdingId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await resubmitHolding({ status: "idle" }, { holdingId });
          if (result.status === "error") toast.error(result.error.message);
          else toast.success("Holding submitted. The company is verifying it.");
        })
      }
    >
      Resubmit
    </Button>
  );
}
