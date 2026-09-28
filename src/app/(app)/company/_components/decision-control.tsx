"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import * as company from "@/app/_actions/company-console";
import * as ops from "@/app/_actions/ops";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConsoleData } from "@/server/actions/company-console";
import type { ActionState } from "@/server/actions/pipeline";

const handlers = {
  verifyHolding: company.verifyHolding,
  rejectHolding: company.rejectHolding,
  decideAccess: company.decideAccessAction,
  approveListing: ops.approveListing,
  rejectListing: ops.rejectListing,
};
export function DecisionControl({
  action,
  values,
  label,
  primary = false,
  confirmation,
  reason = false,
  disabled = false,
}: {
  action: keyof typeof handlers;
  values: Record<string, string>;
  label: string;
  primary?: boolean;
  confirmation?: string;
  reason?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [, start] = useTransition();
  const [state, dispatch, pending] = useActionState(
    async (_prev: ActionState<ConsoleData>, data: FormData): Promise<ActionState<ConsoleData>> => {
      const result = await handlers[action]({ status: "idle" }, data);
      if (result.status === "success") {
        toast.success(result.data.message);
        setOpen(false);
      }
      return result;
    },
    { status: "idle" },
  );
  const error =
    state.status === "error" ? (
      <p role="alert" className="type-body-sm text-danger">
        {state.error.message}
        {state.error.failures?.map((f) => ` ${f.message}`).join("")}
      </p>
    ) : null;
  const submit = () => {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    start(() => dispatch(data));
  };
  const button = (
    <Button
      variant={reason ? "link" : primary ? "primary" : "secondary"}
      size="sm"
      loading={pending}
      disabled={disabled}
    >
      {label}
    </Button>
  );
  if (disabled)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{button}</span>
        </TooltipTrigger>
        <TooltipContent>This buyer doesn't meet your transfer policy.</TooltipContent>
      </Tooltip>
    );
  if (reason)
    return (
      <div className="flex flex-col gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>{button}</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>
                Give a reason. It is recorded and shown to the shareholder.
              </DialogDescription>
            </DialogHeader>
            <ReasonForm
              values={values}
              dispatch={dispatch}
              pending={pending}
              error={error}
              label={label}
              close={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      {confirmation ? (
        <ConfirmDialog
          trigger={button}
          title={confirmation}
          description={confirmation}
          confirmLabel={label}
          onConfirm={submit}
        />
      ) : (
        <Button
          variant={primary ? "primary" : "secondary"}
          size="sm"
          loading={pending}
          onClick={submit}
        >
          {label}
        </Button>
      )}
      {error}
    </div>
  );
}
function ReasonForm({
  values,
  dispatch,
  pending,
  error,
  label,
  close,
}: {
  values: Record<string, string>;
  dispatch: (data: FormData) => void;
  pending: boolean;
  error: React.ReactNode;
  label: string;
  close: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <form action={dispatch} className="flex flex-col gap-4">
      {Object.entries(values).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <Label htmlFor="console-reason">Reason</Label>
      <Textarea
        id="console-reason"
        name="reason"
        required
        maxLength={1000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error}
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button variant="danger" loading={pending} disabled={!reason.trim()}>
          {label}
        </Button>
      </DialogFooter>
    </form>
  );
}
export function AnswerForm({ questionId, primary }: { questionId: string; primary: boolean }) {
  const [text, setText] = useState("");
  const [state, dispatch, pending] = useActionState(
    async (_prev: ActionState<ConsoleData>, input: FormData): Promise<ActionState<ConsoleData>> => {
      const result = await company.answerQuestion({ status: "idle" }, input);
      if (result.status === "success") toast.success(result.data.message);
      return result;
    },
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "success") setText("");
  }, [state]);
  return (
    <form action={dispatch} className="flex w-full flex-col gap-2">
      <input type="hidden" name="questionId" value={questionId} />
      <Label htmlFor={`answer-${questionId}`}>Answer</Label>
      <Textarea
        id={`answer-${questionId}`}
        name="answer"
        required
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {state.status === "error" && (
        <p role="alert" className="type-body-sm text-danger">
          {state.error.message}
        </p>
      )}
      <Button
        type="submit"
        variant={primary ? "primary" : "secondary"}
        size="sm"
        className="self-start"
        loading={pending}
        disabled={!text.trim()}
      >
        Publish answer
      </Button>
    </form>
  );
}
