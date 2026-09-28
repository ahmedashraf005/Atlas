"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { withdrawListing } from "@/app/_actions/holdings";
import { ConfirmDialog } from "@/components/atlas/confirm-dialog";
import { Button } from "@/components/ui/button";
export function WithdrawListing({
  listingId,
  listingRef,
  quantity,
}: {
  listingId: string;
  listingRef: string;
  quantity: string;
}) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      tone="danger"
      title={`Withdraw ${listingRef}?`}
      description={`Any bids are rejected and your ${quantity} become available again. You can't undo this.`}
      confirmLabel="Withdraw listing"
      trigger={
        <Button variant="secondary" size="sm" disabled={pending}>
          Withdraw
        </Button>
      }
      onConfirm={() =>
        start(async () => {
          const result = await withdrawListing({ status: "idle" }, { listingId });
          if (result.status === "error") toast.error(result.error.message);
          else toast.success(`Listing ${listingRef} withdrawn.`);
        })
      }
    />
  );
}
