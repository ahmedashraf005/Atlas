"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { tamper, verify } from "@/app/_actions/audit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export function VerifyControl() {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        loading={pending}
        onClick={() =>
          start(async () => {
            const result = await verify({ status: "idle" }, {});
            const text =
              result.status === "success"
                ? result.data.message
                : result.status === "error"
                  ? result.error.message
                  : "";
            setMessage(text);
            if (result.status === "success" && result.data.verified) toast.success(text);
            else toast.error(text);
          })
        }
      >
        Verify chain
      </Button>
      <span aria-live="polite" className="type-body-sm">
        {message}
      </span>
    </div>
  );
}
export function TamperControl() {
  const [pending, start] = useTransition(),
    [open, setOpen] = useState(false),
    cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Demo tools</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(e) => {
            if (open) e.preventDefault();
          }}
        >
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}>
            Tamper with an entry…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancel.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Tamper with the audit log?</AlertDialogTitle>
            <AlertDialogDescription>
              This changes one past entry directly in the database, bypassing Atlas, to show that
              verification detects it. Reset the demo to restore a clean chain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={cancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await tamper({ status: "idle" }, {});
                  if (result.status === "success") toast.info(result.data.message);
                  else if (result.status === "error") toast.error(result.error.message);
                })
              }
            >
              Tamper with entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
