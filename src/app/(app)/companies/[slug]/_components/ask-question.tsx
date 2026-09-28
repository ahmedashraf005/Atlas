"use client";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { askQuestion } from "@/app/_actions/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QuestionData } from "@/server/actions/company";
import type { ActionState } from "@/server/actions/pipeline";
export function AskQuestion({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState<ActionState<QuestionData>, FormData>(
    askQuestion,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "success") toast.success(state.data.message);
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <div className="flex gap-2">
        <label htmlFor="ask-company" className="sr-only">
          Ask the company a question
        </label>
        <Input
          id="ask-company"
          name="question"
          placeholder="Ask the company a question"
          maxLength={500}
          required
        />
        <Button type="submit" variant="secondary" disabled={pending} loading={pending}>
          Ask
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="type-body-sm text-danger">
          {state.error.message}
        </p>
      )}
    </form>
  );
}
