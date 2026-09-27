"use client";

import { Menu } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="lg:hidden" variant="ghost" size="icon-sm" aria-label="Open navigation">
          <Menu strokeWidth={1.5} aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-surface-sunken p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Navigate the Atlas demo.</SheetDescription>
        <nav
          aria-label="Mobile"
          className="flex h-full flex-col gap-6 px-4 py-5"
          onClickCapture={(event) => {
            if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false);
          }}
        >
          {children}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
