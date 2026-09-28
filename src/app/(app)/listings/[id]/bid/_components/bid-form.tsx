"use client";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { v7 } from "uuid";
import { amend, submit, withdraw } from "@/app/_actions/bids";
import { ConfirmDialog } from "@/components/atlas/confirm-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bidMaths } from "@/lib/bid-maths";
import type { BidData } from "@/server/actions/bids";
import type { ActionState } from "@/server/actions/pipeline";
import type { BidComposerModel } from "@/server/read/bids";
export function BidForm({ model: m }: { model: BidComposerModel }) {
  const router = useRouter(),
    [values, setValues] = useState(m.defaults),
    [key] = useState(() => v7()),
    [review, setReview] = useState(false),
    [busy, start] = useTransition();
  const [state, send, pending] = useActionState<ActionState<BidData>, typeof values>(
    (prev, input) =>
      m.bidId
        ? amend(prev, { ...input, bidId: m.bidId })
        : submit(prev, { ...input, listingId: m.id, idempotencyKey: key }),
    { status: "idle" },
  );
  const [withdrawState, remove, removing] = useActionState(withdraw, { status: "idle" });
  const math = bidMaths(values.price, values.quantity, values.minFill, m.currency, m.band);
  useEffect(() => {
    if (state.status === "success") {
      toast.success(m.mode === "amend" ? "Bid updated." : `Bid submitted on ${m.ref}.`);
      router.push("/bids");
    }
  }, [state, m.mode, m.ref, router]);
  useEffect(() => {
    if (withdrawState.status === "success") {
      toast.success("Bid withdrawn.");
      router.push("/bids");
    }
  }, [withdrawState, router]);
  const disabled = busy || pending || removing;
  return (
    <>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          setReview(true);
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="bid-price" className="type-label">
            Price per share ({m.currency})
          </label>
          <Input
            id="bid-price"
            inputMode="decimal"
            required
            value={values.price}
            onChange={(e) => setValues({ ...values, price: e.target.value })}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {(["quantity", "minFill"] as const).map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <label htmlFor={`bid-${field}`} className="type-label">
                {field === "quantity" ? "Quantity" : "Minimum fill"}
              </label>
              <Input
                id={`bid-${field}`}
                inputMode="numeric"
                required
                value={values[field]}
                onChange={(e) => setValues({ ...values, [field]: e.target.value })}
              />
              <p className="type-body-sm text-ink-muted">
                {field === "quantity"
                  ? `Between ${m.minimumQuantity} and ${m.quantity}`
                  : "The least you'll accept if the seller splits the listing."}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="bid-rationale" className="type-label">
            Rationale (optional)
          </label>
          <Textarea
            id="bid-rationale"
            value={values.rationale}
            maxLength={500}
            onChange={(e) => setValues({ ...values, rationale: e.target.value })}
          />
          <p className="type-body-sm text-ink-muted">
            The seller sees this with your bid. Explain how you priced it.{" "}
            <span>{values.rationale.length}/500</span>
          </p>
        </div>
        {math && (
          <div aria-live="polite" className="flex flex-col gap-2 border-t border-line pt-4">
            <p className="type-figure">{math.total}</p>
            {math.comparison && <p className="type-body-sm">{math.comparison}</p>}
            <p className="type-body-sm text-ink-muted">{math.minimum}</p>
          </div>
        )}
        <div className="flex gap-2 bg-info-soft text-info rounded-md p-3 type-body-sm">
          <Info size={16} strokeWidth={1.5} className="shrink-0" aria-hidden />
          <p>
            Bids are binding once the window closes. You can amend or withdraw until {m.closeLabel}.
          </p>
        </div>
        {state.status === "error" && (
          <div role="alert" className="type-body-sm text-danger">
            <p>{state.error.message}</p>
            {state.error.issues?.map((i) => (
              <p key={i.field}>{i.message}</p>
            ))}
          </div>
        )}
        {withdrawState.status === "error" && (
          <p role="alert" className="type-body-sm text-danger">
            {withdrawState.error.message}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={disabled || !math}>
            {m.mode === "amend" ? "Update bid" : "Review bid"}
          </Button>
          {m.bidId && (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="secondary" disabled={disabled}>
                  Withdraw bid
                </Button>
              }
              tone="danger"
              title={`Withdraw your bid on ${m.ref}?`}
              description="You can bid again while the window is open."
              confirmLabel="Withdraw bid"
              onConfirm={() => start(() => remove({ bidId: m.bidId ?? "" }))}
            />
          )}
        </div>
      </form>
      <AlertDialog open={review} onOpenChange={setReview}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {m.mode === "amend" ? "Update your bid?" : "Submit a binding bid?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {math
              ? `${math.price} per share · ${math.quantity} · minimum fill ${math.minFill} · total ${math.totalValue}. Bids are binding once the window closes.`
              : "Enter a valid price and quantity."}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => start(() => send(values))}>
              {m.mode === "amend" ? "Update bid" : "Submit bid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
