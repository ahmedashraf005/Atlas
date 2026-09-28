"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { sendMessage } from "@/app/_actions/trades";
import { SectionCard } from "@/components/atlas/section-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TradeRoomModel } from "@/server/read/trades";
export function Messages({ model }: { model: TradeRoomModel }) {
  const [state, dispatch, pending] = useActionState(sendMessage, { status: "idle" }),
    form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.data.message);
      form.current?.reset();
    }
  }, [state]);
  if (model.messages === null) return null;
  return (
    <SectionCard title="Messages" aside="Seller, buyer and Atlas operations">
      <div className="flex flex-col gap-4">
        {!model.messages.length && (
          <p className="type-body-sm text-ink-muted">
            No messages yet. Keep all communication about this trade here.
          </p>
        )}
        {model.messages.map((m) => (
          <article key={m.id} className="border-b border-line pb-4 flex flex-col gap-2">
            {m.paymentWarning && (
              <p className="rounded-md bg-danger-soft text-danger p-3 type-body-sm">
                Atlas never changes payment details by message. Use only the locked instructions on
                this page.
              </p>
            )}
            <p className="type-title break-words">{m.sender}</p>
            <p className="type-body-sm text-ink-muted">{m.at}</p>
            <p className="type-body whitespace-pre-wrap break-words">{m.body}</p>
            {m.flagged && <p className="type-body-sm text-warning">Contact details removed</p>}
          </article>
        ))}
      </div>
      <form ref={form} action={dispatch} className="flex flex-col gap-3">
        <input type="hidden" name="tradeId" value={model.id} />
        <Label htmlFor="trade-message">Message</Label>
        <Textarea
          name="body"
          id="trade-message"
          required
          minLength={1}
          maxLength={1000}
          disabled={pending}
        />
        <div>
          <Button type="submit" variant="secondary" loading={pending}>
            Send
          </Button>
        </div>
        {state.status === "error" && (
          <p role="alert" className="type-body-sm text-danger">
            {state.error.message}
          </p>
        )}
      </form>
    </SectionCard>
  );
}
