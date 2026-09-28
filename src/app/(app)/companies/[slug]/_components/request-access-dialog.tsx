"use client";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { requestAccess } from "@/app/_actions/company";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AccessData } from "@/server/actions/company";
import type { ActionState } from "@/server/actions/pipeline";

const clauses = [
  "You'll keep the information confidential and use it only to evaluate a purchase on Atlas.",
  "Documents are watermarked with your identity and every view is attributable to you.",
  "You won't contact the company's employees or shareholders outside Atlas about this sale.",
  "The company may withdraw access at any time.",
];
export function RequestAccessDialog({
  company,
  companyId,
  variant = "primary",
}: {
  company: string;
  companyId: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false),
    [checked, setChecked] = useState(false);
  const [state, action, pending] = useActionState<ActionState<AccessData>, FormData>(
    requestAccess,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
      toast.success("Access requested. Awaiting company approval.");
    }
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>Request access</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request access to {company}</DialogTitle>
          <DialogDescription>
            Read and accept the NDA to ask for the company's information.
          </DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 type-body-sm">
          {clauses.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="ndaVersion" value="v1" />
          <input type="hidden" name="accepted" value={checked ? "true" : "false"} />
          <label htmlFor="nda-agreement" className="flex items-center gap-2 type-body-sm">
            <Checkbox
              id="nda-agreement"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            I agree to the NDA (version v1)
          </label>
          {state.status === "error" && (
            <p role="alert" className="type-body-sm text-danger">
              {state.error.message}
            </p>
          )}
          <Button type="submit" disabled={!checked || pending} loading={pending}>
            Accept NDA and request access
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
