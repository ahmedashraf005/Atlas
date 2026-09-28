"use client";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  stepUp = false,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  stepUp?: boolean;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [verifying, setVerifying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!verifying) setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancel.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {stepUp && (
            <p className="type-body-sm text-ink-muted">
              Simulated step-up check. In production this uses your device passkey.
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancel} disabled={verifying}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={tone}
            disabled={verifying}
            onClick={(event) => {
              if (!stepUp) {
                onConfirm();
                return;
              }
              event.preventDefault();
              setVerifying(true);
              timer.current = setTimeout(() => {
                onConfirm();
                setVerifying(false);
                setOpen(false);
              }, 800);
            }}
          >
            <span aria-live="polite" className="inline-flex items-center gap-2">
              {verifying && (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" aria-hidden />
              )}
              {verifying ? "Verifying passkey…" : stepUp ? "Confirm with passkey" : confirmLabel}
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
