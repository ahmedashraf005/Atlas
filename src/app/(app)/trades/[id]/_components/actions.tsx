"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import * as actions from "@/app/_actions/trades";
import { ConfirmDialog } from "@/components/atlas/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TradeActionKey, TradeActionView } from "@/lib/trade-display";
import type { ActionState } from "@/server/actions/pipeline";
import type { TradeData } from "@/server/actions/trades";

const handlers: Record<
  TradeActionKey,
  (prev: ActionState<TradeData>, input: FormData) => Promise<ActionState<TradeData>>
> = actions;
function useTradeAction(action: TradeActionView) {
  // The next-step button may unmount when the returned server tree advances the trade.
  // Emit the toast from the action completion so it survives that update.
  const [state, dispatch, pending] = useActionState(
    async (prev: ActionState<TradeData>, input: FormData) => {
      const result = await handlers[action.key](prev, input);
      if (result.status === "success") toast.success(result.data.message);
      return result;
    },
    { status: "idle" },
  );
  return { state, dispatch, pending };
}
function ErrorText({ state }: { state: ActionState<TradeData> }) {
  return state.status === "error" ? (
    <p role="alert" className="type-body-sm text-danger">
      {state.error.message}
    </p>
  ) : null;
}
export function TradeActionButton({
  action,
  tradeId,
}: {
  action: TradeActionView;
  tradeId: string;
}) {
  const { state, dispatch, pending } = useTradeAction(action),
    [, start] = useTransition(),
    [open, setOpen] = useState(false);
  if (action.reason)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant={action.variant}
            disabled={pending}
            className={action.tone === "danger" ? "text-danger" : undefined}
          >
            {action.label}
          </Button>
        </DialogTrigger>
        <ReasonContent action={action} tradeId={tradeId} close={() => setOpen(false)} />
      </Dialog>
    );
  return (
    <div className="flex flex-col gap-2">
      <ConfirmDialog
        title={action.title}
        description={action.description}
        confirmLabel={action.confirm}
        tone={action.tone}
        stepUp={action.stepUp}
        trigger={
          <Button variant={action.variant} loading={pending}>
            {action.label}
          </Button>
        }
        onConfirm={() => {
          const form = new FormData();
          form.set("tradeId", tradeId);
          start(() => dispatch(form));
        }}
      />
      <ErrorText state={state} />
    </div>
  );
}
function ReasonContent({
  action,
  tradeId,
  close,
}: {
  action: TradeActionView;
  tradeId: string;
  close: () => void;
}) {
  const { state, dispatch, pending } = useTradeAction(action),
    [reason, setReason] = useState("");
  // Close only after this action succeeds; polling must not close an unfinished reason form.
  useEffect(() => {
    if (state.status === "success") close();
  }, [state, close]);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{action.title}</DialogTitle>
        <DialogDescription>{action.description}</DialogDescription>
      </DialogHeader>
      <form action={dispatch} className="flex flex-col gap-4">
        <input type="hidden" name="tradeId" value={tradeId} />
        <div className="flex flex-col gap-2">
          <Label htmlFor={`reason-${action.key}`}>Reason</Label>
          <Textarea
            id={`reason-${action.key}`}
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            maxLength={1000}
          />
          <p className="type-body-sm text-ink-muted">{reason.length} of 1,000 characters</p>
        </div>
        <ErrorText state={state} />
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant={action.tone} loading={pending} disabled={!reason.trim()}>
            {action.confirm}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
export function TradeMore({ tradeId, items }: { tradeId: string; items: TradeActionView[] }) {
  const [selected, setSelected] = useState<TradeActionView | null>(null);
  if (!items.length) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" aria-label="More trade actions">
            More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.map((action) => (
            <DropdownMenuItem
              key={action.key}
              variant="destructive"
              onSelect={() => setSelected(action)}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected && (
          <ReasonContent
            key={selected.key}
            action={selected}
            tradeId={tradeId}
            close={() => setSelected(null)}
          />
        )}
      </Dialog>
    </>
  );
}
