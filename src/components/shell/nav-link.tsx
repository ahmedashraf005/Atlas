"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function NavLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 type-body text-ink hover:bg-surface",
        active && "bg-atlas-green-soft font-semibold",
      )}
    >
      <span className={cn("[&_svg]:size-5", active ? "text-atlas-green" : "text-ink-muted")}>
        {icon}
      </span>
      {label}
    </Link>
  );
}
