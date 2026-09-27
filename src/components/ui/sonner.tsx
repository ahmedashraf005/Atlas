"use client";
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster({ theme = "light", ...props }: ToasterProps) {
  return (
    <Sonner
      {...props}
      theme={theme}
      icons={{
        success: <CircleCheck className="size-4 text-success" strokeWidth={1.5} />,
        info: <Info className="size-4 text-info" strokeWidth={1.5} />,
        warning: <TriangleAlert className="size-4 text-warning" strokeWidth={1.5} />,
        error: <OctagonX className="size-4 text-danger" strokeWidth={1.5} />,
        loading: <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 p-4 w-full bg-surface border border-line text-ink shadow-overlay rounded-md type-body-sm",
          description: "text-ink-muted",
          actionButton: "bg-atlas-green text-on-green rounded-sm px-2 py-1",
          cancelButton: "bg-surface-sunken text-ink rounded-sm px-2 py-1",
          closeButton: "bg-surface border border-line text-ink rounded-sm",
        },
      }}
    />
  );
}
