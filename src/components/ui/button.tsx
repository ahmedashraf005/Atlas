"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  {
    variants: {
      variant: {
        primary: "bg-atlas-green text-on-green hover:bg-atlas-green-strong",
        secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-sunken",
        ghost: "text-ink hover:bg-surface-sunken",
        danger: "bg-danger text-paper hover:opacity-90",
        link: "text-atlas-green underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 type-body-sm font-medium",
        md: "h-10 px-4 type-body font-medium",
        "icon-sm": "size-8",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  loading = false,
  disabled,
  children,
  onClick,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  const inactive = disabled || loading;
  return (
    <Comp
      {...props}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size }),
        variant === "link" && "h-auto px-0",
        asChild && inactive && "pointer-events-none opacity-50",
        className,
      )}
      disabled={inactive}
      aria-busy={loading ? "true" : undefined}
      aria-disabled={asChild && inactive ? true : undefined}
      tabIndex={asChild && inactive ? -1 : props.tabIndex}
      onClick={inactive ? (event) => event.preventDefault() : onClick}
    >
      {loading && <Loader2 className="animate-spin" strokeWidth={1.5} aria-hidden />}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
}
export { Button, buttonVariants };
